# pysrc

This is the Python part of the snyk-python-plugin.

Given a fully installed Python package with its dependencies (using a virtual environment),
it analyzes and returns the dependency tree.

The Node.js code (from the `lib` directory) only sets up the environment and launches this
analyzer.

The entry point is `main` in `pip_resolve.py`.