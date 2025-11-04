const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * File utility functions for directory browsing, mapping file generation, and test ID writing
 */
class FileUtils {
  async browseDirectory(dirPath) {
    if (!dirPath) {
      // Return common default paths on Windows
      const defaultPaths = [
        { path: 'C:\\', name: 'C:\\' },
        { path: 'C:\\Users', name: 'Users' },
        { path: 'C:\\Projects', name: 'Projects' },
        { path: process.env.USERPROFILE || process.env.HOME || '', name: 'Home' }
      ].filter(p => p.path);
      
      return { 
        directories: defaultPaths,
        currentPath: ''
      };
    }
    
    const fullPath = path.resolve(dirPath);
    
    // Security check - prevent directory traversal
    if (!fsSync.existsSync(fullPath)) {
      throw new Error('Invalid path');
    }
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => ({
          name: entry.name,
          path: path.join(fullPath, entry.name)
        }));
      
      return {
        directories,
        currentPath: fullPath
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async generateMappingFile(testCaseIds, outputPath, adoConfig, testPropertyName) {
    const propertyName = testPropertyName || 'ADOTestCaseId';
    
    // Group by class and file
    const byClass = {};
    const fileStats = new Set();
    
    testCaseIds.forEach(item => {
      // Extract class name from file path
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
        testPropertyName: propertyName,
        ...(adoConfig && {
          adoConfig: {
            organizationUrl: adoConfig.organizationUrl,
            projectName: adoConfig.projectName,
            testPlanId: adoConfig.testPlanId,
            testSuiteId: adoConfig.testSuiteId
          }
        })
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
    
    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(mappingData, null, 2), 'utf-8');
      return {
        filePath: outputPath,
        created: true
      };
    } else {
      return mappingData;
    }
  }

  async writeTestIdsToFiles(testCaseIds, testPropertyName) {
    const results = [];
    const propertyName = testPropertyName || 'ADOTestCaseId';

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
          const testPattern = new RegExp(
            `(\\[Test(?:[^\\]]*)?\\]\\s*(?:\\[Category[^\\]]+\\]\\s*)*(?:\\[TestProperty[^\\]]+\\]\\s*)*)\\s*(public\\s+(?:async\\s+)?(?:Task\\s+|void\\s+)${testName}\\s*\\([^\\)]*\\))`,
            's'
          );

          let match = testPattern.exec(content);
          
          if (!match) {
            // Try a more flexible approach
            const testAttrPattern = /\[Test(?:[^\]]*)?]/g;
            let testAttrMatch;
            while ((testAttrMatch = testAttrPattern.exec(content)) !== null) {
              const afterTest = content.substring(testAttrMatch.index);
              const methodPattern = new RegExp(
                `public\\s+(?:async\\s+)?(?:Task\\s+|void\\s+)${testName}\\s*\\([^\\)]*\\)`,
                's'
              );
              const methodMatch = methodPattern.exec(afterTest);
              
              if (methodMatch) {
                const testStart = testAttrMatch.index;
                
                // Check if Property already exists
                const attrSection = content.substring(Math.max(0, testStart - 500), testStart);
                const existingPropertyPattern = new RegExp(
                  `\\[(?:Test)?Property\\s*\\(\\s*["']${propertyName}["']\\s*,\\s*["'][^"']+["']\\s*\\)`,
                  'i'
                );
                
                if (existingPropertyPattern.test(attrSection)) {
                  // Update existing Property
                  const propertyMatch = existingPropertyPattern.exec(attrSection);
                  const fullMatch = propertyMatch[0];
                  const newProperty = `[Property("${propertyName}", "${testCaseId}")]`;
                  const propertyIndex = Math.max(0, testStart - 500) + propertyMatch.index;
                  content = content.substring(0, propertyIndex) + newProperty + content.substring(propertyIndex + fullMatch.length);
                  fileModified = true;
                } else {
                  // Insert new Property before [Test]
                  const indentMatch = content.substring(Math.max(0, testStart - 100), testStart).match(/([ \t]*)$/);
                  const indent = indentMatch ? indentMatch[1] : '        ';
                  const newProperty = `${indent}[Property("${propertyName}", "${testCaseId}")]\n`;
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
              `\\[(?:Test)?Property\\s*\\(\\s*["']${propertyName}["']\\s*,\\s*["'][^"']+["']\\s*\\)`,
              'i'
            );
            
            if (existingPropertyPattern.test(attrSection)) {
              // Update existing Property
              const updatedSection = attrSection.replace(
                new RegExp(`\\[(?:Test)?Property\\s*\\(\\s*["']${propertyName}["']\\s*,\\s*["'][^"']+["']\\s*\\)`, 'i'),
                `[Property("${propertyName}", "${testCaseId}")]`
              );
              content = content.substring(0, match.index) + updatedSection + content.substring(match.index + match[1].length);
              fileModified = true;
            } else {
              // Insert new Property before [Test]
              const testAttrIndex = match.index;
              const indentMatch = content.substring(Math.max(0, testAttrIndex - 100), testAttrIndex).match(/([ \t]*)$/);
              const indent = indentMatch ? indentMatch[1] : '        ';
              const newProperty = `${indent}[Property("${propertyName}", "${testCaseId}")]\n`;
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

    return results;
  }
}

module.exports = FileUtils;