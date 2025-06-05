import {
  EmptyManifestError,
  inspect,
  RequiredPackagesMissingError,
} from '../../lib';
import * as testUtils from '../test-utils';
import { chdirWorkspaces, ensureVirtualenv } from '../test-utils';
import * as depGraphLib from '@snyk/dep-graph';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { FILENAMES } from '../../lib/types';
import * as subProcess from '../../lib/dependencies/sub-process';
import { SpawnSyncReturns } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Usually the setup of virtual environments can run for a while
jest.setTimeout(180000);

interface Labels {
  pkgIdProvenance?: string;
  provenance?: string;
}

interface DependencyInfo {
  pkg: depGraphLib.Pkg;
  directDeps?: string[];
  labels?: Labels;
}

// This function is a helper to return the version a dependency gets resolved to in the graph
// (in case we aren't able to determine it). This is useful for transitive dependencies
// where the latest version of the package gets pulled in by a top level dependency.
// This latest version can vary between python version and is not consistent for testing with `compareTransitiveLines`
function getGraphPkg(
  graph: depGraphLib.DepGraph,
  depInfo: DependencyInfo
): depGraphLib.Pkg {
  const pkgs = graph.getPkgs();
  if (depInfo.pkg.version) {
    return depInfo.pkg;
  }
  return pkgs.filter((pkg) => pkg.name == depInfo.pkg.name)[0];
}

// We can't do a full dependency graph comparison, as generated dependency graphs vary wildly
// between Python versions. Instead, we ensure that the transitive lines are not broken.
function compareTransitiveLines(
  received: depGraphLib.DepGraph,
  expected: DependencyInfo[]
) {
  expected.forEach((depInfo: DependencyInfo) => {
    const pkg = getGraphPkg(received, depInfo);
    expect(received.directDepsLeadingTo(pkg).map((pkg) => pkg.name)).toEqual(
      depInfo.directDeps
    );
  });
}

function compareLabels(
  received: depGraphLib.DepGraph,
  expected: DependencyInfo[]
) {
  expected.forEach((depInfo: DependencyInfo) => {
    const pkg = getGraphPkg(received, depInfo);
    const expectLabel = received.getPkgNodes(pkg);
    expect(expectLabel).toContainEqual({
      info: {
        labels: depInfo.labels,
      },
    });
  });
}

describe('inspect', () => {
  const originalCurrentWorkingDirectory = process.cwd();

  afterEach(() => {
    process.chdir(originalCurrentWorkingDirectory);
  });

  describe('when doing inspect with --only-provenance', () => {
    let tearDown;
    beforeAll(() => {
      const workspace = 'pip-app';
      chdirWorkspaces(workspace);
      ensureVirtualenv(workspace);
      tearDown = testUtils.activateVirtualenv(workspace);
      testUtils.pipInstall();
    });

    afterAll(() => {
      tearDown();
    });

    it.each([
      {
        workspace: 'pip-app',
        targetFile: FILENAMES.pip.manifest,
      },
      {
        workspace: 'pipfile-pipapp',
        targetFile: FILENAMES.pipenv.manifest,
      },
      {
        workspace: 'setup_py-app',
        targetFile: FILENAMES.setuptools.manifest,
      },
      {
        workspace: 'pipfile-optional-dependencies',
        targetFile: FILENAMES.pipenv.manifest,
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace, targetFile }) => {
        testUtils.chdirWorkspaces(workspace);

        const result = await inspect('.', targetFile, {
          args: ['--only-provenance'],
        });
        expect(result.dependencyGraph.toJSON()).not.toEqual({});
      }
    );
  });

  describe('when testing pip projects', () => {
    let tearDown;
    afterEach(() => {
      tearDown();
    });

    it.each([
      {
        workspace: 'pip-app-local-whl-file',
        uninstallPackages: [],
        pluginOpts: { allowMissing: true },
        expected: [
          {
            pkg: {
              name: 'pandas',
            },
            directDeps: ['my-package'],
          },
        ],
      },
      {
        workspace: 'pip-app',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'jaraco.collections',
              version: '5.1.0',
            },
            directDeps: ['irc'],
          },
          {
            pkg: {
              name: 'django-appconf',
            },
            directDeps: ['django-select2'],
          },
        ],
      },
      {
        workspace: 'pip-app-bom',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-with-urls',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-without-markupsafe',
        uninstallPackages: ['MarkupSafe'],
        pluginOpts: { allowMissing: true },
        expected: [
          {
            pkg: {
              name: 'markupsafe',
              version: '?',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-not-installed',
        uninstallPackages: [],
        pluginOpts: { allowMissing: true },
        expected: [
          {
            pkg: {
              name: 's3transfer',
            },
            directDeps: ['awss'],
          },
        ],
      },
      {
        workspace: 'pip-app-trusted-host',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-with-dashes',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'dj-database-url',
              version: '0.4.2',
            },
            directDeps: ['dj-database-url'],
          },
        ],
      },
      {
        workspace: 'pip-app-with-openapi_spec_validator',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'jsonschema',
            },
            directDeps: ['jsonschema', 'openapi-spec-validator'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-conditional',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'posix-ipc',
              version: '1.0.0',
            },
            directDeps: ['posix-ipc'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-editable',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'posix-ipc',
              version: '1.0.0',
            },
            directDeps: ['posix-ipc'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-canonicalization',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'zope-interface',
            },
            directDeps: ['twisted'],
          },
          {
            pkg: {
              name: 'twisted',
              version: '23.10.0',
            },
            directDeps: ['twisted'],
          },
        ],
      },
      {
        workspace: 'pip-app-optional-dependencies',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'opentelemetry-distro',
              version: '0.35b0',
            },
            directDeps: ['opentelemetry-distro'],
          },
        ],
      },
      {
        workspace: 'pip-app-dev-alpha-beta-python-version',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'requests',
              version: '2.31.0',
            },
            directDeps: ['requests'],
          },
        ],
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace, uninstallPackages, pluginOpts, expected }) => {
        testUtils.chdirWorkspaces(workspace);
        testUtils.ensureVirtualenv(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.pipInstall();
        if (uninstallPackages) {
          uninstallPackages.forEach((pkg) => {
            testUtils.pipUninstall(pkg);
          });
        }

        const result = await inspect('.', FILENAMES.pip.manifest, pluginOpts);

        compareTransitiveLines(result.dependencyGraph, expected);
      }
    );

    it.each([
      {
        workspace: 'pip-app',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'jinja2',
              version: '2.7.2',
            },
            labels: {
              pkgIdProvenance: 'Jinja2@2.7.2',
            },
          },
          {
            pkg: {
              name: 'django-select2',
              version: '6.0.1',
            },
            labels: {
              pkgIdProvenance: 'Django-Select2@6.0.1',
            },
          },
          {
            pkg: {
              name: 'prometheus-client',
              version: '0.6.0',
            },
            labels: {
              pkgIdProvenance: 'prometheus_client@0.6.0',
            },
          },
        ],
      },
      {
        workspace: 'pip-app',
        uninstallPackages: [],
        pluginOpts: { args: ['--only-provenance'] },
        expected: [
          {
            pkg: {
              name: 'jinja2',
              version: '2.7.2',
            },
            labels: {
              pkgIdProvenance: 'Jinja2@2.7.2',
            },
          },
          {
            pkg: {
              name: 'django-select2',
              version: '6.0.1',
            },
            labels: {
              pkgIdProvenance: 'Django-Select2@6.0.1',
            },
          },
          {
            pkg: {
              name: 'prometheus-client',
              version: '0.6.0',
            },
            labels: {
              pkgIdProvenance: 'prometheus_client@0.6.0',
            },
          },
        ],
      },
      {
        workspace: 'pip-app-deps-conditional',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'posix-ipc',
              version: '1.0.0',
            },
            labels: {
              pkgIdProvenance: 'posix_ipc@1.0.0',
            },
          },
        ],
      },
      {
        workspace: 'pip-app-deps-editable',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'posix-ipc',
              version: '1.0.0',
            },
            labels: {
              pkgIdProvenance: 'posix_ipc@1.0.0',
            },
          },
        ],
      },
      {
        workspace: 'pip-app',
        uninstallPackages: ['Jinja2'],
        pluginOpts: { allowMissing: true },
        expected: [
          {
            pkg: {
              name: 'django-select2',
              version: '6.0.1',
            },
            labels: {
              pkgIdProvenance: 'Django-Select2@6.0.1',
            },
          },
        ],
      },
      {
        workspace: 'pip-app-deps-with-dashes',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'dj-database-url',
              version: '0.4.2',
            },
            labels: {
              pkgIdProvenance: 'dj_database_url@0.4.2',
            },
          },
          {
            pkg: {
              name: 'posix-ipc',
              version: '1.0.0',
            },
            labels: {
              pkgIdProvenance: 'posix_ipc@1.0.0',
            },
          },
        ],
      },
    ])(
      'should get correct pkgIdProvenance labels for packages in graph for workspace = $workspace',
      async ({ workspace, uninstallPackages, pluginOpts, expected }) => {
        testUtils.chdirWorkspaces(workspace);
        testUtils.ensureVirtualenv(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.pipInstall();
        if (uninstallPackages) {
          uninstallPackages.forEach((pkg) => {
            testUtils.pipUninstall(pkg);
          });
        }

        const result = await inspect('.', FILENAMES.pip.manifest, pluginOpts);
        compareLabels(result.dependencyGraph, expected);
      }
    );

    it('should succeed on package name/local dir name clash', async () => {
      const workspace = 'pip-app-local-dir';
      testUtils.chdirWorkspaces(workspace);
      testUtils.ensureVirtualenv(workspace);
      tearDown = testUtils.activateVirtualenv(workspace);
      testUtils.pipInstall();

      const result = await inspect('.', FILENAMES.pip.manifest);

      expect(result.dependencyGraph).not.toBe(undefined);
    });

    it.each([
      {
        workspace: 'pip-app',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'jaraco.collections',
              version: '5.1.0',
            },
            directDeps: ['irc'],
          },
          {
            pkg: {
              name: 'django-appconf',
            },
            directDeps: ['django-select2'],
          },
        ],
      },
      {
        workspace: 'pip-app-bom',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-with-urls',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-without-markupsafe',
        uninstallPackages: ['MarkupSafe'],
        pluginOpts: { allowMissing: true },
        expected: [
          {
            pkg: {
              name: 'markupsafe',
              version: '?',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-not-installed',
        uninstallPackages: [],
        pluginOpts: { allowMissing: true },
        expected: [
          {
            pkg: {
              name: 's3transfer',
            },
            directDeps: ['awss'],
          },
        ],
      },
      {
        workspace: 'pip-app-trusted-host',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-with-dashes',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'dj-database-url',
              version: '0.4.2',
            },
            directDeps: ['dj-database-url'],
          },
        ],
      },
      {
        workspace: 'pip-app-with-openapi_spec_validator',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'jsonschema',
            },
            directDeps: ['jsonschema', 'openapi-spec-validator'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-conditional',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'posix-ipc',
              version: '1.0.0',
            },
            directDeps: ['posix-ipc'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-editable',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'posix-ipc',
              version: '1.0.0',
            },
            directDeps: ['posix-ipc'],
          },
        ],
      },
      {
        workspace: 'pip-app-deps-canonicalization',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'zope-interface',
            },
            directDeps: ['twisted'],
          },
          {
            pkg: {
              name: 'twisted',
              version: '23.10.0',
            },
            directDeps: ['twisted'],
          },
        ],
      },
      {
        workspace: 'pip-app-optional-dependencies',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'opentelemetry-distro',
              version: '0.35b0',
            },
            directDeps: ['opentelemetry-distro'],
          },
        ],
      },
      {
        workspace: 'pip-app-dev-alpha-beta-python-version',
        uninstallPackages: [],
        pluginOpts: {},
        expected: [
          {
            pkg: {
              name: 'requests',
              version: '2.31.0',
            },
            directDeps: ['requests'],
          },
        ],
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace without setuptools previously installed',
      async ({ workspace, uninstallPackages, pluginOpts, expected }) => {
        testUtils.chdirWorkspaces(workspace);
        testUtils.ensureVirtualenv(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.pipUninstall('setuptools');
        testUtils.pipInstall();
        if (uninstallPackages) {
          uninstallPackages.forEach((pkg) => {
            testUtils.pipUninstall(pkg);
          });
        }

        const result = await inspect('.', FILENAMES.pip.manifest, pluginOpts);
        compareTransitiveLines(result.dependencyGraph, expected);
      }
    );

    it('should fail on missing transitive dependencies', async () => {
      const workspace = 'pip-app';
      const virtualEnv = 'pip-app-without-markupsafe';
      testUtils.chdirWorkspaces(workspace);
      testUtils.ensureVirtualenv(virtualEnv);
      tearDown = testUtils.activateVirtualenv(workspace);
      testUtils.pipInstall();
      testUtils.pipUninstall('MarkupSafe');

      await expect(
        async () => await inspect('.', FILENAMES.pip.manifest)
      ).rejects.toThrow('Required packages missing: markupsafe');
    });

    it('should fail on nonexistent referenced local depedency', async () => {
      const workspace = 'pip-app-local-nonexistent-file';
      testUtils.chdirWorkspaces(workspace);
      testUtils.ensureVirtualenv(workspace);
      tearDown = testUtils.activateVirtualenv(workspace);

      await expect(inspect('.', FILENAMES.pip.manifest)).rejects.toThrow(
        'Unparsable requirement line (Requirement line ./lib/nonexistent is a local path, but could not be parsed)'
      );
    });

    it('should not fail on nonexistent referenced local depedency when --skip-unresolved', async () => {
      const workspace = 'pip-app-local-nonexistent-file';
      testUtils.chdirWorkspaces(workspace);
      testUtils.ensureVirtualenv(workspace);
      tearDown = testUtils.activateVirtualenv(workspace);

      const result = await inspect('.', FILENAMES.pip.manifest, {
        allowMissing: true,
        allowEmpty: true,
      });

      expect(result.dependencyGraph.toJSON()).not.toEqual({});
    });
  });

  describe('Circular deps', () => {
    let tearDown;
    afterEach(() => {
      tearDown();
    });

    it('Should get a valid dependency graph for circular dependencies', async () => {
      const test_case = {
        workspace: 'pip-app-circular-deps',
        uninstallPackages: [],
        pluginOpts: { allowEmpty: true }, // For Python 3.12
        expected: [
          {
            pkg: {
              name: 'apache-airflow',
              version: '2.8.1',
            },
            directDeps: ['apache-airflow'],
          },
        ],
      };
      testUtils.chdirWorkspaces(test_case.workspace);
      testUtils.ensureVirtualenv(test_case.workspace);
      tearDown = testUtils.activateVirtualenv(test_case.workspace);
      testUtils.pipInstall();
      if (test_case.uninstallPackages) {
        test_case.uninstallPackages.forEach((pkg) => {
          testUtils.pipUninstall(pkg);
        });
      }

      const result = await inspect(
        '.',
        FILENAMES.pip.manifest,
        test_case.pluginOpts
      );
      expect(result).toHaveProperty('dependencyGraph');
    });
  });

  describe('poetry projects', () => {
    it('should return expected dependencies for poetry-app', async () => {
      const workspace = 'poetry-app';
      testUtils.chdirWorkspaces(workspace);

      const result = await inspect('.', FILENAMES.poetry.lockfile);
      expect(result).toMatchObject({
        plugin: {
          name: 'snyk-python-plugin',
          runtime: expect.any(String), // any version of Python
          targetFile: FILENAMES.poetry.manifest,
        },
        package: null, // no dep-tree
        dependencyGraph: {}, // match any dep-graph (equality checked below)
      });

      const builder = new DepGraphBuilder(
        { name: 'poetry' },
        { name: 'poetry-fixtures-project', version: '0.1.0' }
      );
      const expected = builder
        .addPkgNode({ name: 'jinja2', version: '2.11.3' }, 'jinja2', {
          labels: { scope: 'prod', pkgIdProvenance: 'Jinja2@2.11.3' },
        })
        .connectDep(builder.rootNodeId, 'jinja2')
        .addPkgNode({ name: 'markupsafe', version: '1.1.1' }, 'markupsafe', {
          labels: { scope: 'prod', pkgIdProvenance: 'MarkupSafe@1.1.1' },
        })
        .connectDep('jinja2', 'markupsafe')
        .build();

      expect(result.dependencyGraph.equals(expected)).toBeTruthy();
    });
    it('should return expected dependencies for poetry-v2-app', async () => {
      const workspace = 'poetry-v2-app';
      testUtils.chdirWorkspaces(workspace);

      const result = await inspect('.', FILENAMES.poetry.lockfile);
      expect(result).toMatchObject({
        plugin: {
          name: 'snyk-python-plugin',
          runtime: expect.any(String), // any version of Python
          targetFile: FILENAMES.poetry.manifest,
        },
        package: null, // no dep-tree
        dependencyGraph: {}, // match any dep-graph (equality checked below)
      });

      const builder = new DepGraphBuilder(
        { name: 'poetry' },
        { name: 'poetry-fixtures-project', version: '0.1.0' }
      );
      const expected = builder
        .addPkgNode({ name: 'jinja2', version: '3.1.5' }, 'jinja2', {
          labels: { scope: 'prod' },
        })
        .connectDep(builder.rootNodeId, 'jinja2')
        .addPkgNode({ name: 'markupsafe', version: '3.0.2' }, 'markupsafe', {
          labels: { scope: 'prod', pkgIdProvenance: 'MarkupSafe@3.0.2' },
        })
        .connectDep('jinja2', 'markupsafe')
        .addPkgNode({ name: 'isodd', version: '0.1.2' }, 'isodd', {
          labels: { scope: 'prod', pkgIdProvenance: 'isOdd@0.1.2' },
        })
        .connectDep(builder.rootNodeId, 'isodd')
        .build();

      expect(result.dependencyGraph.equals(expected)).toBeTruthy();
    });

    it('should return expected dependencies for poetry-optional-dependencies', async () => {
      const workspace = 'poetry-app-optional-dependencies';
      testUtils.chdirWorkspaces(workspace);

      const result = await inspect('.', FILENAMES.poetry.lockfile);

      const expected = [
        {
          pkg: {
            name: 'opentelemetry-distro',
            version: '0.35b0',
          },
          directDeps: ['opentelemetry-distro'],
        },
      ];

      compareTransitiveLines(result.dependencyGraph, expected);
    });

    it('should return expected dependencies for poetry-v2-app-optional-dependencies', async () => {
      const workspace = 'poetry-v2-app-optional-dependencies';
      testUtils.chdirWorkspaces(workspace);

      const result = await inspect('.', FILENAMES.poetry.lockfile);

      const expected = [
        {
          pkg: {
            name: 'opentelemetry-distro',
            version: '0.35b0',
          },
          directDeps: ['opentelemetry-distro'],
        },
      ];

      compareTransitiveLines(result.dependencyGraph, expected);
    });
  });

  it('should return correct target file for poetry project when relative path to poetry lock file is passed', async () => {
    const dirname = 'test/fixtures/poetry-project';
    const manifestFilePath = `${dirname}/poetry.lock`;

    const result = await inspect('.', manifestFilePath);

    const expectedTargetFile = `${dirname}/pyproject.toml`;
    expect(result.plugin.targetFile).toEqual(expectedTargetFile);
  });

  it('should return correct target file for poetry v2 project when relative path to poetry lock file is passed', async () => {
    const dirname = 'test/fixtures/poetry-v2-project';
    const manifestFilePath = `${dirname}/poetry.lock`;

    const result = await inspect('.', manifestFilePath);

    const expectedTargetFile = `${dirname}/pyproject.toml`;
    expect(result.plugin.targetFile).toEqual(expectedTargetFile);
  });

  describe('Pipfile projects', () => {
    const mockedExecuteSync = jest.spyOn(subProcess, 'executeSync');
    const mockedExecute = jest.spyOn(subProcess, 'execute');

    afterEach(() => {
      mockedExecuteSync.mockClear();
      mockedExecute.mockClear();
    });

    it('should return correct target file for pipenv project when relative path to pipfile lock file is passed', async () => {
      mockedExecuteSync.mockReturnValueOnce({
        status: 0,
      } as SpawnSyncReturns<Buffer>);
      mockedExecute.mockResolvedValueOnce('Python 3.9.5');
      mockedExecute.mockResolvedValueOnce(
        '{"name": "pipenv-app", "version": "0.0.0", "dependencies": {"jinja2": {"name": "jinja2", "version": "3.0.1", "dependencies": {"MarkupSafe": {"name": "markupsafe", "version": "2.0.1"}}}}, "packageFormatVersion": "pip:0.0.1"}'
      );
      const dirname = 'test/fixtures/pipenv-project';
      const manifestFilePath = `${dirname}/Pipfile`;
      const result = await inspect('.', manifestFilePath);
      const expectedTargetFile = `${dirname}/Pipfile`;
      expect(result.plugin.targetFile).toEqual(expectedTargetFile);
    });
  });

  describe('when testing pipenv projects simulating pipenv install', () => {
    let tearDown;

    afterAll(() => {
      tearDown();
    });

    it.each([
      {
        workspace: 'pipfile-pipapp-pinned',
        targetFile: undefined,
      },
      {
        workspace: 'pipenv-app',
        targetFile: undefined,
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace, targetFile }) => {
        testUtils.chdirWorkspaces(workspace);
        testUtils.ensureVirtualenv(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.pipenvInstall();
        testUtils.chdirWorkspaces(workspace);
        const result = await inspect(
          '.',
          targetFile ? targetFile : FILENAMES.pipenv.manifest
        );

        const expected = [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ];
        compareTransitiveLines(result.dependencyGraph, expected);
      }
    );

    it.each([
      {
        workspace: 'pipfile-pipapp-pinned',
        targetFile: undefined,
        expected: [
          {
            pkg: {
              name: 'jinja2',
              version: '2.7.2',
            },
            labels: {
              pkgIdProvenance: 'Jinja2@2.7.2',
            },
          },
          {
            pkg: {
              name: 'django-select2',
              version: '6.0.1',
            },
            labels: {
              pkgIdProvenance: 'Django-Select2@6.0.1',
            },
          },
        ],
      },
    ])(
      'should get correct pkgIdProvenance labels for packages in graph for workspace = $workspace',
      async ({ workspace, targetFile, expected }) => {
        testUtils.chdirWorkspaces(workspace);
        testUtils.ensureVirtualenv(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.pipenvInstall();
        testUtils.chdirWorkspaces(workspace);
        const result = await inspect(
          '.',
          targetFile ? targetFile : FILENAMES.pipenv.manifest
        );
        compareLabels(result.dependencyGraph, expected);
      }
    );
  });

  describe('when generating Pipfile depGraphs ', () => {
    let tearDown;
    beforeAll(() => {
      const workspace = 'pip-app';
      testUtils.chdirWorkspaces(workspace);
      testUtils.ensureVirtualenv(workspace);
      tearDown = testUtils.activateVirtualenv(workspace);
      testUtils.pipInstall();
    });

    afterAll(() => {
      tearDown();
    });

    it.each([
      {
        workspace: 'pipfile-pipapp-pinned',
      },
      {
        workspace: 'pipenv-app',
      },
      {
        workspace: 'pipfile-pipapp',
        targetFile: undefined,
      },
      {
        workspace: 'pipfile-nested-dirs',
        targetFile: 'nested/directory/Pipfile',
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace, targetFile }) => {
        testUtils.chdirWorkspaces(workspace);
        const result = await inspect(
          '.',
          targetFile ? targetFile : FILENAMES.pipenv.manifest
        );

        const expected = [
          {
            pkg: {
              name: 'markupsafe',
            },
            directDeps: ['jinja2'],
          },
        ];
        compareTransitiveLines(result.dependencyGraph, expected);
      }
    );

    it('should fail with no deps or dev-deps', async () => {
      testUtils.chdirWorkspaces('pipfile-empty');
      await expect(
        async () => await inspect('.', FILENAMES.pipenv.manifest)
      ).rejects.toThrow('No dependencies detected in manifest');
    });
  });

  describe('setup.py projects', () => {
    const mockedExecuteSync = jest.spyOn(subProcess, 'executeSync');
    const mockedExecute = jest.spyOn(subProcess, 'execute');

    afterEach(() => {
      mockedExecuteSync.mockClear();
      mockedExecute.mockClear();
    });

    it('should return correct target file for setuptools project when relative path to setup lock file is passed', async () => {
      mockedExecute.mockResolvedValueOnce('Python 3.9.5');
      mockedExecute.mockResolvedValueOnce(
        '{"name": "pipenv-app", "version": "0.0.0", "dependencies": {"jinja2": {"name": "jinja2", "version": "3.0.1", "dependencies": {"MarkupSafe": {"name": "markupsafe", "version": "2.0.1"}}}}, "packageFormatVersion": "pip:0.0.1"}'
      );
      const dirname = 'test/fixtures/setuptools-project';
      const manifestFilePath = `${dirname}/setup.py`;
      const result = await inspect('.', manifestFilePath);
      const expectedTargetFile = `${dirname}/setup.py`;
      expect(result.plugin.targetFile).toEqual(expectedTargetFile);
    });
  });

  describe('setup.py projects without mocks', () => {
    let tearDown;

    afterAll(() => {
      tearDown();
    });

    it.each([
      {
        workspace: 'setup_py-app',
        targetFile: FILENAMES.setuptools.manifest,
        expected: [
          {
            pkg: {
              name: 'django-select2',
              version: '6.0.1',
            },
            labels: {
              pkgIdProvenance: 'Django-Select2@6.0.1',
            },
          },
        ],
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace, targetFile, expected }) => {
        testUtils.chdirWorkspaces(workspace);
        testUtils.ensureVirtualenv(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.setupPyInstall();
        testUtils.chdirWorkspaces(workspace);

        const result = await inspect('.', targetFile);
        compareLabels(result.dependencyGraph, expected);
      }
    );
  });

  describe('dep-graph', () => {
    const mockedExecuteSync = jest.spyOn(subProcess, 'executeSync');
    const mockedExecute = jest.spyOn(subProcess, 'execute');
    const expectedDepGraphPath = path.resolve(
      __dirname,
      '../fixtures/dence-dep-graph/expected.json'
    );

    beforeEach(() => {
      mockedExecuteSync.mockReturnValueOnce({
        status: 0,
      } as SpawnSyncReturns<Buffer>);
      mockedExecute.mockResolvedValueOnce('Python 3.9.5');
      mockedExecute.mockResolvedValueOnce(
        fs.readFileSync(
          'test/fixtures/dence-dep-graph/pip_resolve_output.json',
          'utf8'
        )
      );
    });

    afterEach(() => {
      mockedExecuteSync.mockClear();
      mockedExecute.mockClear();
    });

    it('should return dep graph for very dense input', async () => {
      const manifestFilePath = `test/fixtures/pipenv-project/Pipfile`;
      const result = await inspect('.', manifestFilePath);

      const expectedDepGraphData = require(expectedDepGraphPath);
      const expectedDepGraph = depGraphLib.createFromJSON(expectedDepGraphData);

      expect(result.dependencyGraph.equals(expectedDepGraph)).toBeTruthy();
    });

    it('projectName option should set the dep graph root node name', async () => {
      const manifestFilePath = `test/fixtures/pipenv-project/Pipfile`;
      const projectName = `${Date.now()}`;
      const result = await inspect('.', manifestFilePath, { projectName });

      const expectedDepGraphData = JSON.parse(
        fs
          .readFileSync(expectedDepGraphPath, 'utf8')
          .replace(/pip--62-01iNczXpgA9L/g, projectName)
      );
      const expectedDepGraph = depGraphLib.createFromJSON(expectedDepGraphData);

      expect(result.dependencyGraph.equals(expectedDepGraph)).toBeTruthy();
    });
  });

  describe('error scenarios', () => {
    const mockedExecuteSync = jest.spyOn(subProcess, 'executeSync');
    const mockedExecute = jest.spyOn(subProcess, 'execute');

    afterEach(() => {
      mockedExecuteSync.mockClear();
      mockedExecute.mockClear();
    });

    describe('manifest file is empty', () => {
      it('should throw EmptyManifestError', async () => {
        mockedExecute.mockResolvedValueOnce('Python 3.9.5');
        mockedExecute.mockRejectedValueOnce(
          'No dependencies detected in manifest.'
        );
        const manifestFilePath = 'path/to/requirements.txt';

        await expect(inspect('.', manifestFilePath)).rejects.toThrowError(
          new EmptyManifestError('No dependencies detected in manifest.')
        );
      });
    });

    describe('required packages were not installed', () => {
      it('should throw RequiredPackagesMissingError', async () => {
        mockedExecute.mockResolvedValueOnce('Python 3.9.5');
        mockedExecute.mockRejectedValueOnce('Required packages missing');
        const manifestFilePath = 'path/to/requirements.txt';

        await expect(inspect('.', manifestFilePath)).rejects.toThrowError(
          new RequiredPackagesMissingError(
            'Required packages missing\n' +
              'Please run `pip install -r path/to/requirements.txt`. If the issue persists try again with --skip-unresolved.'
          )
        );
      });
    });
  });
});
