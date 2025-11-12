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

// Get test files list for file selection
router.post('/test-files-list', async (req, res) => {
  const { fileParserService } = req.app.locals;
  
  try {
    const { repoPath } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    console.log('Getting test files list for:', repoPath);

    // Get all test files from repository
    const testFiles = await fileParserService.findTestFiles(repoPath);
    
    if (testFiles.length === 0) {
      return res.json({ files: [], tree: {} });
    }

    const path = require('path');
    const resolvedRepoPath = path.resolve(repoPath);
    
    // Convert absolute paths to relative paths from repo root
    const filesWithRelativePaths = testFiles.map(filePath => {
      const relativePath = path.relative(resolvedRepoPath, filePath);
      return {
        absolutePath: filePath,
        relativePath: relativePath.replace(/\\/g, '/'), // Normalize to forward slashes
        fileName: path.basename(filePath)
      };
    });

    // Build tree structure
    const tree = {};
    filesWithRelativePaths.forEach(file => {
      const parts = file.relativePath.split('/');
      let current = tree;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: 'directory', children: {} };
        }
        current = current[part].children;
      }
      
      const fileName = parts[parts.length - 1];
      if (!current[fileName]) {
        current[fileName] = {
          type: 'file',
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          fileName: file.fileName
        };
      }
    });

    res.json({
      files: filesWithRelativePaths,
      tree: tree
    });
  } catch (error) {
    console.error('Get test files list error:', error);
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
    const { repoPath, selectedFilePaths, testPropertyName } = req.body;
    
    if (!openaiService.isConfigured()) {
      return res.status(400).json({ error: 'OpenAI client not configured' });
    }

    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    if (!selectedFilePaths || selectedFilePaths.length === 0) {
      return res.status(400).json({ error: 'At least one test file must be selected' });
    }

    console.log('Suggest context updates endpoint called:', { repoPath, selectedFilesCount: selectedFilePaths.length });

    const path = require('path');
    const fs = require('fs').promises;
    const resolvedRepoPath = path.resolve(repoPath);
    
    // Automatically look for domain-context.md in repo root
    const domainContextPath = path.join(resolvedRepoPath, 'domain-context.md');
    let existingContext = null;
    
    try {
      existingContext = await fileUtils.readDomainContext(domainContextPath);
      if (existingContext) {
        console.log(`Existing domain context loaded from ${domainContextPath} (${existingContext.length} characters)`);
      }
    } catch (contextError) {
      console.log(`No existing domain context found at ${domainContextPath}`);
    }

    // Read test code from selected files
    const tests = [];
    
    for (const filePath of selectedFilePaths) {
      try {
        // Resolve the path - could be absolute or relative
        const resolvedPath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(resolvedRepoPath, filePath);
        
        const fileContent = await fs.readFile(resolvedPath, 'utf-8');
        
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
              fileName: path.basename(resolvedPath),
              filePath: path.relative(resolvedRepoPath, resolvedPath).replace(/\\/g, '/')
            });
          }
        }
      } catch (fileError) {
        console.warn(`Error reading test file ${filePath}: ${fileError.message}`);
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

    console.log(`Analyzing ${tests.length} test(s) from ${selectedFilePaths.length} file(s) for domain concepts`);

    // Extract domain concepts using AI
    const suggestions = await openaiService.extractDomainConcepts(tests, existingContext);

    res.json({
      suggestions,
      analysisSummary: {
        testsAnalyzed: tests.length,
        filesAnalyzed: selectedFilePaths.length,
        hasExistingContext: !!existingContext,
        domainContextPath: existingContext ? domainContextPath : null
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

// Save/update domain context file
router.post('/save-domain-context', async (req, res) => {
  const { fileUtils } = req.app.locals;
  
  try {
    const { repoPath, content } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const path = require('path');
    const resolvedRepoPath = path.resolve(repoPath);
    const domainContextPath = path.join(resolvedRepoPath, 'domain-context.md');

    console.log(`Saving domain context to: ${domainContextPath}`);

    // Since the user has edited the full content in the textarea, 
    // we should replace the entire file rather than trying to merge
    const result = await fileUtils.saveDomainContext(domainContextPath, content);

    res.json({
      success: true,
      filePath: domainContextPath,
      ...result
    });
  } catch (error) {
    console.error('Save domain context error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

// Generate test steps from manual test description
router.post('/generate/manual', async (req, res) => {
  const { openaiService, fileUtils } = req.app.locals;
  
  try {
    const { testName, description, bulletPoints, repoPath } = req.body;
    
    console.log('Manual test generation endpoint called with:', { 
      testName,
      descriptionLength: description?.length,
      bulletPointsLength: bulletPoints?.length,
      repoPath: repoPath || 'none'
    });
    
    if (!openaiService.isConfigured()) {
      console.error('OpenAI client not configured');
      return res.status(400).json({ error: 'OpenAI client not configured' });
    }

    if (!testName || !testName.trim()) {
      console.error('Test name is required');
      return res.status(400).json({ error: 'Test name is required' });
    }

    if (!description || !description.trim()) {
      console.error('Description is required');
      return res.status(400).json({ error: 'Description is required' });
    }

    // Read domain context if repoPath is provided
    let domainContext = null;
    if (repoPath) {
      try {
        const path = require('path');
        const resolvedRepoPath = path.resolve(repoPath);
        const domainContextPath = path.join(resolvedRepoPath, 'domain-context.md');
        domainContext = await fileUtils.readDomainContext(domainContextPath);
        if (domainContext) {
          console.log(`Domain context loaded from: ${domainContextPath} (${domainContext.length} characters)`);
        }
      } catch (contextError) {
        console.warn(`Failed to load domain context: ${contextError.message}`);
        // Continue without context rather than failing
      }
    }

    console.log(`Generating manual test steps for: ${testName}${domainContext ? ' with domain context' : ''}`);

    const generatedDoc = await openaiService.generateManualTestSteps(
      testName.trim(),
      description.trim(),
      bulletPoints ? bulletPoints.trim() : null,
      domainContext
    );

    console.log(`Manual test generation completed for: ${testName}`);
    res.json({ 
      generatedDoc,
      usedDomainContext: !!domainContext
    });
  } catch (error) {
    console.error('Manual test generation endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

module.exports = router;