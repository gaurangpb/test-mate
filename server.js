require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Store OpenAI client instance
let openaiClient = null;

// Initialize OpenAI client from environment variable if available
console.log('Checking for OPENAI_API_KEY...');
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('OpenAI client initialized from environment variable');
} else {
  console.log('Warning: OPENAI_API_KEY not found in environment variables');
}

// Check OpenAI configuration status
app.get('/api/config/openai/status', (req, res) => {
  res.json({ configured: openaiClient !== null });
});

// Browse directories (for file picker helper - optional, not used in current implementation)
app.get('/api/browse-directory', async (req, res) => {
  try {
    const { path: dirPath } = req.query;
    
    if (!dirPath) {
      // Return common default paths on Windows
      const defaultPaths = [
        { path: 'C:\\', name: 'C:\\' },
        { path: 'C:\\Users', name: 'Users' },
        { path: 'C:\\Projects', name: 'Projects' },
        { path: process.env.USERPROFILE || process.env.HOME || '', name: 'Home' }
      ].filter(p => p.path);
      
      return res.json({ 
        directories: defaultPaths,
        currentPath: ''
      });
    }
    
    const fullPath = path.resolve(dirPath);
    
    // Security check - prevent directory traversal
    if (!fsSync.existsSync(fullPath)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => ({
          name: entry.name,
          path: path.join(fullPath, entry.name)
        }));
      
      res.json({
        directories,
        currentPath: fullPath
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize OpenAI client (kept for backward compatibility, but API key should be in .env)
app.post('/api/config/openai', (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }
  
  openaiClient = new OpenAI({ apiKey });
  res.json({ success: true, message: 'OpenAI client configured' });
});

// Scan repository for test files
app.post('/api/scan', async (req, res) => {
  try {
    const { repoPath, testPropertyName } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    // Find all .cs files recursively
    const testFiles = await findTestFiles(repoPath);
    
    // Optimized: Read and parse files in parallel
    const filePromises = testFiles.map(async (filePath) => {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const testMethods = parseTestMethods(fileContent, testPropertyName || 'TestCaseId');
        
        if (testMethods.length > 0) {
          return {
            fileName: path.basename(filePath),
            filePath: filePath,
            testMethods: testMethods
          };
        }
        return null;
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
        return null;
      }
    });
    
    const fileResults = await Promise.all(filePromises);
    const results = fileResults.filter(result => result !== null);

    res.json({ results });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze repository for comprehensive statistics
app.post('/api/analyze', async (req, res) => {
  try {
    const { repoPath, testPropertyName } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    // Find all .cs files recursively (more inclusive for analysis)
    const testFiles = await findAllCsFiles(repoPath);
    
    // Optimized: Read all files in parallel, then process
    const fileAnalysisPromises = testFiles.map(async (filePath) => {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return analyzeTestFile(fileContent, testPropertyName || 'TestCaseId', filePath);
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return { className: null, tests: [] };
      }
    });
    
    const analyses = await Promise.all(fileAnalysisPromises);
    
    // Process analysis results
    const allTests = [];
    const classStats = {};
    const tagStats = {};
    let totalTests = 0;
    let testsWithAdoId = 0;
    let testsWithoutAdoId = 0;
    let totalFilesWithTests = 0;

    analyses.forEach((analysis, index) => {
      const filePath = testFiles[index];
      
      if (analysis.tests.length > 0) {
        totalFilesWithTests++;
        const className = analysis.className || path.basename(filePath, '.cs');
        const relativePath = path.relative(repoPath, filePath);
        
        // Initialize class stats if not exists
        if (!classStats[className]) {
          classStats[className] = {
            className: className,
            filePath: relativePath,
            totalTests: 0,
            withAdoId: 0,
            withoutAdoId: 0,
            tags: new Set()
          };
        }
        
        analysis.tests.forEach(test => {
          totalTests++;
          allTests.push({
            ...test,
            className: className,
            filePath: relativePath,
            fileName: path.basename(filePath)
          });
          
          if (test.hasTestCaseId) {
            testsWithAdoId++;
            classStats[className].withAdoId++;
          } else {
            testsWithoutAdoId++;
            classStats[className].withoutAdoId++;
          }
          
          classStats[className].totalTests++;
          
          // Track tags
          test.tags.forEach(tag => {
            classStats[className].tags.add(tag);
            if (!tagStats[tag]) {
              tagStats[tag] = 0;
            }
            tagStats[tag]++;
          });
        });
      }
    });

    // Convert class stats to array and convert Sets to arrays
    const classStatsArray = Object.values(classStats).map(stat => ({
      ...stat,
      tags: Array.from(stat.tags),
      coveragePercent: stat.totalTests > 0 
        ? Math.round((stat.withAdoId / stat.totalTests) * 100) 
        : 0
    }));

    // Convert tag stats to array
    const tagStatsArray = Object.entries(tagStats)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    const coveragePercent = totalTests > 0 
      ? Math.round((testsWithAdoId / totalTests) * 100) 
      : 0;

    res.json({
      // Root-level properties for backward compatibility with tests
      totalTests,
      testsWithAdoId,
      testsWithoutAdoId,
      // Comprehensive summary
      summary: {
        totalTests,
        testsWithAdoId,
        testsWithoutAdoId,
        coveragePercent,
        totalClasses: classStatsArray.length,
        totalFiles: totalFilesWithTests,
        totalTags: tagStatsArray.length
      },
      byClass: classStatsArray.sort((a, b) => b.totalTests - a.totalTests),
      byTag: tagStatsArray,
      allTests: allTests
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate documentation for selected tests
app.post('/api/generate', async (req, res) => {
  try {
    const { tests } = req.body;
    
    if (!openaiClient) {
      return res.status(400).json({ error: 'OpenAI client not configured' });
    }

    if (!tests || tests.length === 0) {
      return res.status(400).json({ error: 'No tests provided' });
    }

    // Optimized: Generate documentation in parallel instead of sequentially
    const documentationPromises = tests.map(test => 
      generateDocumentation(test).then(docs => ({ name: test.name, docs }))
    );
    
    const documentationResults = await Promise.all(documentationPromises);
    const generatedDocs = {};
    documentationResults.forEach(({ name, docs }) => {
      generatedDocs[name] = docs;
    });

    res.json({ generatedDocs });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Optimized: Use Set for O(1) directory lookups
const SKIP_DIRECTORIES = new Set(['bin', 'obj', 'node_modules', '.git', 'packages', '.vs', 'TestResults', '.vscode']);

// Helper: Find C# files recursively with configurable filtering
async function findCsFiles(dir, options = {}) {
  const { 
    filterTestFiles = false, // Only files with 'Test' or 'Spec' in name
    includeAllCsFiles = false // Include all .cs files regardless of name
  } = options;
  
  const files = [];
  
  async function traverse(currentPath) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      // Process directories and files in parallel batches
      const promises = [];
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common non-test directories (O(1) lookup with Set)
          if (!SKIP_DIRECTORIES.has(entry.name)) {
            promises.push(traverse(fullPath));
          }
        } else if (entry.isFile() && entry.name.endsWith('.cs')) {
          // Apply filtering based on options
          if (includeAllCsFiles || !filterTestFiles) {
            files.push(fullPath);
          } else if (filterTestFiles && (entry.name.includes('Test') || entry.name.includes('Spec'))) {
            files.push(fullPath);
          }
        }
      }
      
      // Wait for all subdirectory traversals to complete
      await Promise.all(promises);
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error.message);
    }
  }
  
  await traverse(dir);
  return files;
}

// Helper: Find all C# test files recursively (filters by filename containing "Test" or "Spec")
async function findTestFiles(dir) {
  return findCsFiles(dir, { filterTestFiles: true });
}

// Helper: Find all C# files recursively (for comprehensive analysis)
async function findAllCsFiles(dir) {
  return findCsFiles(dir, { includeAllCsFiles: true });
}

// Optimized: Pre-compile regex patterns at module level (reused across calls)
const TEST_METHOD_PATTERN = /\[Test\][^\{]*?(public\s+(?:async\s+)?(?:Task\s+)?void\s+(\w+)\s*\([^\)]*\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\})/gs;

// Helper: Parse test methods from C# file content (for scan - only returns tests without ADO IDs)
function parseTestMethods(content, testPropertyName) {
  const testMethods = [];
  
  // Create test property pattern (testPropertyName can vary, so compile per call)
  const testPropertyPattern = new RegExp(`\\[TestProperty\\s*\\(\\s*["']${testPropertyName}["']`, 'i');
  
  // Reset global regex lastIndex for clean execution
  TEST_METHOD_PATTERN.lastIndex = 0;
  let match;
  while ((match = TEST_METHOD_PATTERN.exec(content)) !== null) {
    const fullMethod = match[0];
    const methodName = match[2];
    
    // Check if this test already has a TestProperty attribute
    const hasTestCaseId = testPropertyPattern.test(fullMethod);
    
    if (!hasTestCaseId) {
      // Extract the method body
      const methodStart = content.indexOf(match[1]);
      const methodCode = extractMethodCode(content, methodStart);
      
      testMethods.push({
        name: methodName,
        hasTestCaseId: false,
        code: methodCode
      });
    }
  }
  
  return testMethods;
}

// Optimized: Pre-compile regex patterns at module level (reused across calls)
const CLASS_MATCH_PATTERN = /\[TestFixture[^\]]*\][\s\S]*?public\s+class\s+(\w+)/;
const CLASS_FALLBACK_PATTERN = /public\s+class\s+(\w+)/;
const TEST_FIXTURE_PATTERN = /\[TestFixture(?:[^\]]*)\]/;
const CATEGORY_PATTERN = /\[Category\s*\(\s*["']([^"']+)["']/gi;
const TAG_PATTERN = /\[Tag\s*\(\s*["']([^"']+)["']/gi;
const BEFORE_CLASS_ATTR_PATTERN = /(\[Category\s*\([^\]]+\)\s*)+\[TestFixture/;
const TEST_ATTRIBUTE_PATTERN = /\[Test\](?!\w)/g;
const METHOD_SIGNATURE_PATTERN = /(public\s+(?:async\s+Task\s+|Task\s+|void\s+)(\w+)\s*\([^\)]*\))/;
const EXCLUDED_METHODS = new Set(['Setup', 'TearDown', 'SetUp', 'OneTimeSetUp', 'OneTimeTearDown']);

// Helper: Comprehensive analysis of test file (for analyzer - returns all tests)
function analyzeTestFile(content, testPropertyName, filePath) {
  const tests = [];
  
  // Extract class name and class-level categories
  let classMatch = CLASS_MATCH_PATTERN.exec(content);
  if (!classMatch) {
    // Fallback: match public class without TestFixture
    CLASS_FALLBACK_PATTERN.lastIndex = 0;
    classMatch = CLASS_FALLBACK_PATTERN.exec(content);
  }
  const className = classMatch ? classMatch[1] : null;
  
  // Extract class-level categories (from TestFixture attribute)
  const classLevelTags = [];
  TEST_FIXTURE_PATTERN.lastIndex = 0;
  const classFixtureMatch = TEST_FIXTURE_PATTERN.exec(content);
  if (classFixtureMatch) {
    const fixtureAttrSection = classFixtureMatch[0];
    
    // Extract Categories
    CATEGORY_PATTERN.lastIndex = 0;
    let classCategoryMatch;
    while ((classCategoryMatch = CATEGORY_PATTERN.exec(fixtureAttrSection)) !== null) {
      classLevelTags.push(classCategoryMatch[1]);
    }
    
    // Extract Tags
    TAG_PATTERN.lastIndex = 0;
    let classTagMatch;
    while ((classTagMatch = TAG_PATTERN.exec(fixtureAttrSection)) !== null) {
      classLevelTags.push(classTagMatch[1]);
    }
  }
  
  // Also check for standalone Category attributes right before the class declaration
  BEFORE_CLASS_ATTR_PATTERN.lastIndex = 0;
  const beforeClassAttrMatch = BEFORE_CLASS_ATTR_PATTERN.exec(content);
  if (beforeClassAttrMatch) {
    const beforeClassSection = beforeClassAttrMatch[0];
    CATEGORY_PATTERN.lastIndex = 0;
    let beforeClassCategoryMatch;
    while ((beforeClassCategoryMatch = CATEGORY_PATTERN.exec(beforeClassSection)) !== null) {
      classLevelTags.push(beforeClassCategoryMatch[1]);
    }
  }
  
  // Find all [Test] attributes and their associated methods
  // Create test property pattern (testPropertyName can vary)
  const testPropertyRegex = new RegExp(`\\[TestProperty\\s*\\(\\s*["']${testPropertyName}["']\\s*,\\s*["']([^"']+)["']\\s*\\)`, 'gi');
  
  TEST_ATTRIBUTE_PATTERN.lastIndex = 0;
  let testMatch;
  while ((testMatch = TEST_ATTRIBUTE_PATTERN.exec(content)) !== null) {
    const testAttrIndex = testMatch.index;
    const afterTestAttr = content.substring(testAttrIndex + testMatch[0].length, testAttrIndex + testMatch[0].length + 2000);
    
    // Look for method signature after [Test] attribute
    METHOD_SIGNATURE_PATTERN.lastIndex = 0;
    const methodMatch = METHOD_SIGNATURE_PATTERN.exec(afterTestAttr);
    if (!methodMatch) continue;
    
    const methodName = methodMatch[2];
    
    // Skip Setup/TearDown methods (O(1) lookup with Set)
    if (EXCLUDED_METHODS.has(methodName)) continue;
    
    const testAttrStart = testAttrIndex;
    const methodStart = testAttrIndex + testMatch[0].length + methodMatch.index;
    
    // Look backwards from [Test] to capture all attributes before it
    const searchStart = Math.max(0, testAttrStart - 1000);
    const methodLineEnd = content.indexOf('\n', methodStart);
    const methodSignature = methodMatch[0];
    const searchEnd = methodLineEnd > -1 ? methodLineEnd : methodStart + methodSignature.length;
    const attrSection = content.substring(searchStart, searchEnd);
    
    // Extract TestProperty for ADO ID
    testPropertyRegex.lastIndex = 0;
    const adoIdMatch = testPropertyRegex.exec(attrSection);
    const hasTestCaseId = !!adoIdMatch;
    const adoId = adoIdMatch ? adoIdMatch[1].trim() : null;
    
    // Extract Category/Tag attributes from method-level attributes
    const tags = [...classLevelTags];
    CATEGORY_PATTERN.lastIndex = 0;
    let categoryMatch;
    while ((categoryMatch = CATEGORY_PATTERN.exec(attrSection)) !== null) {
      tags.push(categoryMatch[1]);
    }
    
    TAG_PATTERN.lastIndex = 0;
    let tagMatch;
    while ((tagMatch = TAG_PATTERN.exec(attrSection)) !== null) {
      tags.push(tagMatch[1]);
    }
    
    // Remove duplicates while preserving order
    const uniqueTags = [...new Set(tags)];
    
    tests.push({
      name: methodName,
      hasTestCaseId: hasTestCaseId,
      adoId: adoId,
      tags: uniqueTags.length > 0 ? uniqueTags : [],
      hasTestCaseParams: attrSection.includes('[TestCase')
    });
  }
  
  return {
    className: className,
    tests: tests
  };
}

// Helper: Extract clean method code
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
  
  // Clean up and format
  return methodCode.trim();
}

// Helper: Generate documentation using OpenAI
async function generateDocumentation(test) {
  const prompt = `You are a QA documentation expert. Analyze this automated test code and generate comprehensive test documentation.

Test Method Name: ${test.name}

Test Code:
\`\`\`csharp
${test.code}
\`\`\`

Please provide:

1. A narrative description (2-3 sentences) explaining what business scenario this test validates. Focus on the user perspective and business value, not technical implementation details.

2. Detailed test steps in the format of Action and Expected Result pairs. Each step should be clear and testable. Include steps for setup, execution, and verification.

Return your response in this exact JSON format:
{
  "description": "Your narrative description here",
  "steps": [
    {
      "action": "Action description",
      "expectedResult": "Expected result description"
    }
  ]
}

Important guidelines:
- Make the description business-focused and user-centric
- Steps should be clear enough for manual testing if needed
- Include verification steps based on assertions in the code
- Keep technical jargon minimal in the description
- Number of steps should match the logical flow of the test (typically 3-7 steps)`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a QA documentation expert who creates clear, comprehensive test documentation from automated test code. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error generating docs for ${test.name}:`, error);
    throw error;
  }
}

// Create test cases in Azure DevOps (Mock implementation)
app.post('/api/ado/create-test-cases', async (req, res) => {
  try {
    const { testCases, generateMappingFile, mappingFilePath } = req.body;
    
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

    // Mock implementation - generate random 6-digit IDs
    // TODO: Replace with actual Azure DevOps API calls
    const results = testCases.map(testCase => {
      // Generate random 6-digit number
      const randomId = Math.floor(100000 + Math.random() * 900000).toString();
      
      return {
        testName: testCase.testName,
        fileName: testCase.fileName,
        filePath: testCase.filePath || '', // Include filePath if provided
        testCaseId: randomId,
        success: true
      };
    });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Optionally generate mapping file
    let mappingFileInfo = null;
    if (generateMappingFile) {
      try {
        const outputPath = mappingFilePath || path.join(process.cwd(), 'test-case-ids-mapping.json');
        const testCaseIds = results.map(r => ({
          testName: r.testName,
          filePath: r.filePath || r.fileName,
          testCaseId: r.testCaseId
        }));
        
        const byClass = {};
        const fileStats = new Set();
        
        testCaseIds.forEach(item => {
          const fileName = path.basename(item.filePath, '.cs');
          const className = fileName.replace('Tests', '').replace('Test', '');
          
          if (!byClass[className]) {
            byClass[className] = 0;
          }
          byClass[className]++;
          fileStats.add(item.filePath);
        });
        
        const mappingData = {
          metadata: {
            generatedDate: new Date().toISOString(),
            totalTestCases: testCaseIds.length,
            testPropertyName: 'TestCaseId'
          },
          testCases: testCaseIds.map(item => ({
            testName: item.testName,
            filePath: item.filePath,
            fileName: path.basename(item.filePath),
            testCaseId: item.testCaseId,
            status: 'active'
          })),
          summary: {
            byClass: byClass,
            filesUpdated: fileStats.size
          }
        };
        
        await fs.writeFile(outputPath, JSON.stringify(mappingData, null, 2), 'utf-8');
        mappingFileInfo = {
          filePath: outputPath,
          created: true
        };
      } catch (mappingError) {
        console.error('Error generating mapping file:', mappingError);
        // Don't fail the entire request if mapping file generation fails
        mappingFileInfo = {
          error: mappingError.message
        };
      }
    }

    res.json({ 
      success: true,
      results: results,
      message: `Successfully created ${results.length} test case(s) in ADO (Mock Mode)`,
      mappingFile: mappingFileInfo
    });
  } catch (error) {
    console.error('ADO creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate test case IDs mapping file (JSON format)
app.post('/api/generate-mapping-file', async (req, res) => {
  try {
    const { testCaseIds, testPropertyName, outputPath } = req.body;
    
    if (!testCaseIds || testCaseIds.length === 0) {
      return res.status(400).json({ error: 'No test case IDs provided' });
    }

    const propertyName = testPropertyName || 'TestCaseId';
    
    // Group by class and file
    const byClass = {};
    const byCategory = {};
    const fileStats = new Set();
    
    testCaseIds.forEach(item => {
      // Extract class name from file path (simplified - assumes className matches fileName)
      const fileName = path.basename(item.filePath, '.cs');
      const className = fileName.replace('Tests', '').replace('Test', '');
      
      if (!byClass[className]) {
        byClass[className] = 0;
      }
      byClass[className]++;
      
      fileStats.add(item.filePath);
      
      // Note: Categories would need to come from scan/analyze results
      // For now, we'll just count them
    });
    
    const mappingData = {
      metadata: {
        generatedDate: new Date().toISOString(),
        totalTestCases: testCaseIds.length,
        testPropertyName: propertyName
      },
      testCases: testCaseIds.map(item => ({
        testName: item.testName,
        filePath: item.filePath,
        fileName: path.basename(item.filePath),
        testCaseId: item.testCaseId,
        status: 'active'
      })),
      summary: {
        byClass: byClass,
        filesUpdated: fileStats.size
      }
    };
    
    // If outputPath is provided, write to file; otherwise return JSON
    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(mappingData, null, 2), 'utf-8');
      res.json({
        success: true,
        message: `Mapping file created at ${outputPath}`,
        filePath: outputPath
      });
    } else {
      res.json(mappingData);
    }
  } catch (error) {
    console.error('Mapping file generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Write test case IDs back to test files
app.post('/api/write-test-ids', async (req, res) => {
  try {
    const { testCaseIds, testPropertyName } = req.body;
    
    if (!testCaseIds || testCaseIds.length === 0) {
      return res.status(400).json({ error: 'No test case IDs provided' });
    }

    if (!testPropertyName) {
      return res.status(400).json({ error: 'Test property name is required' });
    }

    const results = [];
    const propertyName = testPropertyName || 'TestCaseId';

    // Group by file path to minimize file reads/writes
    const fileGroups = {};
    testCaseIds.forEach(item => {
      if (!fileGroups[item.filePath]) {
        fileGroups[item.filePath] = [];
      }
      fileGroups[item.filePath].push({
        testName: item.testName,
        testCaseId: item.testCaseId
      });
    });

    // Process each file
    for (const [filePath, tests] of Object.entries(fileGroups)) {
      try {
        // Read the file
        let content = await fs.readFile(filePath, 'utf-8');
        let fileModified = false;

        // Process each test in this file
        for (const { testName, testCaseId } of tests) {
          // Pattern to find the test method: [Test] followed by method signature
          // Match [Test] attribute and method signature
          const testPattern = new RegExp(
            `(\\[Test\\]\\s*(?:\\[Category[^\\]]+\\]\\s*)*(?:\\[TestProperty[^\\]]+\\]\\s*)*)\\s*(public\\s+(?:async\\s+)?(?:Task\\s+)?void\\s+${testName}\\s*\\([^\\)]*\\))`,
            's'
          );

          let match = testPattern.exec(content);
          
          if (!match) {
            // Try without assuming TestProperty is already there - look for [Test] then method name
            const flexiblePattern = new RegExp(
              `(\\[Test\\]\\s*(?:\\[Category[^\\]]+\\]\\s*)*(?:\\[TestProperty[^\\]]+\\]\\s*)*)\\s*(public\\s+(?:async\\s+)?(?:Task\\s+)?void\\s+${testName}\\s*\\([^\\)]*\\))`,
              's'
            );
            match = flexiblePattern.exec(content);
          }

          if (!match) {
            // Try a more flexible approach: find [Test], then find method after it
            const testAttrPattern = /\[Test\]/g;
            let testAttrMatch;
            while ((testAttrMatch = testAttrPattern.exec(content)) !== null) {
              const afterTest = content.substring(testAttrMatch.index);
              const methodPattern = new RegExp(
                `public\\s+(?:async\\s+)?(?:Task\\s+)?void\\s+${testName}\\s*\\([^\\)]*\\)`,
                's'
              );
              const methodMatch = methodPattern.exec(afterTest);
              
              if (methodMatch) {
                // Found it - look backwards from [Test] to find all attributes
                const testStart = testAttrMatch.index;
                const methodStart = testAttrMatch.index + methodMatch.index;
                
                // Look backwards from [Test] to find where attributes start (max 500 chars)
                let attrStart = testStart;
                for (let i = testStart - 1; i >= Math.max(0, testStart - 500); i--) {
                  if (content[i] === '\n' && (i === testStart - 1 || content.substring(i + 1, testStart).trim().startsWith('['))) {
                    // Found a line break before attributes
                    break;
                  }
                  if (content[i] === '\n' && i < testStart - 1) {
                    const lineAfterBreak = content.substring(i + 1, testStart).trim();
                    if (lineAfterBreak && !lineAfterBreak.startsWith('[') && !lineAfterBreak.startsWith('//')) {
                      attrStart = i + 1;
                      break;
                    }
                  }
                }

                // Check if TestProperty already exists
                const attrSection = content.substring(Math.max(0, testStart - 500), testStart);
                const existingPropertyPattern = new RegExp(
                  `\\[TestProperty\\s*\\(\\s*["']${propertyName}["']\\s*,\\s*["'][^"']+["']\\s*\\)\\]`,
                  'i'
                );
                
                if (existingPropertyPattern.test(attrSection)) {
                  // Update existing TestProperty
                  const propertyMatch = existingPropertyPattern.exec(attrSection);
                  const fullMatch = propertyMatch[0];
                  const newProperty = `[TestProperty("${propertyName}", "${testCaseId}")]`;
                  const propertyIndex = Math.max(0, testStart - 500) + propertyMatch.index;
                  content = content.substring(0, propertyIndex) + newProperty + content.substring(propertyIndex + fullMatch.length);
                  fileModified = true;
                } else {
                  // Insert new TestProperty before [Test]
                  const indentMatch = content.substring(Math.max(0, testStart - 100), testStart).match(/([ \t]*)$/);
                  const indent = indentMatch ? indentMatch[1] : '        ';
                  const newProperty = `${indent}[TestProperty("${propertyName}", "${testCaseId}")]\n`;
                  content = content.substring(0, testStart) + newProperty + content.substring(testStart);
                  fileModified = true;
                }
                break;
              }
            }
          } else {
            // Found with pattern - check if TestProperty already exists
            const attrSection = match[1];
            const existingPropertyPattern = new RegExp(
              `\\[TestProperty\\s*\\(\\s*["']${propertyName}["']\\s*,\\s*["'][^"']+["']\\s*\\)\\]`,
              'i'
            );
            
            if (existingPropertyPattern.test(attrSection)) {
              // Update existing TestProperty
              const propertyMatch = existingPropertyPattern.exec(attrSection);
              const updatedSection = attrSection.replace(
                new RegExp(`\\[TestProperty\\s*\\(\\s*["']${propertyName}["']\\s*,\\s*["'][^"']+["']\\s*\\)\\]`, 'i'),
                `[TestProperty("${propertyName}", "${testCaseId}")]`
              );
              content = content.substring(0, match.index) + updatedSection + content.substring(match.index + match[1].length);
              fileModified = true;
            } else {
              // Insert new TestProperty before [Test]
              const testAttrIndex = match.index;
              const indentMatch = content.substring(Math.max(0, testAttrIndex - 100), testAttrIndex).match(/([ \t]*)$/);
              const indent = indentMatch ? indentMatch[1] : '        ';
              const newProperty = `${indent}[TestProperty("${propertyName}", "${testCaseId}")]\n`;
              content = content.substring(0, testAttrIndex) + newProperty + content.substring(testAttrIndex);
              fileModified = true;
            }
          }
        }

        // Write the file back if modified
        if (fileModified) {
          await fs.writeFile(filePath, content, 'utf-8');
          results.push({
            filePath: filePath,
            fileName: path.basename(filePath),
            success: true,
            testsUpdated: tests.length
          });
        } else {
          results.push({
            filePath: filePath,
            fileName: path.basename(filePath),
            success: false,
            error: 'No changes made - tests may not have been found'
          });
        }
      } catch (fileError) {
        console.error(`Error writing to file ${filePath}:`, fileError);
        results.push({
          filePath: filePath,
          fileName: path.basename(filePath),
          success: false,
          error: fileError.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    res.json({
      success: successCount > 0,
      results: results,
      message: `Successfully updated ${successCount} file(s)`
    });
  } catch (error) {
    console.error('Write test IDs error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});