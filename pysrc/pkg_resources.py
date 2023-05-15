import sys

if sys.version_info >= (3, 0):
    from pkg_resources_py3 import *
else:
    from pkg_resources_py2 import *
