import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { applyRemediationToManifests } from '../lib';
import { chdirWorkspaces, deactivateVirtualenv } from './test-utils';
import { activateVirtualenv, pipInstall } from './test-utils';

function readDirAsFiles(dir: string) {
  return readdirSync(dir).reduce(
    (files: { [fileName: string]: string }, fileName) => {
      files[fileName] = readFileSync(path.join(dir, fileName), 'utf8');
      return files;
    },
    {}
  );
}

describe('remediation', () => {
  beforeEach(() => {
    activateVirtualenv('remediation');
  });

  afterEach(() => {
    deactivateVirtualenv();
  });

  it('fixes a pip app', async () => {
    chdirWorkspaces('pip-app');
    pipInstall();

    const upgrades = {
      'Django@1.6.1': { upgradeTo: 'Django@2.0.1' },
      'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
    };

    const manifests = {
      'requirements.txt': readFileSync('requirements.txt', 'utf8'),
    };

    const expectedUpdatedManifests = readDirAsFiles(
      '../../fixtures/updated-manifest'
    );

    const result = await applyRemediationToManifests(
      '.',
      manifests,
      upgrades,
      {}
    );

    expect(result).toEqual(expectedUpdatedManifests);
  });

  it('retains python markers', async () => {
    chdirWorkspaces('pip-app-with-python-markers');
    pipInstall();

    const upgrades = {
      'click@7.0': { upgradeTo: 'click@7.1' },
    };

    const manifests = {
      'requirements.txt': readFileSync('requirements.txt', 'utf8'),
    };

    const expectedUpdatedManifests = readDirAsFiles(
      '../../fixtures/updated-manifests-with-python-markers'
    );

    const result = await applyRemediationToManifests(
      '.',
      manifests,
      upgrades,
      {}
    );

    expect(result).toEqual(expectedUpdatedManifests);
  });

  it('handles no-op upgrades', async () => {
    chdirWorkspaces('pip-app');
    pipInstall();

    const upgrades = {};

    const manifests = {
      'requirements.txt': readFileSync('requirements.txt', 'utf8'),
    };

    const result = await applyRemediationToManifests(
      '.',
      manifests,
      upgrades,
      {}
    );

    expect(result).toEqual(manifests);
  });

  it('cannot fix a Pipfile app', async () => {
    chdirWorkspaces('pipfile-pipapp');

    const upgrades = {
      'Django@1.6.1': { upgradeTo: 'Django@2.0.1' },
      'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
    };

    const manifests = {
      Pipfile: readFileSync('Pipfile', 'utf8'),
    };

    await expect(
      applyRemediationToManifests('.', manifests, upgrades, {})
    ).rejects.toMatchObject({
      message: 'Remediation only supported for requirements.txt file',
    });
  });
});
