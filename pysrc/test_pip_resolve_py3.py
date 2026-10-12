# run with:
# cd pysrc; python3 test_pip_resolve.py; cd ..

from pip_resolve import canonicalize_package_name

import unittest
from test_markers import TestRequirementMarkers, TestPipfileMarkers  # noqa: F401

class TestStringMethods(unittest.TestCase):

    def test_canonicalize_package_name(self):
        # https://packaging.python.org/guides/distributing-packages-using-setuptools/#name
        self.assertEqual(canonicalize_package_name("Cool-Stuff"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("Cool--.--Stuff"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("Cool--__.__--Stuff"), "cool.stuff")

        self.assertEqual(canonicalize_package_name("cool.stuff"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("COOL_STUFF"), "cool.stuff")
        self.assertEqual(canonicalize_package_name("CoOl__-.-__sTuFF"), "cool.stuff")


if __name__ == '__main__':
    unittest.main()
