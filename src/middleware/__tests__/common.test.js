const { configureSsl, errorHandler, requestLogger } = require('../common');

describe('Common Middleware', () => {
  describe('configureSsl', () => {
    beforeEach(() => {
      delete process.env.REJECT_UNAUTHORIZED;
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.REJECT_UNAUTHORIZED;
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    });

    it('should enable SSL verification by default', () => {
      configureSsl();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith('SSL certificate verification: enabled');
    });

    it('should disable SSL verification when REJECT_UNAUTHORIZED is false', () => {
      process.env.REJECT_UNAUTHORIZED = 'false';
      configureSsl();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');
      expect(console.log).toHaveBeenCalledWith('SSL certificate verification: disabled');
    });

    it('should enable SSL verification when REJECT_UNAUTHORIZED is true', () => {
      process.env.REJECT_UNAUTHORIZED = 'true';
      configureSsl();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
    });
  });

  describe('errorHandler', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false
      };
      next = jest.fn();
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle errors and return 500', () => {
      const error = new Error('Test error');
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: expect.any(String)
      });
      expect(console.error).toHaveBeenCalledWith('Unhandled error:', error);
    });

    it('should show error message in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Test error'
      });
      delete process.env.NODE_ENV;
    });

    it('should show generic message in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Something went wrong'
      });
      delete process.env.NODE_ENV;
    });

    it('should call next if headers already sent', () => {
      res.headersSent = true;
      const error = new Error('Test error');
      errorHandler(error, req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requestLogger', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        method: 'GET',
        originalUrl: '/api/test'
      };
      res = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
        })
      };
      next = jest.fn();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1500);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log request and response', (done) => {
      requestLogger(req, res, next);

      expect(next).toHaveBeenCalled();
      
      setTimeout(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/test - 200')
        );
        done();
      }, 10);
    });

    it('should log request duration', (done) => {
      requestLogger(req, res, next);

      setTimeout(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('(500ms)')
        );
        done();
      }, 10);
    });
  });
});

