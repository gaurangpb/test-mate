const FileParserService = require('../fileParserService');
const fs = require('fs').promises;
const { spawn } = require('child_process');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn()
  },
  existsSync: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('FileParserService', () => {
  let fileParserService;
  let mockSpawn;

  beforeEach(() => {
    fileParserService = new FileParserService();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup default mock for spawn
    mockSpawn = {
      stdin: {
        write: jest.fn(),
        end: jest.fn()
      },
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn()
    };
    
    spawn.mockReturnValue(mockSpawn);
    require('fs').existsSync.mockReturnValue(false); // Default to using dotnet run
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // Helper function to simulate Roslyn parser response
  function mockRoslynResponse(response) {
    const responseJson = JSON.stringify(response);
    let stdoutCallback;
    let closeCallback;
    
    mockSpawn.stdout.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        stdoutCallback = callback;
      }
    });
    
    mockSpawn.stderr.on.mockImplementation(() => {});
    
    mockSpawn.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        closeCallback = callback;
        // Simulate receiving data and closing
        setTimeout(() => {
          if (stdoutCallback) {
            stdoutCallback(Buffer.from(responseJson));
          }
          if (closeCallback) {
            closeCallback(0);
          }
        }, 0);
      }
    });
    
    return new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }

  describe('parseTestMethods', () => {
    it('should parse test methods without IDs', async () => {
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

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: 'public void TestMethod1() { }' },
          { name: 'TestMethod2', hasTestCaseId: true, adoId: '123', tags: [], hasTestCaseParams: false, code: 'public void TestMethod2() { }' }
        ]
      });

      const result = await fileParserService.parseTestMethods(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('TestMethod1');
      expect(result[0].hasTestCaseId).toBe(false);
    });

    it('should not include test methods with IDs', async () => {
      const content = `
        [Test]
        [Property("ADOTestCaseId", "123")]
        public void TestMethod1() {
          // Test code
        }
      `;

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: true, adoId: '123', tags: [], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.parseTestMethods(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result).toHaveLength(0);
    });

    it('should handle custom property names', async () => {
      const content = `
        [Test]
        public void TestMethod1() {
          // Test code
        }
      `;

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.parseTestMethods(content, 'CustomProperty', '/path/to/file.cs');
      
      expect(result).toHaveLength(1);
    });
  });

  describe('analyzeTestFile', () => {
    it('should analyze test file with class name', async () => {
      const content = `
        [TestFixture]
        public class MyTestClass {
          [Test]
          public void TestMethod1() {
          }
        }
      `;

      await mockRoslynResponse({
        className: 'MyTestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.className).toBe('MyTestClass');
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].name).toBe('TestMethod1');
      expect(result.tests[0].hasTestCaseId).toBe(false);
    });

    it('should detect test case IDs', async () => {
      const content = `
        [Test]
        [Property("ADOTestCaseId", "123")]
        public void TestMethod1() {
        }
      `;

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: true, adoId: '123', tags: [], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('123');
    });

    it('should extract tags from Category attributes', async () => {
      const content = `
        [Test]
        [Category("Smoke")]
        [Category("Regression")]
        public void TestMethod1() {
        }
      `;

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: false, adoId: null, tags: ['Smoke', 'Regression'], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].tags).toContain('Smoke');
      expect(result.tests[0].tags).toContain('Regression');
    });

    it('should extract class-level tags', async () => {
      const content = `
        [Category("Integration")]
        [TestFixture]
        public class MyTestClass {
          [Test]
          public void TestMethod1() {
          }
        }
      `;

      await mockRoslynResponse({
        className: 'MyTestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: false, adoId: null, tags: ['Integration'], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].tags).toContain('Integration');
    });

    it('should exclude setup/teardown methods', async () => {
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

      await mockRoslynResponse({
        className: 'MyTestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].name).toBe('TestMethod1');
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

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestMethod1', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: 'public void TestMethod1() { }' }
        ]
      });

      const result = await fileParserService.scanForTestsWithoutIds('/test/path', 'ADOTestCaseId');
      
      expect(result).toHaveLength(1);
      expect(result[0].testMethods).toHaveLength(1);
      expect(result[0].className).toBe('TestClass');
      expect(result[0].fileName).toBe('TestFile.cs');
    });

    it('should return empty array when no tests found', async () => {
      fs.readdir = jest.fn()
        .mockResolvedValueOnce([]);

      const result = await fileParserService.scanForTestsWithoutIds('/test/path', 'ADOTestCaseId');
      
      expect(result).toHaveLength(0);
    });
  });

  // Comprehensive edge case tests for the parsing engine
  describe('analyzeTestFile - Edge Cases', () => {
    it('should correctly handle mixed tests with and without IDs (bug regression test)', async () => {
      const content = `
        namespace Web.Tests.API.Unit.Tests
        {
            public class CorrespondenceIopV1Tests : BaseAPIUnitTests
            {
                [Property("ADOTestCaseId", "1182313")]
                [Test, APIOnly]
                public async Task CorrespondenceApiPingTest()
                {
                    var resultPing = await CorrespondenceIopV1Requester.CorrespondenceIopV1Ping();
                    Assert.That(resultPing, Is.Not.Null);
                }

                [Test, APIOnly]
                public async Task CorrespondenceApiHealthTest()
                {
                    var resultHealth = await CorrespondenceIopV1Requester.CorrespondenceIopV1Health();
                    Assert.That(resultHealth, Is.Not.Null);
                }

                [Property("ADOTestCaseId", "1182327")]
                [Test, APIOnly, Test04]
                public async Task CorrespondenceIopVOutboundInitiatePOSTTest()
                {
                    var response = await CorrespondenceIopV1Requester.CorrespondenceIopV1OutboundInitiatePOST(_initiateInfo);
                    Assert.That(response.Data.statusCode, Is.EqualTo(202));
                }

                [Test, APIOnly, Test04]
                public async Task CorrespondenceIopV1OutboundInitiateGETTest()
                {
                    var initiatePostResponse = await CorrespondenceIopV1Requester.CorrespondenceIopV1OutboundInitiatePOST(_initiateInfo);
                    Assert.That(initiatePostResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK));
                }

                [Test, APIOnly, Test04]
                public async Task CorrespondenceIopV1OutboundRetrieveTest()
                {
                    var retrieveResponse = await CorrespondenceIopV1Requester.CorrespondenceIopV1OutboundRetrieve("test");
                    Assert.That(retrieveResponse.Data, Is.Not.Null);
                }
            }
        }
      `;

      await mockRoslynResponse({
        className: 'CorrespondenceIopV1Tests',
        tests: [
          { name: 'CorrespondenceApiPingTest', hasTestCaseId: true, adoId: '1182313', tags: [], hasTestCaseParams: false, code: '' },
          { name: 'CorrespondenceApiHealthTest', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' },
          { name: 'CorrespondenceIopVOutboundInitiatePOSTTest', hasTestCaseId: true, adoId: '1182327', tags: [], hasTestCaseParams: false, code: '' },
          { name: 'CorrespondenceIopV1OutboundInitiateGETTest', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' },
          { name: 'CorrespondenceIopV1OutboundRetrieveTest', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(5);
      
      // Test the exact scenario that was failing
      expect(result.tests[0].name).toBe('CorrespondenceApiPingTest');
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('1182313');
      
      expect(result.tests[1].name).toBe('CorrespondenceApiHealthTest');
      expect(result.tests[1].hasTestCaseId).toBe(false);
      expect(result.tests[1].adoId).toBe(null);
      
      expect(result.tests[2].name).toBe('CorrespondenceIopVOutboundInitiatePOSTTest');
      expect(result.tests[2].hasTestCaseId).toBe(true);
      expect(result.tests[2].adoId).toBe('1182327');
      
      expect(result.tests[3].name).toBe('CorrespondenceIopV1OutboundInitiateGETTest');
      expect(result.tests[3].hasTestCaseId).toBe(false);
      expect(result.tests[3].adoId).toBe(null);
      
      expect(result.tests[4].name).toBe('CorrespondenceIopV1OutboundRetrieveTest');
      expect(result.tests[4].hasTestCaseId).toBe(false);
      expect(result.tests[4].adoId).toBe(null);
      
      // Verify the summary counts
      const withIds = result.tests.filter(t => t.hasTestCaseId).length;
      const withoutIds = result.tests.filter(t => !t.hasTestCaseId).length;
      expect(withIds).toBe(2);
      expect(withoutIds).toBe(3);
    });

    it('should handle multiple Property attributes correctly', async () => {
      const content = `
        [Test]
        [Property("Title", "Test Title")]
        [Property("ADOTestCaseId", "123456")]
        [Property("Description", "Test Description")]
        public void TestWithMultipleProperties()
        {
        }
        
        [Test]
        [Property("Title", "Another Test")]
        [Property("Category", "Smoke")]
        public void TestWithoutADOId()
        {
        }
      `;

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestWithMultipleProperties', hasTestCaseId: true, adoId: '123456', tags: [], hasTestCaseParams: false, code: '' },
          { name: 'TestWithoutADOId', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(2);
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('123456');
      expect(result.tests[1].hasTestCaseId).toBe(false);
      expect(result.tests[1].adoId).toBe(null);
    });

    it('should handle class-level and method-level attributes together', async () => {
      const content = `
        [Category("Integration")]
        [Category("Smoke")]
        [TestFixture]
        public class MixedAttributeTests
        {
            [Test]
            [Category("Fast")]
            [Property("ADOTestCaseId", "111")]
            public void TestWithBothLevels()
            {
            }
            
            [Test]
            [Category("Slow")]
            public void TestMethodLevelOnly()
            {
            }
        }
      `;

      await mockRoslynResponse({
        className: 'MixedAttributeTests',
        tests: [
          { name: 'TestWithBothLevels', hasTestCaseId: true, adoId: '111', tags: ['Integration', 'Smoke', 'Fast'], hasTestCaseParams: false, code: '' },
          { name: 'TestMethodLevelOnly', hasTestCaseId: false, adoId: null, tags: ['Integration', 'Smoke', 'Slow'], hasTestCaseParams: false, code: '' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(2);
      
      // First test should have class-level + method-level tags
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('111');
      expect(result.tests[0].tags).toContain('Integration');
      expect(result.tests[0].tags).toContain('Smoke');
      expect(result.tests[0].tags).toContain('Fast');
      
      // Second test should have class-level + method-level tags but no ADO ID
      expect(result.tests[1].hasTestCaseId).toBe(false);
      expect(result.tests[1].adoId).toBe(null);
      expect(result.tests[1].tags).toContain('Slow');
    });

    it('should handle custom property names', async () => {
      const content = `
        [Test]
        [Property("CustomTestId", "CUSTOM123")]
        public void TestWithCustomProperty()
        {
        }
        
        [Test]
        [Property("ADOTestCaseId", "456")]
        public void TestWithADOProperty()
        {
        }
      `;

      await mockRoslynResponse({
        className: 'TestClass',
        tests: [
          { name: 'TestWithCustomProperty', hasTestCaseId: true, adoId: 'CUSTOM123', tags: [], hasTestCaseParams: false, code: '' },
          { name: 'TestWithADOProperty', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'CustomTestId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(2);
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('CUSTOM123');
      expect(result.tests[1].hasTestCaseId).toBe(false); // Should not match ADOTestCaseId when looking for CustomTestId
      expect(result.tests[1].adoId).toBe(null);
    });

    it('should handle adjacent tests without cross-contamination', async () => {
      const content = `
        public class AdjacentTests
        {
            [Property("ADOTestCaseId", "ADJ001")]
            [Test]
            public void FirstTestWithId() { }

            [Test]
            public void SecondTestNoId() { }

            [Test]
            public void ThirdTestNoId() { }

            [Property("ADOTestCaseId", "ADJ002")]
            [Test]
            public void FourthTestWithId() { }

            [Test]
            public void FifthTestNoId() { }
        }
      `;

      await mockRoslynResponse({
        className: 'AdjacentTests',
        tests: [
          { name: 'FirstTestWithId', hasTestCaseId: true, adoId: 'ADJ001', tags: [], hasTestCaseParams: false, code: '' },
          { name: 'SecondTestNoId', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' },
          { name: 'ThirdTestNoId', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' },
          { name: 'FourthTestWithId', hasTestCaseId: true, adoId: 'ADJ002', tags: [], hasTestCaseParams: false, code: '' },
          { name: 'FifthTestNoId', hasTestCaseId: false, adoId: null, tags: [], hasTestCaseParams: false, code: '' }
        ]
      });

      const result = await fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(5);
      
      expect(result.tests[0].name).toBe('FirstTestWithId');
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('ADJ001');
      
      expect(result.tests[1].name).toBe('SecondTestNoId');
      expect(result.tests[1].hasTestCaseId).toBe(false);
      expect(result.tests[1].adoId).toBe(null);
      
      expect(result.tests[2].name).toBe('ThirdTestNoId');
      expect(result.tests[2].hasTestCaseId).toBe(false);
      expect(result.tests[2].adoId).toBe(null);
      
      expect(result.tests[3].name).toBe('FourthTestWithId');
      expect(result.tests[3].hasTestCaseId).toBe(true);
      expect(result.tests[3].adoId).toBe('ADJ002');
      
      expect(result.tests[4].name).toBe('FifthTestNoId');
      expect(result.tests[4].hasTestCaseId).toBe(false);
      expect(result.tests[4].adoId).toBe(null);
    });
  });
});
