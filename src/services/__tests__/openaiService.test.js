const OpenAIService = require('../openaiService');
const OpenAI = require('openai');

// Mock the OpenAI module
jest.mock('openai');

describe('OpenAIService', () => {
  let openaiService;
  let mockClient;

  beforeEach(() => {
    // Clear environment variables
    delete process.env.OPENAI_API_KEY;
    
    // Create mock client
    mockClient = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    
    OpenAI.mockImplementation(() => mockClient);
    
    // Clear console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  describe('constructor and initialization', () => {
    it('should initialize without API key', () => {
      openaiService = new OpenAIService();
      expect(openaiService.client).toBeNull();
      expect(openaiService.isConfigured()).toBe(false);
    });

    it('should initialize with API key from environment', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      openaiService = new OpenAIService();
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
      expect(openaiService.client).not.toBeNull();
      expect(openaiService.isConfigured()).toBe(true);
    });
  });

  describe('setClient', () => {
    it('should set a new client', () => {
      openaiService = new OpenAIService();
      openaiService.setClient('new-api-key');
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'new-api-key' });
      expect(openaiService.isConfigured()).toBe(true);
    });
  });

  describe('isConfigured', () => {
    it('should return false when client is null', () => {
      openaiService = new OpenAIService();
      expect(openaiService.isConfigured()).toBe(false);
    });

    it('should return true when client is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      openaiService = new OpenAIService();
      expect(openaiService.isConfigured()).toBe(true);
    });
  });

  describe('generateDocumentation', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      openaiService = new OpenAIService();
    });

    it('should throw error when client is not configured', async () => {
      openaiService.client = null;
      await expect(openaiService.generateDocumentation({ name: 'Test', code: 'code' }))
        .rejects.toThrow('OpenAI client not configured');
    });

    it('should generate documentation successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Test description',
              steps: [
                { action: 'Action 1', expectedResult: 'Result 1' }
              ]
            })
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const test = { name: 'TestMethod', code: 'public void TestMethod() { }' };
      const result = await openaiService.generateDocumentation(test);

      expect(result).toEqual({
        description: 'Test description',
        steps: [{ action: 'Action 1', expectedResult: 'Result 1' }]
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' }
        })
      );
    });

    it('should handle JSON parse errors gracefully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const test = { name: 'TestMethod', code: 'code' };
      const result = await openaiService.generateDocumentation(test);

      expect(result).toEqual({
        description: expect.stringContaining('Test method TestMethod validates system functionality'),
        steps: expect.arrayContaining([
          expect.objectContaining({
            action: 'Execute the test method',
            expectedResult: 'Test should pass successfully'
          })
        ])
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockClient.chat.completions.create.mockRejectedValue(error);

      const test = { name: 'TestMethod', code: 'code' };
      const result = await openaiService.generateDocumentation(test);

      expect(result).toEqual({
        description: expect.stringContaining('Test method TestMethod validates system functionality'),
        steps: expect.arrayContaining([
          expect.objectContaining({
            action: 'Execute the test method',
            expectedResult: 'Test should pass successfully'
          })
        ])
      });
    });
  });

  describe('generateDocumentationForTests', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      openaiService = new OpenAIService();
    });

    it('should generate documentation for multiple tests', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Test description',
              steps: [{ action: 'Action', expectedResult: 'Result' }]
            })
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const tests = [
        { name: 'Test1', code: 'code1' },
        { name: 'Test2', code: 'code2' }
      ];

      const result = await openaiService.generateDocumentationForTests(tests);

      expect(result).toHaveProperty('Test1');
      expect(result).toHaveProperty('Test2');
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should handle failures for individual tests', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Test description',
              steps: [{ action: 'Action', expectedResult: 'Result' }]
            })
          }
        }]
      };

      mockClient.chat.completions.create
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('API Error'));

      const tests = [
        { name: 'Test1', code: 'code1' },
        { name: 'Test2', code: 'code2' }
      ];

      const result = await openaiService.generateDocumentationForTests(tests);

      expect(result.Test1).toBeDefined();
      expect(result.Test2).toBeDefined();
      expect(result.Test2.description).toContain('Documentation generation failed');
    });
  });
});

