const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

/**
 * File parsing service for C# test files using Roslyn
 */
class FileParserService {
  constructor() {
    this.SKIP_DIRECTORIES = new Set(['bin', 'obj', 'node_modules', '.git', 'packages', '.vs', 'TestResults', '.vscode']);
    const isWindows = process.platform === 'win32';
    const exeName = isWindows ? 'RoslynParser.exe' : 'RoslynParser';
    this.roslynParserPath = path.join(__dirname, '../../roslyn-parser/bin/Release/net8.0', exeName);
  }

  /**
   * Call Roslyn parser to analyze a C# file
   */
  async callRoslynParser(filePath, content, testPropertyName) {
    return new Promise((resolve, reject) => {
      const request = {
        filePath: filePath,
        content: content,
        testPropertyName: testPropertyName || 'ADOTestCaseId'
      };

      // Try to find the Roslyn parser executable
      let parserExe = this.roslynParserPath;
      const fsSync = require('fs');
      
      // Fallback: try to find it in common locations
      if (!fsSync.existsSync(parserExe)) {
        // Try Debug build
        const isWindows = process.platform === 'win32';
        const exeName = isWindows ? 'RoslynParser.exe' : 'RoslynParser';
        parserExe = path.join(__dirname, '../../roslyn-parser/bin/Debug/net8.0', exeName);
      }

      if (!fsSync.existsSync(parserExe)) {
        // Try dotnet run as fallback
        const projectPath = path.join(__dirname, '../../roslyn-parser');
        const dotnetProcess = spawn('dotnet', ['run', '--project', path.join(projectPath, 'RoslynParser.csproj')], {
          cwd: projectPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        dotnetProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        dotnetProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        dotnetProcess.on('close', (code) => {
          if (code !== 0) {
            console.error(`DEBUG: Roslyn parser (dotnet run) exited with code ${code}`);
            console.error(`DEBUG: Roslyn parser stderr: ${stderr}`);
            console.error(`DEBUG: Roslyn parser stdout: ${stdout}`);
            reject(new Error(`Roslyn parser failed: ${stderr || 'Unknown error'}`));
            return;
          }

          try {
            console.log(`DEBUG: Roslyn parser (dotnet run) stdout (raw): ${stdout.substring(0, 500)}`);
            const response = JSON.parse(stdout);
            console.log(`DEBUG: Roslyn parser (dotnet run) response parsed:`, JSON.stringify(response, null, 2).substring(0, 1000));
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          } catch (parseError) {
            console.error(`DEBUG: Failed to parse Roslyn response. stdout: ${stdout.substring(0, 500)}`);
            reject(new Error(`Failed to parse Roslyn parser response: ${parseError.message}`));
          }
        });

        dotnetProcess.on('error', (error) => {
          if (error.code === 'ENOENT') {
            reject(new Error('Roslyn parser not available. Please install .NET 8 SDK and run: npm run build:roslyn'));
          } else {
            reject(new Error(`Failed to start Roslyn parser: ${error.message}. Make sure .NET 8 SDK is installed.`));
          }
        });

        dotnetProcess.stdin.write(JSON.stringify(request) + '\n');
        dotnetProcess.stdin.end();

        return;
      }

      // Use the compiled executable
      const parserProcess = spawn(parserExe, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      parserProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      parserProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      parserProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`DEBUG: Roslyn parser process exited with code ${code}`);
          console.error(`DEBUG: Roslyn parser stderr: ${stderr}`);
          console.error(`DEBUG: Roslyn parser stdout: ${stdout}`);
          reject(new Error(`Roslyn parser failed: ${stderr || 'Unknown error'}`));
          return;
        }

        try {
          console.log(`DEBUG: Roslyn parser stdout (raw): ${stdout.substring(0, 500)}`);
          const response = JSON.parse(stdout);
          console.log(`DEBUG: Roslyn parser response parsed:`, JSON.stringify(response, null, 2).substring(0, 1000));
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        } catch (parseError) {
          console.error(`DEBUG: Failed to parse Roslyn response. stdout: ${stdout.substring(0, 500)}`);
          reject(new Error(`Failed to parse Roslyn parser response: ${parseError.message}`));
        }
      });

      parserProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('Roslyn parser executable not found. Please run: npm run build:roslyn'));
        } else {
          reject(new Error(`Failed to start Roslyn parser: ${error.message}. Make sure .NET 8 SDK is installed and the parser is built.`));
        }
      });

      parserProcess.stdin.write(JSON.stringify(request) + '\n');
      parserProcess.stdin.end();
    });
  }

  async scanForTestsWithoutIds(repoPath, testPropertyName) {
    console.log(`DEBUG: Scanning repository: ${repoPath}`);
    console.log(`DEBUG: Looking for property name: ${testPropertyName || 'ADOTestCaseId'}`);

    const testFiles = await this.findTestFiles(repoPath);
    
    if (testFiles.length === 0) {
      console.log('DEBUG: No test files found');
      return [];
    }
    
    const filePromises = testFiles.map(async (filePath) => {
      try {
        console.log(`DEBUG: Processing file: ${filePath}`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const testMethods = await this.parseTestMethods(fileContent, testPropertyName || 'ADOTestCaseId', filePath);
        
        if (testMethods.length > 0) {
          // Extract class name from file content
          const analysis = await this.analyzeTestFile(fileContent, testPropertyName || 'ADOTestCaseId', filePath);
          const className = analysis.className || path.basename(filePath, '.cs');
          
          console.log(`DEBUG: File ${path.basename(filePath)} has ${testMethods.length} tests without IDs`);
          return {
            fileName: path.basename(filePath),
            filePath: filePath,
            className: className,
            testMethods: testMethods
          };
        } else {
          console.log(`DEBUG: File ${path.basename(filePath)} has no tests without IDs`);
        }
        return null;
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
        return null;
      }
    });
    
    const fileResults = await Promise.all(filePromises);
    const results = fileResults.filter(result => result !== null);

    console.log(`DEBUG: Final results: ${results.length} files with tests without IDs`);
    return results;
  }

  async scanForTestsWithIds(repoPath, testPropertyName) {
    console.log(`DEBUG: Scanning repository for tests WITH ADO IDs: ${repoPath}`);
    console.log(`DEBUG: Looking for property name: ${testPropertyName || 'ADOTestCaseId'}`);

    const testFiles = await this.findTestFiles(repoPath);
    
    if (testFiles.length === 0) {
      console.log('DEBUG: No test files found');
      return [];
    }
    
    const filePromises = testFiles.map(async (filePath) => {
      try {
        console.log(`DEBUG: Processing file: ${filePath}`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const testMethods = this.parseTestMethodsWithIds(fileContent, testPropertyName || 'ADOTestCaseId');
        
        if (testMethods.length > 0) {
          // Extract class name from file content
          const analysis = this.analyzeTestFile(fileContent, testPropertyName || 'ADOTestCaseId', filePath);
          const className = analysis.className || path.basename(filePath, '.cs');
          
          console.log(`DEBUG: File ${path.basename(filePath)} has ${testMethods.length} tests with IDs`);
          return {
            fileName: path.basename(filePath),
            filePath: filePath,
            className: className,
            testMethods: testMethods
          };
        } else {
          console.log(`DEBUG: File ${path.basename(filePath)} has no tests with IDs`);
        }
        return null;
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
        return null;
      }
    });
    
    const fileResults = await Promise.all(filePromises);
    const results = fileResults.filter(result => result !== null);

    console.log(`DEBUG: Final results: ${results.length} files with tests with IDs`);
    return results;
  }

  parseTestMethodsWithIds(content, testPropertyName) {
    const testMethods = [];
    
    const testPropertyPattern = new RegExp(`\\[(?:Test)?Property\\s*\\(\\s*["']${testPropertyName}["']\\s*,\\s*["']([^"']+)["']`, 'i');
    
    console.log(`DEBUG: Scanning for property name: "${testPropertyName}"`);
    console.log(`DEBUG: Test property pattern: ${testPropertyPattern.source}`);
    
    // First, remove commented out sections to avoid parsing commented test attributes
    const cleanContent = this.removeComments(content);
    
    this.TEST_METHOD_PATTERN.lastIndex = 0;
    let match;
    while ((match = this.TEST_METHOD_PATTERN.exec(cleanContent)) !== null) {
      const fullMethod = match[0];
      const methodName = match[2];
      const testAttrIndex = match.index;
      
      console.log(`DEBUG: Found test method: ${methodName}`);
      
      // Check for property in the matched method (after [Test])
      let testCaseId = null;
      let testCaseIdMatch = testPropertyPattern.exec(fullMethod);
      
      if (testCaseIdMatch) {
        testCaseId = testCaseIdMatch[1].trim();
      }
      
      // If not found, look backwards from [Test] attribute to find Property attributes
      if (!testCaseId && testAttrIndex > 0) {
        const lookbackStart = Math.max(0, testAttrIndex - 500);
        const textBeforeTest = cleanContent.substring(lookbackStart, testAttrIndex);
        
        // Find the last method end before this test to avoid picking up IDs from previous tests
        const methodPattern = /public\s+(?:async\s+)?(?:Task\s+|void\s+)\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g;
        let lastMethodEnd = -1;
        let methodMatch;
        
        while ((methodMatch = methodPattern.exec(textBeforeTest)) !== null) {
          lastMethodEnd = lookbackStart + methodMatch.index + methodMatch[0].length;
        }
        
        // Search in the section between the last method end and the current test
        const searchStart = lastMethodEnd > -1 ? lastMethodEnd : lookbackStart;
        const attrSection = cleanContent.substring(searchStart, testAttrIndex + fullMethod.length);
        
        testPropertyPattern.lastIndex = 0;
        testCaseIdMatch = testPropertyPattern.exec(attrSection);
        if (testCaseIdMatch) {
          testCaseId = testCaseIdMatch[1].trim();
          console.log(`DEBUG: Method ${methodName} found Property attribute before [Test] with ID: ${testCaseId}`);
        }
      }
      
      if (testCaseId) {
        const methodStart = cleanContent.indexOf(match[1]);
        const methodCode = this.extractMethodCode(cleanContent, methodStart);
        
        testMethods.push({
          name: methodName,
          hasTestCaseId: true,
          testCaseId: testCaseId,
          code: methodCode
        });
        
        console.log(`DEBUG: Added test method with ID: ${methodName} (ID: ${testCaseId})`);
      }
    }
    
    console.log(`DEBUG: Total test methods with IDs found: ${testMethods.length}`);
    return testMethods;
  }

  async countTestFiles(repoPath) {
    const testFiles = await this.findTestFiles(repoPath);
    return testFiles.length;
  }

  async analyzeRepository(repoPath, testPropertyName) {
    const testFiles = await this.findAllCsFiles(repoPath);
    
    const fileAnalysisPromises = testFiles.map(async (filePath) => {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return await this.analyzeTestFile(fileContent, testPropertyName || 'ADOTestCaseId', filePath);
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
      
      if (analysis.tests && analysis.tests.length > 0) {
        totalFilesWithTests++;
        const className = analysis.className || path.basename(filePath, '.cs');
        const relativePath = path.relative(repoPath, filePath);
        
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
          
          if (test.tags && Array.isArray(test.tags)) {
            test.tags.forEach(tag => {
              classStats[className].tags.add(tag);
              if (!tagStats[tag]) {
                tagStats[tag] = 0;
              }
              tagStats[tag]++;
            });
          }
        });
      }
    });

    const classStatsArray = Object.values(classStats).map(stat => ({
      ...stat,
      tags: Array.from(stat.tags),
      coveragePercent: stat.totalTests > 0 
        ? Math.round((stat.withAdoId / stat.totalTests) * 100) 
        : 0
    }));

    const tagStatsArray = Object.entries(tagStats)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    const coveragePercent = totalTests > 0 
      ? Math.round((testsWithAdoId / totalTests) * 100) 
      : 0;

    // Detect duplicate IDs
    const idToTestsMap = new Map();
    allTests.forEach(test => {
      if (test.hasTestCaseId && test.adoId) {
        if (!idToTestsMap.has(test.adoId)) {
          idToTestsMap.set(test.adoId, []);
        }
        idToTestsMap.get(test.adoId).push({
          name: test.name,
          className: test.className,
          filePath: test.filePath,
          fileName: test.fileName,
          tags: test.tags || [],
          adoId: test.adoId
        });
      }
    });

    // Find duplicates (IDs that appear more than once)
    const duplicateIds = [];
    idToTestsMap.forEach((tests, adoId) => {
      if (tests.length > 1) {
        duplicateIds.push({
          adoId: adoId,
          count: tests.length,
          tests: tests
        });
      }
    });

    // Sort duplicates by count (most duplicates first)
    duplicateIds.sort((a, b) => b.count - a.count);

    return {
      totalTests,
      testsWithAdoId,
      testsWithoutAdoId,
      summary: {
        totalTests,
        testsWithAdoId,
        testsWithoutAdoId,
        coveragePercent,
        totalClasses: classStatsArray.length,
        totalFiles: totalFilesWithTests,
        totalTags: tagStatsArray.length,
        duplicateIdsCount: duplicateIds.length,
        duplicateTestsCount: duplicateIds.reduce((sum, dup) => sum + dup.count, 0)
      },
      byClass: classStatsArray.sort((a, b) => b.totalTests - a.totalTests),
      byTag: tagStatsArray,
      allTests: allTests,
      duplicateIds: duplicateIds
    };
  }

  async findCsFiles(dir, options = {}) {
    const { 
      filterTestFiles = false,
      includeAllCsFiles = false
    } = options;
    
    const files = [];
    
    const traverse = async (currentPath) => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        const promises = [];
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            if (!this.SKIP_DIRECTORIES.has(entry.name)) {
              promises.push(traverse(fullPath));
            }
          } else if (entry.isFile() && entry.name.endsWith('.cs')) {
            if (includeAllCsFiles || !filterTestFiles) {
              files.push(fullPath);
            } else if (filterTestFiles && (entry.name.includes('Test') || entry.name.includes('Spec'))) {
              files.push(fullPath);
            }
          }
        }
        
        await Promise.all(promises);
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error.message);
      }
    };
    
    await traverse(dir);
    return files;
  }

  async findTestFiles(dir) {
    const files = await this.findCsFiles(dir, { filterTestFiles: true });
    console.log(`DEBUG: Found ${files.length} test files in ${dir}`);
    files.forEach(file => console.log(`DEBUG: Test file: ${file}`));
    return files;
  }

  async findAllCsFiles(dir) {
    return this.findCsFiles(dir, { includeAllCsFiles: true });
  }

  async parseTestMethods(content, testPropertyName, filePath) {
    try {
      console.log(`DEBUG: Calling Roslyn parser for ${path.basename(filePath)} with property name: ${testPropertyName}`);
      const response = await this.callRoslynParser(filePath, content, testPropertyName);
      
      if (response.error) {
        console.error(`Roslyn parser error for ${path.basename(filePath)}: ${response.error}`);
        return [];
      }
      
      if (!response.tests) {
        console.warn(`DEBUG: Roslyn parser returned no tests array for ${path.basename(filePath)}`);
        return [];
      }

      console.log(`DEBUG: Roslyn parser returned ${response.tests?.length || 0} tests for ${path.basename(filePath)}`);
      if (response.tests && response.tests.length > 0) {
        console.log(`DEBUG: Test details for ${path.basename(filePath)}:`, JSON.stringify(response.tests.map(t => ({
          name: t.name,
          hasTestCaseId: t.hasTestCaseId,
          adoId: t.adoId || null
        })), null, 2));
      } else {
        console.log(`DEBUG: No tests found in ${path.basename(filePath)}`);
      }

      // Filter tests without IDs - make sure we're checking each test method individually
      const allTests = response.tests || [];
      console.log(`DEBUG: Processing ${allTests.length} total tests, checking each for missing ID...`);
      
      const testsWithoutIds = allTests
        .filter(test => {
          // Explicitly check for hasTestCaseId - handle boolean true, string "true", or truthy values
          const hasId = test.hasTestCaseId === true || test.hasTestCaseId === 'true' || (test.hasTestCaseId && test.adoId);
          console.log(`DEBUG: Test "${test.name}": hasTestCaseId=${test.hasTestCaseId} (type: ${typeof test.hasTestCaseId}), adoId=${test.adoId || 'null'}, willInclude=${!hasId}`);
          return !hasId;
        })
        .map(test => ({
          name: test.name,
          hasTestCaseId: false,
          code: test.code || ''
        }));

      console.log(`DEBUG: Found ${testsWithoutIds.length} test methods without IDs out of ${allTests.length} total tests`);
      return testsWithoutIds;
    } catch (error) {
      console.error(`Error parsing test methods for ${path.basename(filePath)}: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
      return [];
    }
  }

  async analyzeTestFile(content, testPropertyName, filePath) {
    try {
      const response = await this.callRoslynParser(filePath, content, testPropertyName);
      
      if (response.error) {
        console.error(`Roslyn parser error: ${response.error}`);
        return { className: null, tests: [] };
      }

      return {
        className: response.className || null,
        tests: response.tests || []
      };
    } catch (error) {
      console.error(`Error analyzing test file: ${error.message}`);
      return { className: null, tests: [] };
    }
  }
}

module.exports = FileParserService;
