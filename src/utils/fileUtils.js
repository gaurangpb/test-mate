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
        const content = await fs.readFile(filePath, 'utf-8');
        let fileModified = false;
        const modifications = [];

        // Split content into lines for better processing
        const lines = content.split('\n');
        
        // Process each test in this file (in reverse order to maintain line numbers)
        const testsToProcess = [...tests].reverse();
        
        for (const { testName, testCaseId } of testsToProcess) {
          const modification = await this._processTestMethod(
            lines, 
            testName, 
            testCaseId, 
            propertyName
          );
          
          if (modification) {
            modifications.push(modification);
            fileModified = true;
          }
        }

        // Apply modifications in reverse order (bottom to top) to preserve line numbers
        for (const mod of modifications.reverse()) {
          if (mod.type === 'insert') {
            lines.splice(mod.lineIndex, 0, mod.newLine);
          } else if (mod.type === 'replace') {
            lines[mod.lineIndex] = mod.newLine;
          }
        }

        // Write the file back if modified
        if (fileModified) {
          const newContent = lines.join('\n');
          await fs.writeFile(filePath, newContent, 'utf-8');
          results.push({
            filePath: filePath,
            fileName: path.basename(filePath),
            success: true,
            testsUpdated: tests.length,
            modificationsApplied: modifications.length
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

  /**
   * Process a single test method to add or update Property attribute
   * @private
   */
  async _processTestMethod(lines, testName, testCaseId, propertyName) {
    // Find the test method
    let testMethodLineIndex = -1;
    let testAttributeLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for [Test] attribute
      if (/^\s*\[Test(?:[^\]]*)?]\s*$/.test(line)) {
        testAttributeLineIndex = i;
        
        // Look ahead for the method signature
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const methodLine = lines[j];
          const methodPattern = new RegExp(
            `public\\s+(?:async\\s+)?(?:Task\\s+|void\\s+)${testName}\\s*\\(`,
            'i'
          );
          
          if (methodPattern.test(methodLine)) {
            testMethodLineIndex = j;
            break;
          }
        }
        
        if (testMethodLineIndex !== -1) {
          break;
        }
      }
    }

    if (testAttributeLineIndex === -1 || testMethodLineIndex === -1) {
      return null; // Test not found
    }

    // Get indentation from the [Test] attribute line
    const testAttributeLine = lines[testAttributeLineIndex];
    const indentMatch = testAttributeLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '        ';

    // Check for existing Property attribute in the range before the test method
    const existingPropertyPattern = new RegExp(
      `^\\s*\\[(?:Test)?Property\\s*\\(\\s*["']${propertyName}["']\\s*,\\s*["'][^"']*["']\\s*\\)\\s*]`,
      'i'
    );

    let existingPropertyLineIndex = -1;
    for (let i = Math.max(0, testAttributeLineIndex - 5); i < testMethodLineIndex; i++) {
      if (existingPropertyPattern.test(lines[i])) {
        existingPropertyLineIndex = i;
        break;
      }
    }

    const newPropertyLine = `${indent}[Property("${propertyName}", "${testCaseId}")]`;

    if (existingPropertyLineIndex !== -1) {
      // Replace existing property
      return {
        type: 'replace',
        lineIndex: existingPropertyLineIndex,
        newLine: newPropertyLine,
        testName: testName,
        action: 'Updated existing property'
      };
    } else {
      // Insert new property before [Test] attribute
      return {
        type: 'insert',
        lineIndex: testAttributeLineIndex,
        newLine: newPropertyLine,
        testName: testName,
        action: 'Added new property'
      };
    }
  }

  /**
   * Read domain context file for AI documentation generation
   * Supports multiple formats: .txt, .md, .json
   * @param {string} contextFilePath - Path to domain context file
   * @returns {Promise<string|null>} - Domain context content or null if file doesn't exist
   */
  async readDomainContext(contextFilePath) {
    if (!contextFilePath) {
      return null;
    }

    try {
      const fullPath = path.resolve(contextFilePath);
      
      // Security check
      if (!fsSync.existsSync(fullPath)) {
        console.warn(`Domain context file not found: ${fullPath}`);
        return null;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      
      // If it's a JSON file, try to parse and format it nicely
      if (fullPath.endsWith('.json')) {
        try {
          const jsonData = JSON.parse(content);
          // Format JSON as readable text for AI
          return JSON.stringify(jsonData, null, 2);
        } catch (parseError) {
          console.warn('Domain context JSON file is not valid JSON, using as plain text');
          return content;
        }
      }

      return content;
    } catch (error) {
      console.error(`Error reading domain context file: ${error.message}`);
      return null;
    }
  }

  /**
   * Save domain context file (replace entire file with new content)
   * @param {string} contextFilePath - Path to domain context file
   * @param {string} content - Content to save
   * @returns {Promise<{created: boolean}>} - Result of the operation
   */
  async saveDomainContext(contextFilePath, content) {
    if (!contextFilePath || !content) {
      throw new Error('Context file path and content are required');
    }

    try {
      const fullPath = path.resolve(contextFilePath);
      const exists = fsSync.existsSync(fullPath);
      
      // Simply write the content to the file (replace entire file)
      await fs.writeFile(fullPath, content, 'utf-8');
      
      return { created: !exists };
    } catch (error) {
      console.error(`Error saving domain context file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Intelligently merge new context content with existing domain context
   * @param {string} contextFilePath - Path to domain context file
   * @param {string} newContent - New content to merge
   * @returns {Promise<{created: boolean, merged: boolean}>} - Result of the operation
   */
  async mergeDomainContext(contextFilePath, newContent) {
    if (!contextFilePath || !newContent) {
      throw new Error('Context file path and new content are required');
    }

    try {
      const fullPath = path.resolve(contextFilePath);
      const exists = fsSync.existsSync(fullPath);
      
      if (!exists) {
        // Create new file
        await fs.writeFile(fullPath, newContent, 'utf-8');
        return { created: true, merged: false };
      }

      // Read existing content
      const existingContent = await fs.readFile(fullPath, 'utf-8');
      
      // Simple merge strategy: append new sections if they don't already exist
      // Look for markdown headers in new content
      const newHeaders = this._extractMarkdownHeaders(newContent);
      const existingHeaders = this._extractMarkdownHeaders(existingContent);
      
      // Find sections that don't exist in existing content
      const newSections = [];
      const newContentLines = newContent.split('\n');
      let currentSection = null;
      let inNewSection = false;
      let sectionLines = [];
      
      for (let i = 0; i < newContentLines.length; i++) {
        const line = newContentLines[i];
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        
        if (headerMatch) {
          // Save previous section if it was new
          if (inNewSection && currentSection && !existingHeaders.has(currentSection.toLowerCase())) {
            newSections.push(sectionLines.join('\n'));
          }
          
          // Start new section
          const headerText = headerMatch[2].trim().toLowerCase();
          currentSection = headerText;
          inNewSection = !existingHeaders.has(headerText);
          sectionLines = [line];
        } else if (inNewSection) {
          sectionLines.push(line);
        }
      }
      
      // Save last section if it was new
      if (inNewSection && currentSection && !existingHeaders.has(currentSection.toLowerCase())) {
        newSections.push(sectionLines.join('\n'));
      }
      
      // Merge: append new sections to existing content
      let mergedContent = existingContent.trim();
      if (newSections.length > 0) {
        mergedContent += '\n\n' + newSections.join('\n\n');
      } else {
        // If no new sections found, append the entire new content as a new section
        mergedContent += '\n\n---\n\n' + newContent;
      }
      
      await fs.writeFile(fullPath, mergedContent, 'utf-8');
      return { created: false, merged: true, newSectionsCount: newSections.length };
    } catch (error) {
      console.error(`Error merging domain context file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract markdown headers from content
   * @private
   */
  _extractMarkdownHeaders(content) {
    const headers = new Set();
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^#{1,6}\s+(.+)$/);
      if (match) {
        headers.add(match[1].trim().toLowerCase());
      }
    }
    
    return headers;
  }
}

module.exports = FileUtils;