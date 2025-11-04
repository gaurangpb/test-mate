const ADOService = require('../adoService');
const https = require('https');
const { URL } = require('url');

// Mock https module
jest.mock('https');

describe('ADOService', () => {
  let adoService;
  let mockRequest;

  beforeEach(() => {
    adoService = new ADOService();
    mockRequest = {
      on: jest.fn(),
      setTimeout: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn()
    };
    https.request.mockReset();
    https.request.mockReturnValue(mockRequest);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('testConnectivity', () => {
    const mockConfig = {
      organizationUrl: 'https://dev.azure.com/test',
      projectName: 'TestProject',
      testPlanId: '123',
      pat: 'test-pat'
    };

    it('should successfully test connectivity', (done) => {
      const callbacks = {};
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          callbacks[event] = callback;
          if (event === 'data') {
            process.nextTick(() => callback(Buffer.from(JSON.stringify({ id: '123', name: 'Test Plan' }))));
          } else if (event === 'end') {
            process.nextTick(() => callback());
          }
        })
      };

      https.request.mockImplementation((options, responseCallback) => {
        process.nextTick(() => responseCallback(mockResponse));
        return mockRequest;
      });

      adoService.testConnectivity(mockConfig).then((result) => {
        expect(result).toEqual({
          testPlanName: 'Test Plan',
          testPlanId: '123',
          status: 'Connected successfully'
        });
        done();
      }).catch(done);
    });

    it('should handle connection errors', (done) => {
      mockRequest.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 0);
        }
      });

      adoService.testConnectivity(mockConfig).catch((error) => {
        expect(error.message).toContain('Connection failed');
        done();
      });
    });

    it('should handle timeout', (done) => {
      mockRequest.setTimeout.mockImplementation((timeout, callback) => {
        setTimeout(() => callback(), 0);
      });

      adoService.testConnectivity(mockConfig).catch((error) => {
        expect(error.message).toBe('Connection timeout');
        done();
      });
    });

    it('should handle HTTP error status', (done) => {
      const mockResponse = {
        statusCode: 401,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            process.nextTick(() => callback(Buffer.from('Unauthorized')));
          } else if (event === 'end') {
            process.nextTick(() => callback());
          }
        })
      };

      https.request.mockImplementation((options, responseCallback) => {
        process.nextTick(() => responseCallback(mockResponse));
        return mockRequest;
      });

      adoService.testConnectivity(mockConfig).catch((error) => {
        expect(error.message).toContain('ADO API test failed');
        done();
      });
    });
  });

  describe('createTestCases', () => {
    const mockConfig = {
      organizationUrl: 'https://dev.azure.com/test',
      projectName: 'TestProject',
      testPlanId: '123',
      testSuiteId: '456',
      pat: 'test-pat'
    };

    it('should create test cases successfully', (done) => {
      const mockResponse = {
        statusCode: 201,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setImmediate(() => callback(Buffer.from(JSON.stringify({ id: '789' }))));
          } else if (event === 'end') {
            setImmediate(() => callback());
          }
        })
      };

      // Mock suite addition response
      const mockSuiteResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setImmediate(() => callback(Buffer.from('')));
          } else if (event === 'end') {
            setImmediate(() => callback());
          }
        })
      };

      let requestCount = 0;
      const mockRequest2 = {
        on: jest.fn((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockSuiteResponse));
          }
        }),
        setTimeout: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      let reqCount1 = 0;
      https.request.mockImplementation((options, responseCallback) => {
        reqCount1++;
        if (reqCount1 === 1) {
          process.nextTick(() => responseCallback(mockResponse));
          return mockRequest;
        } else {
          process.nextTick(() => responseCallback(mockSuiteResponse));
          return mockRequest2;
        }
      });

      const testCases = [
        {
          testName: 'Test1',
          fileName: 'Test1.cs',
          filePath: '/path/to/Test1.cs',
          steps: [
            { action: 'Action 1', expectedResult: 'Result 1' }
          ]
        }
      ];

      adoService.createTestCases(testCases, mockConfig).then((results) => {
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        expect(results[0].testCaseId).toBe('789');
        done();
      }).catch(done);
    });

    it('should handle creation failures', (done) => {
      const mockResponse = {
        statusCode: 400,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setImmediate(() => callback(Buffer.from('Bad Request')));
          } else if (event === 'end') {
            setImmediate(() => callback());
          }
        })
      };

      https.request.mockImplementation((options, responseCallback) => {
        process.nextTick(() => responseCallback(mockResponse));
        return mockRequest;
      });

      const testCases = [
        {
          testName: 'Test1',
          fileName: 'Test1.cs',
          filePath: '/path/to/Test1.cs',
          steps: []
        }
      ];

      adoService.createTestCases(testCases, mockConfig).then((results) => {
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].error).toBeDefined();
        done();
      }).catch(done);
    });

    it('should handle test cases without steps', (done) => {
      const mockResponse = {
        statusCode: 201,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setImmediate(() => callback(Buffer.from(JSON.stringify({ id: '789' }))));
          } else if (event === 'end') {
            setImmediate(() => callback());
          }
        })
      };

      const mockSuiteResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setImmediate(() => callback(Buffer.from('')));
          } else if (event === 'end') {
            setImmediate(() => callback());
          }
        })
      };

      const mockRequest2 = {
        on: jest.fn((event, callback) => {
          if (event === 'response') {
            setImmediate(() => callback(mockSuiteResponse));
          }
        }),
        setTimeout: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      let requestCount = 0;
      https.request.mockImplementation((options, responseCallback) => {
        requestCount++;
        if (requestCount === 1) {
          process.nextTick(() => responseCallback(mockResponse));
          return mockRequest;
        } else {
          process.nextTick(() => responseCallback(mockSuiteResponse));
          return mockRequest2;
        }
      });

      const testCases = [
        {
          testName: 'Test1',
          fileName: 'Test1.cs',
          filePath: '/path/to/Test1.cs'
        }
      ];

      adoService.createTestCases(testCases, mockConfig).then((results) => {
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        done();
      }).catch(done);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(adoService.escapeHtml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#039;');
    });

    it('should handle empty string', () => {
      expect(adoService.escapeHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(adoService.escapeHtml(null)).toBe('');
      expect(adoService.escapeHtml(undefined)).toBe('');
    });

    it('should handle non-string input', () => {
      expect(adoService.escapeHtml(123)).toBe('');
    });
  });
});

