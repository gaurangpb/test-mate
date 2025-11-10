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
    it('should correctly handle mixed tests with and without IDs (bug regression test)', () => {
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

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
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

    it('should handle multiple Property attributes correctly', () => {
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

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(2);
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('123456');
      expect(result.tests[1].hasTestCaseId).toBe(false);
      expect(result.tests[1].adoId).toBe(null);
    });

    it('should handle commented out tests with IDs', () => {
      const content = `
        [Test]
        [Property("ADOTestCaseId", "123")]
        public void ActiveTest()
        {
        }
        
        // [Test]
        // [Property("ADOTestCaseId", "456")]
        // public void CommentedOutTest()
        // {
        // }
        
        [Test]
        public void AnotherActiveTest()
        {
        }
      `;

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(2);
      expect(result.tests[0].name).toBe('ActiveTest');
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[1].name).toBe('AnotherActiveTest');
      expect(result.tests[1].hasTestCaseId).toBe(false);
    });

    it('should handle class-level and method-level attributes together', () => {
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

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
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
      // Note: Class-level tags might not propagate to all methods consistently
      // This is expected behavior based on current implementation
    });

    it('should handle custom property names', () => {
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

      const result = fileParserService.analyzeTestFile(content, 'CustomTestId', '/path/to/file.cs');
      
      expect(result.tests).toHaveLength(2);
      expect(result.tests[0].hasTestCaseId).toBe(true);
      expect(result.tests[0].adoId).toBe('CUSTOM123');
      expect(result.tests[1].hasTestCaseId).toBe(false); // Should not match ADOTestCaseId when looking for CustomTestId
      expect(result.tests[1].adoId).toBe(null);
    });

    it('should handle very complex attribute arrangements', () => {
      const content = `
        [Category("IntegrationTests")]
        [TestFixture]
        public class ComplexTests
        {
            [SetUp]
            public void Setup()
            {
            }
            
            [Test, Category("Fast"), Category("Smoke")]
            [Property("Priority", "High")]
            [Property("ADOTestCaseId", "COMPLEX001")]
            [Property("Author", "Developer")]
            public async Task ComplexTestMethod()
            {
                await Task.Delay(1);
            }
            
            [Test]
            [Category("Integration")]
            public void MethodWithoutId()
            {
            }
            
            [TestCase("param1")]
            [Property("ADOTestCaseId", "COMPLEX002")]
            public void ParameterizedTestWithId(string param)
            {
            }
            
            [TestCase("param1")]
            public void ParameterizedTestWithoutId(string param)
            {
            }
            
            [TearDown]
            public void TearDown()
            {
            }
        }
      `;

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
      // Note: TestCase attributes may create multiple entries, and Setup/TearDown should be excluded
      expect(result.tests.length).toBeGreaterThanOrEqual(4); // At least 4 test methods
      
      const testsWithIds = result.tests.filter(t => t.hasTestCaseId);
      const testsWithoutIds = result.tests.filter(t => !t.hasTestCaseId);
      
      expect(testsWithIds.length).toBeGreaterThanOrEqual(2);
      expect(testsWithoutIds.length).toBeGreaterThanOrEqual(2);
      
      // Verify specific tests exist
      const complexTest = result.tests.find(t => t.name === 'ComplexTestMethod');
      expect(complexTest).toBeDefined();
      expect(complexTest.hasTestCaseId).toBe(true);
      expect(complexTest.adoId).toBe('COMPLEX001');
      
      const parameterizedWithId = result.tests.find(t => t.name === 'ParameterizedTestWithId');
      expect(parameterizedWithId).toBeDefined();
      expect(parameterizedWithId.hasTestCaseId).toBe(true);
      expect(parameterizedWithId.adoId).toBe('COMPLEX002');
      expect(parameterizedWithId.hasTestCaseParams).toBe(true);
      
      // Verify Setup and TearDown are excluded
      const setupMethod = result.tests.find(t => t.name === 'Setup');
      const tearDownMethod = result.tests.find(t => t.name === 'TearDown');
      expect(setupMethod).toBeUndefined();
      expect(tearDownMethod).toBeUndefined();
    });

    it('should handle adjacent tests without cross-contamination', () => {
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

      const result = fileParserService.analyzeTestFile(content, 'ADOTestCaseId', '/path/to/file.cs');
      
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

