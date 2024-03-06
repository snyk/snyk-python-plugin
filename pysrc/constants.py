import os
from collections import namedtuple


DepsManagerItem = namedtuple(
    'DepsManagerItem', ['package_manager', 'file']
)


# TODO: When support for Python 2.7 - 3.3 will be removed, use Enums instead
#  of namedtuple, this is just a workaround to support Python2.7 syntax.
class DepsManager:
    PIP = DepsManagerItem(package_manager="pip", file="requirements.txt")
    PIPENV = DepsManagerItem(package_manager="pipenv", file="Pipfile")
    SETUPTOOLS = DepsManagerItem(package_manager="setuptools", file="setup.py")

    @classmethod
    def discover(cls, requirements_file_path):
        """Establishes the dependency manager based on the used files"""
        if os.path.basename(requirements_file_path) == 'Pipfile':
            return cls.PIPENV
        if os.path.basename(requirements_file_path) == 'setup.py':
            return cls.SETUPTOOLS

        return cls.PIP
