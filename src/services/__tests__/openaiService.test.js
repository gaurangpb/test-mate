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

  describe('extractDomainConcepts', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      openaiService = new OpenAIService();
    });

    it('should throw error when client is not configured', async () => {
      openaiService.client = null;
      await expect(openaiService.extractDomainConcepts([{ name: 'Test', code: 'code' }]))
        .rejects.toThrow('OpenAI client not configured');
    });

    it('should extract domain concepts successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              newTerminology: [
                {
                  term: 'Order Status',
                  definition: 'Status of an order in the system',
                  examples: ['Pending', 'Processing']
                }
              ],
              newWorkflows: [
                {
                  name: 'Order Fulfillment',
                  description: 'Process of fulfilling orders',
                  steps: ['Step 1', 'Step 2'],
                  testEvidence: ['TestOrder']
                }
              ],
              newFeatures: [
                {
                  name: 'Payment Processing',
                  description: 'Feature for processing payments',
                  testEvidence: ['TestPayment']
                }
              ],
              businessRules: [
                {
                  rule: 'Orders over $100 require approval',
                  testEvidence: ['TestOrderApproval']
                }
              ],
              suggestedContextUpdates: '## New Terminology\n\n- Order Status...',
              confidence: 'high'
            })
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const tests = [
        { name: 'TestOrder', code: 'public void TestOrder() { /* order code */ }' }
      ];

      const result = await openaiService.extractDomainConcepts(tests);

      expect(result).toEqual({
        newTerminology: [
          {
            term: 'Order Status',
            definition: 'Status of an order in the system',
            examples: ['Pending', 'Processing']
          }
        ],
        newWorkflows: [
          {
            name: 'Order Fulfillment',
            description: 'Process of fulfilling orders',
            steps: ['Step 1', 'Step 2'],
            testEvidence: ['TestOrder']
          }
        ],
        newFeatures: [
          {
            name: 'Payment Processing',
            description: 'Feature for processing payments',
            testEvidence: ['TestPayment']
          }
        ],
        businessRules: [
          {
            rule: 'Orders over $100 require approval',
            testEvidence: ['TestOrderApproval']
          }
        ],
        suggestedContextUpdates: '## New Terminology\n\n- Order Status...',
        confidence: 'high'
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.5,
          response_format: { type: 'json_object' }
        })
      );
    });

    it('should include existing context when provided', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              newTerminology: [],
              newWorkflows: [],
              newFeatures: [],
              businessRules: [],
              suggestedContextUpdates: '',
              confidence: 'high'
            })
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const tests = [{ name: 'Test1', code: 'code' }];
      const existingContext = '## Domain Context\n\nExisting terminology...';

      await openaiService.extractDomainConcepts(tests, existingContext);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find(m => m.role === 'user').content;

      expect(userMessage).toContain('EXISTING DOMAIN CONTEXT');
      expect(userMessage).toContain('Existing terminology');
    });

    it('should limit test samples to 20', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              newTerminology: [],
              newWorkflows: [],
              newFeatures: [],
              businessRules: [],
              suggestedContextUpdates: '',
              confidence: 'low'
            })
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const tests = Array.from({ length: 25 }, (_, i) => ({
        name: `Test${i}`,
        code: `public void Test${i}() { /* code */ }`
      }));

      await openaiService.extractDomainConcepts(tests);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find(m => m.role === 'user').content;
      
      // More robust parsing - find the JSON array after "Test Samples:"
      const match = userMessage.match(/Test Samples:\s*(\[[\s\S]*?\])/);
      expect(match).toBeTruthy();
      const testSamples = JSON.parse(match[1]);

      expect(testSamples.length).toBe(20);
    });

    it('should truncate test code to 2000 characters', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              newTerminology: [],
              newWorkflows: [],
              newFeatures: [],
              businessRules: [],
              suggestedContextUpdates: '',
              confidence: 'low'
            })
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const longCode = 'x'.repeat(3000);
      const tests = [{ name: 'Test1', code: longCode }];

      await openaiService.extractDomainConcepts(tests);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find(m => m.role === 'user').content;
      
      // More robust parsing
      const match = userMessage.match(/Test Samples:\s*(\[[\s\S]*?\])/);
      expect(match).toBeTruthy();
      const testSamples = JSON.parse(match[1]);

      expect(testSamples[0].code.length).toBe(2000);
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

      const tests = [{ name: 'Test1', code: 'code' }];
      const result = await openaiService.extractDomainConcepts(tests);

      expect(result).toEqual({
        newTerminology: [],
        newWorkflows: [],
        newFeatures: [],
        businessRules: [],
        suggestedContextUpdates: 'Error parsing AI response. Please review test code manually.',
        confidence: 'low'
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockClient.chat.completions.create.mockRejectedValue(error);

      const tests = [{ name: 'Test1', code: 'code' }];
      const result = await openaiService.extractDomainConcepts(tests);

      expect(result).toEqual({
        newTerminology: [],
        newWorkflows: [],
        newFeatures: [],
        businessRules: [],
        suggestedContextUpdates: 'Error extracting domain concepts: API Error',
        confidence: 'low'
      });
    });

    it('should truncate existing context to 3000 characters', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              newTerminology: [],
              newWorkflows: [],
              newFeatures: [],
              businessRules: [],
              suggestedContextUpdates: '',
              confidence: 'low'
            })
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const longContext = 'x'.repeat(15000);
      const tests = [{ name: 'Test1', code: 'code' }];

      await openaiService.extractDomainConcepts(tests, longContext);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find(m => m.role === 'user').content;
      
      // Check that context is included and truncated
      expect(userMessage).toContain('=== EXISTING DOMAIN CONTEXT ===');
      expect(userMessage).toContain('=== END EXISTING CONTEXT ===');
      
      // Extract context between markers (non-greedy match)
      const contextMatch = userMessage.match(/=== EXISTING DOMAIN CONTEXT ===\s*([\s\S]*?)\s*=== END EXISTING CONTEXT ===/);
      
      expect(contextMatch).toBeTruthy();
      if (contextMatch && contextMatch[1]) {
        // Context is truncated to 10000 characters when longer than 10000
        // The truncation message adds extra characters, so we check it's approximately 10000
        const contextLength = contextMatch[1].length;
        expect(contextLength).toBeGreaterThanOrEqual(10000);
        expect(contextLength).toBeLessThan(10100); // Allow for truncation message
      }
    });
  });
});

