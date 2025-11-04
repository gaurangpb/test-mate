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
});

