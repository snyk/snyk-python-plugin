from setuptools import setup, find_packages
setup(
    name='my_package',
    version='0.1.0',
    description='My awesome package',
    author='Your Name',
    author_email='your_email@example.com',
    packages=find_packages(),
    install_requires=['numpy', 'pandas'],
)