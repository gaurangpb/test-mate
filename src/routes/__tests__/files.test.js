const express = require('express');
const request = require('supertest');
const fileRoutes = require('../files');

describe('Files Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', fileRoutes);
    
    app.locals = {
      fileUtils: {
        generateMappingFile: jest.fn(),
        writeTestIdsToFiles: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/generate-mapping-file', () => {
    it('should return 400 when no test case IDs provided', async () => {
      const response = await request(app)
        .post('/api/generate-mapping-file')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'No test case IDs provided'
      });
    });

    it('should generate mapping file without output path', async () => {
      const mockTestCaseIds = [
        {
          testName: 'Test1',
          filePath: '/path/to/Test1.cs',
          testCaseId: '123'
        }
      ];

      const mockMappingData = {
        metadata: {
          generatedDate: expect.anything(),
          totalTestCases: 1
        },
        testCases: mockTestCaseIds
      };

      app.locals.fileUtils.generateMappingFile.mockResolvedValue(mockMappingData);

      const response = await request(app)
        .post('/api/generate-mapping-file')
        .send({ testCaseIds: mockTestCaseIds })
        .expect(200);

      expect(response.body).toEqual(mockMappingData);
    });

    it('should generate mapping file with output path', async () => {
      const mockTestCaseIds = [
        {
          testName: 'Test1',
          filePath: '/path/to/Test1.cs',
          testCaseId: '123'
        }
      ];

      const mockResult = {
        filePath: '/path/to/mapping.json',
        created: true
      };

      app.locals.fileUtils.generateMappingFile.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/generate-mapping-file')
        .send({
          testCaseIds: mockTestCaseIds,
          outputPath: '/path/to/mapping.json'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Mapping file created at /path/to/mapping.json',
        filePath: '/path/to/mapping.json'
      });
    });

    it('should handle errors', async () => {
      app.locals.fileUtils.generateMappingFile.mockRejectedValue(
        new Error('Generation failed')
      );

      const response = await request(app)
        .post('/api/generate-mapping-file')
        .send({
          testCaseIds: [
            { testName: 'Test1', filePath: '/path/to/Test1.cs', testCaseId: '123' }
          ]
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Generation failed'
      });
    });
  });

  describe('POST /api/write-test-ids', () => {
    it('should return 400 when no test case IDs provided', async () => {
      const response = await request(app)
        .post('/api/write-test-ids')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'No test case IDs provided'
      });
    });

    it('should return 400 when test property name is missing', async () => {
      const response = await request(app)
        .post('/api/write-test-ids')
        .send({
          testCaseIds: [
            { testName: 'Test1', filePath: '/path/to/Test1.cs', testCaseId: '123' }
          ]
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Test property name is required'
      });
    });

    it('should write test IDs successfully', async () => {
      const mockResults = [
        {
          filePath: '/path/to/Test1.cs',
          fileName: 'Test1.cs',
          success: true,
          testsUpdated: 1
        }
      ];

      app.locals.fileUtils.writeTestIdsToFiles.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/write-test-ids')
        .send({
          testCaseIds: [
            { testName: 'Test1', filePath: '/path/to/Test1.cs', testCaseId: '123' }
          ],
          testPropertyName: 'ADOTestCaseId'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        results: mockResults,
        message: 'Successfully updated 1 file(s)',
        needsReview: false
      });
    });

    it('should handle partial failures', async () => {
      const mockResults = [
        {
          filePath: '/path/to/Test1.cs',
          fileName: 'Test1.cs',
          success: true,
          testsUpdated: 1
        },
        {
          filePath: '/path/to/Test2.cs',
          fileName: 'Test2.cs',
          success: false,
          error: 'File not found'
        }
      ];

      app.locals.fileUtils.writeTestIdsToFiles.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/write-test-ids')
        .send({
          testCaseIds: [
            { testName: 'Test1', filePath: '/path/to/Test1.cs', testCaseId: '123' },
            { testName: 'Test2', filePath: '/path/to/Test2.cs', testCaseId: '456' }
          ],
          testPropertyName: 'ADOTestCaseId'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Successfully updated 1 file(s)');
    });

    it('should handle errors', async () => {
      app.locals.fileUtils.writeTestIdsToFiles.mockRejectedValue(
        new Error('Write failed')
      );

      const response = await request(app)
        .post('/api/write-test-ids')
        .send({
          testCaseIds: [
            { testName: 'Test1', filePath: '/path/to/Test1.cs', testCaseId: '123' }
          ],
          testPropertyName: 'ADOTestCaseId'
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Write failed'
      });
    });
  });
});

