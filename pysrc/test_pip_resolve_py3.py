# run with:
# cd pysrc; python3 test_pip_resolve.py; cd ..

from pip_resolve import satisfies_python_requirement, \
    matches_environment, \
    canonicalize_package_name
from collections import namedtuple

import unittest

try:
    from mock import patch
except:
    from unittest.mock import patch

class TestStringMethods(unittest.TestCase):

    def test_canonicalize_package_name(self):
        # https://packaging.python.org/guides/distributing-packages-using-setuptools/#name
        self.assertEqual(canonicalize_package_name("Cool-Stuff"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("Cool--.--Stuff"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("Cool--__.__--Stuff"), "cool.stuff")

        self.assertEqual(canonicalize_package_name("cool.stuff"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("COOL_STUFF"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("CoOl__-.-__sTuFF"), "cool.stuff")


    def test_satisfies_python_requirement(self):

        with patch('pip_resolve.sys') as mock_sys:
            mock_sys.version_info = (3, 5)
            self.assertTrue(satisfies_python_requirement('>', '3.1'))

            mock_sys.version_info = (3, 6)
            self.assertTrue(satisfies_python_requirement('==', '3.*'))

    def test_matches_environment(self):

        req = namedtuple('requirement', ['line'])

        with patch('pip_resolve.sys') as mock_sys:

            mock_sys.platform = "LInux2"
            req.line = "futures==3.2.0; sys_platform == 'linux2'"
            self.assertTrue(matches_environment(req))

            # BUG: sys_platform is always expected on the left side
            # mock_sys.platform = "win2000"
            # req.line = "futures==3.2.0; 'linux2' == sys_platform"
            # self.assertFalse(matches_environment(req))

            mock_sys.platform = "linux2"
            req.line = 'futures==3.2.0; sys_platform == "linux2"'
            self.assertTrue(matches_environment(req))

            mock_sys.platform = "win2000"
            req.line = "futures==3.2.0; sys_platform == 'linux2'"
            self.assertFalse    (matches_environment(req))

            mock_sys.platform = "linux"
            req.line = "jinja2==3.1.4 ; sys_platform == 'darwin' or sys_platform == 'linux'"
            self.assertTrue(matches_environment(req))

            mock_sys.platform = "darwin"
            req.line = "jinja2==3.1.4 ; sys_platform == 'darwin' or sys_platform == 'linux'"
            self.assertTrue(matches_environment(req))

            # BUG: Only == operator is supported in the moment
            # mock_sys.platform = "linux2"
            # req.line = "futures==3.2.0; sys_platform != 'linux2'"
            # self.assertTrue(matches_environment(req))

            # BUG: Expressions containing logical operators are not supported
            # mock_sys.platform = "win2000"
            # req.line = "futures==3.2.0; python_version == '2.6' and sys_platform == 'linux2'"
            # self.assertTrue(matches_environment(req))



if __name__ == '__main__':
    unittest.main()
