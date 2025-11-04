const express = require('express');
const router = express.Router();

/**
 * Configuration routes for OpenAI and Azure DevOps
 */

// Check OpenAI configuration status
router.get('/openai/status', (req, res) => {
  const { openaiClient } = req.app.locals;
  res.json({ configured: openaiClient !== null });
});

// Check ADO configuration status
router.get('/ado/status', (req, res) => {
  const adoConfigured = !!(
    process.env.ADO_ORGANIZATION_URL &&
    process.env.ADO_PROJECT_NAME &&
    process.env.ADO_TEST_PLAN_ID &&
    process.env.ADO_TEST_SUITE_ID &&
    process.env.ADO_PAT
  );
  
  res.json({ 
    configured: adoConfigured,
    config: adoConfigured ? {
      organizationUrl: process.env.ADO_ORGANIZATION_URL,
      projectName: process.env.ADO_PROJECT_NAME,
      testPlanId: process.env.ADO_TEST_PLAN_ID,
      testSuiteId: process.env.ADO_TEST_SUITE_ID,
      hasToken: !!process.env.ADO_PAT
    } : null
  });
});

// Test ADO connectivity
router.post('/ado/test', async (req, res) => {
  const { adoService } = req.app.locals;
  
  try {
    const adoConfig = {
      organizationUrl: process.env.ADO_ORGANIZATION_URL,
      projectName: process.env.ADO_PROJECT_NAME,
      testPlanId: process.env.ADO_TEST_PLAN_ID,
      testSuiteId: process.env.ADO_TEST_SUITE_ID,
      pat: process.env.ADO_PAT
    };

    if (!adoConfig.organizationUrl || !adoConfig.projectName || 
        !adoConfig.testPlanId || !adoConfig.testSuiteId || !adoConfig.pat) {
      return res.status(400).json({ 
        error: 'ADO configuration is incomplete' 
      });
    }

    const testConnectivity = await adoService.testConnectivity(adoConfig);
    res.json({ 
      success: true, 
      message: 'ADO connectivity test successful',
      details: testConnectivity
    });
  } catch (error) {
    console.error('ADO connectivity test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Initialize OpenAI client (kept for backward compatibility)
router.post('/openai', (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }
  
  const OpenAI = require('openai');
  req.app.locals.openaiClient = new OpenAI({ apiKey });
  res.json({ success: true, message: 'OpenAI client configured' });
});

module.exports = router;