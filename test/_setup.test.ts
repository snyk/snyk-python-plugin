import { test } from 'tap';
import {
  ensureVirtualenv,
  chdirWorkspaces,
  activateVirtualenv,
  pipInstall,
} from './test-utils';

test('install requirements in "pip-app" venv (may take a while)', async (t) => {
  chdirWorkspaces('pip-app');
  ensureVirtualenv('pip-app');
  t.teardown(activateVirtualenv('pip-app'));
  try {
    pipInstall();
  } catch (error) {
    t.bailout(error);
  }
});
