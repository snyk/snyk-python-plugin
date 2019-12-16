import { readFileSync } from 'fs';
import * as path from 'path';
import { applyRemediationToManifests } from '../lib';

describe('remediation', () => {
  it('does not add extra new lines', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1' },
      'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
    };

    const manifests = {
      'requirements.txt': 'Django==1.6.1',
    };

    const expectedManifests = {
      'requirements.txt':
        'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability',
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    // Note no extra newline was added to the expected manifest
    expect(result).toEqual(expectedManifests);
  });

  it('ignores casing in upgrades (treats all as lowercase)', () => {
    const upgrades = {
      'Django@1.6.1': { upgradeTo: 'Django@2.0.1' },
    };

    const manifests = {
      'requirements.txt': 'django==1.6.1\n',
    };

    const expectedManifests = {
      'requirements.txt': 'django==2.0.1\n',
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    expect(result).toEqual(expectedManifests);
  });

  it('maintains package name casing when upgrading', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1' },
    };

    const manifests = {
      'requirements.txt': 'Django==1.6.1\n',
    };

    const expectedManifests = {
      'requirements.txt': 'Django==2.0.1\n',
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    expect(result).toEqual(expectedManifests);
  });

  it('maintains comments when upgrading', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1' },
    };

    const manifests = {
      'requirements.txt': 'django==1.6.1 # this is a comment\n',
    };

    const expectedManifests = {
      'requirements.txt': 'django==2.0.1 # this is a comment\n',
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    expect(result).toEqual(expectedManifests);
  });

  it('maintains version comparator when upgrading', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1' },
      'click@7.0': { upgradeTo: 'click@7.1' },
    };

    const manifests = {
      'requirements.txt': 'django>=1.6.1\nclick>7.0',
    };

    const expectedManifests = {
      'requirements.txt': 'django>=2.0.1\nclick>7.1',
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    expect(result).toEqual(expectedManifests);
  });

  it('fixes a pip app', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1' },
      'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
    };

    const manifests = {
      'requirements.txt': readFileSync(
        path.resolve('test', 'workspaces', 'pip-app', 'requirements.txt'),
        'utf8'
      ),
    };

    const expectedManifests = {
      'requirements.txt': readFileSync(
        path.resolve(
          'test',
          'fixtures',
          'updated-manifest',
          'requirements.txt'
        ),
        'utf8'
      ),
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    expect(result).toEqual(expectedManifests);
  });

  it('retains python markers', () => {
    const upgrades = {
      'click@7.0': { upgradeTo: 'click@7.1' },
    };

    const manifests = {
      'requirements.txt': readFileSync(
        path.resolve(
          'test',
          'workspaces',
          'pip-app-with-python-markers',
          'requirements.txt'
        ),
        'utf8'
      ),
    };

    const expectedManifests = {
      'requirements.txt': readFileSync(
        path.resolve(
          'test',
          'fixtures',
          'updated-manifests-with-python-markers',
          'requirements.txt'
        ),
        'utf8'
      ),
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    expect(result).toEqual(expectedManifests);
  });

  it('handles no-op upgrades', () => {
    const upgrades = {};

    const manifests = {
      'requirements.txt': readFileSync(
        path.resolve('test', 'workspaces', 'pip-app', 'requirements.txt'),
        'utf8'
      ),
    };

    const result = applyRemediationToManifests(manifests, upgrades);

    expect(result).toEqual(manifests);
  });

  it('cannot fix a Pipfile app', () => {
    const upgrades = {
      'Django@1.6.1': { upgradeTo: 'Django@2.0.1' },
      'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
    };

    const manifests = {
      Pipfile: readFileSync(
        path.resolve('test', 'workspaces', 'pipfile-pipapp', 'Pipfile'),
        'utf8'
      ),
    };

    expect(() => applyRemediationToManifests(manifests, upgrades)).toThrow(
      'Remediation only supported for requirements.txt file'
    );
  });
});
