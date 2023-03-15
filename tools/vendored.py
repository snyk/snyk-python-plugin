from path import path as Path


def write_contents_ts_module(dst_path: Path, src_path: Path):
    # Make sure this is in sync with pysrc/_vendor/.gitignore
    paths = []
    for path in src_path.walkfiles():
        paths.append(f'{Path("../..") / path}')
    with open(dst_path, 'w') as fp:
        fp.write("import * as path from 'path';\n\nconst PySrcContents = [\n")
        for path in sorted(paths):
            fp.write(f"    path.join(__dirname, {repr(path)}),\n")
        fp.write("];\n\nexport default PySrcContents;\n")


def main():
    vendor = Path('pysrc')
    write_contents_ts_module(Path('lib') / 'dependencies' / 'pysrc.ts', vendor)


if __name__ == '__main__':
    main()
