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
    const { testCaseIds, testPropertyName, reviewMode = false } = req.body;
    
    if (!testCaseIds || testCaseIds.length === 0) {
      return res.status(400).json({ error: 'No test case IDs provided' });
    }

    if (!testPropertyName) {
      return res.status(400).json({ error: 'Test property name is required' });
    }

    const results = await fileUtils.writeTestIdsToFiles(testCaseIds, testPropertyName, reviewMode);

    const successCount = results.filter(r => r.success).length;
    const needsReviewCount = results.filter(r => r.needsReview).length;
    
    let message = `Successfully updated ${successCount} file(s)`;
    if (needsReviewCount > 0) {
      message += `. ${needsReviewCount} file(s) need review due to multiple tests.`;
    }

    res.json({
      success: successCount > 0,
      results: results,
      message: message,
      needsReview: needsReviewCount > 0
    });
  } catch (error) {
    console.error('Write test IDs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply reviewed changes to files
router.post('/apply-reviewed-changes', async (req, res) => {
  const { fileUtils } = req.app.locals;
  
  try {
    const { approvedChanges } = req.body;
    
    if (!approvedChanges || approvedChanges.length === 0) {
      return res.status(400).json({ error: 'No approved changes provided' });
    }

    const results = [];
    
    for (const change of approvedChanges) {
      try {
        const { filePath, modifications } = change;
        
        // Read the current file content
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        
        // Apply modifications in reverse order (bottom to top) to preserve line numbers
        for (const mod of modifications.reverse()) {
          if (mod.type === 'insert') {
            lines.splice(mod.lineIndex, 0, mod.newLine);
          } else if (mod.type === 'replace') {
            lines[mod.lineIndex] = mod.newLine;
          }
        }
        
        // Write the updated content back to file
        const newContent = lines.join('\n');
        await fs.writeFile(filePath, newContent, 'utf-8');
        
        results.push({
          filePath: filePath,
          fileName: path.basename(filePath),
          success: true,
          modificationsApplied: modifications.length
        });
        
      } catch (fileError) {
        console.error(`Error applying changes to file ${change.filePath}:`, fileError);
        results.push({
          filePath: change.filePath,
          fileName: path.basename(change.filePath),
          success: false,
          error: fileError.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    res.json({
      success: successCount > 0,
      results: results,
      message: `Successfully applied changes to ${successCount} file(s)`
    });
    
  } catch (error) {
    console.error('Apply reviewed changes error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;