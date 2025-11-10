const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

/**
 * File operations and mapping routes
 */

// Generate test case IDs mapping file (JSON format)
router.post('/generate-mapping-file', async (req, res) => {
  const { fileUtils } = req.app.locals;
  
  try {
    const { testCaseIds, testPropertyName, outputPath } = req.body;
    
    if (!testCaseIds || testCaseIds.length === 0) {
      return res.status(400).json({ error: 'No test case IDs provided' });
    }

    const result = await fileUtils.generateMappingFile(testCaseIds, outputPath, null, testPropertyName);
    
    if (outputPath) {
      res.json({
        success: true,
        message: `Mapping file created at ${outputPath}`,
        filePath: outputPath
      });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Mapping file generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Write test case IDs back to test files
router.post('/write-test-ids', async (req, res) => {
  const { fileUtils } = req.app.locals;
  
  try {
    const { testCaseIds, testPropertyName } = req.body;
    
    if (!testCaseIds || testCaseIds.length === 0) {
      return res.status(400).json({ error: 'No test case IDs provided' });
    }

    if (!testPropertyName) {
      return res.status(400).json({ error: 'Test property name is required' });
    }

    const results = await fileUtils.writeTestIdsToFiles(testCaseIds, testPropertyName);

    const successCount = results.filter(r => r.success).length;
    const message = `Successfully updated ${successCount} file(s)`;

    res.json({
      success: successCount > 0,
      results: results,
      message: message
    });
  } catch (error) {
    console.error('Write test IDs error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;