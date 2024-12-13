import io
import sys
import os
import json
import re
import argparse
import utils
import requirements
import pipfile
import codecs
from operator import le, lt, gt, ge, eq, ne
from constants import DepsManager

import pkg_resources

PYTHON_MARKER_REGEX = re.compile(r'python_version\s*('
                                 r'?P<operator>==|<=|>=|>|<)\s*[\'"]('
                                 r'?P<python_version>.+?)[\'"]')
SYSTEM_MARKER_REGEX = re.compile(r'sys_platform\s*==\s*[\'"](.+)[\'"]')
DEPENDENCIES = 'dependencies'
VERSION = 'version'
NAME = 'name'
DIR_VERSION = '0.0.0'
PACKAGE_FORMAT_VERSION = 'packageFormatVersion'
LABELS = 'labels'
PROVENANCE = 'provenance'
PKG_ID_PROVENANCE = 'pkgIdProvenance'
NUMBER_OF_BYTES = 4

# Declaring deps manager as global variable
deps_manager = None


def format_provenance_label(prov_tuple):
    fn, ln1, ln2 = prov_tuple
    if ln1 == ln2:
        return fn + ':' + str(ln1)
    else:
        return fn + ':' + str(ln1) + '-' + str(ln2)


def create_tree_of_packages_dependencies(
        dist_tree,
        top_level_requirements,
        optional_dependencies,
        req_file_path,
        allow_missing=False,
        only_provenance=False,
        top_level_provenance_map={},
):
    """Creates the dependency tree for the project.

    Args:
        dist_tree (dict): Packages tree based on the dependencies from the venv
        top_level_requirements (list): Packages from the requirements files
        optional_dependencies (list): Optional dependencies that are introduced
            by optional dependencies/arbitrary identifiers
        req_file_path (str): The path to the dependencies file (e.g. Pipfile)
        allow_missing (bool, optional): Allow dependency tree creation if some
            packages are missing from the venv.
        only_provenance (bool, optional):label only present for the top-level nodes

    Returns:
        dict: If the dependency tree was created successfully.
        None: If some package is missing from the venv.
    """
    tree = utils.sorted_tree(dist_tree)
    nodes = tree.keys()
    key_tree = dict(
        (canonicalize_package_name(k.key), v) for k, v in tree.items()
    )
    
    tree_provenance_map = dict(
        (canonicalize_package_name(k.key), k.key) for k, _ in tree.items()
    )
    tree_provenance_map.update(top_level_provenance_map)

    lowercase_pkgs_names = [p.name.lower() for p in top_level_requirements]
    tlr_by_key = dict((tlr.name.lower(), tlr) for tlr in top_level_requirements)
    packages_as_dist_obj = [
        p for p in nodes if
        p.key.lower() in lowercase_pkgs_names or
        (p.project_name and p.project_name.lower()) in lowercase_pkgs_names]

    # Add the discovered optional dependencies to the packages that we need to
    # create the dependency tree for
    if optional_dependencies:
        packages_as_dist_obj.extend(optional_dependencies)

    def create_children_recursive(
            root_package,
            key_tree,
            ancestors,
            all_packages_map,
            provenance_map,
    ):
        root_name = canonicalize_package_name(root_package[NAME])

        # Checks if there is a circular dependency within the packages.
        # Circular package example: apache.airflow and
        if root_name in ancestors:
            return root_package

        if root_name not in key_tree:
            msg = 'Required packages missing: ' + root_name
            if allow_missing:
                sys.stderr.write(msg + "\n")
                return
            else:
                sys.exit(msg)

        if provenance_map[root_name] != root_package[NAME]:
            if LABELS in root_package:
                root_package[LABELS][PKG_ID_PROVENANCE] = "{}@{}".format(provenance_map[root_name],root_package[VERSION])
            else:
                root_package[LABELS] = {
                    PKG_ID_PROVENANCE: "{}@{}".format(provenance_map[root_name],root_package[VERSION])
                }

        ancestors = ancestors.copy()
        ancestors.add(root_name)
        children_packages_as_dist = key_tree[root_name]

        for child_dist in children_packages_as_dist:
            child_project_name = child_dist.project_name.lower()

            if child_project_name in ancestors:
                continue

            if DEPENDENCIES not in root_package:
                root_package[DEPENDENCIES] = {}

            if child_project_name in root_package[DEPENDENCIES]:
                continue

            if child_project_name in all_packages_map and child_project_name not in root_package[DEPENDENCIES]:
                root_package[DEPENDENCIES][child_project_name] = 'true'
                continue

            child_package = {
                NAME: child_project_name,
                VERSION: child_dist.installed_version
            }

            create_children_recursive(child_package, key_tree, ancestors, all_packages_map, provenance_map)
            root_package[DEPENDENCIES][child_project_name] = child_package
            all_packages_map[child_project_name] = 'true'
        return root_package

    def create_dir_as_root():
        name, version = None, None
        if os.path.basename(req_file_path) == 'setup.py':
            import setup_file
            with open(req_file_path, "r") as setup_py_file:
                name, version = setup_file.parse_name_and_version(setup_py_file.read())

        dir_as_root = {
            NAME: name or os.path.basename(os.path.dirname(os.path.abspath(req_file_path))),
            VERSION: version or DIR_VERSION,
            DEPENDENCIES: {},
            PACKAGE_FORMAT_VERSION: 'pip:0.0.1'
        }
        return dir_as_root

    def create_package_as_root(package):
        package_as_root = {
            NAME: package.project_name.lower(),
            # Note: _version is a private field.
            VERSION: package._obj._version,
        }
        return package_as_root

    dir_as_root = create_dir_as_root()
    all_packages_map = {}

    for package in packages_as_dist_obj:
        package_as_root = create_package_as_root(package)
        if only_provenance and package_as_root.get(NAME) in dir_as_root.get(DEPENDENCIES):
            package_as_root[LABELS] = {PROVENANCE: format_provenance_label(
                tlr_by_key[package_as_root[NAME]].provenance)}
            dir_as_root[DEPENDENCIES][package_as_root[NAME]] = package_as_root
        else:
            package_tree = create_children_recursive(package_as_root, key_tree,
                                                     set([]), all_packages_map, tree_provenance_map)
            dir_as_root[DEPENDENCIES][package_as_root[NAME]] = package_tree

    return dir_as_root


def satisfies_python_requirement(parsed_operator, py_version):
    """Check if a package required python versions matches the one of the system

    Args:
        parsed_operator (str): operator to compare by i.e. >, <=, ==
        py_version (str): The python version that is required by the package

    Returns:
        bool: True if the version matches, False otherwise
    """
    # TODO: use python semver library to compare versions
    operator = {
        ">": gt,
        "==": eq,
        "<": lt,
        "<=": le,
        ">=": ge,
        '!=': ne,
    }
    operator_func = operator.get(parsed_operator)
    system_py_version_tuple = (sys.version_info[0], sys.version_info[1])
    py_version_tuple = tuple(py_version.split('.'))  # tuple of strings

    # For wildcard versions like 3.9.*
    if py_version_tuple[-1] == '*':
        system_py_version_tuple = system_py_version_tuple[0]
        py_version_tuple = int(py_version_tuple[0])  # tuple of integers

    # For dev/alpha/beta/rc versions like 3.9.dev0
    elif not py_version_tuple[-1].isdigit():
        py_version_tuple = (int(py_version_tuple[0]), int(py_version_tuple[1]))

    # For stable releases like 3.9.2
    else:
        py_version_tuple = tuple(int(x) for x in py_version_tuple)

    result = operator_func(system_py_version_tuple, py_version_tuple)

    return result


def get_markers_text(requirement):
    if isinstance(requirement, pipfile.PipfileRequirement):
        return requirement.markers
    return requirement.line


def matches_python_version(requirement):
    """Filter out requirements that should not be installed
    in this Python version.
    See: https://www.python.org/dev/peps/pep-0508/#environment-markers
    """
    markers_text = get_markers_text(requirement)
    if not (markers_text and re.match(".*;.*python_version", markers_text)):
        return True

    cond_text = markers_text.split(";", 1)[1]

    # Gloss over the 'and' case and return true on the first matching python version

    for sub_exp in re.split(r"\s*(?:and|or)\s*", cond_text):
        match = PYTHON_MARKER_REGEX.search(sub_exp)

        if match:
            match_dict = match.groupdict()

            if len(match_dict) == 2 and satisfies_python_requirement(
                    match_dict['operator'],
                    match_dict['python_version']
            ):
                return True

    return False


def matches_environment(requirement):
    """Filter out requirements that should not be installed
    in this environment. Only sys_platform is inspected right now.
    This should be expanded to include other environment markers.
    See: https://www.python.org/dev/peps/pep-0508/#environment-markers
    """
    sys_platform = sys.platform.lower()
    markers_text = get_markers_text(requirement)
    if markers_text and 'sys_platform' in markers_text:
        match = SYSTEM_MARKER_REGEX.findall(markers_text)
        if len(match) > 0:
            return match[0].lower() == sys_platform
    return True


def is_testable(requirement):
    return requirement.editable is False and requirement.vcs is None


def detect_encoding_by_bom(path):
    with open(path, 'rb') as f:
        raw = f.read(NUMBER_OF_BYTES)  # will read less if the file is smaller
    # BOM_UTF32_LE's start is equal to BOM_UTF16_LE so need to try the former first
    for enc, boms in \
            ('utf-8-sig', (codecs.BOM_UTF8,)), \
            ('utf-32', (codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)), \
            ('utf-16', (codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        if any(raw.startswith(bom) for bom in boms):
            return enc
    return None


def get_requirements_for_pipenv(requirements_file_path, dev_deps=False):
    """Get requirements for a pipenv project.

    Notes:
        The requirements file for a pipenv project is `Pipfile`.

    Args:
        requirements_file_path: path to Pipfile
        dev_deps: Include dev dependencies or not.

    Returns:
        list[PipfileRequirement]: if requirements were found.
        empty list: if no requirements were found in the requirements file.
    """

    with io.open(requirements_file_path, 'r', encoding='utf-8') as f:
        requirements_data = f.read()
    parsed_reqs = pipfile.parse(requirements_data)
    parsed_packages = parsed_reqs.get('packages', [])
    if parsed_packages is None:
        parsed_packages = []
    req_list = list(parsed_packages)
    if dev_deps:
        dev_packages = parsed_reqs.get('dev-packages', [])
        if dev_packages is not None:
            req_list.extend(dev_packages)
    if not req_list:
        return []
    else:
        for r in req_list:
            r.provenance = (
            requirements_file_path, r.provenance[1], r.provenance[2])

    req_list = filter_requirements(req_list)

    return req_list


def get_requirements_for_setuptools(requirements_file_path):
    """Get requirements for a setuptools project.

    Notes:
        The requirements are located in a `setup.py` file, usually located in
        the root directory of the project.
    Args:
        requirements_file_path: path to `setup.py`

    Returns:
        list[Requirement]: if requirements were found.
        empty list: if no requirements were found in the requirements file.
    """
    import setup_file
    with open(requirements_file_path, 'r') as f:
        setup_py_file_content = f.read()
    requirements_data = setup_file.parse_requirements(setup_py_file_content)
    req_list = list(requirements.parse(requirements_data))

    provenance = setup_file.get_provenance(setup_py_file_content)
    for req in req_list:
        req.provenance = (
            os.path.basename(requirements_file_path),
            provenance,
            provenance
        )

    req_list = filter_requirements(req_list)

    return req_list


def get_requirements_for_pip(requirements_file_path):
    """Get requirements for a pip project.

    Note:
        1. This is usually a `requirements.txt` file.
        2. requirements.txt files are unicode and can be in any encoding.

    Args:
        requirements_file_path: path to `requirements.txt` file

    Returns:
        list[Requirement]: if requirements were found.
        empty list: if no requirements were found in the requirements file.
    """
    encoding = detect_encoding_by_bom(requirements_file_path)

    with io.open(requirements_file_path, 'r', encoding=encoding) as f:
        req_list = list(requirements.parse(f))

    req_list = filter_requirements(req_list)

    return req_list


def filter_requirements(req_list):
    """Filters and checks the discovered requirements.

    Args:
        req_list (list): List of found requirement files.

    Returns:
        list: if requirements were found in the requirements file.
        empty list: if no requirements were found in the requirements file.
    """
    req_list = filter(matches_environment, req_list)
    req_list = filter(is_testable, req_list)
    req_list = filter(matches_python_version, req_list)
    req_list = [r for r in req_list if r.name]

    for req in req_list:
        req.name = req.name = req.name.lower().replace('_', '-')

    return req_list


def get_requirements_list(requirements_file_path, dev_deps=False):
    """Retrieves the requirements from the requirements file

    The requirements can be retrieved from requirements.txt, Pipfile or setup.py

    Args:
        requirements_file_path (str): path to requirements file.
        dev_deps (bool, optional): Include dev dependencies or not.

    Returns:
        list[PipfileRequirement]: if requirements were found.
        empty list: if no requirements were found in the requirements file.
    """
    if deps_manager is DepsManager.PIPENV:
        req_list = get_requirements_for_pipenv(requirements_file_path, dev_deps)
    elif deps_manager is DepsManager.SETUPTOOLS:
        req_list = get_requirements_for_setuptools(requirements_file_path)
    else:
        req_list = get_requirements_for_pip(requirements_file_path)

    return req_list


def canonicalize_package_name(name):
    # https://packaging.python.org/guides/distributing-packages-using-setuptools/#name
    name = name.lower().replace('-', '.').replace('_', '.')
    name = re.sub(r'\.+', '.', name)
    return name


def create_dependencies_tree_by_req_file_path(
    requirements_file_path,
    allow_missing=False,
    dev_deps=False,
    only_provenance=False,
    allow_empty=False
):
    # TODO: normalise package names before any other processing - this should
    #  help reduce the amount of `in place` conversions.
    global deps_manager

    # Establishing the dependency manager
    deps_manager = DepsManager.discover(requirements_file_path)

    # get all installed packages
    pkgs = list(pkg_resources.working_set)

    # get all installed packages distribution object
    dist_index = utils.build_dist_index(pkgs)

    # get all installed distributions tree
    dist_tree = utils.construct_tree(dist_index)

    # create a list of dependencies from the dependencies file
    required = get_requirements_list(requirements_file_path, dev_deps=dev_deps)

    # Handle optional dependencies/arbitrary dependencies
    optional_dependencies = utils.establish_optional_dependencies(
        dist_index,
        required,
        dist_tree,
        deps_manager
    )

    top_level_provenance_map = {}

    if not required and not allow_empty:
        msg = 'No dependencies detected in manifest.'
        sys.exit(msg)
    else:
        installed = [canonicalize_package_name(p) for p in dist_index]
        top_level_requirements = []
        missing_package_names = []
        for r in required:
            if canonicalize_package_name(r.name) not in installed:
                missing_package_names.append(r.name)
            else:
                top_level_requirements.append(r)
            top_level_provenance_map[canonicalize_package_name(r.name)] = r.original_name
        if missing_package_names:
            msg = 'Required packages missing: ' + (', '.join(missing_package_names))
            if allow_missing:
                sys.stderr.write(msg + "\n")
            else:
                sys.exit(msg)

        # build a tree of dependencies
        package_tree = create_tree_of_packages_dependencies(
            dist_tree,
            top_level_requirements,
            optional_dependencies,
            requirements_file_path,
            allow_missing,
            only_provenance,
            top_level_provenance_map,
        )

        print(json.dumps(package_tree))


def main():
    """Builds the dependency tree from the manifest file (Pipfile or requirements.txt) and
    prints it as JSON. The tree nodes are:
    interface DepTree {
        name: string;
        version?: string;
        dependencies?: {[n: string]: DepTree};
        labels: { provenance?: string };
    }
    The `provenance` label only present for the top-level nodes, indicates the position of the dependency
    version in the original file and is in the format "filename:lineNum" or "filename:lineFrom-lineTo",
    where line numbers are 1-based.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("requirements",
        help="dependencies file path (requirements.txt or Pipfile)")
    parser.add_argument("--allow-missing",
        action="store_true",
        help="don't fail if some packages listed in the dependencies file " +
             "are not installed")
    parser.add_argument("--dev-deps",
        action="store_true",
        help="resolve dev dependencies")
    parser.add_argument("--only-provenance",
        action="store_true",
        help="only return top level deps with provenance information")
    parser.add_argument("--allow-empty",
        action="store_true",
        help="return empty dep tree instead of throwing")
    args = parser.parse_args()

    create_dependencies_tree_by_req_file_path(
        args.requirements,
        allow_missing=args.allow_missing,
        dev_deps=args.dev_deps,
        only_provenance=args.only_provenance,
        allow_empty=args.allow_empty,
    )


if __name__ == '__main__':
    sys.exit(main())
