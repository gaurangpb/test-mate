const express = require('express');
const router = express.Router();

/**
 * Azure DevOps integration routes
 */

// Create test cases in Azure DevOps
router.post('/create-test-cases', async (req, res) => {
  const { adoService, fileUtils } = req.app.locals;
  
  try {
    const { testCases, generateMappingFile, mappingFilePath, addTags } = req.body;
    
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

    const results = await adoService.createTestCases(testCases, adoConfig, addTags);

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

module.exports = router;