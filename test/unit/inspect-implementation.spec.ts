import * as fs from 'fs';
import * as tmp from 'tmp';

import { inspectInstalledDeps } from '../../lib/dependencies/inspect-implementation';

jest.mock('tmp');

describe('Test inspect-implementation.ts', () => {
  describe('inspectInstalledDeps', () => {
    const dirSyncMock = tmp.dirSync as jest.MockedFunction<typeof tmp.dirSync>;

    beforeEach(() => {
      jest.resetModules();

      dirSyncMock.mockClear();
      dirSyncMock.mockReturnValue({
        name: 'tempDir',
        removeCallback: jest.fn(),
      });
    });

    afterEach(() => {
      try {
        fs.rmSync('tempDir', { recursive: true, force: true });
      } catch (e) {
        // Ignore error
      }
    });

    it('should call tmp.dirSync with tmpdir option when SNYK_TMP_PATH is set', async () => {
      const tmpDirPath = './test-temp-dir';

      await inspectInstalledDeps(
        'python3',
        [],
        '.',
        'test/unit/fixtures/requirements.txt',
        false,
        false,
        true,
        undefined,
        undefined,
        tmpDirPath
      );

      expect(dirSyncMock).toHaveBeenCalledWith({
        tmpdir: tmpDirPath,
        unsafeCleanup: true,
      });
      expect(dirSyncMock).toHaveBeenCalledTimes(1);
    });

    it('should call tmp.dirSync without tmpdir option when SNYK_TMP_PATH is not set', async () => {
      const tmpDirPath = undefined;

      await inspectInstalledDeps(
        'python3',
        [],
        '.',
        'test/unit/fixtures/requirements.txt',
        false,
        false,
        true,
        undefined,
        undefined,
        tmpDirPath
      );

      expect(dirSyncMock).toHaveBeenCalledWith({ unsafeCleanup: true });
      expect(dirSyncMock).toHaveBeenCalledTimes(1);
    });
  });
});
