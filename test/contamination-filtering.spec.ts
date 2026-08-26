import { parseJsonWithContaminationFiltering } from '../lib/dependencies/inspect-implementation';

describe('parseJsonWithContaminationFiltering', () => {
  const validDepTree = {
    name: 'test-project',
    version: '0.0.0',
    dependencies: {
      'pip-system-certs': {
        name: 'pip-system-certs',
        version: '4.0',
        dependencies: {
          wrapt: {
            name: 'wrapt',
            version: '1.17.2',
          },
        },
      },
    },
  };

  const validJsonString = JSON.stringify(validDepTree);

  describe('Strategy 1: Clean JSON (most common case)', () => {
    it('should parse clean JSON output successfully', () => {
      const result = parseJsonWithContaminationFiltering(validJsonString);
      expect(result).toEqual(validDepTree);
    });

    it('should handle JSON with extra whitespace', () => {
      const jsonWithWhitespace = `\n\n  ${validJsonString}  \n\n`;
      const result = parseJsonWithContaminationFiltering(jsonWithWhitespace);
      expect(result).toEqual(validDepTree);
    });
  });

  describe('Strategy 2: JSON extraction from contaminated output', () => {
    it('should extract valid JSON from output with prefix contamination', () => {
      const contaminatedOutput = `pip_system_certs configuration loaded\n${validJsonString}`;
      const result = parseJsonWithContaminationFiltering(contaminatedOutput);
      expect(result).toEqual(validDepTree);
    });

    it('should extract valid JSON from output with suffix contamination', () => {
      const contaminatedOutput = `${validJsonString}\npip_system certificate validation complete`;
      const result = parseJsonWithContaminationFiltering(contaminatedOutput);
      expect(result).toEqual(validDepTree);
    });

    it('should extract valid JSON from output with surrounding contamination', () => {
      const contaminatedOutput = `SSL certificate verification\n${validJsonString}\npip_system cleanup done`;
      const result = parseJsonWithContaminationFiltering(contaminatedOutput);
      expect(result).toEqual(validDepTree);
    });
  });

  describe('Strategy 2 edge cases', () => {
    it('should extract JSON using brace boundaries', () => {
      const contaminatedOutput = `prefix contamination ${validJsonString} suffix contamination`;
      const result = parseJsonWithContaminationFiltering(contaminatedOutput);
      expect(result).toEqual(validDepTree);
    });

    it('should find valid JSON line in multi-line output', () => {
      const multiLineOutput = [
        'Loading certificates...',
        'pip_system_certs initializing',
        validJsonString,
        'Cleanup complete',
      ].join('\n');

      const result = parseJsonWithContaminationFiltering(multiLineOutput);
      expect(result).toEqual(validDepTree);
    });
  });

  describe('Error handling', () => {
    it('should provide descriptive error with original output for debugging', () => {
      const invalidOutput = 'completely invalid output without JSON';
      expect(() => parseJsonWithContaminationFiltering(invalidOutput)).toThrow(
        /Failed to parse JSON output after contamination filtering.*Original output.*completely invalid/
      );
    });
  });
});
