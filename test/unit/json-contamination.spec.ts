import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('JSON contamination prevention', () => {
  describe('when allowMissing=true with missing packages', () => {
    it('should produce valid JSON output despite stderr warnings', async () => {
      const fixturesPath = path.join(__dirname, '..', 'fixtures', 'missing-packages');
      const requirementsPath = path.join(fixturesPath, 'requirements.txt');
      const pythonScriptPath = path.join(__dirname, '..', '..', 'pysrc', 'pip_resolve.py');
      
      expect(fs.existsSync(requirementsPath)).toBe(true);
      expect(fs.existsSync(pythonScriptPath)).toBe(true);
      
      // Run the Python script with allowMissing=true
      const command = `python3 "${pythonScriptPath}" "${requirementsPath}" --allow-missing`;
      
      try {
        const { stdout, stderr } = await execAsync(command);
        
        // Verify stderr contains warnings (proves packages are missing)
        expect(stderr).toContain('Required packages missing');
        
        // Verify stdout contains valid JSON (proves no contamination)
        expect(stdout.trim()).toBeTruthy();
        
        // Parse JSON to verify it's valid
        let parsedJson;
        expect(() => {
          parsedJson = JSON.parse(stdout.trim());
        }).not.toThrow();
        
        // Verify basic structure of dependency tree
        expect(parsedJson).toHaveProperty('name');
        expect(parsedJson).toHaveProperty('version');
        expect(parsedJson).toHaveProperty('dependencies');
        expect(parsedJson).toHaveProperty('packageFormatVersion');

      } catch (error) {
        // If this fails, it means JSON contamination occurred
        fail(`JSON contamination detected: ${error.message}`);
      }
    }, 30000);

    it('should exit with error when allowMissing=false with missing packages', async () => {
      const fixturesPath = path.join(__dirname, '..', 'fixtures', 'missing-packages');
      const requirementsPath = path.join(fixturesPath, 'requirements.txt');
      const pythonScriptPath = path.join(__dirname, '..', '..', 'pysrc', 'pip_resolve.py');
      
      // Run the Python script with allowMissing=false (default)
      const command = `python3 "${pythonScriptPath}" "${requirementsPath}"`;
      
      try {
        await execAsync(command);
        fail('Expected script to exit with error when allowMissing=false');
      } catch (error) {
        // Verify it exits with error message about missing packages
        expect(error.message).toContain('Required packages missing');
        
        // Verify no JSON output was produced (stdout should be empty or contain only error)
        const stdout = (error as any).stdout || '';
        expect(stdout.trim()).not.toMatch(/^{.*}$/); // Should not start and end with JSON braces
        
        console.log('Correctly failed with:', error.message.substring(0, 200));
      }
    }, 10000);
  });
});
