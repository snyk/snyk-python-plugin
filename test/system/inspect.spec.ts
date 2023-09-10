import {
  EmptyManifestError,
  inspect,
  RequiredPackagesMissingError,
} from '../../lib';
import * as testUtils from '../test-utils';
import { chdirWorkspaces, ensureVirtualenv } from '../test-utils'; // Usually the setup of virtual environments can run for a while
import * as depGraphLib from '@snyk/dep-graph';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { FILENAMES } from '../../lib/types';
import * as subProcess from '../../lib/dependencies/sub-process';
import { SpawnSyncReturns } from 'child_process';
import * as fs from 'fs';
import * as path from 'path'; // Usually the setup of virtual environments can run for a while

// Usually the setup of virtual environments can run for a while
jest.setTimeout(120000);

describe('inspect', () => {
  const originalCurrentWorkingDirectory = process.cwd();

  afterEach(() => {
    process.chdir(originalCurrentWorkingDirectory);
  });

  describe('when testing setup.py projects', () => {
    let tearDown;
    afterEach(() => {
      tearDown();
    });

    it.each([
      {
        workspace: 'setup_py-app',
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace }) => {
        testUtils.chdirWorkspaces(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.setupPyInstall();

        const expectedDepGraphPath = path.resolve(
          __dirname,
          `../fixtures/${workspace}/expected.json`
        );
        const expected = JSON.parse(
          fs.readFileSync(expectedDepGraphPath).toString()
        );

        const result = await inspect('.', FILENAMES.setuptools.manifest);
        expect(result.dependencyGraph.toJSON()).toMatchObject(expected);
      }
    );
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
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace, targetFile }) => {
        testUtils.chdirWorkspaces(workspace);

        const expectedDepGraphPath = path.resolve(
          __dirname,
          `../fixtures/${workspace}-only-provenance/expected.json`
        );
        const expected = JSON.parse(
          fs.readFileSync(expectedDepGraphPath).toString()
        );

        const result = await inspect('.', targetFile, {
          args: ['--only-provenance'],
        });
        expect(result.dependencyGraph.toJSON()).toMatchObject(expected);
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
        workspace: 'pip-app',
        uninstallPackages: [],
        pluginOpts: {},
      },
      {
        workspace: 'pip-app-bom',
        uninstallPackages: [],
        pluginOpts: {},
      },
      {
        workspace: 'pip-app-deps-with-urls',
        uninstallPackages: [],
        pluginOpts: {},
      },
      {
        workspace: 'pip-app-without-markupsafe',
        uninstallPackages: ['MarkupSafe'],
        pluginOpts: { allowMissing: true },
      },
      {
        workspace: 'pip-app-deps-not-installed',
        uninstallPackages: [],
        pluginOpts: { allowMissing: true },
      },
      {
        workspace: 'pip-app-trusted-host',
        uninstallPackages: [],
        pluginOpts: {},
      },
      {
        workspace: 'pip-app-deps-with-dashes',
        uninstallPackages: [],
        pluginOpts: {},
      },
      {
        workspace: 'pip-app-with-openapi_spec_validator',
        uninstallPackages: [],
        pluginOpts: {},
      },
      {
        workspace: 'pip-app-deps-conditional',
        uninstallPackages: [],
        pluginOpts: {},
      },
      {
        workspace: 'pip-app-deps-editable',
        uninstallPackages: [],
        pluginOpts: {},
      },
    ])(
      'should get a valid dependency graph for workspace = $workspace',
      async ({ workspace, uninstallPackages, pluginOpts }) => {
        testUtils.chdirWorkspaces(workspace);
        testUtils.ensureVirtualenv(workspace);
        tearDown = testUtils.activateVirtualenv(workspace);
        testUtils.pipInstall();
        if (uninstallPackages) {
          uninstallPackages.forEach((pkg) => {
            testUtils.pipUninstall(pkg);
          });
        }

        const expectedDepGraphPath = path.resolve(
          __dirname,
          `../fixtures/${workspace}/expected.json`
        );
        const expected = JSON.parse(
          fs.readFileSync(expectedDepGraphPath).toString()
        );

        const result = await inspect('.', FILENAMES.pip.manifest, pluginOpts);
        expect(result.dependencyGraph.toJSON()).toMatchObject(expected);
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
        .addPkgNode({ name: 'jinja2', version: '2.11.2' }, 'jinja2', {
          labels: { scope: 'prod' },
        })
        .connectDep(builder.rootNodeId, 'jinja2')
        .addPkgNode({ name: 'markupsafe', version: '1.1.1' }, 'markupsafe', {
          labels: { scope: 'prod' },
        })
        .connectDep('jinja2', 'markupsafe')
        .build();

      expect(result.dependencyGraph.equals(expected)).toBeTruthy();
    });
  });

  it('should return correct target file for poetry project when relative path to poetry lock file is passed', async () => {
    const dirname = 'test/fixtures/poetry-project';
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

        const expectedDepGraphPath = path.resolve(
          __dirname,
          `../fixtures/${workspace}/expected.json`
        );
        const expected = JSON.parse(
          fs.readFileSync(expectedDepGraphPath).toString()
        );

        const result = await inspect(
          '.',
          targetFile ? targetFile : FILENAMES.pipenv.manifest
        );
        expect(result.dependencyGraph.toJSON()).toMatchObject(expected);
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
