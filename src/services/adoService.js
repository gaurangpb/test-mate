const https = require('https');
const { URL } = require('url');

/**
 * Azure DevOps service for test case management
 */
class ADOService {
  async testConnectivity(adoConfig) {
    return new Promise((resolve, reject) => {
      const apiUrl = `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/test/Plans/${adoConfig.testPlanId}?api-version=7.1-preview.3`;
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

        // Add description if available
        if (testCase.description && testCase.description.trim()) {
          const escapedDescription = this.escapeHtml(testCase.description);
          workItemData.push({
            "op": "add",
            "path": "/fields/System.Description",
            "value": `<div>${escapedDescription}</div>`
          });
          console.log(`Adding description for test case "${testCase.testName}": ${testCase.description.substring(0, 50)}...`);
        } else {
          console.log(`No description found for test case "${testCase.testName}"`);
        }

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
    return new Promise((resolve, reject) => {
      try {
        // Use the Test Suites API to add test case to suite
        // Try with empty body first (most common format)
        const apiUrl = `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/testplan/Plans/${adoConfig.testPlanId}/Suites/${adoConfig.testSuiteId}/TestCases/${testCaseId}?api-version=7.1-preview.3`;
        const url = new URL(apiUrl);
        
        const auth = Buffer.from(`:${adoConfig.pat}`).toString('base64');
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Content-Length': 0
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`Successfully added test case ${testCaseId} to suite`);
              resolve();
            } else {
              // Try with request body if empty body fails
              console.log(`Empty body attempt failed (${res.statusCode}): ${data.substring(0, 200)}. Trying with request body...`);
              this.tryAlternativeSuiteEndpoint(testCaseId, adoConfig)
                .then(() => resolve())
                .catch(err => {
                  console.error(`Failed to add test case ${testCaseId} to suite: ${err.message}`);
                  reject(new Error(`Failed to add test case ${testCaseId} to suite: ${err.message}`));
                });
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });

        req.end();
      } catch (error) {
        reject(new Error(`Failed to add test case to suite: ${error.message}`));
      }
    });
  }

  tryAlternativeSuiteEndpoint(testCaseId, adoConfig) {
    return new Promise((resolve, reject) => {
      try {
        // Try with request body containing work item reference
        const apiUrl = `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/testplan/Plans/${adoConfig.testPlanId}/Suites/${adoConfig.testSuiteId}/TestCases/${testCaseId}?api-version=7.1-preview.3`;
        const url = new URL(apiUrl);
        
        const auth = Buffer.from(`:${adoConfig.pat}`).toString('base64');
        
        // Try with work item reference in body
        const requestBody = JSON.stringify({
          workItem: {
            id: testCaseId.toString()
          }
        });
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
              console.log(`Successfully added test case ${testCaseId} to suite using request body`);
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode} - ${data.substring(0, 200)}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });

        req.write(requestBody);
        req.end();
      } catch (error) {
        reject(new Error(`Request setup failed: ${error.message}`));
      }
    });
  }


  /**
   * Make a generic ADO API request
   */
  async makeAdoRequest(adoConfig, apiPath, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      try {
        const apiUrl = `${adoConfig.organizationUrl}/${adoConfig.projectName}${apiPath}`;
        const url = new URL(apiUrl);
        
        const auth = Buffer.from(`:${adoConfig.pat}`).toString('base64');
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: method,
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        };

        if (body) {
          options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const response = JSON.parse(data);
                resolve(response);
              } catch (parseError) {
                reject(new Error(`Failed to parse ADO response: ${parseError.message}`));
              }
            } else {
              reject(new Error(`ADO API error: ${res.statusCode} - ${data.substring(0, 500)}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        if (body) {
          req.write(body);
        }
        req.end();
      } catch (error) {
        reject(new Error(`Request setup failed: ${error.message}`));
      }
    });
  }

  /**
   * Get all test suites for a test plan
   */
  async getTestSuites(adoConfig, planId) {
    const apiPath = `/_apis/testplan/suites?planId=${planId}&api-version=7.1-preview.3`;
    return this.makeAdoRequest(adoConfig, apiPath);
  }

  /**
   * Get all test cases in a test suite
   */
  async getTestCasesInSuite(adoConfig, suiteId) {
    const apiPath = `/_apis/testplan/suites/${suiteId}/testcases?api-version=7.1-preview.3`;
    return this.makeAdoRequest(adoConfig, apiPath);
  }

  /**
   * Get latest test result for a test case
   */
  async getLatestTestResult(adoConfig, testCaseId, outcomeFilter = null) {
    let apiPath = `/_apis/test/results?testCaseId=${testCaseId}&$top=1&$orderby=completedDate desc&api-version=7.1-preview.3`;
    if (outcomeFilter) {
      apiPath += `&outcomes=${outcomeFilter}`;
    }
    return this.makeAdoRequest(adoConfig, apiPath);
  }

  /**
   * Get work item details with relations (for bugs and attachments)
   */
  async getWorkItemWithRelations(adoConfig, workItemId) {
    const apiPath = `/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=7.1-preview.3`;
    return this.makeAdoRequest(adoConfig, apiPath);
  }

  /**
   * Get test cases linked to a bug (reverse lookup)
   */
  async getTestCasesForBug(adoConfig, bugId, testOutcome = null) {
    try {
      // Get bug work item with relations
      const bugWorkItem = await this.getWorkItemWithRelations(adoConfig, bugId);
      
      if (!bugWorkItem.fields || 
          (bugWorkItem.fields['System.WorkItemType'] !== 'Bug' && 
           bugWorkItem.fields['System.WorkItemType'] !== 'Issue')) {
        throw new Error(`Work item ${bugId} is not a Bug or Issue`);
      }

      const relations = bugWorkItem.relations || [];
      const linkedTestCases = [];

      // Find linked test cases
      for (const relation of relations) {
        const relType = relation.rel;
        const isTestCaseLink = relType === 'System.LinkTypes.Related' || 
                              relType === 'System.LinkTypes.Tests' ||
                              relType === 'System.LinkTypes.Hierarchy-Forward' ||
                              relType === 'System.LinkTypes.Hierarchy-Reverse';
        
        if (isTestCaseLink && relation.url) {
          // Extract test case ID from URL
          const testCaseIdMatch = relation.url.match(/workitems\/(\d+)/);
          if (testCaseIdMatch) {
            const testCaseId = parseInt(testCaseIdMatch[1]);
            
            try {
              // Get test case details
              const testCaseWorkItem = await this.getWorkItemWithRelations(adoConfig, testCaseId);
              
              // Check if it's actually a test case
              if (testCaseWorkItem.fields && 
                  testCaseWorkItem.fields['System.WorkItemType'] === 'Test Case') {
                
                // Get latest test result if outcome filter is specified
                let latestResult = null;
                if (testOutcome) {
                  const testResultResponse = await this.getLatestTestResult(
                    adoConfig, 
                    testCaseId, 
                    testOutcome
                  );
                  const testResults = testResultResponse.value || [];
                  if (testResults.length > 0) {
                    latestResult = testResults[0];
                  }
                } else {
                  // Get latest result regardless of outcome
                  const testResultResponse = await this.getLatestTestResult(adoConfig, testCaseId);
                  const testResults = testResultResponse.value || [];
                  if (testResults.length > 0) {
                    latestResult = testResults[0];
                  }
                }

                linkedTestCases.push({
                  testCaseId: testCaseId,
                  testCaseTitle: testCaseWorkItem.fields['System.Title'] || 'Untitled',
                  webUrl: testCaseWorkItem._links?.html?.href,
                  testResult: latestResult,
                  hasResult: latestResult !== null
                });
              }
            } catch (testCaseError) {
              console.warn(`Failed to fetch test case ${testCaseId}: ${testCaseError.message}`);
            }
          }
        }
      }

      return {
        bug: {
          id: bugId,
          title: bugWorkItem.fields['System.Title'] || 'Untitled',
          status: bugWorkItem.fields['System.State'] || 'Unknown',
          assignedTo: bugWorkItem.fields['System.AssignedTo']?.displayName || 'Unassigned',
          webUrl: bugWorkItem._links?.html?.href
        },
        linkedTestCases: linkedTestCases
      };
    } catch (error) {
      throw new Error(`Failed to get test cases for bug ${bugId}: ${error.message}`);
    }
  }

  /**
   * Get test analysis: failed tests with linked bugs
   * Supports both planId-based analysis and bugId-based reverse lookup
   */
  async getTestAnalysis(adoConfig, filters = {}) {
    const {
      planId,
      bugId, // Alternative to planId - reverse lookup from bug
      suiteIds = null, // null = all suites
      testOutcome = 'Failed', // Filter by test outcome
      bugStatus = null, // Filter by bug status (e.g., 'Active', 'Resolved', 'Closed')
      includeAttachments = true
    } = filters;

    // If bugId is provided, do reverse lookup
    if (bugId) {
      return this.getTestAnalysisFromBug(adoConfig, bugId, testOutcome, includeAttachments);
    }

    // Otherwise, use planId-based analysis
    if (!planId) {
      throw new Error('Either planId or bugId is required for test analysis');
    }

    const results = {
      summary: {
        totalSuites: 0,
        totalTestCases: 0,
        failedTests: 0,
        testsWithBugs: 0,
        testsWithoutBugs: 0,
        totalBugs: 0,
        activeBugs: 0,
        resolvedBugs: 0,
        closedBugs: 0
      },
      failedTests: []
    };

    try {
      // Get all test suites
      const suitesResponse = await this.getTestSuites(adoConfig, planId);
      const suites = suitesResponse.value || [];
      
      // Filter suites if suiteIds provided
      const filteredSuites = suiteIds 
        ? suites.filter(s => suiteIds.includes(s.id.toString()))
        : suites;

      results.summary.totalSuites = filteredSuites.length;

      // Process each suite
      for (const suite of filteredSuites) {
        try {
          // Get test cases in this suite
          const testCasesResponse = await this.getTestCasesInSuite(adoConfig, suite.id);
          const testCases = testCasesResponse.value || [];
          
          results.summary.totalTestCases += testCases.length;

          // Process each test case
          for (const testCase of testCases) {
            const testCaseId = testCase.workItem?.id || testCase.testCase?.id;
            if (!testCaseId) continue;

            try {
              // Get latest test result
              const testResultResponse = await this.getLatestTestResult(
                adoConfig, 
                testCaseId, 
                testOutcome
              );
              
              const testResults = testResultResponse.value || [];
              if (testResults.length === 0) continue; // No failed results

              const latestResult = testResults[0];
              results.summary.failedTests++;

              // Get test case work item to find linked bugs
              const testCaseWorkItem = await this.getWorkItemWithRelations(adoConfig, testCaseId);
              const relations = testCaseWorkItem.relations || [];
              
              // Find linked bugs (System.LinkTypes.Related, Tests, or hierarchy links)
              const linkedBugs = [];
              for (const relation of relations) {
                const relType = relation.rel;
                const isBugLink = relType === 'System.LinkTypes.Related' || 
                                 relType === 'System.LinkTypes.Tests' ||
                                 relType === 'System.LinkTypes.Hierarchy-Forward' ||
                                 relType === 'System.LinkTypes.Hierarchy-Reverse';
                
                if (isBugLink && relation.url) {
                  // Extract bug ID from URL
                  const bugIdMatch = relation.url.match(/workitems\/(\d+)/);
                  if (bugIdMatch) {
                    const bugId = parseInt(bugIdMatch[1]);
                    
                    try {
                      // Get bug details
                      const bugWorkItem = await this.getWorkItemWithRelations(adoConfig, bugId);
                      
                      // Check if it's actually a bug
                      if (bugWorkItem.fields && 
                          (bugWorkItem.fields['System.WorkItemType'] === 'Bug' || 
                           bugWorkItem.fields['System.WorkItemType'] === 'Issue')) {
                        
                        const bugState = bugWorkItem.fields['System.State'] || 'Unknown';
                        const bugTitle = bugWorkItem.fields['System.Title'] || 'Untitled';
                        const bugAssignedTo = bugWorkItem.fields['System.AssignedTo']?.displayName || 'Unassigned';
                        
                        // Filter by bug status if specified
                        if (bugStatus && bugState !== bugStatus) {
                          continue;
                        }

                        const bug = {
                          id: bugId,
                          title: bugTitle,
                          status: bugState,
                          assignedTo: bugAssignedTo,
                          url: relation.url,
                          webUrl: bugWorkItem._links?.html?.href || relation.url,
                          attachments: []
                        };

                        // Get attachments if requested
                        if (includeAttachments) {
                          const bugRelations = bugWorkItem.relations || [];
                          for (const bugRel of bugRelations) {
                            if (bugRel.rel === 'AttachedFile') {
                              const attachmentIdMatch = bugRel.url.match(/attachments\/([^\/]+)/);
                              if (attachmentIdMatch) {
                                bug.attachments.push({
                                  id: attachmentIdMatch[1],
                                  name: bugRel.attributes?.name || 'Unknown',
                                  url: bugRel.url
                                });
                              }
                            }
                          }
                        }

                        linkedBugs.push(bug);

                        // Update summary
                        results.summary.totalBugs++;
                        if (bugState === 'Active' || bugState === 'New') {
                          results.summary.activeBugs++;
                        } else if (bugState === 'Resolved') {
                          results.summary.resolvedBugs++;
                        } else if (bugState === 'Closed') {
                          results.summary.closedBugs++;
                        }
                      }
                    } catch (bugError) {
                      console.warn(`Failed to fetch bug ${bugId}: ${bugError.message}`);
                    }
                  }
                }
              }

              // Add failed test to results
              const failedTest = {
                testCaseId: testCaseId,
                testCaseTitle: testCaseWorkItem.fields?.['System.Title'] || 'Untitled',
                suiteId: suite.id,
                suiteName: suite.name || 'Unknown Suite',
                testResult: {
                  id: latestResult.id,
                  outcome: latestResult.outcome,
                  completedDate: latestResult.completedDate,
                  duration: latestResult.duration,
                  runBy: latestResult.runBy?.displayName || 'Unknown',
                  testRunId: latestResult.testRun?.id
                },
                bugs: linkedBugs,
                hasBugs: linkedBugs.length > 0,
                webUrl: testCaseWorkItem._links?.html?.href
              };

              results.failedTests.push(failedTest);

              if (linkedBugs.length > 0) {
                results.summary.testsWithBugs++;
              } else {
                results.summary.testsWithoutBugs++;
              }

            } catch (testError) {
              console.warn(`Failed to process test case ${testCaseId}: ${testError.message}`);
            }
          }
        } catch (suiteError) {
          console.warn(`Failed to process suite ${suite.id}: ${suiteError.message}`);
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Test analysis failed: ${error.message}`);
    }
  }

  /**
   * Get test analysis starting from a bug (reverse lookup)
   */
  async getTestAnalysisFromBug(adoConfig, bugId, testOutcome = 'Failed', includeAttachments = true) {
    try {
      const bugAnalysis = await this.getTestCasesForBug(adoConfig, bugId, testOutcome);
      
      const results = {
        summary: {
          mode: 'bug-reverse-lookup',
          bugId: bugId,
          totalTestCases: bugAnalysis.linkedTestCases.length,
          failedTests: 0,
          testsWithBugs: bugAnalysis.linkedTestCases.length, // All are linked to this bug
          testsWithoutBugs: 0,
          totalBugs: 1,
          activeBugs: bugAnalysis.bug.status === 'Active' || bugAnalysis.bug.status === 'New' ? 1 : 0,
          resolvedBugs: bugAnalysis.bug.status === 'Resolved' ? 1 : 0,
          closedBugs: bugAnalysis.bug.status === 'Closed' ? 1 : 0
        },
        bug: bugAnalysis.bug,
        failedTests: []
      };

      // Process each linked test case
      for (const testCase of bugAnalysis.linkedTestCases) {
        if (testCase.hasResult && testCase.testResult) {
          results.summary.failedTests++;
          
          // Get full test case details with all linked bugs
          const testCaseWorkItem = await this.getWorkItemWithRelations(adoConfig, testCase.testCaseId);
          const relations = testCaseWorkItem.relations || [];
          
          // Find all linked bugs (including the one we started with)
          const linkedBugs = [];
          for (const relation of relations) {
            const relType = relation.rel;
            const isBugLink = relType === 'System.LinkTypes.Related' || 
                            relType === 'System.LinkTypes.Tests' ||
                            relType === 'System.LinkTypes.Hierarchy-Forward' ||
                            relType === 'System.LinkTypes.Hierarchy-Reverse';
            
            if (isBugLink && relation.url) {
              const bugIdMatch = relation.url.match(/workitems\/(\d+)/);
              if (bugIdMatch) {
                const linkedBugId = parseInt(bugIdMatch[1]);
                
                try {
                  const bugWorkItem = await this.getWorkItemWithRelations(adoConfig, linkedBugId);
                  
                  if (bugWorkItem.fields && 
                      (bugWorkItem.fields['System.WorkItemType'] === 'Bug' || 
                       bugWorkItem.fields['System.WorkItemType'] === 'Issue')) {
                    
                    const bugState = bugWorkItem.fields['System.State'] || 'Unknown';
                    const bugTitle = bugWorkItem.fields['System.Title'] || 'Untitled';
                    const bugAssignedTo = bugWorkItem.fields['System.AssignedTo']?.displayName || 'Unassigned';
                    
                    const bug = {
                      id: linkedBugId,
                      title: bugTitle,
                      status: bugState,
                      assignedTo: bugAssignedTo,
                      url: relation.url,
                      webUrl: bugWorkItem._links?.html?.href || relation.url,
                      attachments: [],
                      isSourceBug: linkedBugId === bugId // Mark the original bug
                    };

                    // Get attachments if requested
                    if (includeAttachments) {
                      const bugRelations = bugWorkItem.relations || [];
                      for (const bugRel of bugRelations) {
                        if (bugRel.rel === 'AttachedFile') {
                          const attachmentIdMatch = bugRel.url.match(/attachments\/([^\/]+)/);
                          if (attachmentIdMatch) {
                            bug.attachments.push({
                              id: attachmentIdMatch[1],
                              name: bugRel.attributes?.name || 'Unknown',
                              url: bugRel.url
                            });
                          }
                        }
                      }
                    }

                    linkedBugs.push(bug);
                  }
                } catch (bugError) {
                  console.warn(`Failed to fetch bug ${linkedBugId}: ${bugError.message}`);
                }
              }
            }
          }

          // Find suite information (we need to search for it)
          // For now, we'll set it as unknown since we don't have suite context in reverse lookup
          const failedTest = {
            testCaseId: testCase.testCaseId,
            testCaseTitle: testCase.testCaseTitle,
            suiteId: null,
            suiteName: 'Unknown (reverse lookup)',
            testResult: {
              id: testCase.testResult.id,
              outcome: testCase.testResult.outcome,
              completedDate: testCase.testResult.completedDate,
              duration: testCase.testResult.duration,
              runBy: testCase.testResult.runBy?.displayName || 'Unknown',
              testRunId: testCase.testResult.testRun?.id
            },
            bugs: linkedBugs,
            hasBugs: linkedBugs.length > 0,
            webUrl: testCase.webUrl
          };

          results.failedTests.push(failedTest);
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Test analysis from bug failed: ${error.message}`);
    }
  }

  /**
   * Get test case details including steps, description, and tags
   */
  async getTestCaseDetails(adoConfig, testCaseId) {
    try {
      const workItem = await this.getWorkItemWithRelations(adoConfig, testCaseId);
      
      if (!workItem.fields || workItem.fields['System.WorkItemType'] !== 'Test Case') {
        throw new Error(`Work item ${testCaseId} is not a Test Case`);
      }

      // Parse steps from XML
      const stepsXml = workItem.fields['Microsoft.VSTS.TCM.Steps'] || '';
      const steps = this.parseStepsFromXml(stepsXml);
      
      // Get description
      const description = workItem.fields['System.Description'] || '';
      // Remove HTML tags from description
      const cleanDescription = description.replace(/<[^>]*>/g, '').trim();
      
      // Get tags
      const tagsString = workItem.fields['System.Tags'] || '';
      const tags = tagsString ? tagsString.split(';').map(t => t.trim()).filter(t => t) : [];
      
      return {
        testCaseId: testCaseId,
        title: workItem.fields['System.Title'] || '',
        description: cleanDescription,
        steps: steps,
        tags: tags,
        webUrl: workItem._links?.html?.href
      };
    } catch (error) {
      // Parse ADO error response for more graceful error messages
      if (error.message && error.message.includes('ADO API error: 404')) {
        try {
          // Extract JSON from error message
          const jsonMatch = error.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            if (errorData.message) {
              // Check if it's a "not found" or "no permissions" error
              if (errorData.message.includes('does not exist') || errorData.message.includes('WorkItemUnauthorizedAccessException')) {
                throw new Error(`Test case ${testCaseId} was not found in Azure DevOps. It may have been deleted, or you may not have permissions to access it.`);
              }
              // Use the ADO error message if available
              throw new Error(`Test case ${testCaseId}: ${errorData.message}`);
            }
          }
        } catch (parseError) {
          // If parsing fails, fall through to default error
        }
      }
      
      // Default error message
      throw new Error(`Failed to get test case details for ${testCaseId}: ${error.message}`);
    }
  }

  /**
   * Parse steps from ADO XML format
   */
  parseStepsFromXml(stepsXml) {
    if (!stepsXml || !stepsXml.trim()) {
      return [];
    }

    const steps = [];
    // Match step elements: <step id="X" type="ValidateStep">...</step>
    const stepPattern = /<step\s+id="(\d+)"[^>]*>[\s\S]*?<\/step>/g;
    let stepMatch;
    
    while ((stepMatch = stepPattern.exec(stepsXml)) !== null) {
      const stepXml = stepMatch[0];
      const stepId = stepMatch[1];
      
      // Extract action (first parameterizedString)
      const actionMatch = stepXml.match(/<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>/);
      const action = actionMatch ? this.unescapeHtml(actionMatch[1].trim()) : '';
      
      // Extract expected result (second parameterizedString)
      const expectedResultMatches = stepXml.match(/<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>/g);
      const expectedResult = expectedResultMatches && expectedResultMatches.length > 1
        ? this.unescapeHtml(expectedResultMatches[1].replace(/<parameterizedString[^>]*>|<\/parameterizedString>/g, '').trim())
        : '';
      
      steps.push({
        id: parseInt(stepId),
        action: action,
        expectedResult: expectedResult
      });
    }
    
    // Sort by step ID
    steps.sort((a, b) => a.id - b.id);
    
    return steps;
  }

  /**
   * Unescape HTML entities
   */
  unescapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    const map = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#039;': "'",
      '&apos;': "'"
    };
    
    return text.replace(/&(amp|lt|gt|quot|#039|apos);/g, function(m) { return map[m] || m; });
  }

  /**
   * Update test case in ADO
   */
  async updateTestCase(adoConfig, testCaseId, updates) {
    return new Promise((resolve, reject) => {
      try {
        const { steps, description, tags } = updates;
        
        const workItemData = [];
        
        // Update steps if provided
        if (steps !== undefined) {
          let formattedSteps = '';
          let lastStepId = 2;
          
          if (steps && steps.length > 0) {
            formattedSteps = steps.map((step, index) => {
              const stepId = index + 2;
              const escapedAction = this.escapeHtml(step.action || '');
              const escapedExpectedResult = this.escapeHtml(step.expectedResult || '');
              
              return `<step id="${stepId}" type="ValidateStep">` +
                     `<parameterizedString isformatted="true">${escapedAction}</parameterizedString>` +
                     `<parameterizedString isformatted="true">${escapedExpectedResult}</parameterizedString>` +
                     `<description/>` +
                     `</step>`;
            }).join('');
            lastStepId = steps.length + 1;
          }
          
          workItemData.push({
            "op": "replace",
            "path": "/fields/Microsoft.VSTS.TCM.Steps",
            "value": `<steps id="0" last="${lastStepId}">${formattedSteps}</steps>`
          });
        }
        
        // Update description if provided
        if (description !== undefined) {
          const escapedDescription = this.escapeHtml(description);
          workItemData.push({
            "op": "replace",
            "path": "/fields/System.Description",
            "value": `<div>${escapedDescription}</div>`
          });
        }
        
        // Update tags if provided
        if (tags !== undefined) {
          const tagsString = Array.isArray(tags) ? tags.join('; ') : tags;
          workItemData.push({
            "op": "replace",
            "path": "/fields/System.Tags",
            "value": tagsString
          });
        }
        
        if (workItemData.length === 0) {
          reject(new Error('No updates provided'));
          return;
        }
        
        const requestBody = JSON.stringify(workItemData);
        
        const apiUrl = `${adoConfig.organizationUrl}/${adoConfig.projectName}/_apis/wit/workitems/${testCaseId}?api-version=7.1-preview.3`;
        const url = new URL(apiUrl);
        
        const auth = Buffer.from(`:${adoConfig.pat}`).toString('base64');
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: 'PATCH',
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
                resolve({
                  testCaseId: testCaseId,
                  success: true,
                  updatedFields: workItemData.map(op => op.path)
                });
              } catch (parseError) {
                reject(new Error(`Failed to parse ADO response: ${parseError.message}`));
              }
            } else {
              reject(new Error(`ADO API error: ${res.statusCode} - ${data.substring(0, 500)}`));
            }
          });
        });
        
        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });
        
        req.write(requestBody);
        req.end();
      } catch (error) {
        reject(new Error(`Failed to update test case: ${error.message}`));
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