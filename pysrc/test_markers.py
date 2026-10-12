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

try:
    from mock import patch
except ImportError:
    from unittest.mock import patch

import pip_resolve
from pipfile import PipfileRequirement
from requirements.requirement import Requirement

IMPLEMENTATION_NAME = getattr(sys, 'implementation', None)
IMPLEMENTATION_NAME = (
    IMPLEMENTATION_NAME.name if IMPLEMENTATION_NAME else 'cpython')
MACHINE = platform.machine()
SYSTEM = platform.system()
FULL_VERSION = platform.python_version()
PY_VERSION = '.'.join(platform.python_version_tuple()[:2])


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
            "idna==3.4 ; python_full_version < '3.0.1'",
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
            "or os_name == 'not-an-os') and python_version >= '3'",
            # true: the parenthesised group is true
            "six==1.16.0 ; implementation_name == 'not-an-impl' "
            "or (python_version >= '3' and sys_platform == '%s')" % sys.platform,
            # false: the first clause matching must not short-circuit 'and'
            "idna==3.4 ; python_version >= '3' and python_version < '3.0'",
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
            "attrs==23.1.0 ; python_version < '3.0'",
            "idna==3.4 ; python_version >= '3'",
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
        line = "qux @ https://example.com/qux-1.0.tar.gz;python_version<'3'"
        try:
            Requirement.parse(line)
        except Exception:
            self.skipTest('this packaging version rejects the line')
        self.assertEqual(kept([line, "six==1.16.0"]), ['six'])

    def test_url_lines_marker_separators_and_options(self):
        self.assertEqual(kept([
            # space-form option after the marker
            "https://example.com/foo-1.0.tar.gz#egg=foo ; python_version < '3' --hash sha256:abc",
            # no space around ";" after the fragment, as pip <= 25 accepted
            "https://example.com/bar-1.0.tar.gz#egg=bar;python_version < '3'",
            "https://example.com/qux-1.0.tar.gz#egg=qux ;python_version < '3'",
            # ";" inside the URL is not a marker separator
            "https://example.com/baz;v=1/baz-1.0.tar.gz#egg=baz",
        ]), ['baz'])

    def test_malformed_marker_is_kept_without_crashing(self):
        stderr = StringIO()
        with patch.object(sys, 'stderr', stderr):
            result = kept([
                "https://example.com/foo-1.0.tar.gz#egg=foo ; python_version >>> '3'",
            ])
        self.assertEqual(result, ['foo'])
        self.assertIn('foo', stderr.getvalue())


class TestPipfileMarkers(unittest.TestCase):

    def test_pipfile_markers_are_evaluated(self):
        self.assertEqual(kept_pipfile([
            pipfile_req('cffi', "implementation_name == 'not-an-impl'"),
            pipfile_req('attrs', "python_version < '3.0'"),
            pipfile_req('idna', "platform_machine == 'not-a-machine'"),
            pipfile_req('six', "python_version >= '3' and os_name == '%s'" % os.name),
            pipfile_req('click', None),
        ]), ['six', 'click'])

    def test_malformed_pipfile_marker_is_kept_without_crashing(self):
        stderr = StringIO()
        with patch.object(sys, 'stderr', stderr):
            result = kept_pipfile([
                pipfile_req('stdeb', "sys_platform == 'linux' ; python_version != '3.4"),
            ])
        self.assertEqual(result, ['stdeb'])
        self.assertIn('stdeb', stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
