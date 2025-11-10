const express = require('express');
const request = require('supertest');
const generateRoutes = require('../generate');

describe('Generate Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', generateRoutes);
    
    app.locals = {
      openaiService: {
        isConfigured: jest.fn(),
        generateDocumentationForTests: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/generate', () => {
    it('should return 400 when OpenAI is not configured', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(false);

      const response = await request(app)
        .post('/api/generate')
        .send({ tests: [] })
        .expect(400);

      expect(response.body).toEqual({
        error: 'OpenAI client not configured'
      });
    });

    it('should return 400 when no tests provided', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .post('/api/generate')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'No tests provided'
      });
    });

    it('should return 400 when tests array is empty', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .post('/api/generate')
        .send({ tests: [] })
        .expect(400);

      expect(response.body).toEqual({
        error: 'No tests provided'
      });
    });

    it('should return 400 when test missing name or code', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .post('/api/generate')
        .send({ tests: [{ name: 'Test1' }] })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Each test must have a name and code property'
      });
    });

    it('should generate documentation successfully', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      
      const mockGeneratedDocs = {
        TestMethod1: {
          description: 'Test description',
          steps: [
            { action: 'Action 1', expectedResult: 'Result 1' }
          ]
        }
      };

      app.locals.openaiService.generateDocumentationForTests.mockResolvedValue(mockGeneratedDocs);

      const response = await request(app)
        .post('/api/generate')
        .send({
          tests: [
            { name: 'TestMethod1', code: 'public void TestMethod1() { }' }
          ]
        })
        .expect(200);

      expect(response.body).toEqual({
        generatedDocs: mockGeneratedDocs,
        usedDomainContext: false
      });
    });

    it('should handle errors', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.openaiService.generateDocumentationForTests.mockRejectedValue(
        new Error('Generation failed')
      );

      const response = await request(app)
        .post('/api/generate')
        .send({
          tests: [
            { name: 'TestMethod1', code: 'code' }
          ]
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Generation failed',
        details: 'Check server logs for more information'
      });
    });
  });

  describe('POST /api/suggest-context-updates', () => {
    beforeEach(() => {
      app.locals.fileParserService = {
        findTestFiles: jest.fn(),
        parseTestMethods: jest.fn()
      };
      app.locals.fileUtils = {
        readDomainContext: jest.fn()
      };
      app.locals.openaiService.extractDomainConcepts = jest.fn();
    });

    it('should return 400 when OpenAI is not configured', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(false);

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({ repoPath: '/test/path' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'OpenAI client not configured'
      });
    });

    it('should return 400 when repoPath is missing', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Repository path is required'
      });
    });

    it('should return 400 when no files selected', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path',
          selectedFilePaths: []
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'At least one test file must be selected'
      });
    });

    it('should suggest context updates successfully without existing context', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileUtils.readDomainContext.mockResolvedValue(null);

      const fs = require('fs').promises;
      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'join').mockReturnValue('/test/path/domain-context.md');
      jest.spyOn(path, 'isAbsolute').mockReturnValue(false);
      jest.spyOn(path, 'relative').mockReturnValue('Test1.cs');
      jest.spyOn(path, 'basename').mockReturnValue('Test1.cs');
      
      jest.spyOn(fs, 'readFile').mockResolvedValue('[Test]\npublic void TestMethod() { }');

      const mockSuggestions = {
        newTerminology: [
          {
            term: 'Order Status',
            definition: 'Status of an order',
            examples: ['Pending']
          }
        ],
        newWorkflows: [],
        newFeatures: [],
        businessRules: [],
        suggestedContextUpdates: '## New Terminology',
        confidence: 'high'
      };

      app.locals.openaiService.extractDomainConcepts.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path',
          selectedFilePaths: ['Test1.cs']
        })
        .expect(200);

      expect(response.body).toEqual({
        suggestions: mockSuggestions,
        analysisSummary: {
          testsAnalyzed: expect.any(Number),
          filesAnalyzed: 1,
          hasExistingContext: false,
          domainContextPath: null
        }
      });

      // Should check for domain-context.md in repo root
      expect(app.locals.fileUtils.readDomainContext).toHaveBeenCalled();
      expect(app.locals.openaiService.extractDomainConcepts).toHaveBeenCalled();
    });

    it('should suggest context updates with existing context', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);

      const existingContext = '## Domain Context\n\nExisting content';
      app.locals.fileUtils.readDomainContext.mockResolvedValue(existingContext);

      const fs = require('fs').promises;
      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'join').mockReturnValue('/test/path/domain-context.md');
      jest.spyOn(path, 'isAbsolute').mockReturnValue(false);
      jest.spyOn(path, 'relative').mockReturnValue('Test1.cs');
      jest.spyOn(path, 'basename').mockReturnValue('Test1.cs');
      
      jest.spyOn(fs, 'readFile').mockResolvedValue('[Test]\npublic void TestMethod() { }');

      const mockSuggestions = {
        newTerminology: [],
        newWorkflows: [],
        newFeatures: [],
        businessRules: [],
        suggestedContextUpdates: '',
        confidence: 'high'
      };

      app.locals.openaiService.extractDomainConcepts.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path',
          selectedFilePaths: ['Test1.cs']
        })
        .expect(200);

      expect(response.body.analysisSummary.hasExistingContext).toBe(true);
      // Should automatically look for domain-context.md in repo root
      expect(app.locals.fileUtils.readDomainContext).toHaveBeenCalled();
      expect(app.locals.openaiService.extractDomainConcepts).toHaveBeenCalledWith(
        expect.any(Array),
        existingContext
      );
    });

    it('should return 400 when no test methods found', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileUtils.readDomainContext.mockResolvedValue(null);

      const fs = require('fs').promises;
      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'join').mockImplementation((...args) => {
        if (args.includes('domain-context.md')) {
          return '/test/path/domain-context.md';
        }
        return args.join('/');
      });
      jest.spyOn(path, 'isAbsolute').mockReturnValue(false);
      jest.spyOn(path, 'relative').mockReturnValue('Test1.cs');
      jest.spyOn(path, 'basename').mockReturnValue('Test1.cs');
      
      jest.spyOn(fs, 'readFile').mockResolvedValue('// No tests here');

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path',
          selectedFilePaths: ['Test1.cs']
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'No test methods found to analyze'
      });
    });

    it('should handle errors gracefully', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      
      // Mock path operations to throw an error
      const path = require('path');
      jest.spyOn(path, 'resolve').mockImplementation(() => {
        throw new Error('File system error');
      });

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path',
          selectedFilePaths: ['Test1.cs']
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'File system error',
        details: 'Check server logs for more information'
      });
    });

    it('should handle file read errors gracefully', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileUtils.readDomainContext.mockResolvedValue(null);

      const fs = require('fs').promises;
      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'join').mockReturnValue('/test/path/domain-context.md');
      jest.spyOn(path, 'isAbsolute').mockReturnValue(false);
      jest.spyOn(path, 'relative').mockReturnValue('Test1.cs');
      jest.spyOn(path, 'basename').mockReturnValue('Test1.cs');
      
      jest.spyOn(fs, 'readFile')
        .mockResolvedValueOnce('[Test]\npublic void TestMethod() { }')
        .mockRejectedValueOnce(new Error('Cannot read file'));

      app.locals.openaiService.extractDomainConcepts.mockResolvedValue({
        newTerminology: [],
        newWorkflows: [],
        newFeatures: [],
        businessRules: [],
        suggestedContextUpdates: '',
        confidence: 'low'
      });

      // Should still succeed with one file
      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path',
          selectedFilePaths: ['Test1.cs', 'Test2.cs']
        })
        .expect(200);

      expect(response.body.analysisSummary.testsAnalyzed).toBeGreaterThan(0);
    });
  });

  describe('POST /api/test-files-list', () => {
    beforeEach(() => {
      app.locals.fileParserService = {
        findTestFiles: jest.fn()
      };
    });

    it('should return 400 when repoPath is missing', async () => {
      const response = await request(app)
        .post('/api/test-files-list')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Repository path is required'
      });
    });

    it('should return empty files array when no test files found', async () => {
      app.locals.fileParserService.findTestFiles.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/test-files-list')
        .send({ repoPath: '/test/path' })
        .expect(200);

      expect(response.body).toEqual({
        files: [],
        tree: {}
      });
    });

    it('should return test files with relative paths and tree structure', async () => {
      const testFiles = [
        '/test/path/tests/Test1.cs',
        '/test/path/tests/Test2.cs',
        '/test/path/tests/subdir/Test3.cs'
      ];

      app.locals.fileParserService.findTestFiles.mockResolvedValue(testFiles);

      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'relative').mockImplementation((base, file) => {
        return file.replace('/test/path/', '').replace(/\\/g, '/');
      });
      jest.spyOn(path, 'basename').mockImplementation((file) => {
        return file.split('/').pop();
      });

      const response = await request(app)
        .post('/api/test-files-list')
        .send({ repoPath: '/test/path' })
        .expect(200);

      expect(response.body.files).toHaveLength(3);
      expect(response.body.files[0]).toHaveProperty('absolutePath');
      expect(response.body.files[0]).toHaveProperty('relativePath');
      expect(response.body.files[0]).toHaveProperty('fileName');
      expect(response.body.tree).toHaveProperty('tests');
    });
  });

  describe('POST /api/save-domain-context', () => {
    beforeEach(() => {
      app.locals.fileUtils = {
        saveDomainContext: jest.fn()
      };
    });

    it('should return 400 when repoPath is missing', async () => {
      const response = await request(app)
        .post('/api/save-domain-context')
        .send({ content: 'test content' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Repository path is required'
      });
    });

    it('should return 400 when content is missing', async () => {
      const response = await request(app)
        .post('/api/save-domain-context')
        .send({ repoPath: '/test/path' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Content is required'
      });
    });

    it('should save domain context successfully (new file)', async () => {
      const mockResult = { created: true };
      app.locals.fileUtils.saveDomainContext.mockResolvedValue(mockResult);

      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'join').mockReturnValue('/test/path/domain-context.md');

      const response = await request(app)
        .post('/api/save-domain-context')
        .send({
          repoPath: '/test/path',
          content: '## New Context\n\nContent here'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        filePath: '/test/path/domain-context.md',
        created: true
      });

      expect(app.locals.fileUtils.saveDomainContext).toHaveBeenCalledWith(
        '/test/path/domain-context.md',
        '## New Context\n\nContent here'
      );
    });

    it('should save domain context successfully (existing file)', async () => {
      const mockResult = { created: false };
      app.locals.fileUtils.saveDomainContext.mockResolvedValue(mockResult);

      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'join').mockReturnValue('/test/path/domain-context.md');

      const response = await request(app)
        .post('/api/save-domain-context')
        .send({
          repoPath: '/test/path',
          content: '## Updated Context'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        filePath: '/test/path/domain-context.md',
        created: false
      });
    });

    it('should handle errors', async () => {
      app.locals.fileUtils.saveDomainContext.mockRejectedValue(
        new Error('Write failed')
      );

      const path = require('path');
      jest.spyOn(path, 'resolve').mockReturnValue('/test/path');
      jest.spyOn(path, 'join').mockReturnValue('/test/path/domain-context.md');

      const response = await request(app)
        .post('/api/save-domain-context')
        .send({
          repoPath: '/test/path',
          content: 'test content'
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Write failed',
        details: 'Check server logs for more information'
      });
    });
  });
});

