import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileText, Settings, Play, Download, CheckCircle, AlertCircle, Loader2, Check, BarChart3, Tag } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001/api';
const USE_MOCK = process.env.REACT_APP_USE_MOCK === 'true';

function createMockResponse(body, ok = true) {
	return {
		ok,
		status: ok ? 200 : 500,
		json: async () => body
	};
}

async function mockFetch(url, options = {}) {
	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	await delay(300); // simulate network latency

	if (url.endsWith('/config/openai/status')) {
		return createMockResponse({ configured: true });
	}

	if (url.endsWith('/config/ado/status')) {
		return createMockResponse({ 
			configured: true, 
			config: {
				organizationUrl: 'https://dev.azure.com/MockOrg',
				projectName: 'MockProject',
				testPlanId: '12345',
				testSuiteId: '67890',
				hasToken: true
			}
		});
	}

	if (url.endsWith('/scan') && options.method === 'POST') {
		return createMockResponse({
			results: [
				{
					fileName: 'LoginTests.cs',
					filePath: 'tests/UI/Authentication/LoginTests.cs',
					testMethods: [
						{ name: 'Login_With_Valid_Credentials_Should_Succeed', code: '[Test]\npublic void Login_With_Valid_Credentials_Should_Succeed() { /* ... */ }' },
						{ name: 'Login_With_Invalid_Credentials_Should_Fail', code: '[Test]\npublic void Login_With_Invalid_Credentials_Should_Fail() { /* ... */ }' }
					]
				},
				{
					fileName: 'CheckoutTests.cs',
					filePath: 'tests/UI/Ecommerce/CheckoutTests.cs',
					testMethods: [
						{ name: 'Checkout_With_Valid_Cart_Should_Create_Order', code: '[Test]\npublic void Checkout_With_Valid_Cart_Should_Create_Order() { /* ... */ }' }
					]
				}
			]
		});
	}

	if (url.endsWith('/analyze') && options.method === 'POST') {
		return createMockResponse({
			summary: {
				totalTests: 3,
				testsWithAdoId: 1,
				testsWithoutAdoId: 2,
				coveragePercent: 33,
				totalClasses: 2,
				totalFiles: 2,
				totalTags: 3
			},
			byClass: [
				{
					className: 'LoginTests',
					filePath: 'tests/UI/Authentication/LoginTests.cs',
					withAdoId: 1,
					withoutAdoId: 1,
					totalTests: 2,
					coveragePercent: 50,
					tags: ['auth', 'smoke']
				},
				{
					className: 'CheckoutTests',
					filePath: 'tests/UI/Ecommerce/CheckoutTests.cs',
					withAdoId: 0,
					withoutAdoId: 1,
					totalTests: 1,
					coveragePercent: 0,
					tags: ['ecommerce']
				}
			],
			byTag: [
				{ tag: 'auth', count: 1 },
				{ tag: 'smoke', count: 1 },
				{ tag: 'ecommerce', count: 1 }
			]
		});
	}

	if (url.endsWith('/generate') && options.method === 'POST') {
		const body = options.body ? JSON.parse(options.body) : { tests: [] };
		const generatedDocs = {};
		(body.tests || []).forEach((t) => {
			generatedDocs[t.name] = {
				description: `Automatically generated description for ${t.name}.`,
				steps: [
					{ action: 'Open application', expectedResult: 'Application opens successfully' },
					{ action: 'Perform primary user action', expectedResult: 'Action is processed correctly' },
					{ action: 'Verify result', expectedResult: 'Expected output is displayed' }
				]
			};
		});
		return createMockResponse({ generatedDocs });
	}

	if (url.endsWith('/ado/create-test-cases') && options.method === 'POST') {
		// Removed mock implementation - now uses real ADO API
		return createMockResponse({ error: 'Mock route not implemented for ADO - using real API' }, false);
	}

	if (url.endsWith('/write-test-ids') && options.method === 'POST') {
		const body = options.body ? JSON.parse(options.body) : { testCaseIds: [] };
		const results = (body.testCaseIds || []).map((item, idx) => ({
			filePath: item.filePath,
			fileName: item.filePath.split(/[/\\]/).pop(),
			success: true,
			testsUpdated: 1
		}));
		return createMockResponse({
			success: true,
			results: results,
			message: `Successfully updated ${results.length} file(s) with ADOTestCaseId properties (Mock Mode)`
		});
	}

	return createMockResponse({ error: 'Mock route not implemented' }, false);
}

async function apiFetch(url, options) {
	if (USE_MOCK) {
		return mockFetch(url, options);
	}
	return fetch(url, options);
}

export default function App() {
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState({
    repoPath: '',
    testPropertyName: 'ADOTestCaseId'
  });
  const [scanResults, setScanResults] = useState(null);
  const [selectedTests, setSelectedTests] = useState(new Set());
  const [generatedDocs, setGeneratedDocs] = useState({});
  const [editedSteps, setEditedSteps] = useState({}); // Track edited steps: { testName: { stepIndex: { action, expectedResult, isEditing } } }
  const [createdTestCaseIds, setCreatedTestCaseIds] = useState({}); // Track created test case IDs: { testName: testCaseId }
  const [analysisResults, setAnalysisResults] = useState(null); // Analyzer statistics
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingInAdo, setIsCreatingInAdo] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isWritingIds, setIsWritingIds] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [openAiConfigured, setOpenAiConfigured] = useState(false);
  const [adoConfigured, setAdoConfigured] = useState(false);
  const [adoConfig, setAdoConfig] = useState(null);

  // Check OpenAI and ADO configuration status on mount
  useEffect(() => {
    const checkConfigStatus = async () => {
      try {
        // Check OpenAI status
        const openaiResponse = await apiFetch(`${API_BASE_URL}/config/openai/status`);
        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          setOpenAiConfigured(openaiData.configured);
        }

        // Check ADO status
        const adoResponse = await apiFetch(`${API_BASE_URL}/config/ado/status`);
        if (adoResponse.ok) {
          const adoData = await adoResponse.json();
          setAdoConfigured(adoData.configured);
          setAdoConfig(adoData.config);
        }
      } catch (err) {
        console.error('Failed to check configuration status:', err);
      }
    };
    checkConfigStatus();
  }, []);

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleScan = async () => {
    if (!config.repoPath) {
      setError('Please enter a repository path');
      return;
    }

    setIsScanning(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch(`${API_BASE_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: config.repoPath,
          testPropertyName: config.testPropertyName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to scan repository');
      }

      const data = await response.json();
      setScanResults(data.results);
      
      if (data.results.length === 0) {
        if (data.debug) {
          setError(`${data.debug.message}${data.debug.suggestion ? '\n\nSuggestion: ' + data.debug.suggestion : ''}`);
        } else {
          setError('No test files found without ADO test case IDs');
        }
      } else {
        setActiveTab('select');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAnalyze = async () => {
    if (!config.repoPath) {
      setError('Please enter a repository path');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: config.repoPath,
          testPropertyName: config.testPropertyName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze repository');
      }

      const data = await response.json();
      setAnalysisResults(data);
      setActiveTab('analyzer');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!openAiConfigured) {
      setError('Please configure OpenAI API key first');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Collect selected test details
      const testsToGenerate = [];
      scanResults.forEach(file => {
        file.testMethods.forEach(test => {
          if (selectedTests.has(test.name)) {
            testsToGenerate.push({
              name: test.name,
              code: test.code,
              fileName: file.fileName
            });
          }
        });
      });

      const response = await apiFetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tests: testsToGenerate })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate documentation');
      }

      const data = await response.json();
      setGeneratedDocs(data.generatedDocs);
      setActiveTab('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Optimized: Memoize callbacks to prevent unnecessary re-renders
  const toggleTestSelection = useCallback((testName) => {
    setSelectedTests(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(testName)) {
        newSelected.delete(testName);
      } else {
        newSelected.add(testName);
      }
      return newSelected;
    });
  }, []);

  const selectAllTests = useCallback(() => {
    if (!scanResults) return;
    const allTests = new Set();
    scanResults.forEach(file => {
      file.testMethods.forEach(test => {
        allTests.add(test.name);
      });
    });
    setSelectedTests(allTests);
  }, [scanResults]);

  const deselectAllTests = useCallback(() => {
    setSelectedTests(new Set());
  }, []);

  // Optimized: Memoize export handlers
  const handleExport = useCallback(() => {
    const output = Object.keys(generatedDocs).map(testName => {
      const testCaseId = createdTestCaseIds[testName] || 'PENDING_ADO_CREATION';
      return `// Add this attribute to ${testName}:\n[Property("${config.testPropertyName}", "${testCaseId}")]`;
    }).join('\n\n');
    
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-case-ids.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedDocs, createdTestCaseIds, config.testPropertyName]);

  const handleExportDocs = useCallback(() => {
    const output = Object.entries(generatedDocs).map(([testName, doc]) => {
      const testEditedSteps = editedSteps[testName] || {};
      const stepsToExport = doc.steps.map((step, idx) => {
        const edited = testEditedSteps[idx];
        if (edited && !edited.isEditing) {
          return edited; // Use edited version if saved
        }
        return step; // Use original
      });
      
      return `Test: ${testName}\n\nDescription:\n${doc.description}\n\nSteps:\n${stepsToExport.map((step, idx) => 
        `${idx + 1}. Action: ${step.action}\n   Expected: ${step.expectedResult}`
      ).join('\n\n')}`;
    }).join('\n\n' + '='.repeat(80) + '\n\n');
    
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-documentation.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedDocs, editedSteps]);

  // Optimized: Memoize step editing handlers
  const handleStepClick = useCallback((testName, stepIndex) => {
    const testEditedSteps = editedSteps[testName] || {};
    const doc = generatedDocs[testName];
    const step = doc.steps[stepIndex];
    
    // Get the current values (edited if exists, otherwise original)
    const currentStep = testEditedSteps[stepIndex];
    const actionValue = currentStep && !currentStep.isEditing ? currentStep.action : step.action;
    const expectedValue = currentStep && !currentStep.isEditing ? currentStep.expectedResult : step.expectedResult;
    
    setEditedSteps(prev => ({
      ...prev,
      [testName]: {
        ...testEditedSteps,
        [stepIndex]: {
          action: actionValue,
          expectedResult: expectedValue,
          isEditing: true
        }
      }
    }));
  }, [editedSteps, generatedDocs]);

  const handleStepSave = useCallback((testName, stepIndex) => {
    setEditedSteps(prev => {
      const testEditedSteps = prev[testName] || {};
      const editedStep = testEditedSteps[stepIndex];
      
      if (editedStep) {
        return {
          ...prev,
          [testName]: {
            ...testEditedSteps,
            [stepIndex]: {
              ...editedStep,
              isEditing: false
            }
          }
        };
      }
      return prev;
    });
  }, []);

  const handleStepChange = useCallback((testName, stepIndex, field, value) => {
    setEditedSteps(prev => {
      const testEditedSteps = prev[testName] || {};
      return {
        ...prev,
        [testName]: {
          ...testEditedSteps,
          [stepIndex]: {
            ...testEditedSteps[stepIndex],
            [field]: value,
            isEditing: true
          }
        }
      };
    });
  }, []);

  const hasUnsavedChanges = useCallback((testName, stepIndex) => {
    const testEditedSteps = editedSteps[testName] || {};
    const edited = testEditedSteps[stepIndex];
    return edited && edited.isEditing;
  }, [editedSteps]);

  const handleCreateInAdo = async () => {
    if (!adoConfigured) {
      setError('Azure DevOps is not configured. Please set ADO configuration in your .env file.');
      return;
    }

    setIsCreatingInAdo(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Prepare test cases with documentation
      const testCases = Object.entries(generatedDocs).map(([testName, doc]) => {
        const testEditedSteps = editedSteps[testName] || {};
        // Use edited steps if available and saved, otherwise use original
        const stepsToUse = doc.steps.map((step, idx) => {
          const edited = testEditedSteps[idx];
          if (edited && !edited.isEditing) {
            return edited; // Use edited version if saved
          }
          return step; // Use original
        });

        // Find the original test info for the test name
        let fileName = '';
        scanResults.forEach(file => {
          file.testMethods.forEach(test => {
            if (test.name === testName) {
              fileName = file.fileName;
            }
          });
        });

        return {
          testName: testName,
          fileName: fileName,
          description: doc.description,
          steps: stepsToUse
        };
      });

      const response = await apiFetch(`${API_BASE_URL}/ado/create-test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCases: testCases
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create test cases in ADO');
      }

      const data = await response.json();
      
      // Update created test case IDs (only for successful creations)
      const newIds = {};
      data.results.forEach(result => {
        if (result.success && result.testCaseId) {
          newIds[result.testName] = result.testCaseId;
        }
      });
      setCreatedTestCaseIds({ ...createdTestCaseIds, ...newIds });
      
      // Show warnings for any failures
      if (data.errors && data.errors.length > 0) {
        const errorMessages = data.errors.map(err => `${err.testName}: ${err.error}`).join('\n');
        console.warn('Some test cases failed to create:', errorMessages);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreatingInAdo(false);
    }
  };

  const handleWriteIdsToFiles = async () => {
    if (Object.keys(createdTestCaseIds).length === 0) {
      setError('No test case IDs available. Please create test cases in ADO first.');
      return;
    }

    setIsWritingIds(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Map test names to file paths and collect IDs
      const testCaseIdsToWrite = [];
      
      Object.entries(createdTestCaseIds).forEach(([testName, testCaseId]) => {
        // Find the file path for this test
        let filePath = null;
        if (scanResults) {
          scanResults.forEach(file => {
            file.testMethods.forEach(test => {
              if (test.name === testName) {
                filePath = file.filePath;
              }
            });
          });
        }

        if (filePath) {
          testCaseIdsToWrite.push({
            testName: testName,
            filePath: filePath,
            testCaseId: testCaseId
          });
        }
      });

      if (testCaseIdsToWrite.length === 0) {
        throw new Error('No test files found. Please scan the repository first.');
      }

      const response = await apiFetch(`${API_BASE_URL}/write-test-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseIds: testCaseIdsToWrite,
          testPropertyName: config.testPropertyName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to write test case IDs to files');
      }

      const data = await response.json();
      
      if (data.success) {
        // Show success message
        const successCount = data.results.filter(r => r.success).length;
        setError(null);
        setSuccessMessage(`Successfully updated ${successCount} file(s) with test case IDs!`);
      } else {
        const failedFiles = data.results.filter(r => !r.success);
        if (failedFiles.length > 0) {
          throw new Error(`Failed to update some files: ${failedFiles.map(f => f.fileName).join(', ')}`);
        }
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWritingIds(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Test Documentation Generator</h1>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-green-800 font-medium">Success</p>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('config')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'config'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Configuration
              </button>
              <button
                onClick={() => setActiveTab('analyzer')}
                disabled={!analysisResults}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'analyzer'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-50'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Analyzer
              </button>
              <button
                onClick={() => setActiveTab('select')}
                disabled={!scanResults}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'select'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-50'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Select Tests
              </button>
              <button
                onClick={() => setActiveTab('review')}
                disabled={Object.keys(generatedDocs).length === 0}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'review'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-50'
                }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Review & Export
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Configuration Tab */}
            {activeTab === 'config' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repository Path
                  </label>
                  <input
                    type="text"
                    value={config.repoPath}
                    onChange={(e) => setConfig({ ...config, repoPath: e.target.value })}
                    placeholder="C:\Projects\MyTestAutomation"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Path to your test automation repository
                  </p>
                </div>

                {!openAiConfigured && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      OpenAI API Key Configuration
                    </label>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-200">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">OpenAI API Key Not Configured</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Please set OPENAI_API_KEY in your .env file (see env-example.sh for reference)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Azure DevOps Configuration
                  </label>
                  {adoConfigured ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800">Azure DevOps Configured</p>
                        {adoConfig && (
                          <div className="text-xs text-green-700 mt-1">
                            <p>Organization: {adoConfig.organizationUrl}</p>
                            <p>Project: {adoConfig.projectName}</p>
                            <p>Test Plan: {adoConfig.testPlanId}, Suite: {adoConfig.testSuiteId}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-200">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">Azure DevOps Not Configured</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Please set ADO_ORGANIZATION_URL, ADO_PROJECT_NAME, ADO_TEST_PLAN_ID, ADO_TEST_SUITE_ID, and ADO_PAT in your .env file
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Property Name
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{config.testPropertyName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        The attribute name used to store ADO test case IDs (configured)
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                        Configured
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={!config.repoPath || isAnalyzing}
                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" />
                        Analyze Repository
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleScan}
                    disabled={!config.repoPath || isScanning}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Scan for Missing IDs
                      </>
                    )}
                  </button>
                </div>

                {isScanning && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Scanning for tests without ADO test case IDs...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Select Tests Tab */}
            {activeTab === 'select' && scanResults && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-1">
                    <p className="text-sm text-blue-800">
                      Found {scanResults.reduce((acc, file) => acc + file.testMethods.length, 0)} test methods without ADO test case IDs
                    </p>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={selectAllTests}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllTests}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {scanResults.map((file) => (
                  <div key={file.fileName} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">{file.fileName}</h3>
                      <p className="text-xs text-gray-500 mt-1">{file.filePath}</p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {file.testMethods.map((test) => (
                        <div key={test.name} className="p-4 hover:bg-gray-50 transition-colors">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTests.has(test.name)}
                              onChange={() => toggleTestSelection(test.name)}
                              className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{test.name}</p>
                              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                                {test.code}
                              </pre>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleGenerate}
                    disabled={selectedTests.size === 0 || isGenerating || !openAiConfigured}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Documentation...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Generate Documentation ({selectedTests.size} tests)
                      </>
                    )}
                  </button>
                </div>

                {!openAiConfigured && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">
                        Please configure your OpenAI API key in the Configuration tab
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analyzer Tab */}
            {activeTab === 'analyzer' && analysisResults && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-900">{analysisResults.summary.totalTests}</div>
                    <div className="text-sm text-blue-700">Total Tests</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-900">{analysisResults.summary.testsWithAdoId}</div>
                    <div className="text-sm text-green-700">With ADO ID</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-900">{analysisResults.summary.testsWithoutAdoId}</div>
                    <div className="text-sm text-yellow-700">Without ADO ID</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-900">{analysisResults.summary.coveragePercent}%</div>
                    <div className="text-sm text-purple-700">Coverage</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xl font-bold text-gray-900">{analysisResults.summary.totalClasses}</div>
                    <div className="text-sm text-gray-700">Test Classes</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xl font-bold text-gray-900">{analysisResults.summary.totalFiles}</div>
                    <div className="text-sm text-gray-700">Test Files</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xl font-bold text-gray-900">{analysisResults.summary.totalTags}</div>
                    <div className="text-sm text-gray-700">Unique Tags</div>
                  </div>
                </div>

                {/* Coverage Progress Bar */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">ADO Coverage</span>
                    <span className="text-sm font-bold text-gray-900">{analysisResults.summary.coveragePercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        analysisResults.summary.coveragePercent >= 80 ? 'bg-green-600' :
                        analysisResults.summary.coveragePercent >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${analysisResults.summary.coveragePercent}%` }}
                    />
                  </div>
                </div>

                {/* By Class */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Tests by Class</h3>
                  </div>
                  <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {analysisResults.byClass.map((classStat, idx) => (
                      <div key={idx} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium text-gray-900">{classStat.className}</div>
                            <div className="text-xs text-gray-500">{classStat.filePath}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">{classStat.coveragePercent}%</div>
                            <div className="text-xs text-gray-500">Coverage</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            <span className="font-medium text-green-700">{classStat.withAdoId}</span> with ID
                          </span>
                          <span className="text-gray-600">
                            <span className="font-medium text-yellow-700">{classStat.withoutAdoId}</span> without ID
                          </span>
                          <span className="text-gray-600">
                            <span className="font-medium text-gray-900">{classStat.totalTests}</span> total
                          </span>
                        </div>
                        {classStat.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {classStat.tags.map((tag, tagIdx) => (
                              <span key={tagIdx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                                <Tag className="w-3 h-3 inline mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* By Tag */}
                {analysisResults.byTag.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Tests by Tag</h3>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {analysisResults.byTag.map((tagStat, idx) => (
                          <div key={idx} className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Tag className="w-4 h-4 text-purple-600" />
                              <span className="font-medium text-purple-900">{tagStat.tag}</span>
                              <span className="text-sm text-purple-700">({tagStat.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Review Tab */}
            {activeTab === 'review' && Object.keys(generatedDocs).length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex-1">
                    <div className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <p className="text-sm text-green-800">
                        Successfully generated documentation for {Object.keys(generatedDocs).length} test cases
                      </p>
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={handleExportDocs}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export Docs
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export IDs
                    </button>
                    <button
                      onClick={handleWriteIdsToFiles}
                      disabled={isWritingIds || Object.keys(createdTestCaseIds).length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                      {isWritingIds ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Writing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Write IDs to Files
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCreateInAdo}
                      disabled={isCreatingInAdo || !adoConfigured}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                      {isCreatingInAdo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating in ADO...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Create in ADO
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {Object.entries(generatedDocs).map(([testName, doc]) => {
                  const testCaseId = createdTestCaseIds[testName];
                  return (
                    <div key={testName} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className={`px-4 py-3 border-b border-gray-200 ${testCaseId ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">{testName}</h3>
                          {testCaseId && (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <span className="text-sm font-medium text-green-700">
                                Test Case ID: {testCaseId}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Description:</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">{doc.description}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Test Steps:</h4>
                        <div className="space-y-2">
                          {doc.steps.map((step, idx) => {
                            const testEditedSteps = editedSteps[testName] || {};
                            const edited = testEditedSteps[idx];
                            const isEditing = edited && edited.isEditing;
                            const currentAction = edited && !edited.isEditing ? edited.action : (edited?.action || step.action);
                            const currentExpected = edited && !edited.isEditing ? edited.expectedResult : (edited?.expectedResult || step.expectedResult);
                            const showSaveButton = hasUnsavedChanges(testName, idx);
                            
                            return (
                              <div 
                                key={idx} 
                                className={`bg-gray-50 rounded p-3 ${isEditing ? 'border-2 border-blue-300' : 'border border-gray-200 hover:border-gray-300 cursor-pointer'} transition-colors`}
                                onClick={!isEditing ? () => handleStepClick(testName, idx) : undefined}
                              >
                                <div className="flex gap-2 items-start">
                                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold mt-1">
                                    {idx + 1}
                                  </span>
                                  <div className="flex-1 space-y-2">
                                    {isEditing ? (
                                      <>
                                        <div>
                                          <span className="text-xs text-gray-500 block mb-1">Action:</span>
                                          <textarea
                                            value={edited.action || step.action}
                                            onChange={(e) => handleStepChange(testName, idx, 'action', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                            rows={2}
                                            placeholder="Enter action..."
                                          />
                                        </div>
                                        <div>
                                          <span className="text-xs text-gray-500 block mb-1">Expected:</span>
                                          <textarea
                                            value={edited.expectedResult || step.expectedResult}
                                            onChange={(e) => handleStepChange(testName, idx, 'expectedResult', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                            rows={2}
                                            placeholder="Enter expected result..."
                                          />
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <p className="text-sm font-medium text-gray-900">
                                          <span className="text-gray-500">Action:</span> {currentAction}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                          <span className="text-gray-500">Expected:</span> {currentExpected}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                  {showSaveButton && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStepSave(testName, idx);
                                      }}
                                      className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors shadow-md"
                                      title="Save changes"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        {testCaseId ? (
                          <p className="text-xs text-gray-500 font-mono">
                            {`[Property("${config.testPropertyName}", "${testCaseId}")]`}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 font-mono">
                            {`[Property("${config.testPropertyName}", "PENDING_ADO_CREATION")]`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}

                {!adoConfigured && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-yellow-800 font-medium mb-1">Azure DevOps Not Configured</p>
                        <p className="text-sm text-yellow-700">
                          Configure ADO settings in your .env file to create test cases in Azure DevOps.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {Object.keys(createdTestCaseIds).length === 0 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium mb-2">Next Steps:</p>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Review and edit the generated documentation above if needed</li>
                      <li>{adoConfigured ? 'Azure DevOps is configured ✓' : 'Configure Azure DevOps settings in your .env file'}</li>
                      <li>Click "Create in ADO" to create test cases in Azure DevOps</li>
                      <li>Test case IDs will be displayed after successful creation</li>
                      <li>Click "Write IDs to Files" to add ADOTestCaseId attributes to your test methods</li>
                    </ol>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex gap-2 items-start">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-green-800 font-medium mb-2">
                          Successfully created {Object.keys(createdTestCaseIds).length} test case(s) in ADO
                        </p>
                        <p className="text-sm text-green-700">
                          Test case IDs are displayed above. You can now add the ADOTestCaseId attributes to your test methods.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}