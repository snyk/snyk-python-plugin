# run with:
# cd pysrc; python3 test_pipfile.py; cd ..

from pipfile import PipfileRequirement, parse
from collections import namedtuple

import unittest

try:
    from mock import patch
except:
    from unittest.mock import patch

class TestPipfileRequirement(unittest.TestCase):
    def test_init(self):
        req = PipfileRequirement("example")
        self.assertEqual(req.name, "example")
        self.assertFalse(req.editable)
        self.assertIsNone(req.vcs)
        self.assertIsNone(req.vcs_uri)
        self.assertIsNone(req.version)
        self.assertIsNone(req.markers)
        self.assertIsNone(req.provenance)

    def test_from_dict(self):
        test_cases = [
            {
                "input": {
                    "name": "example",
                    "requirement_dict": {
                        "version": '*',
                        "editable": True,
                        "git": 'git_uri',
                        "markers": 'sys_platform == "linux" ; python_version != "3.4"'
                    },
                    "pos_in_toml": (1, 2)
                },
                "expected_output": {
                    "name": "example",
                    "editable": True,
                    "vcs": "git",
                    "vcs_uri": "git_uri",
                    "version": "*",
                    "markers": 'sys_platform == "linux" ; python_version != "3.4"',
                    "provenance": ('Pipfile', 1, 1)
                }
            },
            {
                "input": {
                    "name": "example2",
                    "requirement_dict": {
                        "version": ('*', (9, 23)),
                        "editable": False,
                        "markers": ('sys_platform == "linux" ; python_version != "3.4"', (8, 36))
                    },
                    "pos_in_toml": (1, 2)
                },
                "expected_output": {
                    "name": "example2",
                    "editable": False,
                    "vcs": None,
                    "vcs_uri": None,
                    "version": "*",
                    "markers": 'sys_platform == "linux" ; python_version != "3.4"',
                    "provenance": ('Pipfile', 1, 1)
                }
            }
        ]
        for test_case in test_cases:
            test_input = test_case["input"]
            expected_output = test_case["expected_output"]
            req = PipfileRequirement.from_dict(test_input["name"], test_input["requirement_dict"], test_input["pos_in_toml"])
            self.assertEqual(str(req), str(expected_output))

    def test_parse(self):
        test_cases = [
            {
                "input": """
                    [packages]
                    requests = "*"
                    flask = { version = "1.0", markers = "python_version < '3.7'" }

                    [dev-packages]
                    pytest = "*"
                    """,
                "expected_output": {
                    "packages": [
                        {
                            "name": "flask",
                            "editable": False,
                            "vcs": None,
                            "vcs_uri": None,
                            "version": "1.0",
                            "markers": "python_version < \'3.7\'",
                            "provenance": ('Pipfile', 4, 4)
                        },
                        {
                            "name": "requests",
                            "editable": False,
                            "vcs": None,
                            "vcs_uri": None,
                            "version": "*",
                            "markers": None,
                            "provenance": ('Pipfile', 3, 3)
                        }
                    ],
                    "dev-packages": [
                        {
                            "name": "pytest",
                            "editable": False,
                            "vcs": None,
                            "vcs_uri": None,
                            "version": "*",
                            "markers": None,
                            "provenance": ('Pipfile', 7, 7)
                        }
                    ]
                }
            },
            {
                "input": """
                    [packages]
                    requests = {version = "==2.28.1"}

                    [requires]
                    python_version = "3.7"
                    """,
                "expected_output": {
                    "packages": [
                        {
                            "name": "requests",
                            "editable": False,
                            "vcs": None,
                            "vcs_uri": None,
                            "version": "==2.28.1",
                            "markers": None,
                            "provenance": ('Pipfile', 3, 3)
                        }
                    ],
                    "dev-packages": None,
                }
            },
            {
                "input": """
                    [[source]]
                    url = "https://pypi.org/simple"
                    verify_ssl = true
                    name = "pypi"

                    [packages]
                    "Jinja2" = "*"

                    [dev-packages]

                    [requires]
                    """,
                "expected_output": {
                    "packages": [
                        {
                            "name": "Jinja2",
                            "editable": False,
                            "vcs": None,
                            "vcs_uri": None,
                            "version": "*",
                            "markers": None,
                            "provenance": ('Pipfile', 8, 8)
                        }
                    ],
                    "dev-packages": [],
                }
            }
        ]
        
        for test_case in test_cases:
            pipfile_content = test_case["input"]
            expected_output = test_case["expected_output"]

            parsed_data = parse(pipfile_content)

            self.assertEqual(str(parsed_data), str(expected_output))


if __name__ == '__main__':
    unittest.main()
