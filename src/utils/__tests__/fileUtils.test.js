const FileUtils = require('../fileUtils');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Mock fs modules
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn()
  },
  existsSync: jest.fn()
}));

describe('FileUtils', () => {
  let fileUtils;

  beforeEach(() => {
    fileUtils = new FileUtils();
    jest.clearAllMocks();
  });

  describe('browseDirectory', () => {
    it('should return default paths when no path provided', async () => {
      const result = await fileUtils.browseDirectory();
      
      expect(result).toHaveProperty('directories');
      expect(result).toHaveProperty('currentPath');
      expect(result.currentPath).toBe('');
      expect(result.directories.length).toBeGreaterThan(0);
    });

    it('should browse directory successfully', async () => {
      const mockEntries = [
        { name: 'dir1', isDirectory: () => true },
        { name: 'dir2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ];

      fs.readdir = jest.fn().mockResolvedValue(mockEntries);
      fsSync.existsSync = jest.fn().mockReturnValue(true);

      const result = await fileUtils.browseDirectory('/test/path');
      
      expect(result.directories).toHaveLength(2);
      expect(result.currentPath).toBe(path.resolve('/test/path'));
    });

    it('should throw error for invalid path', async () => {
      fsSync.existsSync = jest.fn().mockReturnValue(false);

      await expect(fileUtils.browseDirectory('/invalid/path'))
        .rejects.toThrow('Invalid path');
    });

    it('should handle readdir errors', async () => {
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readdir = jest.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(fileUtils.browseDirectory('/test/path'))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('generateMappingFile', () => {
    const mockTestCaseIds = [
      {
        testName: 'Test1',
        filePath: '/path/to/Test1Tests.cs',
        testCaseId: '123'
      },
      {
        testName: 'Test2',
        filePath: '/path/to/Test1Tests.cs',
        testCaseId: '456'
      }
    ];

    it('should generate mapping file without output path', async () => {
      const result = await fileUtils.generateMappingFile(mockTestCaseIds);
      
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('testCases');
      expect(result).toHaveProperty('summary');
      expect(result.metadata.totalTestCases).toBe(2);
      expect(result.testCases).toHaveLength(2);
    });

    it('should write mapping file to disk when output path provided', async () => {
      const outputPath = '/path/to/mapping.json';
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.generateMappingFile(mockTestCaseIds, outputPath);
      
      expect(result).toEqual({
        filePath: outputPath,
        created: true
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('"totalTestCases": 2'),
        'utf-8'
      );
    });

    it('should include ADO config in metadata when provided', async () => {
      const adoConfig = {
        organizationUrl: 'https://dev.azure.com/test',
        projectName: 'TestProject',
        testPlanId: '123',
        testSuiteId: '456'
      };

      const result = await fileUtils.generateMappingFile(mockTestCaseIds, null, adoConfig);
      
      expect(result.metadata.adoConfig).toEqual({
        organizationUrl: adoConfig.organizationUrl,
        projectName: adoConfig.projectName,
        testPlanId: adoConfig.testPlanId,
        testSuiteId: adoConfig.testSuiteId
      });
    });

    it('should use custom property name', async () => {
      const result = await fileUtils.generateMappingFile(mockTestCaseIds, null, null, 'CustomProperty');
      
      expect(result.metadata.testPropertyName).toBe('CustomProperty');
    });
  });

  describe('writeTestIdsToFiles', () => {
    it('should write test IDs to files successfully', async () => {
      const testCaseIds = [
        {
          testName: 'TestMethod1',
          filePath: '/path/to/TestFile.cs',
          testCaseId: '123'
        }
      ];

      const fileContent = `
        [Test]
        public void TestMethod1() {
        }
      `;

      fs.readFile = jest.fn().mockResolvedValue(fileContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.writeTestIdsToFiles(testCaseIds, 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
      expect(result[0].testsUpdated).toBe(1);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should group tests by file path', async () => {
      const testCaseIds = [
        {
          testName: 'TestMethod1',
          filePath: '/path/to/TestFile.cs',
          testCaseId: '123'
        },
        {
          testName: 'TestMethod2',
          filePath: '/path/to/TestFile.cs',
          testCaseId: '456'
        }
      ];

      const fileContent = `
        [Test]
        public void TestMethod1() {
        }
        
        [Test]
        public void TestMethod2() {
        }
      `;

      fs.readFile = jest.fn().mockResolvedValue(fileContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.writeTestIdsToFiles(testCaseIds, 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].testsUpdated).toBe(2);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should handle file read errors', async () => {
      const testCaseIds = [
        {
          testName: 'TestMethod1',
          filePath: '/path/to/TestFile.cs',
          testCaseId: '123'
        }
      ];

      fs.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

      const result = await fileUtils.writeTestIdsToFiles(testCaseIds, 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(false);
      expect(result[0].error).toBe('File not found');
    });

    it('should handle test not found in file', async () => {
      const testCaseIds = [
        {
          testName: 'NonExistentTest',
          filePath: '/path/to/TestFile.cs',
          testCaseId: '123'
        }
      ];

      const fileContent = `
        [Test]
        public void OtherTest() {
        }
      `;

      fs.readFile = jest.fn().mockResolvedValue(fileContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.writeTestIdsToFiles(testCaseIds, 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(false);
      expect(result[0].error).toContain('No changes made');
    });

    it('should update existing property attribute', async () => {
      const testCaseIds = [
        {
          testName: 'TestMethod1',
          filePath: '/path/to/TestFile.cs',
          testCaseId: '456'
        }
      ];

      const fileContent = `
        [Property("ADOTestCaseId", "123")]
        [Test]
        public void TestMethod1() {
        }
      `;

      fs.readFile = jest.fn().mockResolvedValue(fileContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.writeTestIdsToFiles(testCaseIds, 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/TestFile.cs',
        expect.stringContaining('[Property("ADOTestCaseId", "456")]'),
        'utf-8'
      );
    });
  });

  describe('readDomainContext', () => {
    it('should return null when contextFilePath is not provided', async () => {
      const result = await fileUtils.readDomainContext(null);
      expect(result).toBeNull();
    });

    it('should return null when file does not exist', async () => {
      fsSync.existsSync = jest.fn().mockReturnValue(false);

      const result = await fileUtils.readDomainContext('/path/to/context.md');
      expect(result).toBeNull();
    });

    it('should read markdown file successfully', async () => {
      const content = '## Domain Context\n\nTest content';
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(content);

      const result = await fileUtils.readDomainContext('/path/to/context.md');
      expect(result).toBe(content);
    });

    it('should parse and format JSON file', async () => {
      const jsonContent = '{"key": "value"}';
      const formattedJson = JSON.stringify({ key: 'value' }, null, 2);
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(jsonContent);

      const result = await fileUtils.readDomainContext('/path/to/context.json');
      expect(result).toBe(formattedJson);
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{invalid json}';
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(invalidJson);

      const result = await fileUtils.readDomainContext('/path/to/context.json');
      expect(result).toBe(invalidJson); // Should return as plain text
    });

    it('should handle read errors', async () => {
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await fileUtils.readDomainContext('/path/to/context.md');
      expect(result).toBeNull();
    });
  });

  describe('saveDomainContext', () => {
    it('should throw error when contextFilePath is missing', async () => {
      await expect(fileUtils.saveDomainContext(null, 'content'))
        .rejects.toThrow('Context file path and content are required');
    });

    it('should throw error when content is missing', async () => {
      await expect(fileUtils.saveDomainContext('/path/to/context.md', null))
        .rejects.toThrow('Context file path and content are required');
    });

    it('should create new file when it does not exist', async () => {
      const content = '## New Context\n\nContent here';
      fsSync.existsSync = jest.fn().mockReturnValue(false);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.saveDomainContext('/path/to/domain-context.md', content);

      expect(result).toEqual({ created: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.resolve('/path/to/domain-context.md'),
        content,
        'utf-8'
      );
    });

    it('should replace existing file when it exists', async () => {
      const content = '## Updated Context\n\nUpdated content here';
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.saveDomainContext('/path/to/domain-context.md', content);

      expect(result).toEqual({ created: false });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.resolve('/path/to/domain-context.md'),
        content,
        'utf-8'
      );
    });

    it('should handle write errors', async () => {
      fsSync.existsSync = jest.fn().mockReturnValue(false);
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Write failed'));

      await expect(fileUtils.saveDomainContext('/path/to/domain-context.md', 'content'))
        .rejects.toThrow('Write failed');
    });

    it('should save content with <!-- NEW --> comments removed (if any)', async () => {
      const content = '## Context\n\n<!-- NEW -->\nNew item\n\nExisting item';
      fsSync.existsSync = jest.fn().mockReturnValue(false);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.saveDomainContext('/path/to/domain-context.md', content);

      expect(result).toEqual({ created: true });
      // Note: Comment removal happens in the client, but we verify the method saves whatever content is passed
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.resolve('/path/to/domain-context.md'),
        content,
        'utf-8'
      );
    });
  });

  describe('mergeDomainContext', () => {
    it('should throw error when contextFilePath is missing', async () => {
      await expect(fileUtils.mergeDomainContext(null, 'content'))
        .rejects.toThrow('Context file path and new content are required');
    });

    it('should throw error when newContent is missing', async () => {
      await expect(fileUtils.mergeDomainContext('/path/to/context.md', null))
        .rejects.toThrow('Context file path and new content are required');
    });

    it('should create new file when it does not exist', async () => {
      const newContent = '## New Context\n\nContent here';
      fsSync.existsSync = jest.fn().mockReturnValue(false);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.mergeDomainContext('/path/to/domain-context.md', newContent);

      expect(result).toEqual({ created: true, merged: false });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.resolve('/path/to/domain-context.md'),
        newContent,
        'utf-8'
      );
    });

    it('should merge new sections that do not exist', async () => {
      const existingContent = '# Existing Context\n\n## Section 1\n\nContent 1';
      const newContent = '## Section 2\n\nContent 2\n\n## Section 3\n\nContent 3';

      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(existingContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.mergeDomainContext('/path/to/domain-context.md', newContent);

      expect(result).toEqual({ created: false, merged: true, newSectionsCount: 2 });
      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('# Existing Context');
      expect(writtenContent).toContain('## Section 1');
      expect(writtenContent).toContain('## Section 2');
      expect(writtenContent).toContain('## Section 3');
      expect(writtenContent).toContain('Content 2');
      expect(writtenContent).toContain('Content 3');
    });

    it('should not duplicate existing sections', async () => {
      const existingContent = '# Existing Context\n\n## Section 1\n\nContent 1';
      const newContent = '## Section 1\n\nDifferent content\n\n## Section 2\n\nNew content';

      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(existingContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.mergeDomainContext('/path/to/domain-context.md', newContent);

      expect(result).toEqual({ created: false, merged: true, newSectionsCount: 1 });
      const writeCall = fs.writeFile.mock.calls[0];
      expect(writeCall[1]).toContain('## Section 2');
      expect(writeCall[1]).not.toContain('Different content'); // Should not add duplicate Section 1
    });

    it('should append entire content when no headers found', async () => {
      const existingContent = 'Existing content';
      const newContent = 'New content without headers';

      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(existingContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      const result = await fileUtils.mergeDomainContext('/path/to/domain-context.md', newContent);

      expect(result).toEqual({ created: false, merged: true, newSectionsCount: 0 });
      const writeCall = fs.writeFile.mock.calls[0];
      expect(writeCall[1]).toContain('Existing content');
      expect(writeCall[1]).toContain('---');
      expect(writeCall[1]).toContain('New content without headers');
    });

    it('should handle write errors', async () => {
      fsSync.existsSync = jest.fn().mockReturnValue(false);
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Write failed'));

      await expect(fileUtils.mergeDomainContext('/path/to/domain-context.md', 'content'))
        .rejects.toThrow('Write failed');
    });
  });
});

