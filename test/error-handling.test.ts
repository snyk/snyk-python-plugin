import { test } from 'tap';
import * as sinon from 'sinon';
import { join } from 'path';

import { inspect } from '../lib/index';

// Sinon mocks
import * as subProcess from '../lib/dependencies/sub-process';

test('returns error from subprocess with suggestion for the cause', async (t) => {
  const stub = sinon
    .stub(subProcess, 'execute')
    .throws(
      () =>
        `'Traceback (most recent call last):\n File "/tmp/tmp-38340UzUyyvr3Qqv/pip_resolve.py", line 7, in <module>\n import utils\n File "/tmp/tmp-38340UzUyyvr3Qqv/utils.py", line 8, in <module>\n from reqPackage import ReqPackage\n File "/tmp/tmp-38340UzUyyvr3Qqv/reqPackage.py", line 1, in <module>\n import pkg_resources\nImportError: No module named pkg_resources\n'`
    );

  t.teardown(stub.restore);

  await t.rejects(
    () =>
      inspect(
        join(__dirname, 'fixtures', 'updated-manifest', 'requirements.txt'),
        'requirements.txt'
      ),
    `'Traceback (most recent call last):\n File "/tmp/tmp-38340UzUyyvr3Qqv/pip_resolve.py", line 7, in <module>\n import utils\n File "/tmp/tmp-38340UzUyyvr3Qqv/utils.py", line 8, in <module>\n from reqPackage import ReqPackage\n File "/tmp/tmp-38340UzUyyvr3Qqv/reqPackage.py", line 1, in <module>\n import pkg_resources\nImportError: No module named pkg_resources\n'\nIs pip installed in your environment?`
  );
});
