# run with:
# cd pysrc; python3 -m unittest test_extras; cd ..
#
# Builds a throwaway "site-packages" of hand-written .dist-info folders and
# runs pip_resolve against it, so the tests need no network access and no
# real packages.

import argparse
import io
import json
import os
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import pkg_resources

import pip_resolve

# name -> (version, [metadata lines])
FAKE_DISTS = {
    # Top-level extra (smolagents[litellm] shape), including a self-referencing
    # extra, which is common in real packages (pkg[all] -> pkg[litellm]).
    'agent-pkg': ('1.0.0', [
        'Requires-Dist: base-pkg',
        'Provides-Extra: litellm',
        'Requires-Dist: llm-pkg ; extra == "litellm"',
        'Provides-Extra: all',
        'Requires-Dist: agent-pkg[litellm] ; extra == "all"',
    ]),
    # Nested extra requested in a dependency's own metadata
    # (litellm -> httpx[http2] shape).
    'llm-pkg': ('2.0.0', [
        'Requires-Dist: http-pkg[http2]>=1.0',
    ]),
    'http-pkg': ('1.5.0', [
        'Requires-Dist: base-pkg',
        'Provides-Extra: http2',
        'Requires-Dist: h2-pkg ; extra == "http2"',
        'Provides-Extra: brotli',
        'Requires-Dist: brotli-pkg ; extra == "brotli" and python_version >= "3"',
        'Requires-Dist: never-pkg ; extra == "brotli" and python_version < "3"',
        'Provides-Extra: socks',
        'Requires-Dist: not-installed-pkg ; extra == "socks"',
    ]),
    'h2-pkg': ('4.0.0', ['Requires-Dist: hpack-pkg']),
    'hpack-pkg': ('4.0.0', []),
    'brotli-pkg': ('1.0.0', []),
    'never-pkg': ('1.0.0', []),
    'base-pkg': ('3.0.0', []),
    # An extra named like a version string (OSM-3990 shape).
    'azure-pkg': ('1.2.1', [
        'Requires-Dist: base-pkg',
        'Provides-Extra: v1',
        'Requires-Dist: legacy-pkg ; extra == "v1"',
    ]),
    'legacy-pkg': ('0.1.0', []),
    # Extras whose declared spelling differs only in separators (PEP 685).
    'sep-pkg': ('1.0.0', [
        'Provides-Extra: some_extra',
        'Requires-Dist: base-pkg ; extra == "some_extra"',
        'Provides-Extra: dot.ted',
        'Requires-Dist: legacy-pkg ; extra == "dot.ted"',
    ]),
    # Installed in the venv but not required by anything.
    'unrelated-tool': ('9.9.9', []),
}

OPTIONS = argparse.Namespace(allow_missing=False, dev_deps=False,
                             only_provenance=False, allow_empty=False)


def write_fake_site_packages(root):
    for name, (version, lines) in FAKE_DISTS.items():
        dist_info = os.path.join(
            root, '{0}-{1}.dist-info'.format(name.replace('-', '_'), version))
        os.makedirs(dist_info)
        metadata = ['Metadata-Version: 2.1', 'Name: ' + name,
                    'Version: ' + version] + lines
        with open(os.path.join(dist_info, 'METADATA'), 'w') as f:
            f.write('\n'.join(metadata) + '\n')


def children(tree, *path):
    """Names of the dependencies under the node at `path`."""
    node = tree
    for name in path:
        node = node['dependencies'][name]
    return sorted((node.get('dependencies') or {}).keys())


def all_names(node, found=None):
    found = set() if found is None else found
    for name, child in (node.get('dependencies') or {}).items():
        found.add(name)
        if isinstance(child, dict):
            all_names(child, found)
    return found


class TestExtras(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.site_packages = tempfile.mkdtemp()
        write_fake_site_packages(cls.site_packages)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.site_packages)

    def resolve(self, requirements_txt):
        manifest_dir = tempfile.mkdtemp()
        try:
            manifest = os.path.join(manifest_dir, 'requirements.txt')
            with open(manifest, 'w') as f:
                f.write(requirements_txt)
            # fresh Distribution objects each time: pkg_resources caches the
            # parsed metadata, which would hide a crash after the first call
            dists = list(pkg_resources.find_distributions(self.site_packages))
            out = io.StringIO()
            with patch.object(pip_resolve.pkg_resources, 'working_set',
                              dists), redirect_stdout(out):
                pip_resolve.create_dependencies_tree_by_req_file_path(
                    manifest, OPTIONS)
            return json.loads(out.getvalue())
        finally:
            shutil.rmtree(manifest_dir)

    def test_top_level_extra(self):
        tree = self.resolve('agent-pkg[litellm]>=1.0\n')
        # only the manifest's package is a root; unrelated venv packages are
        # not attached
        self.assertEqual(children(tree), ['agent-pkg'])
        self.assertEqual(children(tree, 'agent-pkg'), ['base-pkg', 'llm-pkg'])

    def test_nested_extra(self):
        # llm-pkg requires http-pkg[http2]; h2-pkg must follow even though the
        # manifest mentions no extras at all.
        tree = self.resolve('llm-pkg\n')
        self.assertEqual(children(tree, 'llm-pkg', 'http-pkg'),
                         ['base-pkg', 'h2-pkg'])
        self.assertEqual(children(tree, 'llm-pkg', 'http-pkg', 'h2-pkg'),
                         ['hpack-pkg'])

    def test_top_level_and_nested_extras(self):
        tree = self.resolve('agent-pkg[litellm]>=1.0\n')
        self.assertEqual(all_names(tree), {
            'agent-pkg', 'base-pkg', 'llm-pkg', 'http-pkg', 'h2-pkg',
            'hpack-pkg',
        })

    def test_self_referencing_extra(self):
        tree = self.resolve('agent-pkg[all]\n')
        self.assertIn('llm-pkg', children(tree, 'agent-pkg'))
        self.assertIn('h2-pkg', all_names(tree))

    def test_same_package_with_different_extras(self):
        # http-pkg is reached as http-pkg[http2] (via llm-pkg) and as
        # http-pkg[brotli] (from the manifest); both sets of extras apply.
        tree = self.resolve('agent-pkg[litellm]\nhttp-pkg[brotli]\n')
        names = all_names(tree)
        self.assertIn('h2-pkg', names)
        self.assertIn('brotli-pkg', names)

    def test_extra_combined_with_other_markers(self):
        tree = self.resolve('http-pkg[brotli]\n')
        self.assertEqual(children(tree, 'http-pkg'), ['base-pkg', 'brotli-pkg'])

    def test_unknown_extra_is_ignored(self):
        tree = self.resolve('agent-pkg[does-not-exist,litellm]\n')
        self.assertEqual(children(tree, 'agent-pkg'), ['base-pkg', 'llm-pkg'])

    def test_extra_whose_dependency_is_not_installed(self):
        # e.g. installed with --no-deps: skip the missing extra dependency
        # rather than failing a scan that used to work
        tree = self.resolve('http-pkg[http2,socks]\n')
        self.assertEqual(children(tree, 'http-pkg'), ['base-pkg', 'h2-pkg'])

    def test_extra_in_egg_fragment(self):
        tree = self.resolve('./vendor/agent-pkg#egg=agent-pkg[litellm]\n')
        self.assertEqual(children(tree), ['agent-pkg'])
        self.assertEqual(children(tree, 'agent-pkg'), ['base-pkg', 'llm-pkg'])

    def test_names_and_extras_are_normalised(self):
        tree = self.resolve('Agent_Pkg[LiteLLM]\n')
        self.assertEqual(children(tree, 'agent-pkg'), ['base-pkg', 'llm-pkg'])

    def test_extra_separators_are_normalised(self):
        tree = self.resolve('sep-pkg[Some-Extra,dot_ted]\n')
        self.assertEqual(children(tree, 'sep-pkg'), ['base-pkg', 'legacy-pkg'])

    def test_extra_named_like_a_version(self):
        # OSM-3990: evaluating `extra == "v1"` raised on Python < 3.12, and
        # the requested extra was ignored on every version.
        tree = self.resolve('azure-pkg==1.2.1\n')
        self.assertEqual(children(tree, 'azure-pkg'), ['base-pkg'])
        tree = self.resolve('azure-pkg[v1]==1.2.1\n')
        self.assertEqual(children(tree, 'azure-pkg'), ['base-pkg', 'legacy-pkg'])


if __name__ == '__main__':
    unittest.main()
