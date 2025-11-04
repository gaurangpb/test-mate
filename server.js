require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import middleware
const { configureSsl, errorHandler, requestLogger } = require('./src/middleware/common');

// Import services
const OpenAIService = require('./src/services/openaiService');
const ADOService = require('./src/services/adoService');
const FileParserService = require('./src/services/fileParserService');

// Import utilities
const FileUtils = require('./src/utils/fileUtils');

// Import routes
const configRoutes = require('./src/routes/config');
const scanRoutes = require('./src/routes/scan');
const generateRoutes = require('./src/routes/generate');
const adoRoutes = require('./src/routes/ado');
const fileRoutes = require('./src/routes/files');

const app = express();

// Configure SSL
configureSsl();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Initialize services
const openaiService = new OpenAIService();
const adoService = new ADOService();
const fileParserService = new FileParserService();
const fileUtils = new FileUtils();

// Store services in app.locals for access in routes
app.locals.openaiClient = openaiService.client; // For backward compatibility
app.locals.openaiService = openaiService;
app.locals.adoService = adoService;
app.locals.fileParserService = fileParserService;
app.locals.fileUtils = fileUtils;

// Routes
app.use('/api/config', configRoutes);
app.use('/api', scanRoutes);
app.use('/api', generateRoutes);
app.use('/api/ado', adoRoutes);
app.use('/api', fileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: openaiService.isConfigured(),
      ado: !!(
        process.env.ADO_ORGANIZATION_URL &&
        process.env.ADO_PROJECT_NAME &&
        process.env.ADO_TEST_PLAN_ID &&
        process.env.ADO_TEST_SUITE_ID &&
        process.env.ADO_PAT
      )
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Health check at http://localhost:${PORT}/api/health`);
});