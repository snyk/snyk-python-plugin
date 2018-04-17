import sys
import os
import json
import re
import argparse
import utils
import requirements

# pip >= 10.0.0 moved all APIs to the _internal package reflecting the fact
# that pip does not currently have any public APIs. This is a temporary fix.
# TODO: We need a workaround to using the get_installed_distributions method.
try:
    from pip import get_installed_distributions
except ImportError:
    from pip._internal import get_installed_distributions

def create_tree_of_packages_dependencies(dist_tree, packages_names, req_file_path, allow_missing=False):
    """Create packages dependencies tree
    :param dict tree: the package tree
    :param set packages_names: set of select packages to be shown in the output.
    :param req_file_path: the path to requirements.txt file
    :rtype: dict
    """
    DEPENDENCIES = 'dependencies'
    FROM = 'from'
    VERSION = 'version'
    NAME = 'name'
    VERSION_SEPARATOR = '@'
    DIR_VERSION = '0.0.0'
    PACKAGE_FORMAT_VERSION = 'packageFormatVersion'

    tree = utils.sorted_tree(dist_tree)
    nodes = tree.keys()
    key_tree = dict((k.key, v) for k, v in tree.items())

    def get_children(n): return key_tree.get(n.key, [])
    lowercase_pkgs_names = [p.lower() for p in packages_names]
    packages_as_dist_obj = [
        p for p in nodes if
            p.key.lower() in lowercase_pkgs_names or
            (p.project_name and p.project_name.lower()) in lowercase_pkgs_names]

    def create_children_recursive(root_package, key_tree, ancestors):
        root_name = root_package[NAME].lower()
        if root_name not in key_tree:
            msg = 'Required package missing: ' + root_name
            if allow_missing:
                sys.stderr.write(msg + "\n")
                return
            else:
                sys.exit(msg)

        ancestors = ancestors.copy()
        ancestors.add(root_name)
        children_packages_as_dist = key_tree[root_name]
        for child_dist in children_packages_as_dist:
            if child_dist.project_name.lower() in ancestors:
                continue

            child_package = {
                NAME: child_dist.project_name,
                VERSION: child_dist.installed_version,
                FROM: root_package[FROM] +
                      [child_dist.key + VERSION_SEPARATOR + child_dist.installed_version]
            }

            create_children_recursive(child_package, key_tree, ancestors)
            if DEPENDENCIES not in root_package:
                root_package[DEPENDENCIES] = {}
            root_package[DEPENDENCIES][child_dist.project_name] = child_package
        return root_package

    def create_dir_as_root():
        name = os.path.basename(os.path.dirname(os.path.abspath(req_file_path)))
        dir_as_root = {
            NAME: name,
            VERSION: DIR_VERSION,
            DEPENDENCIES: {},
            FROM: [name + VERSION_SEPARATOR + DIR_VERSION], DEPENDENCIES: {},
            PACKAGE_FORMAT_VERSION: 'pip:0.0.1'
        }
        return dir_as_root

    def create_package_as_root(package, dir_as_root):
        package_as_root = {
            NAME: package.project_name.lower(),
            VERSION: package._obj._version,
            FROM: ["{}{}{}".format(
                dir_as_root[NAME], VERSION_SEPARATOR, dir_as_root[VERSION])] +
                  ["{}{}{}".format(
                package.project_name.lower(), VERSION_SEPARATOR, package._obj._version)]
        }
        return package_as_root
    dir_as_root = create_dir_as_root()
    for package in packages_as_dist_obj:
        package_as_root = create_package_as_root(package, dir_as_root)
        package_tree = create_children_recursive(package_as_root, key_tree, set([]))
        dir_as_root[DEPENDENCIES][package_as_root[NAME]] = package_tree
    return dir_as_root

sys_platform_re = re.compile('sys_platform\s*==\s*[\'"](.+)[\'"]')
sys_platform = sys.platform.lower()

def matches_environment(requirement):
    """Filter out requirements that should not be installed
    in this environment. Only sys_platform is inspected right now.
    This should be expanded to include other environment markers.
    See: https://www.python.org/dev/peps/pep-0508/#environment-markers
    """
    if 'sys_platform' in requirement.line:
        match = sys_platform_re.findall(requirement.line)
        if len(match) > 0:
            return match[0].lower() == sys_platform
    return True

def is_testable(requirement):
    return requirement.editable == False and requirement.vcs == None

def get_requirements_list(requirements_file):
    req_list = list(requirements.parse(requirements_file))
    req_list = filter(matches_environment, req_list)
    req_list = filter(is_testable, req_list)
    required = [req.name.replace('_', '-') for req in req_list]
    return required

def create_dependencies_tree_by_req_file_path(requirements_file_path, allow_missing=False):
    # get all installed packages
    pkgs = get_installed_distributions(local_only=False, skip=[])

    # get all installed packages's distribution object
    dist_index = utils.build_dist_index(pkgs)

    # get all installed distributions tree
    dist_tree = utils.construct_tree(dist_index)

    # open the requirements.txt file and create dependencies tree out of it
    with open(requirements_file_path, 'r') as requirements_file:
        required = get_requirements_list(requirements_file)
        installed = [p for p in dist_index]
        packages = []
        for r in required:
            if r.lower() not in installed:
                msg = 'Required package missing: ' + r.lower()
                if allow_missing:
                    sys.stderr.write(msg + "\n")
                else:
                    sys.exit(msg)
            else:
                packages.append(r);

        package_tree = create_tree_of_packages_dependencies(
            dist_tree, packages, requirements_file_path, allow_missing)
    print(json.dumps(package_tree))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("requirements", help="requirements.txt path")
    parser.add_argument("--allow-missing",
        action="store_true",
        help="don't fail if some packages listed in requirements.txt are missing")
    args = parser.parse_args()

    create_dependencies_tree_by_req_file_path(
        args.requirements, args.allow_missing)

if __name__ == '__main__':
    sys.exit(main())
