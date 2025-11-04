const express = require('express');
const router = express.Router();

/**
 * Documentation generation routes
 */

// Generate documentation for selected tests
router.post('/generate', async (req, res) => {
  const { openaiService, fileUtils } = req.app.locals;
  
  try {
    const { tests, domainContextPath } = req.body;
    
    console.log('Generate endpoint called with:', { 
      testsCount: tests?.length, 
      tests: tests?.map(t => ({ name: t.name, codeLength: t.code?.length })),
      domainContextPath: domainContextPath || 'none'
    });
    
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

    // Read domain context if provided
    let domainContext = null;
    if (domainContextPath) {
      try {
        domainContext = await fileUtils.readDomainContext(domainContextPath);
        if (domainContext) {
          console.log(`Domain context loaded from: ${domainContextPath} (${domainContext.length} characters)`);
        } else {
          console.warn(`Domain context file not found or empty: ${domainContextPath}`);
        }
      } catch (contextError) {
        console.warn(`Failed to load domain context: ${contextError.message}`);
        // Continue without context rather than failing
      }
    }

    console.log(`Processing ${tests.length} test(s) for documentation generation${domainContext ? ' with domain context' : ''}`);

    const generatedDocs = await openaiService.generateDocumentationForTests(tests, domainContext);

    console.log(`Documentation generation completed. Generated docs for ${Object.keys(generatedDocs).length} tests`);
    res.json({ 
      generatedDocs,
      usedDomainContext: !!domainContext
    });
  } catch (error) {
    console.error('Generation endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

// Suggest domain context updates based on test analysis
router.post('/suggest-context-updates', async (req, res) => {
  const { openaiService, fileParserService, fileUtils } = req.app.locals;
  
  try {
    const { repoPath, domainContextPath, testPropertyName, limit = 50 } = req.body;
    
    if (!openaiService.isConfigured()) {
      return res.status(400).json({ error: 'OpenAI client not configured' });
    }

    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    console.log('Suggest context updates endpoint called:', { repoPath, domainContextPath, limit });

    // Read existing domain context if provided
    let existingContext = null;
    if (domainContextPath) {
      existingContext = await fileUtils.readDomainContext(domainContextPath);
      if (existingContext) {
        console.log(`Existing domain context loaded (${existingContext.length} characters)`);
      }
    }

    // Get all tests from repository
    const testFiles = await fileParserService.findTestFiles(repoPath);
    
    if (testFiles.length === 0) {
      return res.status(400).json({ error: 'No test files found in repository' });
    }

    // Read test code from files (limit to avoid too large prompts)
    const tests = [];
    const maxFiles = Math.min(testFiles.length, limit);
    const fs = require('fs').promises;
    const path = require('path');
    
    for (let i = 0; i < maxFiles; i++) {
      try {
        const fileContent = await fs.readFile(testFiles[i], 'utf-8');
        
        // Extract all test methods (with or without IDs) by parsing the file
        const testAttributePattern = /\[Test(?:\s*,|\s*\])/g;
        const methodSignaturePattern = /(public\s+(?:async\s+)?(?:Task\s+|void\s+)(\w+)\s*\([^\)]*\))/;
        const excludedMethods = new Set(['Setup', 'TearDown', 'SetUp', 'OneTimeSetUp', 'OneTimeTearDown']);
        
        let testMatch;
        while ((testMatch = testAttributePattern.exec(fileContent)) !== null) {
          const testAttrIndex = testMatch.index;
          const afterTestAttr = fileContent.substring(testAttrIndex + testMatch[0].length, testAttrIndex + testMatch[0].length + 2000);
          
          methodSignaturePattern.lastIndex = 0;
          const methodMatch = methodSignaturePattern.exec(afterTestAttr);
          if (!methodMatch) continue;
          
          const methodName = methodMatch[2];
          if (excludedMethods.has(methodName)) continue;
          
          // Extract method code
          const methodStart = testAttrIndex + testMatch[0].length + methodMatch.index;
          const methodCode = extractMethodCode(fileContent, methodStart);
          
          if (methodCode) {
            tests.push({
              name: methodName,
              code: methodCode,
              fileName: path.basename(testFiles[i])
            });
          }
        }
      } catch (fileError) {
        console.warn(`Error reading test file ${testFiles[i]}: ${fileError.message}`);
      }
    }
    
    // Helper function to extract method code
    function extractMethodCode(content, startIndex) {
      let braceCount = 0;
      let inMethod = false;
      let methodCode = '';
      
      for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        methodCode += char;
        
        if (char === '{') {
          braceCount++;
          inMethod = true;
        } else if (char === '}') {
          braceCount--;
          if (inMethod && braceCount === 0) {
            break;
          }
        }
      }
      
      return methodCode.trim();
    }

    if (tests.length === 0) {
      return res.status(400).json({ error: 'No test methods found to analyze' });
    }

    console.log(`Analyzing ${tests.length} test(s) for domain concepts`);

    // Extract domain concepts using AI
    const suggestions = await openaiService.extractDomainConcepts(tests, existingContext);

    res.json({
      suggestions,
      analysisSummary: {
        testsAnalyzed: tests.length,
        filesAnalyzed: maxFiles,
        totalTestFiles: testFiles.length,
        hasExistingContext: !!existingContext
      }
    });
  } catch (error) {
    console.error('Suggest context updates error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

module.exports = router;