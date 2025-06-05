#!/usr/bin/env python

from setuptools import setup, find_packages

setup(
    name="test_package",
    version="1.0.2",
    install_requires=[
        "Django==1.6.1",
        "python-etcd==0.4.5",
        "urllib3==1.26.16",
        "Django-Select2==6.0.1",
        "irc==16.2",
        "testtools==2.3.0",
        "jsonschema==4.23.0"
    ],
)
