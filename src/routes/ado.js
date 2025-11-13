const express = require('express');
const router = express.Router();

/**
 * Azure DevOps integration routes
 */

// Create test cases in Azure DevOps
router.post('/create-test-cases', async (req, res) => {
  const { adoService, fileUtils } = req.app.locals;
  
  try {
    const { testCases, generateMappingFile, mappingFilePath, addTags, testTagsMap } = req.body;
    
    if (!testCases || testCases.length === 0) {
      return res.status(400).json({ error: 'No test cases provided' });
    }

    // Read ADO configuration from environment variables
    const adoConfig = {
      organizationUrl: process.env.ADO_ORGANIZATION_URL,
      projectName: process.env.ADO_PROJECT_NAME,
      testPlanId: process.env.ADO_TEST_PLAN_ID,
      testSuiteId: process.env.ADO_TEST_SUITE_ID,
      pat: process.env.ADO_PAT
    };

    // Validate required ADO config fields
    if (!adoConfig.organizationUrl || !adoConfig.projectName || 
        !adoConfig.testPlanId || !adoConfig.testSuiteId || !adoConfig.pat) {
      return res.status(400).json({ 
        error: 'ADO configuration is incomplete. Please set ADO_ORGANIZATION_URL, ADO_PROJECT_NAME, ADO_TEST_PLAN_ID, ADO_TEST_SUITE_ID, and ADO_PAT in your .env file' 
      });
    }

    console.log(`Creating ${testCases.length} test cases in Azure DevOps...`);
    console.log(`ADO Config: ${adoConfig.organizationUrl}/${adoConfig.projectName} (Plan: ${adoConfig.testPlanId}, Suite: ${adoConfig.testSuiteId})`);

    const results = await adoService.createTestCases(testCases, adoConfig, addTags, testTagsMap || {});

    // Optionally generate mapping file
    let mappingFileInfo = null;
    if (generateMappingFile) {
      try {
        mappingFileInfo = await fileUtils.generateMappingFile(results, mappingFilePath, adoConfig);
      } catch (mappingError) {
        console.error('Error generating mapping file:', mappingError);
        mappingFileInfo = { error: mappingError.message };
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({ 
      success: successCount > 0,
      results: results,
      message: `Successfully created ${successCount} test case(s) in ADO${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
      mappingFile: mappingFileInfo,
      errors: results.filter(r => !r.success).map(r => ({ testName: r.testName, error: r.error }))
    });
  } catch (error) {
    console.error('ADO creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get test analysis: failed tests with linked bugs
router.get('/test-analysis', async (req, res) => {
  const { adoService } = req.app.locals;
  
  try {
    // Read ADO configuration from environment variables
    const adoConfig = {
      organizationUrl: process.env.ADO_ORGANIZATION_URL,
      projectName: process.env.ADO_PROJECT_NAME,
      testPlanId: process.env.ADO_TEST_PLAN_ID,
      testSuiteId: process.env.ADO_TEST_SUITE_ID,
      pat: process.env.ADO_PAT
    };

    // Validate required ADO config fields
    if (!adoConfig.organizationUrl || !adoConfig.projectName || !adoConfig.pat) {
      return res.status(400).json({ 
        error: 'ADO configuration is incomplete. Please set ADO_ORGANIZATION_URL, ADO_PROJECT_NAME, and ADO_PAT in your .env file' 
      });
    }

    // Get filters from query parameters
    const bugId = req.query.bugId ? parseInt(req.query.bugId) : null;
    const planId = req.query.planId || (bugId ? null : adoConfig.testPlanId);

    // Either bugId or planId must be provided
    if (!bugId && !planId) {
      return res.status(400).json({ 
        error: 'Either planId or bugId must be provided' 
      });
    }

    const filters = {
      planId: planId,
      bugId: bugId,
      suiteIds: req.query.suiteIds ? req.query.suiteIds.split(',').map(id => id.trim()) : null,
      testOutcome: req.query.testOutcome || 'Failed',
      bugStatus: req.query.bugStatus || null,
      includeAttachments: req.query.includeAttachments !== 'false'
    };

    console.log(`Fetching test analysis with filters:`, filters);

    const results = await adoService.getTestAnalysis(adoConfig, filters);

    res.json({
      success: true,
      data: results,
      filters: filters
    });
  } catch (error) {
    console.error('Test analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get test case details from ADO
router.get('/test-case/:testCaseId', async (req, res) => {
  const { adoService } = req.app.locals;
  
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    
    if (!testCaseId || isNaN(testCaseId)) {
      return res.status(400).json({ error: 'Invalid test case ID' });
    }

    // Read ADO configuration from environment variables
    const adoConfig = {
      organizationUrl: process.env.ADO_ORGANIZATION_URL,
      projectName: process.env.ADO_PROJECT_NAME,
      testPlanId: process.env.ADO_TEST_PLAN_ID,
      testSuiteId: process.env.ADO_TEST_SUITE_ID,
      pat: process.env.ADO_PAT
    };

    // Validate required ADO config fields
    if (!adoConfig.organizationUrl || !adoConfig.projectName || !adoConfig.pat) {
      return res.status(400).json({ 
        error: 'ADO configuration is incomplete. Please set ADO_ORGANIZATION_URL, ADO_PROJECT_NAME, and ADO_PAT in your .env file' 
      });
    }

    console.log(`Fetching test case details for ID: ${testCaseId}`);

    const details = await adoService.getTestCaseDetails(adoConfig, testCaseId);

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Get test case details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update test case in ADO
router.patch('/test-case/:testCaseId', async (req, res) => {
  const { adoService } = req.app.locals;
  
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    const { steps, description, tags } = req.body;
    
    if (!testCaseId || isNaN(testCaseId)) {
      return res.status(400).json({ error: 'Invalid test case ID' });
    }

    // Read ADO configuration from environment variables
    const adoConfig = {
      organizationUrl: process.env.ADO_ORGANIZATION_URL,
      projectName: process.env.ADO_PROJECT_NAME,
      testPlanId: process.env.ADO_TEST_PLAN_ID,
      testSuiteId: process.env.ADO_TEST_SUITE_ID,
      pat: process.env.ADO_PAT
    };

    // Validate required ADO config fields
    if (!adoConfig.organizationUrl || !adoConfig.projectName || !adoConfig.pat) {
      return res.status(400).json({ 
        error: 'ADO configuration is incomplete. Please set ADO_ORGANIZATION_URL, ADO_PROJECT_NAME, and ADO_PAT in your .env file' 
      });
    }

    console.log(`Updating test case ${testCaseId} in ADO`);

    const result = await adoService.updateTestCase(adoConfig, testCaseId, {
      steps,
      description,
      tags
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Update test case error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch update multiple test cases
router.post('/update-test-cases', async (req, res) => {
  const { adoService } = req.app.locals;
  
  try {
    const { updates } = req.body; // Array of { testCaseId, steps, description, tags }
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Read ADO configuration from environment variables
    const adoConfig = {
      organizationUrl: process.env.ADO_ORGANIZATION_URL,
      projectName: process.env.ADO_PROJECT_NAME,
      testPlanId: process.env.ADO_TEST_PLAN_ID,
      testSuiteId: process.env.ADO_TEST_SUITE_ID,
      pat: process.env.ADO_PAT
    };

    // Validate required ADO config fields
    if (!adoConfig.organizationUrl || !adoConfig.projectName || !adoConfig.pat) {
      return res.status(400).json({ 
        error: 'ADO configuration is incomplete. Please set ADO_ORGANIZATION_URL, ADO_PROJECT_NAME, and ADO_PAT in your .env file' 
      });
    }

    console.log(`Batch updating ${updates.length} test cases in ADO`);

    const results = [];
    for (const update of updates) {
      try {
        const result = await adoService.updateTestCase(adoConfig, update.testCaseId, {
          steps: update.steps,
          description: update.description,
          tags: update.tags
        });
        results.push({ ...result, testCaseId: update.testCaseId });
      } catch (error) {
        console.error(`Failed to update test case ${update.testCaseId}:`, error.message);
        results.push({
          testCaseId: update.testCaseId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: successCount > 0,
      results: results,
      message: `Successfully updated ${successCount} test case(s)${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
    });
  } catch (error) {
    console.error('Batch update test cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;