const FileParserService = require('../fileParserService');
const fs = require('fs').promises;
// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn()
  }
}));

describe('FileParserService', () => {
  let fileParserService;

  beforeEach(() => {
    fileParserService = new FileParserService();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('parseTestMethods', () => {
    it('should parse test methods without IDs', () => {
      const content = `
        [Test]
        public void TestMethod1() {
          // Test code
        }
        
        [Test]
        [Property("ADOTestCaseId", "123")]
        public void TestMethod2() {
          // Test code
        }
      `;

      const result = fileParserService.parseTestMethods(content, 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('TestMethod1');
      expect(result[0].hasTestCaseId).toBe(false);
    });

    it('should not include test methods with IDs', () => {
      const content = `
        [Test]
        [Property("ADOTestCaseId", "123")]
        public void TestMethod1() {
          // Test code
        }
      `;

      const result = fileParserService.parseTestMethods(content, 'ADOTestCaseId');
      
      expect(result).toHaveLength(0);
    });

    it('should handle custom property names', () => {
      const content = `
        [Test]
        public void TestMethod1() {
          // Test code
        }
      `;

      const result = fileParserService.parseTestMethods(content, 'CustomProperty');
      
      expect(result).toHaveLength(1);
    });
  });

  describe('analyzeTestFile', () => {
    it('should analyze test file with class name', () => {
      const content = `
        [TestFixture]
        public class MyTestClass {
          [Test]
          public void TestMethod1() {
          }
        }
      `;

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.className).toBe('MyTestClass');
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].name).toBe('TestMethod1');
      expect(result.tests[0].hasTestCaseId).toBe(false);
    });

    it('should detect test case IDs', () => {
      const content = `
        [Test]
        [Property("ADOTestCaseId", "123")]
        public void TestMethod1() {
        }
      `;

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('123');
    });

    it('should extract tags from Category attributes', () => {
      const content = `
        [Test]
        [Category("Smoke")]
        [Category("Regression")]
        public void TestMethod1() {
        }
      `;

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].tags).toContain('Smoke');
      expect(result.tests[0].tags).toContain('Regression');
    });

    it('should extract class-level tags', () => {
      const content = `
        [Category("Integration")]
        [TestFixture]
        public class MyTestClass {
          [Test]
          public void TestMethod1() {
          }
        }
      `;

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].tags).toContain('Integration');
    });

    it('should exclude setup/teardown methods', () => {
      const content = `
        [TestFixture]
        public class MyTestClass {
          [SetUp]
          public void Setup() {
          }
          
          [Test]
          public void TestMethod1() {
          }
        }
      `;

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].name).toBe('TestMethod1');
    });
  });

  describe('extractMethodCode', () => {
    it('should extract method code correctly', () => {
      const content = `
        public void TestMethod() {
          var x = 1;
          var y = 2;
        }
      `;

      const startIndex = content.indexOf('public void TestMethod');
      const result = fileParserService.extractMethodCode(content, startIndex);
      
      expect(result).toContain('TestMethod');
      expect(result).toContain('var x = 1');
    });

    it('should handle nested braces', () => {
      const content = `
        public void TestMethod() {
          if (true) {
            var x = 1;
          }
        }
      `;

      const startIndex = content.indexOf('public void TestMethod');
      const result = fileParserService.extractMethodCode(content, startIndex);
      
      expect(result).toContain('TestMethod');
      expect(result).toContain('if (true)');
    });
  });

  describe('findTestFiles', () => {
    it('should find test files', async () => {
      const mockEntries = [
        { name: 'TestFile.cs', isFile: () => true, isDirectory: () => false },
        { name: 'RegularFile.cs', isFile: () => true, isDirectory: () => false },
        { name: 'TestSpec.cs', isFile: () => true, isDirectory: () => false },
        { name: 'bin', isFile: () => false, isDirectory: () => true },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true }
      ];

      fs.readdir = jest.fn()
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce([]);

      const result = await fileParserService.findTestFiles('/test/path');
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(f => f.includes('TestFile'))).toBe(true);
    });

    it('should skip excluded directories', async () => {
      const mockEntries = [
        { name: 'bin', isFile: () => false, isDirectory: () => true },
        { name: 'obj', isFile: () => false, isDirectory: () => true },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true }
      ];

      fs.readdir = jest.fn()
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce([]);

      const result = await fileParserService.findTestFiles('/test/path');
      
      expect(result.length).toBe(0);
    });
  });

  describe('scanForTestsWithoutIds', () => {
    it('should scan for tests without IDs', async () => {
      const testContent = `
        [TestFixture]
        public class TestClass {
          [Test]
          public void TestMethod1() {
          }
        }
      `;

      fs.readdir = jest.fn()
        .mockResolvedValueOnce([
          { name: 'TestFile.cs', isFile: () => true, isDirectory: () => false }
        ])
        .mockResolvedValueOnce([]);

      fs.readFile = jest.fn().mockResolvedValue(testContent);

      const result = await fileParserService.scanForTestsWithoutIds('/test/path', 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].testMethods).toHaveLength(1);
    });

    it('should return empty array when no tests found', async () => {
      fs.readdir = jest.fn()
        .mockResolvedValueOnce([]);

      const result = await fileParserService.scanForTestsWithoutIds('/test/path', 'ADOTestCaseId');
      
      expect(result).toHaveLength(0);
    });
  });
});

