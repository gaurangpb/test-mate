const express = require('express');
const request = require('supertest');
const adoRoutes = require('../ado');

describe('ADO Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ado', adoRoutes);
    
    app.locals = {
      adoService: {
        createTestCases: jest.fn()
      },
      fileUtils: {
        generateMappingFile: jest.fn()
      }
    };

    // Clear environment variables
    delete process.env.ADO_ORGANIZATION_URL;
    delete process.env.ADO_PROJECT_NAME;
    delete process.env.ADO_TEST_PLAN_ID;
    delete process.env.ADO_TEST_SUITE_ID;
    delete process.env.ADO_PAT;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/ado/create-test-cases', () => {
    it('should return 400 when no test cases provided', async () => {
      const response = await request(app)
        .post('/api/ado/create-test-cases')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'No test cases provided'
      });
    });

    it('should return 400 when ADO config is incomplete', async () => {
      const response = await request(app)
        .post('/api/ado/create-test-cases')
        .send({ testCases: [{ testName: 'Test1' }] })
        .expect(400);

      expect(response.body).toEqual({
        error: expect.stringContaining('ADO configuration is incomplete')
      });
    });

    it('should create test cases successfully', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      const mockResults = [
        {
          testName: 'Test1',
          fileName: 'Test1.cs',
          filePath: '/path/to/Test1.cs',
          testCaseId: '789',
          success: true
        }
      ];

      app.locals.adoService.createTestCases.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/ado/create-test-cases')
        .send({
          testCases: [
            {
              testName: 'Test1',
              fileName: 'Test1.cs',
              filePath: '/path/to/Test1.cs',
              steps: []
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toEqual(mockResults);
      expect(response.body.message).toContain('Successfully created');
    });

    it('should generate mapping file when requested', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      const mockResults = [
        {
          testName: 'Test1',
          fileName: 'Test1.cs',
          filePath: '/path/to/Test1.cs',
          testCaseId: '789',
          success: true
        }
      ];

      const mockMappingFile = {
        filePath: '/path/to/mapping.json',
        created: true
      };

      app.locals.adoService.createTestCases.mockResolvedValue(mockResults);
      app.locals.fileUtils.generateMappingFile.mockResolvedValue(mockMappingFile);

      const response = await request(app)
        .post('/api/ado/create-test-cases')
        .send({
          testCases: [{ testName: 'Test1', fileName: 'Test1.cs', steps: [] }],
          generateMappingFile: true,
          mappingFilePath: '/path/to/mapping.json'
        })
        .expect(200);

      expect(response.body.mappingFile).toEqual(mockMappingFile);
      expect(app.locals.fileUtils.generateMappingFile).toHaveBeenCalled();
    });

    it('should handle mapping file generation errors gracefully', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      const mockResults = [
        {
          testName: 'Test1',
          fileName: 'Test1.cs',
          filePath: '/path/to/Test1.cs',
          testCaseId: '789',
          success: true
        }
      ];

      app.locals.adoService.createTestCases.mockResolvedValue(mockResults);
      app.locals.fileUtils.generateMappingFile.mockRejectedValue(
        new Error('Mapping file error')
      );

      const response = await request(app)
        .post('/api/ado/create-test-cases')
        .send({
          testCases: [{ testName: 'Test1', fileName: 'Test1.cs', steps: [] }],
          generateMappingFile: true
        })
        .expect(200);

      expect(response.body.mappingFile).toEqual({
        error: 'Mapping file error'
      });
    });

    it('should handle partial failures', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      const mockResults = [
        {
          testName: 'Test1',
          fileName: 'Test1.cs',
          filePath: '/path/to/Test1.cs',
          testCaseId: '789',
          success: true
        },
        {
          testName: 'Test2',
          fileName: 'Test2.cs',
          filePath: '/path/to/Test2.cs',
          testCaseId: null,
          success: false,
          error: 'Creation failed'
        }
      ];

      app.locals.adoService.createTestCases.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/ado/create-test-cases')
        .send({
          testCases: [
            { testName: 'Test1', fileName: 'Test1.cs', steps: [] },
            { testName: 'Test2', fileName: 'Test2.cs', steps: [] }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.message).toContain('failed');
    });

    it('should handle service errors', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      app.locals.adoService.createTestCases.mockRejectedValue(
        new Error('Service error')
      );

      const response = await request(app)
        .post('/api/ado/create-test-cases')
        .send({
          testCases: [{ testName: 'Test1', fileName: 'Test1.cs', steps: [] }]
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Service error'
      });
    });
  });
});

