const express = require('express');
const request = require('supertest');
const scanRoutes = require('../scan');

describe('Scan Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', scanRoutes);
    
    app.locals = {
      fileParserService: {
        scanForTestsWithoutIds: jest.fn(),
        countTestFiles: jest.fn()
      },
      fileUtils: {
        browseDirectory: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/scan', () => {
    it('should return 400 when repoPath is missing', async () => {
      const response = await request(app)
        .post('/api/scan')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Repository path is required'
      });
    });

    it('should scan repository successfully', async () => {
      const mockResults = [
        {
          fileName: 'TestFile.cs',
          filePath: '/path/to/TestFile.cs',
          testMethods: [
            { name: 'TestMethod1', hasTestCaseId: false, code: 'code' }
          ]
        }
      ];

      app.locals.fileParserService.scanForTestsWithoutIds.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/scan')
        .send({ repoPath: '/test/path' })
        .expect(200);

      expect(response.body).toEqual({ results: mockResults });
      expect(app.locals.fileParserService.scanForTestsWithoutIds).toHaveBeenCalledWith(
        '/test/path',
        undefined
      );
    });

    it('should use custom testPropertyName', async () => {
      app.locals.fileParserService.scanForTestsWithoutIds.mockResolvedValue([]);
      app.locals.fileParserService.countTestFiles.mockResolvedValue(5);

      await request(app)
        .post('/api/scan')
        .send({ repoPath: '/test/path', testPropertyName: 'CustomProperty' })
        .expect(200);

      expect(app.locals.fileParserService.scanForTestsWithoutIds).toHaveBeenCalledWith(
        '/test/path',
        'CustomProperty'
      );
    });

    it('should return debug info when no results found', async () => {
      app.locals.fileParserService.scanForTestsWithoutIds.mockResolvedValue([]);
      app.locals.fileParserService.countTestFiles.mockResolvedValue(0);

      const response = await request(app)
        .post('/api/scan')
        .send({ repoPath: '/test/path' })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('debug');
      expect(response.body.debug.totalTestFilesFound).toBe(0);
    });

    it('should handle errors', async () => {
      app.locals.fileParserService.scanForTestsWithoutIds.mockRejectedValue(
        new Error('Scan failed')
      );

      const response = await request(app)
        .post('/api/scan')
        .send({ repoPath: '/test/path' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Scan failed'
      });
    });
  });

  describe('POST /api/analyze', () => {
    it('should return 400 when repoPath is missing', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Repository path is required'
      });
    });

    it('should analyze repository successfully', async () => {
      const mockAnalysis = {
        totalTests: 10,
        testsWithAdoId: 5,
        testsWithoutAdoId: 5,
        summary: {
          totalTests: 10,
          testsWithAdoId: 5,
          testsWithoutAdoId: 5,
          coveragePercent: 50
        },
        byClass: [],
        byTag: [],
        allTests: []
      };

      app.locals.fileParserService.analyzeRepository = jest.fn().mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/analyze')
        .send({ repoPath: '/test/path' })
        .expect(200);

      expect(response.body).toEqual(mockAnalysis);
    });

    it('should handle errors', async () => {
      app.locals.fileParserService.analyzeRepository = jest.fn().mockRejectedValue(
        new Error('Analysis failed')
      );

      const response = await request(app)
        .post('/api/analyze')
        .send({ repoPath: '/test/path' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Analysis failed'
      });
    });
  });

  describe('GET /api/browse-directory', () => {
    it('should browse directory successfully', async () => {
      const mockResult = {
        directories: [
          { name: 'dir1', path: '/test/dir1' }
        ],
        currentPath: '/test'
      };

      app.locals.fileUtils.browseDirectory.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/browse-directory?path=/test')
        .expect(200);

      expect(response.body).toEqual(mockResult);
    });

    it('should handle errors', async () => {
      app.locals.fileUtils.browseDirectory.mockRejectedValue(
        new Error('Invalid path')
      );

      const response = await request(app)
        .get('/api/browse-directory?path=/invalid')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Invalid path'
      });
    });
  });
});

