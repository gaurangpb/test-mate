const fs = require('fs').promises;
const path = require('path');

/**
 * File parsing service for C# test files
 */
class FileParserService {
  constructor() {
    // Pre-compile regex patterns for better performance
    this.SKIP_DIRECTORIES = new Set(['bin', 'obj', 'node_modules', '.git', 'packages', '.vs', 'TestResults', '.vscode']);
    this.TEST_METHOD_PATTERN = /\[Test[^\]]*\][^\{]*?(public\s+(?:async\s+)?(?:Task\s+|void\s+)(\w+)\s*\([^\)]*\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\})/gs;
    this.CLASS_MATCH_PATTERN = /\[TestFixture[^\]]*\][\s\S]*?public\s+class\s+(\w+)/;
    this.CLASS_FALLBACK_PATTERN = /public\s+class\s+(\w+)/;
    this.TEST_FIXTURE_PATTERN = /\[TestFixture(?:[^\]]*)\]/;
    this.CATEGORY_PATTERN = /\[Category\s*\(\s*["']([^"']+)["']/gi;
    this.TAG_PATTERN = /\[Tag\s*\(\s*["']([^"']+)["']/gi;
    this.BEFORE_CLASS_ATTR_PATTERN = /(\[Category\s*\([^\]]+\)\s*)+\[TestFixture/;
    this.TEST_ATTRIBUTE_PATTERN = /\[Test(?:\s*,|\s*\])/g;
    this.METHOD_SIGNATURE_PATTERN = /(public\s+(?:async\s+Task\s+|Task\s+|void\s+)(\w+)\s*\([^\)]*\))/;
    this.EXCLUDED_METHODS = new Set(['Setup', 'TearDown', 'SetUp', 'OneTimeSetUp', 'OneTimeTearDown']);
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
        const testMethods = this.parseTestMethods(fileContent, testPropertyName || 'ADOTestCaseId');
        
        if (testMethods.length > 0) {
          console.log(`DEBUG: File ${path.basename(filePath)} has ${testMethods.length} tests without IDs`);
          return {
            fileName: path.basename(filePath),
            filePath: filePath,
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

  async countTestFiles(repoPath) {
    const testFiles = await this.findTestFiles(repoPath);
    return testFiles.length;
  }

  async analyzeRepository(repoPath, testPropertyName) {
    const testFiles = await this.findAllCsFiles(repoPath);
    
    const fileAnalysisPromises = testFiles.map(async (filePath) => {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return this.analyzeTestFile(fileContent, testPropertyName || 'ADOTestCaseId', filePath);
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
        totalTags: tagStatsArray.length
      },
      byClass: classStatsArray.sort((a, b) => b.totalTests - a.totalTests),
      byTag: tagStatsArray,
      allTests: allTests
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

  parseTestMethods(content, testPropertyName) {
    const testMethods = [];
    
    const testPropertyPattern = new RegExp(`\\[(?:Test)?Property\\s*\\(\\s*["']${testPropertyName}["']`, 'i');
    
    console.log(`DEBUG: Scanning for property name: "${testPropertyName}"`);
    console.log(`DEBUG: Test property pattern: ${testPropertyPattern.source}`);
    
    this.TEST_METHOD_PATTERN.lastIndex = 0;
    let match;
    while ((match = this.TEST_METHOD_PATTERN.exec(content)) !== null) {
      const fullMethod = match[0];
      const methodName = match[2];
      
      console.log(`DEBUG: Found test method: ${methodName}`);
      
      const hasTestCaseId = testPropertyPattern.test(fullMethod);
      
      console.log(`DEBUG: Method ${methodName} has TestCaseId: ${hasTestCaseId}`);
      if (hasTestCaseId) {
        console.log(`DEBUG: Method ${methodName} matched pattern in: ${fullMethod.substring(0, 200)}...`);
      }
      
      if (!hasTestCaseId) {
        const methodStart = content.indexOf(match[1]);
        const methodCode = this.extractMethodCode(content, methodStart);
        
        testMethods.push({
          name: methodName,
          hasTestCaseId: false,
          code: methodCode
        });
        
        console.log(`DEBUG: Added test method without ID: ${methodName}`);
      }
    }
    
    console.log(`DEBUG: Total test methods without IDs found: ${testMethods.length}`);
    return testMethods;
  }

  analyzeTestFile(content, testPropertyName, filePath) {
    const tests = [];
    
    let classMatch = this.CLASS_MATCH_PATTERN.exec(content);
    if (!classMatch) {
      this.CLASS_FALLBACK_PATTERN.lastIndex = 0;
      classMatch = this.CLASS_FALLBACK_PATTERN.exec(content);
    }
    const className = classMatch ? classMatch[1] : null;
    
    const classLevelTags = [];
    this.TEST_FIXTURE_PATTERN.lastIndex = 0;
    const classFixtureMatch = this.TEST_FIXTURE_PATTERN.exec(content);
    if (classFixtureMatch) {
      const fixtureAttrSection = classFixtureMatch[0];
      
      this.CATEGORY_PATTERN.lastIndex = 0;
      let classCategoryMatch;
      while ((classCategoryMatch = this.CATEGORY_PATTERN.exec(fixtureAttrSection)) !== null) {
        classLevelTags.push(classCategoryMatch[1]);
      }
      
      this.TAG_PATTERN.lastIndex = 0;
      let classTagMatch;
      while ((classTagMatch = this.TAG_PATTERN.exec(fixtureAttrSection)) !== null) {
        classLevelTags.push(classTagMatch[1]);
      }
    }
    
    this.BEFORE_CLASS_ATTR_PATTERN.lastIndex = 0;
    const beforeClassAttrMatch = this.BEFORE_CLASS_ATTR_PATTERN.exec(content);
    if (beforeClassAttrMatch) {
      const beforeClassSection = beforeClassAttrMatch[0];
      this.CATEGORY_PATTERN.lastIndex = 0;
      let beforeClassCategoryMatch;
      while ((beforeClassCategoryMatch = this.CATEGORY_PATTERN.exec(beforeClassSection)) !== null) {
        classLevelTags.push(beforeClassCategoryMatch[1]);
      }
    }
    
    const testPropertyRegex = new RegExp(`\\[(?:Test)?Property\\s*\\(\\s*["']${testPropertyName}["']\\s*,\\s*["']([^"']+)["']\\s*\\)`, 'gi');
    
    this.TEST_ATTRIBUTE_PATTERN.lastIndex = 0;
    let testMatch;
    while ((testMatch = this.TEST_ATTRIBUTE_PATTERN.exec(content)) !== null) {
      const testAttrIndex = testMatch.index;
      const afterTestAttr = content.substring(testAttrIndex + testMatch[0].length, testAttrIndex + testMatch[0].length + 2000);
      
      this.METHOD_SIGNATURE_PATTERN.lastIndex = 0;
      const methodMatch = this.METHOD_SIGNATURE_PATTERN.exec(afterTestAttr);
      if (!methodMatch) continue;
      
      const methodName = methodMatch[2];
      
      if (this.EXCLUDED_METHODS.has(methodName)) continue;
      
      const testAttrStart = testAttrIndex;
      const methodStart = testAttrIndex + testMatch[0].length + methodMatch.index;
      
      const searchStart = Math.max(0, testAttrStart - 1000);
      const methodLineEnd = content.indexOf('\n', methodStart);
      const methodSignature = methodMatch[0];
      const searchEnd = methodLineEnd > -1 ? methodLineEnd : methodStart + methodSignature.length;
      const attrSection = content.substring(searchStart, searchEnd);
      
      testPropertyRegex.lastIndex = 0;
      const adoIdMatch = testPropertyRegex.exec(attrSection);
      const hasTestCaseId = !!adoIdMatch;
      const adoId = adoIdMatch ? adoIdMatch[1].trim() : null;
      
      const tags = [...classLevelTags];
      this.CATEGORY_PATTERN.lastIndex = 0;
      let categoryMatch;
      while ((categoryMatch = this.CATEGORY_PATTERN.exec(attrSection)) !== null) {
        tags.push(categoryMatch[1]);
      }
      
      this.TAG_PATTERN.lastIndex = 0;
      let tagMatch;
      while ((tagMatch = this.TAG_PATTERN.exec(attrSection)) !== null) {
        tags.push(tagMatch[1]);
      }
      
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

  extractMethodCode(content, startIndex) {
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
}

module.exports = FileParserService;