const https = require('https');
const { URL } = require('url');

/**
 * Azure DevOps service for test case management
 */
class ADOService {
  async testConnectivity(adoConfig) {
    return new Promise((resolve, reject) => {
      const apiUrl = `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/test/Plans/${adoConfig.testPlanId}?api-version=7.0`;
      const url = new URL(apiUrl);
      
      const auth = Buffer.from(`:${adoConfig.pat}`).toString('base64');
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              resolve({
                testPlanName: response.name || 'Unknown',
                testPlanId: response.id,
                status: 'Connected successfully'
              });
            } catch (parseError) {
              resolve({
                status: 'Connected but response parsing failed',
                rawResponse: data.substring(0, 200)
              });
            }
          } else {
            reject(new Error(`ADO API test failed: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Connection failed: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });

      req.end();
    });
  }

  async createTestCases(testCases, adoConfig, addTags = false, testTagsMap = {}) {
    // Check if mock mode is enabled
    const mockMode = process.env.ADO_MOCK_MODE === 'true' || process.env.ADO_MOCK_MODE === '1';
    
    if (mockMode) {
      console.log('ADO Mock Mode enabled - simulating test case creation');
      return this.createTestCasesMock(testCases, addTags, testTagsMap);
    }

    const results = [];

    for (const testCase of testCases) {
      try {
        console.log(`Creating test case for: ${testCase.testName}`);
        
        // Get custom tags for this test case if any (from manual scenarios)
        const customTags = testTagsMap[testCase.testName] || [];
        if (customTags.length > 0) {
          console.log(`Found ${customTags.length} custom tag(s) for "${testCase.testName}": ${customTags.join(", ")}`);
        }
        
        const testCaseId = await this.createTestCaseInADO(testCase, adoConfig, addTags, customTags);
        
        results.push({
          testName: testCase.testName,
          fileName: testCase.fileName,
          filePath: testCase.filePath || '',
          testCaseId: testCaseId.toString(),
          success: true
        });

        console.log(`Successfully created test case ${testCaseId} for ${testCase.testName}`);
      } catch (error) {
        console.error(`Failed to create test case for ${testCase.testName}:`, error);
        
        results.push({
          testName: testCase.testName,
          fileName: testCase.fileName,
          filePath: testCase.filePath || '',
          testCaseId: null,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async createTestCasesMock(testCases, addTags = false, testTagsMap = {}) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const results = [];
    let mockIdCounter = 100000; // Start with a high mock ID to avoid conflicts

    for (const testCase of testCases) {
      // Simulate occasional failures (5% chance) for realism
      const shouldFail = Math.random() < 0.05;
      
      if (shouldFail) {
        console.log(`[MOCK] Simulated failure for test case: ${testCase.testName}`);
        results.push({
          testName: testCase.testName,
          fileName: testCase.fileName,
          filePath: testCase.filePath || '',
          testCaseId: null,
          success: false,
          error: 'Mock mode: Simulated API failure'
        });
      } else {
        const mockTestCaseId = mockIdCounter++;
        console.log(`[MOCK] Simulated creation of test case ${mockTestCaseId} for ${testCase.testName}`);
        
        results.push({
          testName: testCase.testName,
          fileName: testCase.fileName,
          filePath: testCase.filePath || '',
          testCaseId: mockTestCaseId.toString(),
          success: true
        });
      }
    }

    return results;
  }

  async createTestCaseInADO(testCase, adoConfig, addTags = false, customTags = []) {
    return new Promise((resolve, reject) => {
      try {
        // Format the test steps for ADO
        let formattedSteps = testCase.steps ? testCase.steps.map((step, index) => {
          const stepId = index + 2;
          const escapedAction = this.escapeHtml(step.action || 'Foo');
          const escapedExpectedResult = this.escapeHtml(step.expectedResult || 'Bar');
          
          return `<step id="${stepId}" type="ValidateStep">` +
                 `<parameterizedString isformatted="true">${escapedAction}</parameterizedString>` +
                 `<parameterizedString isformatted="true">${escapedExpectedResult}</parameterizedString>` +
                 `<description/>` +
                 `</step>`;
        }).join('') : '';
        
        let lastStepId = testCase.steps ? testCase.steps.length + 1 : 2;
        
        if (!testCase.steps || testCase.steps.length === 0) {
          formattedSteps = `<step id="2" type="ValidateStep">` +
                          `<parameterizedString isformatted="true">Execute ${testCase.testName}</parameterizedString>` +
                          `<parameterizedString isformatted="true">Test should pass successfully</parameterizedString>` +
                          `<description/>` +
                          `</step>`;
          lastStepId = 2;
        }

        const workItemData = [
          {
            "op": "add",
            "path": "/fields/System.Title",
            "value": testCase.testName
          },
          {
            "op": "add",
            "path": "/fields/Microsoft.VSTS.Common.Priority",
            "value": 1
          },
          {
            "op": "add",
            "path": "/fields/Microsoft.VSTS.TCM.Steps",
            "value": `<steps id="0" last="${lastStepId}">${formattedSteps}</steps>`
          }
        ];

        // Build tags array - include default tag if addTags is true, and always include custom tags from manual scenarios
        const tags = [];
        if (addTags) {
          tags.push("BTAF_Automation");
        }
        // Always include custom tags from manual scenarios (even if addTags is false)
        if (customTags && Array.isArray(customTags) && customTags.length > 0) {
          // Filter out duplicates and add custom tags
          customTags.forEach(tag => {
            if (tag && tag.trim() && !tags.includes(tag.trim())) {
              tags.push(tag.trim());
            }
          });
        }

        // Add tags if any
        if (tags.length > 0) {
          console.log(`Adding tags for test case "${testCase.testName}": ${tags.join(", ")}`);
          workItemData.push({
            "op": "add",
            "path": "/fields/System.Tags",
            "value": tags.join("; ")
          });
        }

        const requestBody = JSON.stringify(workItemData);
        
        const apiUrl = `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/wit/workitems/$Test Case?api-version=7.1-preview.3`;
        const url = new URL(apiUrl);
        
        const auth = Buffer.from(`:${adoConfig.pat}`).toString('base64');
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json-patch+json',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength(requestBody)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const response = JSON.parse(data);
                const testCaseId = response.id;
                
                this.addTestCaseToSuite(testCaseId, adoConfig)
                  .then(() => resolve(testCaseId))
                  .catch(err => {
                    console.warn(`Test case ${testCaseId} created but failed to add to suite:`, err.message);
                    resolve(testCaseId);
                  });
              } catch (parseError) {
                reject(new Error(`Failed to parse ADO response: ${parseError.message}`));
              }
            } else {
              reject(new Error(`ADO API error: ${res.statusCode} - ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });

        req.write(requestBody);
        req.end();
      } catch (error) {
        reject(new Error(`Failed to create test case: ${error.message}`));
      }
    });
  }

  async addTestCaseToSuite(testCaseId, adoConfig) {
    const apiMethods = [
      {
        name: 'Method 1 (Primary)',
        url: `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/testplan/Plans/${adoConfig.testPlanId}/Suites/${adoConfig.testSuiteId}/TestCase/${testCaseId}?api-version=7.1-preview.3`,
        method: 'POST',
        body: null
      },
      {
        name: 'Method 2 (Fallback)',
        url: `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/testplan/Plans/${adoConfig.testPlanId}/Suites/${adoConfig.testSuiteId}/TestCase/${testCaseId}?api-version=7.2`,
        method: 'POST',
        body: null
      },
      {
        name: 'Method 3 (Legacy)',
        url: `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/test/Plans/${adoConfig.testPlanId}/suites/${adoConfig.testSuiteId}/testcases/${testCaseId}?api-version=6.0`,
        method: 'POST',
        body: null
      }
    ];

    for (const apiMethod of apiMethods) {
      try {
        console.log(`Trying ${apiMethod.name}: ${apiMethod.url}`);
        await this.tryAddTestCaseMethod(apiMethod, adoConfig);
        console.log(`Successfully added test case ${testCaseId} to suite using ${apiMethod.name}`);
        return;
      } catch (error) {
        console.log(`${apiMethod.name} failed: ${error.message}`);
      }
    }

    throw new Error(`Failed to add test case ${testCaseId} to suite after trying all available API methods`);
  }

  tryAddTestCaseMethod(apiMethod, adoConfig) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(apiMethod.url);
        const auth = Buffer.from(`:${adoConfig.pat}`).toString('base64');
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: apiMethod.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
          }
        };

        if (apiMethod.body) {
          const requestBody = JSON.stringify(apiMethod.body);
          options.headers['Content-Length'] = Buffer.byteLength(requestBody);
        } else {
          options.headers['Content-Length'] = 0;
        }

        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode} - ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });

        if (apiMethod.body) {
          req.write(JSON.stringify(apiMethod.body));
        }
        
        req.end();
      } catch (error) {
        reject(new Error(`Request setup failed: ${error.message}`));
      }
    });
  }

  escapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }
}

module.exports = ADOService;