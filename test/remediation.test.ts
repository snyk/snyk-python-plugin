import { test } from 'tap';
import * as fs from 'fs';
import * as path from 'path';

import plugin = require('../lib');
import { chdirWorkspaces } from './test-utils';
const testUtils = require('./test-utils') as any;

function readDirAsFiles(dir: string) {
  const res = {};
  fs.readdirSync(dir).forEach((fn) => {
    res[fn] = fs.readFileSync(path.join(dir, fn), 'utf8');
  });
  return res;
}

test('remediation with constraints.txt', async (t) => {
  chdirWorkspaces('pip-app');
  t.teardown(testUtils.activateVirtualenv('pip-app'));
  const upgrades = {
    'DJANGO@1.6.1': { upgradeTo: 'Django@2.0.1' }, // Note different capitalisation
    'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
  };

  const manifests = {
    'requirements.txt': fs.readFileSync('requirements.txt', 'utf8'),
    'constraints.txt': '',
  };

  const expectedUpdatedManifests = readDirAsFiles(
    '../../fixtures/updated-manifests-with-constraints'
  );

  const result = await plugin.applyRemediationToManifests(
    '.',
    manifests,
    upgrades,
    {}
  );

  t.same(result, expectedUpdatedManifests, 'remediation as expected');
});

test('remediation without constraints.txt', async (t) => {
  chdirWorkspaces('pip-app');
  t.teardown(testUtils.activateVirtualenv('pip-app'));
  const upgrades = {
    'Django@1.6.1': { upgradeTo: 'Django@2.0.1' },
    'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
  };

  const manifests = {
    'requirements.txt': fs.readFileSync('requirements.txt', 'utf8'),
  };

  const expectedUpdatedManifests = readDirAsFiles(
    '../../fixtures/updated-manifests-without-constraints'
  );

  const result = await plugin.applyRemediationToManifests(
    '.',
    manifests,
    upgrades,
    {}
  );

  t.same(result, expectedUpdatedManifests, 'remediation as expected');
});

// TODO(kyegupov): tests for other additional attributes
test('remediation - retains python markers', async (t) => {
  chdirWorkspaces('pip-app-with-python-markers');
  const venvCreated = testUtils.ensureVirtualenv('pip-app-with-python-markers');
  t.teardown(testUtils.activateVirtualenv('pip-app-with-python-markers'));
  if (venvCreated) {
    testUtils.pipInstall();
  }
  const upgrades = {
    'click@7.0': { upgradeTo: 'click@7.1' },
  };

  const manifests = {
    'requirements.txt': fs.readFileSync('requirements.txt', 'utf8'),
  };

  const expectedUpdatedManifests = readDirAsFiles(
    '../../fixtures/updated-manifests-with-python-markers'
  );

  const result = await plugin.applyRemediationToManifests(
    '.',
    manifests,
    upgrades,
    {}
  );

  t.same(result, expectedUpdatedManifests, 'remediation as expected');
});

test('remediation without constraints.txt - no-op upgrades', async (t) => {
  chdirWorkspaces('pip-app');
  t.teardown(testUtils.activateVirtualenv('pip-app'));
  const upgrades = {};

  const manifests = {
    'requirements.txt': fs.readFileSync('requirements.txt', 'utf8'),
  };

  const result = await plugin.applyRemediationToManifests(
    '.',
    manifests,
    upgrades,
    {}
  );

  t.same(result, manifests, 'remediation as expected (unchanged)');
});

test('remediation for Pipfile', async (t) => {
  chdirWorkspaces('pipfile-pipapp');
  t.teardown(testUtils.activateVirtualenv('pipfile-pipapp'));
  const upgrades = {
    'Django@1.6.1': { upgradeTo: 'Django@2.0.1' },
    'transitive@1.0.0': { upgradeTo: 'transitive@1.1.1' },
  };

  const manifests = {
    Pipfile: fs.readFileSync('Pipfile', 'utf8'),
  };

  try {
    await plugin.applyRemediationToManifests('.', manifests, upgrades, {});
    t.fail('expected exception');
  } catch (e) {
    t.match(
      e.message,
      'Remediation only supported for requirements.txt and constraints.txt files'
    );
  }
});
