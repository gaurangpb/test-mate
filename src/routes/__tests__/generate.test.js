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
        generatedDocs: mockGeneratedDocs
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
});

