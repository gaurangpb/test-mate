const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const styleGuideLoader = require('../styleGuideLoader');

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn()
  },
  existsSync: jest.fn()
}));

describe('StyleGuideLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDefaultStyleGuide', () => {
    it('should return default style guide', () => {
      const defaultGuide = styleGuideLoader.getDefaultStyleGuide();
      
      expect(defaultGuide).toHaveProperty('formatting');
      expect(defaultGuide).toHaveProperty('terminology');
      expect(defaultGuide).toHaveProperty('structure');
      expect(defaultGuide).toHaveProperty('examples');
      expect(defaultGuide.formatting.actionFormat).toBe('imperative');
      expect(defaultGuide.terminology.preference).toBe('business');
    });
  });

  describe('loadStyleGuide', () => {
    it('should return default style guide when repoPath is not provided', async () => {
      const guide = await styleGuideLoader.loadStyleGuide(null);
      expect(guide).toEqual(styleGuideLoader.getDefaultStyleGuide());
    });

    it('should return default style guide when file does not exist', async () => {
      fsSync.existsSync.mockReturnValue(false);
      fs.readdir.mockResolvedValue([]);
      
      const guide = await styleGuideLoader.loadStyleGuide('/test/path');
      
      expect(guide).toEqual(styleGuideLoader.getDefaultStyleGuide());
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Style guide not found')
      );
    });

    it('should load and return style guide from file', async () => {
      const customGuide = {
        formatting: {
          actionFormat: 'declarative',
          stepGranularity: 'high'
        },
        terminology: {
          preference: 'technical',
          domainSpecificTerms: ['custom', 'terms']
        }
      };

      // Mock: file exists at root path
      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath === path.join('/test/path', 'test-style-guide.json');
      });
      fs.readFile.mockResolvedValue(JSON.stringify(customGuide));
      fs.readdir.mockResolvedValue([]);

      const guide = await styleGuideLoader.loadStyleGuide('/test/path');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/test/path', 'test-style-guide.json'),
        'utf-8'
      );
      expect(guide.formatting.actionFormat).toBe('declarative');
      expect(guide.formatting.stepGranularity).toBe('high');
      expect(guide.terminology.preference).toBe('technical');
      expect(guide.terminology.domainSpecificTerms).toEqual(['custom', 'terms']);
      // Should merge with defaults
      expect(guide.formatting.maxStepsPerTest).toBeDefined();
    });

    it('should handle invalid JSON gracefully', async () => {
      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath === path.join('/test/path', 'test-style-guide.json');
      });
      fs.readFile.mockResolvedValue('invalid json');
      fs.readdir.mockResolvedValue([]);

      const guide = await styleGuideLoader.loadStyleGuide('/test/path');

      expect(guide).toEqual(styleGuideLoader.getDefaultStyleGuide());
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath === path.join('/test/path', 'test-style-guide.json');
      });
      fs.readFile.mockRejectedValue(new Error('Permission denied'));
      fs.readdir.mockResolvedValue([]);

      const guide = await styleGuideLoader.loadStyleGuide('/test/path');

      expect(guide).toEqual(styleGuideLoader.getDefaultStyleGuide());
      expect(console.warn).toHaveBeenCalled();
    });

    it('should find style guide in subdirectory', async () => {
      const customGuide = {
        formatting: {
          actionFormat: 'declarative'
        }
      };

      // Mock: file exists in subdirectory
      fsSync.existsSync.mockImplementation((filePath) => {
        return filePath === path.join('/test/path', 'subdir', 'test-style-guide.json');
      });
      fs.readFile.mockResolvedValue(JSON.stringify(customGuide));
      
      // Mock readdir to return subdirectory (withFileTypes: true returns Dirent objects)
      fs.readdir.mockImplementation((dir, options) => {
        if (dir === '/test/path') {
          return Promise.resolve([
            { name: 'subdir', isDirectory: () => true, isFile: () => false }
          ]);
        }
        return Promise.resolve([]);
      });

      const guide = await styleGuideLoader.loadStyleGuide('/test/path');

      expect(guide.formatting.actionFormat).toBe('declarative');
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/test/path', 'subdir', 'test-style-guide.json'),
        'utf-8'
      );
    });
  });

  describe('validateAndMerge', () => {
    it('should merge custom guide with defaults', () => {
      const customGuide = {
        formatting: {
          actionFormat: 'declarative'
        }
      };

      const merged = styleGuideLoader.validateAndMerge(customGuide);

      expect(merged.formatting.actionFormat).toBe('declarative');
      expect(merged.formatting.maxStepsPerTest).toBeDefined(); // From default
      expect(merged.terminology.preference).toBe('business'); // From default
    });

    it('should handle partial style guide', () => {
      const partialGuide = {
        formatting: {
          maxStepsPerTest: 15
        }
      };

      const merged = styleGuideLoader.validateAndMerge(partialGuide);

      expect(merged.formatting.maxStepsPerTest).toBe(15);
      expect(merged.formatting.actionFormat).toBe('imperative'); // From default
    });
  });

  describe('buildStyleGuideInstructions', () => {
    it('should build instructions from style guide', () => {
      const styleGuide = {
        formatting: {
          actionFormat: 'imperative',
          expectedResultFormat: 'declarative',
          stepGranularity: 'medium',
          minStepsPerTest: 3,
          maxStepsPerTest: 10
        },
        terminology: {
          preference: 'business',
          technicalTermsAllowed: false,
          domainSpecificTerms: ['account', 'transaction']
        },
        structure: {
          includeSetupSteps: true,
          includeTeardownSteps: false,
          verificationRequired: true
        },
        examples: {
          goodAction: 'Navigate to the account page',
          badAction: 'Call getAccount() method'
        }
      };

      const instructions = styleGuideLoader.buildStyleGuideInstructions(styleGuide);

      expect(instructions).toContain('TEST DOCUMENTATION STYLE GUIDE');
      expect(instructions).toContain('Action format: imperative');
      expect(instructions).toContain('Language preference: business');
      expect(instructions).toContain('Include setup steps: yes');
      expect(instructions).toContain('Navigate to the account page');
      expect(instructions).toContain('Call getAccount() method');
    });

    it('should return empty string for null style guide', () => {
      const instructions = styleGuideLoader.buildStyleGuideInstructions(null);
      expect(instructions).toBe('');
    });

    it('should handle style guide with missing sections', () => {
      const partialGuide = {
        formatting: {
          actionFormat: 'imperative'
        }
      };

      const instructions = styleGuideLoader.buildStyleGuideInstructions(partialGuide);

      expect(instructions).toContain('TEST DOCUMENTATION STYLE GUIDE');
      expect(instructions).toContain('Action format: imperative');
    });
  });
});

