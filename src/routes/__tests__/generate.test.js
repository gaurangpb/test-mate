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

    it('should return 400 when no test files found', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileParserService.findTestFiles.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({ repoPath: '/test/path' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'No test files found in repository'
      });
    });

    it('should suggest context updates successfully without existing context', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileParserService.findTestFiles.mockResolvedValue([
        '/test/path/Test1.cs',
        '/test/path/Test2.cs'
      ]);
      app.locals.fileUtils.readDomainContext.mockResolvedValue(null);

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue('[Test]\npublic void TestMethod() { }');

      app.locals.fileParserService.parseTestMethods.mockReturnValue([
        { name: 'TestMethod', code: 'public void TestMethod() { }' }
      ]);

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
          limit: 50
        })
        .expect(200);

      expect(response.body).toEqual({
        suggestions: mockSuggestions,
        analysisSummary: {
          testsAnalyzed: expect.any(Number),
          filesAnalyzed: 2,
          totalTestFiles: 2,
          hasExistingContext: false
        }
      });

      expect(app.locals.fileUtils.readDomainContext).not.toHaveBeenCalled();
      expect(app.locals.openaiService.extractDomainConcepts).toHaveBeenCalled();
    });

    it('should suggest context updates with existing context', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileParserService.findTestFiles.mockResolvedValue([
        '/test/path/Test1.cs'
      ]);

      const existingContext = '## Domain Context\n\nExisting content';
      app.locals.fileUtils.readDomainContext.mockResolvedValue(existingContext);

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue('[Test]\npublic void TestMethod() { }');

      app.locals.fileParserService.parseTestMethods.mockReturnValue([
        { name: 'TestMethod', code: 'public void TestMethod() { }' }
      ]);

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
          domainContextPath: '/test/context.md'
        })
        .expect(200);

      expect(response.body.analysisSummary.hasExistingContext).toBe(true);
      expect(app.locals.fileUtils.readDomainContext).toHaveBeenCalledWith('/test/context.md');
      expect(app.locals.openaiService.extractDomainConcepts).toHaveBeenCalledWith(
        expect.any(Array),
        existingContext
      );
    });

    it('should limit files analyzed based on limit parameter', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      const testFiles = Array.from({ length: 100 }, (_, i) => `/test/path/Test${i}.cs`);
      app.locals.fileParserService.findTestFiles.mockResolvedValue(testFiles);
      app.locals.fileUtils.readDomainContext.mockResolvedValue(null);

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue('[Test]\npublic void TestMethod() { }');
      app.locals.fileParserService.parseTestMethods.mockReturnValue([
        { name: 'TestMethod', code: 'code' }
      ]);

      app.locals.openaiService.extractDomainConcepts.mockResolvedValue({
        newTerminology: [],
        newWorkflows: [],
        newFeatures: [],
        businessRules: [],
        suggestedContextUpdates: '',
        confidence: 'low'
      });

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path',
          limit: 10
        })
        .expect(200);

      expect(response.body.analysisSummary.filesAnalyzed).toBe(10);
      expect(response.body.analysisSummary.totalTestFiles).toBe(100);
    });

    it('should return 400 when no test methods found', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileParserService.findTestFiles.mockResolvedValue([
        '/test/path/Test1.cs'
      ]);
      app.locals.fileUtils.readDomainContext.mockResolvedValue(null);

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue('// No tests here');
      app.locals.fileParserService.parseTestMethods.mockReturnValue([]);

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path'
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'No test methods found to analyze'
      });
    });

    it('should handle errors gracefully', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileParserService.findTestFiles.mockRejectedValue(
        new Error('File system error')
      );

      const response = await request(app)
        .post('/api/suggest-context-updates')
        .send({
          repoPath: '/test/path'
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'File system error',
        details: 'Check server logs for more information'
      });
    });

    it('should handle file read errors gracefully', async () => {
      app.locals.openaiService.isConfigured.mockReturnValue(true);
      app.locals.fileParserService.findTestFiles.mockResolvedValue([
        '/test/path/Test1.cs',
        '/test/path/Test2.cs'
      ]);
      app.locals.fileUtils.readDomainContext.mockResolvedValue(null);

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile')
        .mockResolvedValueOnce('[Test]\npublic void TestMethod() { }')
        .mockRejectedValueOnce(new Error('Cannot read file'));

      app.locals.fileParserService.parseTestMethods.mockReturnValue([
        { name: 'TestMethod', code: 'code' }
      ]);

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
          repoPath: '/test/path'
        })
        .expect(200);

      expect(response.body.analysisSummary.testsAnalyzed).toBeGreaterThan(0);
    });
  });
});

