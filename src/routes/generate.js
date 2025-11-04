const express = require('express');
const router = express.Router();

/**
 * Documentation generation routes
 */

// Generate documentation for selected tests
router.post('/generate', async (req, res) => {
  const { openaiService } = req.app.locals;
  
  try {
    const { tests } = req.body;
    
    console.log('Generate endpoint called with:', { testsCount: tests?.length, tests: tests?.map(t => ({ name: t.name, codeLength: t.code?.length })) });
    
    if (!openaiService.isConfigured()) {
      console.error('OpenAI client not configured');
      return res.status(400).json({ error: 'OpenAI client not configured' });
    }

    if (!tests || tests.length === 0) {
      console.error('No tests provided');
      return res.status(400).json({ error: 'No tests provided' });
    }

    // Validate test objects
    for (const test of tests) {
      if (!test.name || !test.code) {
        console.error('Invalid test object:', test);
        return res.status(400).json({ error: 'Each test must have a name and code property' });
      }
    }

    console.log(`Processing ${tests.length} test(s) for documentation generation`);

    const generatedDocs = await openaiService.generateDocumentationForTests(tests);

    console.log(`Documentation generation completed. Generated docs for ${Object.keys(generatedDocs).length} tests`);
    res.json({ generatedDocs });
  } catch (error) {
    console.error('Generation endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

module.exports = router;