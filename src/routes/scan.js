const express = require('express');
const router = express.Router();

/**
 * File scanning and analysis routes
 */

// Scan repository for test files
router.post('/scan', async (req, res) => {
  const { fileParserService } = req.app.locals;
  
  try {
    const { repoPath, testPropertyName } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    console.log(`DEBUG: Scanning repository: ${repoPath}`);
    console.log(`DEBUG: Looking for property name: ${testPropertyName || 'ADOTestCaseId'}`);

    const results = await fileParserService.scanForTestsWithoutIds(repoPath, testPropertyName);
    
    if (results.length === 0) {
      const totalTestFiles = await fileParserService.countTestFiles(repoPath);
      return res.json({ 
        results: [],
        debug: {
          message: `No test files found without ADO test case IDs`,
          searchPath: repoPath,
          testPropertyName: testPropertyName || 'ADOTestCaseId',
          totalTestFilesFound: totalTestFiles,
          suggestion: totalTestFiles > 0 ? 
            `Found ${totalTestFiles} test files, but all tests already have the '${testPropertyName || 'ADOTestCaseId'}' property. Verify that your test methods don't already have this attribute.` :
            'No C# test files found. Verify the repository path contains test files with [Test] attributes.'
        }
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scan repository for test files WITH ADO IDs
router.post('/scan-with-ids', async (req, res) => {
  const { fileParserService } = req.app.locals;
  
  try {
    const { repoPath, testPropertyName } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    console.log(`DEBUG: Scanning repository for tests WITH IDs: ${repoPath}`);
    console.log(`DEBUG: Looking for property name: ${testPropertyName || 'ADOTestCaseId'}`);

    const results = await fileParserService.scanForTestsWithIds(repoPath, testPropertyName);
    
    if (results.length === 0) {
      const totalTestFiles = await fileParserService.countTestFiles(repoPath);
      return res.json({ 
        results: [],
        debug: {
          message: `No test files found with ADO test case IDs`,
          searchPath: repoPath,
          testPropertyName: testPropertyName || 'ADOTestCaseId',
          totalTestFilesFound: totalTestFiles,
          suggestion: totalTestFiles > 0 ? 
            `Found ${totalTestFiles} test files, but none have the '${testPropertyName || 'ADOTestCaseId'}' property.` :
            'No C# test files found. Verify the repository path contains test files with [Test] attributes.'
        }
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('Scan with IDs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze repository for comprehensive statistics
router.post('/analyze', async (req, res) => {
  const { fileParserService } = req.app.locals;
  
  try {
    const { repoPath, testPropertyName } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    const analysis = await fileParserService.analyzeRepository(repoPath, testPropertyName);
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Browse directories (for file picker helper)
router.get('/browse-directory', async (req, res) => {
  const { fileUtils } = req.app.locals;
  
  try {
    const { path: dirPath } = req.query;
    const result = await fileUtils.browseDirectory(dirPath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;