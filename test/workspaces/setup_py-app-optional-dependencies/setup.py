from distutils.core import setup

setup(
    name="test_package",
    version="1.0.2",
    install_requires=[
        "opentelemetry-distro[otlp] == 0.35b0"
    ],
)