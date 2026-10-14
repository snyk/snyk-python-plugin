# run with:
# cd pysrc; python3 -m unittest test_markers; cd ..
#
# Top-level requirements must be filtered by their PEP 508 environment
# markers the same way pip does: a line whose marker is false for the running
# interpreter is not installed, so it must not be reported as missing.
# The markers below are built from the running interpreter so that the tests
# hold on any OS, architecture and Python version.

import os
import platform
import sys
import unittest

try:
    from StringIO import StringIO
except ImportError:
    from io import StringIO

import pip_resolve
from pipfile import PipfileRequirement
from requirements.requirement import Requirement

# the environment the markers are evaluated against, e.g. on Python 2
# implementation_name is '' as sys.implementation doesn't exist
ENVIRONMENT = pip_resolve.get_marker_module().default_environment()
IMPLEMENTATION_NAME = ENVIRONMENT['implementation_name']
MACHINE = platform.machine()
SYSTEM = platform.system()
FULL_VERSION = platform.python_version()
PY_VERSION = '.'.join(platform.python_version_tuple()[:2])
# version markers that are true and false on any interpreter
TRUE_VERSION = "python_version >= '%s'" % PY_VERSION
FALSE_VERSION = "python_version < '%s'" % PY_VERSION


class captured_stderr(object):
    """Swaps sys.stderr for a StringIO, without needing mock on Python 2."""

    def __enter__(self):
        self.original, sys.stderr = sys.stderr, StringIO()
        return sys.stderr

    def __exit__(self, *exc_info):
        sys.stderr = self.original


def kept(lines):
    """Names of the requirement lines that survive marker filtering."""
    reqs = [Requirement.parse(line) for line in lines]
    return [r.name for r in pip_resolve.filter_requirements(reqs)]


def pipfile_req(name, markers):
    req = PipfileRequirement(name)
    req.original_name = name
    req.version = '*'
    req.markers = markers
    return req


def kept_pipfile(reqs):
    return [r.name for r in pip_resolve.filter_requirements(reqs)]


class TestRequirementMarkers(unittest.TestCase):

    @unittest.skipIf(IMPLEMENTATION_NAME == 'pypy', 'needs a non-PyPy interpreter')
    def test_pypy_only_lines_are_skipped(self):
        # uv export output for a project depending on cffi via PyPy only
        self.assertEqual(kept([
            "cffi==2.0.0 ; implementation_name == 'pypy'",
            "pycparser==3.0 ; implementation_name == 'pypy'",
            "six==1.16.0",
        ]), ['six'])

    def test_true_implementation_name_is_kept(self):
        self.assertEqual(kept([
            "six==1.16.0 ; implementation_name == '%s'" % IMPLEMENTATION_NAME,
        ]), ['six'])

    def test_platform_machine(self):
        self.assertEqual(kept([
            "six==1.16.0 ; platform_machine == '%s'" % MACHINE,
            "attrs==23.1.0 ; platform_machine == 'not-a-machine'",
        ]), ['six'])

    def test_os_name_and_platform_system(self):
        self.assertEqual(kept([
            "six==1.16.0 ; platform_system == '%s'" % SYSTEM,
            "attrs==23.1.0 ; os_name != '%s'" % os.name,
            "idna==3.4 ; os_name == '%s'" % os.name,
        ]), ['six', 'idna'])

    def test_python_full_version(self):
        self.assertEqual(kept([
            "six==1.16.0 ; python_full_version == '%s'" % FULL_VERSION,
            "attrs==23.1.0 ; python_full_version != '%s'" % FULL_VERSION,
            "idna==3.4 ; python_full_version < '%s'" % FULL_VERSION,
        ]), ['six'])

    def test_not_equal(self):
        self.assertEqual(kept([
            "six==1.16.0 ; sys_platform != 'not-a-platform'",
            "attrs==23.1.0 ; sys_platform != '%s'" % sys.platform,
        ]), ['six'])

    def test_in_and_not_in(self):
        self.assertEqual(kept([
            "six==1.16.0 ; sys_platform in 'not-a-platform %s'" % sys.platform,
            "attrs==23.1.0 ; sys_platform not in 'not-a-platform %s'" % sys.platform,
        ]), ['six'])

    def test_and_or_with_parentheses(self):
        self.assertEqual(kept([
            # false: the parenthesised group is false
            "attrs==23.1.0 ; (implementation_name == 'not-an-impl' "
            "or os_name == 'not-an-os') and %s" % TRUE_VERSION,
            # true: the parenthesised group is true
            "six==1.16.0 ; implementation_name == 'not-an-impl' "
            "or (%s and sys_platform == '%s')" % (TRUE_VERSION, sys.platform),
            # false: the first clause matching must not short-circuit 'and'
            "idna==3.4 ; %s and %s" % (TRUE_VERSION, FALSE_VERSION),
        ]), ['six'])

    def test_reversed_operands(self):
        self.assertEqual(kept([
            "six==1.16.0 ; '%s' == sys_platform" % sys.platform,
            "attrs==23.1.0 ; 'not-a-platform' == sys_platform",
        ]), ['six'])

    def test_python_version_compares_as_versions(self):
        # '3.10' > '3.9' as a version, but not as a string
        newer_than_3_9 = sys.version_info[:2] > (3, 9)
        expected = ['six'] if newer_than_3_9 else []
        self.assertEqual(kept(["six==1.16.0 ; python_version > '3.9'"]), expected)
        self.assertEqual(kept([
            "six==1.16.0 ; python_version == '%s'" % PY_VERSION,
            "attrs==23.1.0 ; " + FALSE_VERSION,
            "idna==3.4 ; " + TRUE_VERSION,
        ]), ['six', 'idna'])

    def test_sys_platform(self):
        self.assertEqual(kept([
            "six==1.16.0 ; sys_platform == '%s'" % sys.platform,
            "attrs==23.1.0 ; sys_platform == 'win32'"
            if sys.platform != 'win32' else
            "attrs==23.1.0 ; sys_platform == 'linux'",
        ]), ['six'])

    def test_extra_marker_is_skipped(self):
        # pip installs a top-level line guarded by `extra` only when that
        # extra is requested, which a requirements file can't do
        self.assertEqual(kept([
            "six==1.16.0",
            "attrs==23.1.0 ; extra == 'test'",
        ]), ['six'])

    def test_extra_named_like_a_version(self):
        # packaging < 26 compares these as versions and raises
        self.assertEqual(kept([
            "six==1.16.0 ; extra != 'v1'",
            "attrs==23.1.0 ; extra == 'v1'",
            "idna==3.4 ; extra == \"1.0\" or os_name == 'not-an-os'",
            "click==8.1.0 ; 'v1' != extra and os_name == '%s'" % os.name,
        ]), ['six', 'click'])

    def test_reversed_extra_after_another_quoted_value(self):
        # only the value directly before `== extra` is compared with extra
        self.assertEqual(kept([
            "attrs==23.1.0 ; 'not-a-platform' == sys_platform or 'x' == extra",
            "six==1.16.0 ; '%s' == sys_platform or 'x' == extra" % sys.platform,
            "idna==3.4 ; os_name == 'not-an-os' or '' == extra",
            "click==8.1.0 ; os_name == 'not-an-os' or \"v1\" != extra",
        ]), ['six', 'idna', 'click'])

    def test_resolve_extra_markers_output(self):
        true, false = 'python_version >= "0"', 'python_version < "0"'
        cases = [
            ("extra == 'test'", false),
            ("extra != 'v1'", true),
            ("'' == extra", true),
            ("'darwin' == sys_platform or 'x' == extra",
             "'darwin' == sys_platform or " + false),
            ("os_name == 'a' or '' == extra", "os_name == 'a' or " + true),
            ("extra == \"it's\" and 'b' != extra", false + " and " + true),
        ]
        marker_module = pip_resolve.get_marker_module()
        for markers_text, expected in cases:
            resolved = pip_resolve.resolve_extra_markers(markers_text)
            self.assertEqual(resolved, expected)
            # the rewritten marker must still parse
            marker_module.Marker(resolved)

    def test_no_marker_is_kept(self):
        self.assertEqual(kept(["six==1.16.0", "attrs==23.1.0"]), ['six', 'attrs'])

    def test_marker_followed_by_hash_and_comment(self):
        self.assertEqual(kept([
            "cffi==2.0.0 ; implementation_name == 'not-an-impl' --hash=sha256:abc",
            "six==1.16.0 ; os_name == '%s'  # a comment" % os.name,
            "attrs==23.1.0 ; os_name == 'not-an-os'  # a comment",
        ]), ['six'])

    def test_url_lines_with_markers(self):
        self.assertEqual(kept([
            "https://example.com/foo-1.0.tar.gz#egg=foo ; implementation_name == 'not-an-impl'",
            "bar @ https://example.com/bar-1.0.tar.gz ; implementation_name == 'not-an-impl'",
            "https://example.com/baz-1.0.tar.gz#egg=baz ; os_name == '%s'" % os.name,
        ]), ['baz'])

    def test_direct_reference_with_unspaced_marker(self):
        line = "qux @ https://example.com/qux-1.0.tar.gz;python_version<'%s'" % PY_VERSION
        try:
            Requirement.parse(line)
        except Exception:
            self.skipTest('this packaging version rejects the line')
        self.assertEqual(kept([line, "six==1.16.0"]), ['six'])

    def test_url_lines_marker_separators_and_options(self):
        self.assertEqual(kept([
            # space-form option after the marker
            "https://example.com/foo-1.0.tar.gz#egg=foo ; %s --hash sha256:abc" % FALSE_VERSION,
            # no space around ";" after the fragment, as pip <= 25 accepted
            "https://example.com/bar-1.0.tar.gz#egg=bar;" + FALSE_VERSION,
            "https://example.com/qux-1.0.tar.gz#egg=qux ;" + FALSE_VERSION,
            # ";" inside the URL is not a marker separator
            "https://example.com/baz;v=1/baz-1.0.tar.gz#egg=baz",
        ]), ['baz'])

    def test_malformed_marker_is_kept_without_crashing(self):
        with captured_stderr() as stderr:
            result = kept([
                "https://example.com/foo-1.0.tar.gz#egg=foo ; python_version >>> '3'",
            ])
        self.assertEqual(result, ['foo'])
        self.assertIn('foo', stderr.getvalue())


class TestPipfileMarkers(unittest.TestCase):

    def test_pipfile_markers_are_evaluated(self):
        self.assertEqual(kept_pipfile([
            pipfile_req('cffi', "implementation_name == 'not-an-impl'"),
            pipfile_req('attrs', FALSE_VERSION),
            pipfile_req('idna', "platform_machine == 'not-a-machine'"),
            pipfile_req('six', "%s and os_name == '%s'" % (TRUE_VERSION, os.name)),
            pipfile_req('click', None),
        ]), ['six', 'click'])

    def test_malformed_pipfile_marker_is_kept_without_crashing(self):
        with captured_stderr() as stderr:
            result = kept_pipfile([
                pipfile_req('stdeb', "sys_platform == 'linux' ; python_version != '3.4"),
            ])
        self.assertEqual(result, ['stdeb'])
        self.assertIn('stdeb', stderr.getvalue())

    def test_semicolon_separated_pipfile_marker_is_kept(self):
        # ";" isn't PEP 508 marker syntax and pipenv fails to lock with it,
        # so the requirement is kept and checked rather than guessed at
        with captured_stderr() as stderr:
            result = kept_pipfile([
                pipfile_req('waitress', "sys_platform == 'linux' ; python_version != '3.4'"),
            ])
        self.assertEqual(result, ['waitress'])
        self.assertIn('waitress', stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
