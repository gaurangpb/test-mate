const express = require('express');
const request = require('supertest');
const configRoutes = require('../config');

describe('Config Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/config', configRoutes);
    
    // Mock app.locals
    app.locals = {
      openaiClient: null,
      openaiService: {
        isConfigured: jest.fn()
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

  describe('GET /api/config/openai/status', () => {
    it('should return configured false when client is null', async () => {
      app.locals.openaiClient = null;
      app.locals.openaiService.isConfigured.mockReturnValue(false);

      const response = await request(app)
        .get('/api/config/openai/status')
        .expect(200);

      expect(response.body).toEqual({ configured: false });
    });

    it('should return configured true when client exists', async () => {
      app.locals.openaiClient = { mock: 'client' };
      app.locals.openaiService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .get('/api/config/openai/status')
        .expect(200);

      expect(response.body).toEqual({ configured: true });
    });
  });

  describe('GET /api/config/ado/status', () => {
    it('should return configured false when ADO env vars are missing', async () => {
      const response = await request(app)
        .get('/api/config/ado/status')
        .expect(200);

      expect(response.body).toEqual({
        configured: false,
        config: null
      });
    });

    it('should return configured true when all ADO env vars are set', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      const response = await request(app)
        .get('/api/config/ado/status')
        .expect(200);

      expect(response.body.configured).toBe(true);
      expect(response.body.config).toHaveProperty('organizationUrl');
      expect(response.body.config).toHaveProperty('projectName');
      expect(response.body.config).toHaveProperty('testPlanId');
      expect(response.body.config).toHaveProperty('testSuiteId');
      expect(response.body.config.hasToken).toBe(true);
    });
  });

  describe('POST /api/config/ado/test', () => {
    beforeEach(() => {
      app.locals.adoService = {
        testConnectivity: jest.fn()
      };
    });

    it('should return 400 when ADO config is incomplete', async () => {
      const response = await request(app)
        .post('/api/config/ado/test')
        .expect(400);

      expect(response.body).toEqual({
        error: 'ADO configuration is incomplete'
      });
    });

    it('should test connectivity successfully', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      const mockResult = {
        testPlanName: 'Test Plan',
        testPlanId: '123',
        status: 'Connected successfully'
      };

      app.locals.adoService.testConnectivity.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/config/ado/test')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'ADO connectivity test successful',
        details: mockResult
      });
    });

    it('should handle connectivity test errors', async () => {
      process.env.ADO_ORGANIZATION_URL = 'https://dev.azure.com/test';
      process.env.ADO_PROJECT_NAME = 'TestProject';
      process.env.ADO_TEST_PLAN_ID = '123';
      process.env.ADO_TEST_SUITE_ID = '456';
      process.env.ADO_PAT = 'test-pat';

      app.locals.adoService.testConnectivity.mockRejectedValue(
        new Error('Connection failed')
      );

      const response = await request(app)
        .post('/api/config/ado/test')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Connection failed'
      });
    });
  });

  describe('POST /api/config/openai', () => {
    it('should return 400 when API key is missing', async () => {
      const response = await request(app)
        .post('/api/config/openai')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'API key is required'
      });
    });

    it('should configure OpenAI client successfully', async () => {
      jest.mock('openai');

      const response = await request(app)
        .post('/api/config/openai')
        .send({ apiKey: 'test-api-key' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'OpenAI client configured'
      });
    });
  });
});

