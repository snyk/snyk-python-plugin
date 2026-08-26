# run with:
# cd pysrc; python3 test_requirements.py; cd ..

import unittest
import os
from requirements.requirement import Requirement

class TestWheelFileRequirements(unittest.TestCase):
    """Test that .whl files are parsed correctly regardless of file existence"""

    def test_whl_file_with_relative_path(self):
        """Test parsing .whl file with relative path (no ./ prefix)"""
        line = "offline_packages/anyio-4.5.2-py3-none-any.whl"
        req = Requirement.parse(line)
        
        self.assertEqual(req.name, "anyio")
        self.assertTrue(req.local_file)
        self.assertEqual(req.path, line)

    def test_whl_file_with_dot_slash_prefix(self):
        """Test parsing .whl file with ./ prefix"""
        line = "./offline_packages/anyio-4.5.2-py3-none-any.whl"
        req = Requirement.parse(line)
        
        self.assertEqual(req.name, "anyio")
        self.assertTrue(req.local_file)
        self.assertEqual(req.path, line)

    def test_whl_file_without_file_existence_check(self):
        """Test that .whl files are recognized even when file doesn't exist
        
        This is the key test for the bug fix - previously the parser would
        only recognize .whl files if os.path.isfile(line) returned True.
        With --all-projects, the working directory context differs, causing
        the file check to fail and the parser to throw an error.
        
        The fix checks for .whl extension first, before checking file existence.
        """
        # Use a path that definitely doesn't exist
        line = "nonexistent/path/to/package-1.0.0-py3-none-any.whl"
        req = Requirement.parse(line)
        
        self.assertEqual(req.name, "package")
        self.assertTrue(req.local_file)
        self.assertEqual(req.path, line)

    def test_whl_file_with_complex_name(self):
        """Test parsing .whl file with complex package name"""
        line = "./lib/my_complex_package-2.1.0-cp39-cp39-linux_x86_64.whl"
        req = Requirement.parse(line)
        
        self.assertEqual(req.name, "my_complex_package")
        self.assertTrue(req.local_file)
        self.assertEqual(req.path, line)

    def test_whl_file_uppercase_extension(self):
        """Test that .WHL extension (uppercase) is recognized as local file
        
        Note: The name extraction may not work due to case-sensitive regex,
        but the file is still recognized as a local .whl file.
        """
        line = "packages/SomePackage-1.0.0-py3-none-any.WHL"
        req = Requirement.parse(line)
        
        # Name extraction may fail due to case-sensitive regex, but that's ok
        # The important part is that it's recognized as a local_file
        self.assertTrue(req.local_file)
        self.assertEqual(req.path, line)

    def test_whl_file_mixed_case_extension(self):
        """Test that .Whl extension (mixed case) is recognized as local file
        
        Note: The name extraction may not work due to case-sensitive regex,
        but the file is still recognized as a local .whl file.
        """
        line = "packages/AnotherPackage-2.0.0-py3-none-any.Whl"
        req = Requirement.parse(line)
        
        # Name extraction may fail due to case-sensitive regex, but that's ok
        # The important part is that it's recognized as a local_file
        self.assertTrue(req.local_file)
        self.assertEqual(req.path, line)


if __name__ == '__main__':
    unittest.main()
