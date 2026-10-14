import re
import sys
import pip_resolve

from reqPackage import ReqPackage
from distPackage import DistPackage
from importlib import import_module
from operator import attrgetter
from constants import DepsManager

try:
    from collections import OrderedDict
except ImportError:
    from ordereddict import OrderedDict


__version__ = '0.10.1'


def canonicalize_package_name(name):
    # https://packaging.python.org/guides/distributing-packages-using-setuptools/#name
    name = name.lower().replace('-', '.').replace('_', '.')
    name = re.sub(r'\.+', '.', name)
    return name


def build_dist_index(pkgs):
    """Build an index pkgs by their key as a dict.
    :param list pkgs: list of pkg_resources.Distribution instances
    :returns: index of the pkgs by the pkg key
    :rtype: dict
    """
    return dict((p.key, DistPackage(p)) for p in pkgs)


def _requirement_extras(requirement):
    """Returns the extras requested by a manifest requirement.

    Requirements parsed from requirements.txt / setup.py carry an `extras`
    list. Pipfile requirements may instead carry them in the name, e.g.
    'opentelemetry-distro[otlp]'.
    """
    extras = list(getattr(requirement, 'extras', None) or [])
    name = getattr(requirement, 'name', None) or ''
    match = re.search(r'\[([^]]*)]$', name)
    if match:
        extras.extend(e.strip() for e in match.group(1).split(',') if e.strip())
    return extras


def _declared_extras(dist, extras):
    """Filters `extras` down to the ones that `dist` actually declares.

    `Distribution.requires(extras=...)` raises UnknownExtra for an extra the
    package does not provide; pip only warns in that case, so we skip it.
    """
    if not extras:
        return ()
    # Compare names the way pip does (PEP 685): case-insensitive, with runs
    # of '-', '_' and '.' treated as equal; pass on the declared spelling.
    declared = dict((_normalise_extra(e), e) for e in dist.extras)
    return tuple(sorted(set(
        declared[_normalise_extra(e)] for e in extras
        if _normalise_extra(e) in declared
    )))


def _normalise_extra(extra):
    return re.sub(r'[-_.]+', '-', extra).lower()


def resolve_requested_extras(index, root_requirements):
    """Works out which extras are requested for each installed package.

    Walks the installed packages reachable from the manifest's requirements and
    follows every edge with the extras requested on it, so that extras
    requested inside a dependency's own metadata (e.g. `httpx[http2]`) are
    honoured as well as top-level ones (e.g. `smolagents[litellm]`). When the
    same package is reached with different extras, the union is used, which
    mirrors what pip installs into the environment.

    :param dict index: dist index ie. index of pkgs by their keys
    :param list root_requirements: requirements from the manifest file
    :returns: canonical package name -> set of requested extras
    :rtype: dict
    """
    canonical_index = dict(
        (canonicalize_package_name(key), dist) for key, dist in index.items()
    )
    requested = {}
    queue = []

    def request(name, extras):
        key = canonicalize_package_name(remove_optional_dependencies(name))
        if key not in canonical_index:
            return
        new_extras = set(extras) - requested.get(key, set())
        if key not in requested or new_extras:
            requested.setdefault(key, set()).update(new_extras)
            queue.append(key)

    for requirement in root_requirements:
        if getattr(requirement, 'name', None):
            request(requirement.name, _requirement_extras(requirement))

    while queue:
        key = queue.pop()
        dist = canonical_index[key]
        for child in dist.requires(_declared_extras(dist, requested[key])):
            request(child.key, child.extras)

    return dict((key, extras) for key, extras in requested.items() if extras)


def construct_tree(index, requested_extras=None):
    """Construct tree representation of the pkgs from the index.
    The keys of the dict representing the tree will be objects of type
    DistPackage and the values will be list of ReqPackage objects.
    :param dict index: dist index ie. index of pkgs by their keys
    :param dict requested_extras: optional map of canonical package name to
        the extras requested for it (see `resolve_requested_extras`)
    :returns: tree of pkgs and their dependencies
    :rtype: dict
    """
    requested_extras = requested_extras or {}

    # Build a canonicalized lookup map to handle package name variations
    # (e.g., zope-interface vs zope.interface)
    canonical_map = {}
    for key, dist in index.items():
        canonical_key = canonicalize_package_name(key)
        canonical_map[canonical_key] = dist
    
    def get_dist_for_requirement(req):
        # Try exact match first
        if req.key in index:
            return index[req.key]
        # Fall back to canonicalized lookup
        canonical_req_key = canonicalize_package_name(req.key)
        return canonical_map.get(canonical_req_key)

    def requires(p):
        base = p.requires()
        extras = _declared_extras(
            p, requested_extras.get(canonicalize_package_name(p.key)))
        if not extras:
            return base
        # Only follow an extra's requirements when they are installed: pip
        # may have been run with --no-deps, or the extra not installed at
        # all, and that should not fail a scan that worked before.
        reqs = list(base)
        for r in p.requires(extras)[len(base):]:
            if r not in reqs and get_dist_for_requirement(r) is not None:
                reqs.append(r)
        return reqs

    return dict((p, [ReqPackage(r, get_dist_for_requirement(r))
                     for r in requires(p)])
                for p in index.values())


def sorted_tree(tree):
    """Sorts the dict representation of the tree
    The root packages as well as the intermediate packages are sorted
    in the alphabetical order of the package names.
    :param dict tree: the pkg dependency tree obtained by calling
                     `construct_tree` function
    :returns: sorted tree
    :rtype: collections.OrderedDict
    """
    return OrderedDict(sorted([(k, sorted(v, key=attrgetter('key')))
                               for k, v in tree.items()],
                              key=lambda kv: kv[0].key))


def guess_version(pkg_key, default='?'):
    """Guess the version of a pkg when pip doesn't provide it
    :param str pkg_key: key of the package
    :param str default: default version to return if unable to find
    :returns: version
    :rtype: string
    """
    try:
        m = import_module(pkg_key)
    except ImportError:
        return default
    else:
        return getattr(m, '__version__', default)


def is_string(obj):
    """Check whether an object is a string"""
    if sys.version_info < (3,):
        # Python 2.x only
        return isinstance(obj, basestring)
    else:
        return isinstance(obj, str)


def remove_optional_dependencies(package_name):
    """Removes optional dependencies/arbitrary identifiers from package name.

    It looks at the end of the package name and searches for a pair of square
    brackets with anything inside of them and replaces it with nothing.

    Args:
        package_name (str): package name to be processed

    Examples:
        opentelemetry-distro[otlp] -> opentelemetry-distro

    Returns:
        str: `package_name` without optional_dependencies/arbitrary identifiers
    """
    package_name = re.sub(r'\[[^]]*]$', '', package_name)

    return package_name


def check_optional_dependencies(root_dependencies, deps_manager):
    """Checks if the list has packages with optional/arbitrary dependencies.

    If at least one of the dependencies has arbitrary dependencies, returns True

    Args:
        root_dependencies (list): A list of canonical python packages.
        deps_manager: DepsManager class object (PIP, PIPENV, SETUPTOOLS).
    Returns:
        bool: True if `[` or `]` found in a package, False otherwise
    """
    for dependency in root_dependencies:
        if '[' in dependency.name and ']' in dependency.name:
            return True

        elif (deps_manager is DepsManager.SETUPTOOLS
              and '[' in dependency.line and ']' in dependency.line):
            return True

    return False


def extract_dependencies(dependency_dict):
    dependencies = []

    def extract_names(dependency_dict):
        for _, value in dependency_dict.items():
            if isinstance(value, dict):
                dependencies.append(value.get('name'))
                if 'dependencies' in value:
                    extract_names(value.get('dependencies'))

    if 'dependencies' in dependency_dict:
        extract_names(dependency_dict.get('dependencies'))

    return dependencies


def establish_optional_dependencies(
        venv_deps,
        required_deps,
        dist_tree,
        deps_manager
):
    """Establishes if the project has optional dependencies or not.

    Builds the dependency tree in reverse. The dependencies that are left out
    of the tree, will be considered optional dependencies/dependencies that
    were introduced by arbitrary identifiers.
    Args:
        venv_deps: dependencies installed in the venv.
        required_deps: dependencies mentioned in the requirements file.
        dist_tree: distribution tree based on the venv_deps.
        deps_manager: DepsManager class object (PIP, PIPENV, SETUPTOOLS)

    Returns:
        list[str]: if optional dependencies were found.
        empty list: if no optional dependencies were found.
    """
    # For requirements.txt, extras are resolved by following them through the
    # dependency tree (see `resolve_requested_extras`), so the orphan-root
    # heuristic below is not needed and would attach unrelated venv packages.
    if deps_manager is DepsManager.PIP:
        return []

    has_optional_dependencies = check_optional_dependencies(
        required_deps, deps_manager
    )

    if not has_optional_dependencies:
        return []

    # Use the extras-aware tree, so packages already reached through an extra
    # are not also attached as top-level dependencies.
    dependency_map = dict(
        (dist.key, requirements) for dist, requirements in dist_tree.items()
    )

    # Identify the root nodes
    root_candidates = set(dependency_map.keys())

    # Establish root dependencies
    for dependency in dependency_map.values():
        # Check if dependency has other dependencies
        if not dependency:
            continue

        for subdep in dependency:
            # Check if sub-dependency is amongst all other dependencies
            if subdep.key not in root_candidates:
                continue
            root_candidates.remove(subdep.key)

    # Remove pip and wheel in case they are installed in the venv
    root_candidates -= {'pip', 'wheel'}

    # setup.py adds the project_name to dist_index, and needs to be removed.
    if deps_manager is DepsManager.SETUPTOOLS:
        pkg_name = get_package_name_from_setup()

        if pkg_name:
            to_be_removed = set()
            for value in root_candidates:
                candidate = pip_resolve.canonicalize_package_name(value)
                pkg_name = pip_resolve.canonicalize_package_name(pkg_name)

                if candidate == pkg_name:
                    to_be_removed.add(value)

            if to_be_removed:
                root_candidates -= to_be_removed

    # Remove required_deps from root_candidates
    for requirement in required_deps:
        requirement.name = remove_optional_dependencies(requirement.name)

        if requirement.name in root_candidates:
            root_candidates.remove(requirement.name)

    optional_dependencies = [
        node for node in dist_tree.keys() if node.key in root_candidates
    ]

    return optional_dependencies


def get_package_name_from_setup():
    """Retrieves project name from setup.py

    When using setup.py to establish the dependency tree, the project name is
    added to dist_index. The actual project name should not be part of the
    dependency tree, so it needs to be removed.

    Notes:
        Usually the setup.py file is stored in the root directory of a project.

    Returns:
        str: if the project name was found.
        None: if the project name was not found.
    """
    # Open the setup.py file and read its contents
    with open("setup.py", 'r') as f:
        setup_content = f.read()

    # Iterate over the lines of setup.py and find the `name` attrribute
    # Usually it is the first attribute
    name_line = next((line.strip() for line in setup_content.split('\n') if
                      line.strip().startswith('name=')), None)

    if name_line:
        # Extract the project name from the 'name' attribute.
        package_name = (name_line.split('=')[1]
                        .replace("'", '')
                        .replace('"', '')
                        .replace(',', '')
                        .strip())
        return package_name

    return None
