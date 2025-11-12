import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileText, Settings, Play, Download, CheckCircle, AlertCircle, Loader2, Check, BarChart3, Tag, Lightbulb, Plus, Folder, File, ChevronRight, ChevronDown, X, Save } from 'lucide-react';

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
		
		// Group test cases by file to simulate multiple tests per file
		const fileGroups = {};
		(body.testCaseIds || []).forEach(item => {
			if (!fileGroups[item.filePath]) {
				fileGroups[item.filePath] = [];
			}
			fileGroups[item.filePath].push(item);
		});
		
		const results = [];
		
		Object.entries(fileGroups).forEach(([filePath, tests]) => {
			// Simulate successful update
			results.push({
				filePath: filePath,
				fileName: filePath.split(/[/\\]/).pop(),
				success: true,
				testsUpdated: tests.length,
				modificationsApplied: tests.length
			});
		});
		
		const successCount = results.filter(r => r.success).length;
		const message = `Successfully updated ${successCount} file(s) (Mock Mode)`;
		
		return createMockResponse({
			success: successCount > 0,
			results: results,
			message: message
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

// Helper function to parse error responses (handles both JSON and HTML/text)
async function parseErrorResponse(response, defaultMessage) {
	let errorMessage = defaultMessage;
	try {
		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			const errorData = await response.json();
			errorMessage = errorData.error || errorMessage;
		} else {
			const text = await response.text();
			errorMessage = `Server error (${response.status}): ${text.substring(0, 200)}`;
		}
	} catch (parseError) {
		errorMessage = `Server error (${response.status}). Please check if the server is running.`;
	}
	return errorMessage;
}

// File Tree Component for displaying test files
function FileTree({ tree, files, selectedFilePaths, onToggleFile, level = 0 }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (path) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (node, path = '') => {
    const entries = Object.entries(node).sort(([a], [b]) => {
      const aIsDir = node[a].type === 'directory';
      const bIsDir = node[b].type === 'directory';
      if (aIsDir !== bIsDir) {
        return aIsDir ? -1 : 1; // Directories first
      }
      return a.localeCompare(b);
    });

    return (
      <div className={level > 0 ? 'ml-4' : ''}>
        {entries.map(([name, item]) => {
          const currentPath = path ? `${path}/${name}` : name;
          
          if (item.type === 'directory') {
            const isExpanded = expanded[currentPath];
            return (
              <div key={currentPath} className="mb-1">
                <div
                  className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer"
                  onClick={() => toggleExpand(currentPath)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  <Folder className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-gray-700">{name}</span>
                </div>
                {isExpanded && (
                  <div className="mt-1">
                    {renderTree(item.children, currentPath)}
                  </div>
                )}
              </div>
            );
          } else {
            // It's a file
            const filePath = item.relativePath || item.absolutePath;
            const isSelected = selectedFilePaths.has(filePath);
            return (
              <div key={currentPath} className="mb-1">
                <label className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleFile(filePath)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                  />
                  <File className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 flex-1">{name}</span>
                  <span className="text-xs text-gray-400 truncate max-w-xs" title={item.relativePath}>{item.relativePath}</span>
                </label>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return <div>{renderTree(tree)}</div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState({
    repoPath: 'c:\\workspace\\test-mate\\tests',
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
  const [isAnalyzingContext, setIsAnalyzingContext] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [openAiConfigured, setOpenAiConfigured] = useState(false);
  const [adoConfigured, setAdoConfigured] = useState(false);
  const [adoConfig, setAdoConfig] = useState(null);
  const [adoMockMode, setAdoMockMode] = useState(false);
  const [contextSuggestions, setContextSuggestions] = useState(null);
  const [addTags, setAddTags] = useState(true);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [testFilesList, setTestFilesList] = useState(null);
  const [selectedFilePaths, setSelectedFilePaths] = useState(new Set());
  const [editedContextContent, setEditedContextContent] = useState('');
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [contextSaveSuccess, setContextSaveSuccess] = useState(false);
  const [showManualTestModal, setShowManualTestModal] = useState(false);
  const [manualTestName, setManualTestName] = useState('');
  const [manualTestDescription, setManualTestDescription] = useState('');
  const [expandedDuplicateId, setExpandedDuplicateId] = useState(null); // Track which duplicate ID is expanded
  const [manualTestBulletPoints, setManualTestBulletPoints] = useState('');
  const [manualTestTags, setManualTestTags] = useState('');
  const [manualTestTagsArray, setManualTestTagsArray] = useState([]);
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);
  const [manualTests, setManualTests] = useState(new Set()); // Track which tests are manual (no file write-back)
  const [testTags, setTestTags] = useState({}); // Store tags per test: { testName: ['tag1', 'tag2'] }
  const [selectedForAdo, setSelectedForAdo] = useState(new Set()); // Tests selected for ADO creation
  const [selectedForFileWrite, setSelectedForFileWrite] = useState(new Set()); // Tests selected for file write-back
  const [writtenToFiles, setWrittenToFiles] = useState(new Set()); // Track which tests have been written to files

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
          setAdoMockMode(adoData.mockMode || false);
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
        const errorMessage = await parseErrorResponse(response, 'Failed to scan repository');
        throw new Error(errorMessage);
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
        const errorMessage = await parseErrorResponse(response, 'Failed to analyze repository');
        throw new Error(errorMessage);
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

  const loadTestFiles = async () => {
    if (!config.repoPath) {
      setError('Please enter a repository path');
      return;
    }

    setError(null);
    setIsAnalyzingContext(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/test-files-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: config.repoPath
        })
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to load test files');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setTestFilesList(data);
      setShowFileSelector(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzingContext(false);
    }
  };

  const handleSuggestContextUpdates = async () => {
    if (!config.repoPath) {
      setError('Please enter a repository path');
      return;
    }

    if (!openAiConfigured) {
      setError('Please configure OpenAI API key first');
      return;
    }

    // First, load test files and show file selector
    await loadTestFiles();
  };

  const handleAnalyzeSelectedFiles = async () => {
    if (selectedFilePaths.size === 0) {
      setError('Please select at least one test file');
      return;
    }

    setIsAnalyzingContext(true);
    setError(null);
    setSuccessMessage(null);
    setShowFileSelector(false);

    try {
      const response = await apiFetch(`${API_BASE_URL}/suggest-context-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: config.repoPath,
          selectedFilePaths: Array.from(selectedFilePaths),
          testPropertyName: config.testPropertyName
        })
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to analyze context updates');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setContextSuggestions(data);
      setEditedContextContent(data.suggestions.suggestedContextUpdates || '');
      setContextSaveSuccess(false); // Reset success state for new analysis
      setSuccessMessage(`Analyzed ${data.analysisSummary.testsAnalyzed} tests from ${data.analysisSummary.filesAnalyzed} files and found ${data.suggestions.newTerminology.length + data.suggestions.newWorkflows.length + data.suggestions.newFeatures.length} new concepts`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzingContext(false);
    }
  };

  const handleSaveDomainContext = async () => {
    if (!editedContextContent.trim()) {
      setError('Context content cannot be empty');
      return;
    }

    setIsSavingContext(true);
    setError(null);
    setContextSaveSuccess(false);

    try {
      // Remove <!-- NEW --> comments from content before saving
      const cleanedContent = editedContextContent
        .replace(/<!--\s*NEW\s*-->/gi, '')
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up extra blank lines
        .trim();

      const response = await apiFetch(`${API_BASE_URL}/save-domain-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: config.repoPath,
          content: cleanedContent
        })
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to save domain context');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const successMsg = data.created 
        ? 'Domain context file created successfully!' 
        : 'Domain context file updated successfully!';
      setSuccessMessage(successMsg);
      setContextSaveSuccess(true);
    } catch (err) {
      setError(err.message);
      setContextSaveSuccess(false);
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleManualTestTagInput = (e) => {
    const value = e.target.value;
    setManualTestTags(value);
    
    // Parse tags from comma-separated input
    if (value.trim()) {
      const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      setManualTestTagsArray(tags);
    } else {
      setManualTestTagsArray([]);
    }
  };

  const removeManualTestTag = (tagToRemove) => {
    const newTags = manualTestTagsArray.filter(tag => tag !== tagToRemove);
    setManualTestTagsArray(newTags);
    setManualTestTags(newTags.join(', '));
  };

  const handleGenerateManualTest = async () => {
    if (!openAiConfigured) {
      setError('Please configure OpenAI API key first');
      return;
    }

    if (!manualTestName.trim()) {
      setError('Test name is required');
      return;
    }

    if (!manualTestDescription.trim()) {
      setError('Description is required');
      return;
    }

    setIsGeneratingManual(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch(`${API_BASE_URL}/generate/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testName: manualTestName.trim(),
          description: manualTestDescription.trim(),
          bulletPoints: manualTestBulletPoints.trim() || null,
          repoPath: config.repoPath || null
        })
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to generate manual test steps');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Add the generated test to generatedDocs
      const testName = manualTestName.trim();
      setGeneratedDocs(prev => ({
        ...prev,
        [testName]: data.generatedDoc
      }));
      
      // Mark this as a manual test (no file write-back)
      setManualTests(prev => new Set([...prev, testName]));
      
      // Store tags for this manual test (we'll use this when creating in ADO)
      if (manualTestTagsArray.length > 0) {
        setTestTags(prev => ({
          ...prev,
          [testName]: manualTestTagsArray
        }));
      }
      
      // Initialize selection - select for ADO (not for file write since it's manual)
      setSelectedForAdo(prev => new Set([...prev, testName]));
      
      // Reset form
      setShowManualTestModal(false);
      setManualTestName('');
      setManualTestDescription('');
      setManualTestBulletPoints('');
      setManualTestTags('');
      setManualTestTagsArray([]);
      
      if (data.usedDomainContext) {
        setSuccessMessage('Manual test steps generated with domain context!');
      } else {
        setSuccessMessage('Manual test steps generated successfully!');
      }
      
      setActiveTab('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGeneratingManual(false);
    }
  };

  const toggleFileSelection = (filePath) => {
    const newSelection = new Set(selectedFilePaths);
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath);
    } else {
      newSelection.add(filePath);
    }
    setSelectedFilePaths(newSelection);
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
        body: JSON.stringify({ 
          tests: testsToGenerate,
          domainContextPath: config.domainContextPath || null
        })
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to generate documentation');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setGeneratedDocs(data.generatedDocs);
      
      // Clear selected tests since generation is complete
      setSelectedTests(new Set());
      
      // Initialize selections - select all tests for ADO and file write (excluding already created)
      const allTestNames = Object.keys(data.generatedDocs);
      const testsForAdo = allTestNames.filter(name => !createdTestCaseIds[name]);
      const testsForFileWrite = allTestNames.filter(name => 
        !manualTests.has(name) && 
        createdTestCaseIds[name] && 
        !writtenToFiles.has(name)
      );
      setSelectedForAdo(new Set(testsForAdo));
      setSelectedForFileWrite(new Set(testsForFileWrite));
      
      if (data.usedDomainContext) {
        setSuccessMessage('Documentation generated with domain context!');
      }
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

  const toggleAdoSelection = useCallback((testName) => {
    setSelectedForAdo(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testName)) {
        newSet.delete(testName);
      } else {
        newSet.add(testName);
      }
      return newSet;
    });
  }, []);

  const toggleFileWriteSelection = useCallback((testName) => {
    setSelectedForFileWrite(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testName)) {
        newSet.delete(testName);
      } else {
        newSet.add(testName);
      }
      return newSet;
    });
  }, []);

  const selectAllForAdo = useCallback(() => {
    const allTests = Object.keys(generatedDocs).filter(testName => !createdTestCaseIds[testName]);
    setSelectedForAdo(new Set(allTests));
  }, [generatedDocs, createdTestCaseIds]);

  const deselectAllForAdo = useCallback(() => {
    setSelectedForAdo(new Set());
  }, []);

  const selectAllForFileWrite = useCallback(() => {
    const allTests = Object.keys(generatedDocs).filter(testName => 
      !manualTests.has(testName) && 
      createdTestCaseIds[testName] && 
      !writtenToFiles.has(testName)
    );
    setSelectedForFileWrite(new Set(allTests));
  }, [generatedDocs, manualTests, createdTestCaseIds, writtenToFiles]);

  const deselectAllForFileWrite = useCallback(() => {
    setSelectedForFileWrite(new Set());
  }, []);

  const handleCreateInAdo = async () => {
    if (!adoConfigured) {
      setError('Azure DevOps is not configured. Please set ADO configuration in your .env file.');
      return;
    }

    if (selectedForAdo.size === 0) {
      setError('Please select at least one test case to create in ADO.');
      return;
    }

    setIsCreatingInAdo(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Prepare test cases with documentation - only for selected tests
      const testCases = Object.entries(generatedDocs)
        .filter(([testName]) => selectedForAdo.has(testName))
        .map(([testName, doc]) => {
        const testEditedSteps = editedSteps[testName] || {};
        // Use edited steps if available and saved, otherwise use original
        const stepsToUse = doc.steps.map((step, idx) => {
          const edited = testEditedSteps[idx];
          if (edited && !edited.isEditing) {
            return edited; // Use edited version if saved
          }
          return step; // Use original
        });

        // Find the original test info for the test name (only for automated tests)
        let fileName = '';
        if (scanResults) {
          scanResults.forEach(file => {
            file.testMethods.forEach(test => {
              if (test.name === testName) {
                fileName = file.fileName;
              }
            });
          });
        }

        return {
          testName: testName,
          fileName: fileName || (manualTests.has(testName) ? 'Manual Test' : ''),
          description: doc.description,
          steps: stepsToUse
        };
      });

      const response = await apiFetch(`${API_BASE_URL}/ado/create-test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCases: testCases,
          addTags: addTags,
          testTagsMap: testTags
        })
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to create test cases in ADO');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Update created test case IDs (only for successful creations)
      const newIds = {};
      data.results.forEach(result => {
        if (result.success && result.testCaseId) {
          newIds[result.testName] = result.testCaseId;
          // Remove from selection since it's now created
          setSelectedForAdo(prev => {
            const newSet = new Set(prev);
            newSet.delete(result.testName);
            return newSet;
          });
        }
      });
      setCreatedTestCaseIds({ ...createdTestCaseIds, ...newIds });
      
      const successCount = data.results.filter(r => r.success).length;
      if (successCount > 0) {
        setSuccessMessage(`Successfully created ${successCount} test case(s) in ADO`);
      }
      
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
    if (selectedForFileWrite.size === 0) {
      setError('Please select at least one test case to write to files.');
      return;
    }

    if (Object.keys(createdTestCaseIds).length === 0) {
      setError('No test case IDs available. Please create test cases in ADO first.');
      return;
    }

    setIsWritingIds(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Map test names to file paths and collect IDs - only for selected tests
      const testCaseIdsToWrite = [];
      
      Object.entries(createdTestCaseIds)
        .filter(([testName]) => selectedForFileWrite.has(testName))
        .forEach(([testName, testCaseId]) => {
          // Skip manual tests - they don't have source files
          if (manualTests.has(testName)) {
            return;
          }

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
        const manualTestCount = Object.keys(createdTestCaseIds).filter(name => manualTests.has(name)).length;
        if (manualTestCount > 0) {
          throw new Error('No automated test files found. Manual tests cannot be written back to source files.');
        } else {
          throw new Error('No test files found. Please scan the repository first.');
        }
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
        const errorMessage = await parseErrorResponse(response, 'Failed to write test case IDs to files');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.success) {
        // Show success message
        const successCount = data.results.filter(r => r.success).length;
        setError(null);
        setSuccessMessage(`Successfully updated ${successCount} file(s) with test case IDs!`);
        
        // Track which tests were written and remove from selection
        data.results.forEach(result => {
          if (result.success && result.testsUpdated) {
            // Find which tests were in this file
            if (scanResults) {
              scanResults.forEach(file => {
                if (file.filePath === result.filePath) {
                  file.testMethods.forEach(test => {
                    if (selectedForFileWrite.has(test.name) && createdTestCaseIds[test.name]) {
                      setWrittenToFiles(prev => new Set([...prev, test.name]));
                      setSelectedForFileWrite(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(test.name);
                        return newSet;
                      });
                    }
                  });
                }
              });
            }
          }
        });
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test-Mate</h1>
              <p className="text-sm text-gray-600">AI-driven QA assistant</p>
            </div>
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
                {/* How to Use Guide Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-600 rounded-lg p-3 flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-3">How to Use Test Mate</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Scan for Missing IDs</p>
                            <p className="text-xs text-gray-600 mt-0.5">Find tests that don't have ADO test case IDs yet, and create AI-generated test steps</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Analyze Repository</p>
                            <p className="text-xs text-gray-600 mt-0.5">Get insights about your test structure and statistics</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Generate Manual Test</p>
                            <p className="text-xs text-gray-600 mt-0.5">Create manual test cases with AI-generated steps</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="bg-amber-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Suggest Context Updates</p>
                            <p className="text-xs text-gray-600 mt-0.5">AI analyzes your tests to suggest domain context improvements</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-xs text-gray-600">
                          <strong className="text-gray-800">Workflow:</strong> After scanning, select tests → Review generated documentation → Create tests in ADO and save IDs to test files
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

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
                    Path to your test directory of automation repository
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
                          Please set OPENAI_API_KEY in your .env file (see .env.example for reference)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 flex-wrap">
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
                    onClick={() => setShowManualTestModal(true)}
                    disabled={!openAiConfigured}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Generate Manual Test
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Azure DevOps Configuration
                  </label>
                  {adoConfigured ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-green-800">Azure DevOps Configured</p>
                          {adoMockMode && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded font-medium border border-yellow-300" title="Mock mode is enabled - test cases will be simulated without creating them in ADO">
                              🧪 MOCK MODE
                            </span>
                          )}
                        </div>
                        {adoConfig && (
                          <div className="text-xs text-green-700 mt-1">
                            <p>Organization: {adoConfig.organizationUrl}</p>
                            <p>Project: {adoConfig.projectName}</p>
                            <p>Test Plan: {adoConfig.testPlanId}, Suite: {adoConfig.testSuiteId}</p>
                            {adoMockMode && (
                              <p className="text-yellow-700 mt-1 font-medium">
                                ⚠️ Mock mode enabled - no actual test cases will be created in ADO
                              </p>
                            )}
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
                        <p className="text-xs text-gray-600 mt-1">
                          To enable mock mode (for testing without creating real test cases), set ADO_MOCK_MODE=true in your .env file
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Domain Context File</p>
                      <p className="text-xs text-blue-700 mt-1">
                        When you use "Suggest Context Updates", the system will automatically look for <code className="bg-blue-100 px-1 rounded">domain-context.md</code> in your repository root. 
                        If found, it will be used to enhance context suggestions. You can create or update it after analyzing your tests.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSuggestContextUpdates}
                    disabled={!config.repoPath || isAnalyzingContext || !openAiConfigured}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isAnalyzingContext ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4" />
                        Suggest Context Updates
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

                {/* File Selector Modal */}
                {showFileSelector && testFilesList && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
                      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Select Test Files for Analysis</h3>
                        <button
                          onClick={() => {
                            setShowFileSelector(false);
                            setSelectedFilePaths(new Set());
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6">
                        {testFilesList.files.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No test files found in repository</p>
                        ) : (
                          <FileTree
                            tree={testFilesList.tree}
                            files={testFilesList.files}
                            selectedFilePaths={selectedFilePaths}
                            onToggleFile={toggleFileSelection}
                          />
                        )}
                      </div>
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          {selectedFilePaths.size} file{selectedFilePaths.size !== 1 ? 's' : ''} selected
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowFileSelector(false);
                              setSelectedFilePaths(new Set());
                            }}
                            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAnalyzeSelectedFiles}
                            disabled={selectedFilePaths.size === 0 || isAnalyzingContext}
                            className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                          >
                            {isAnalyzingContext ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Lightbulb className="w-4 h-4" />
                                Analyze Selected Files
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Test Generation Modal */}
                {showManualTestModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
                      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Generate Manual Test Case</h3>
                        <button
                          onClick={() => {
                            setShowManualTestModal(false);
                            setManualTestName('');
                            setManualTestDescription('');
                            setManualTestBulletPoints('');
                            setManualTestTags('');
                            setManualTestTagsArray([]);
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Test Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={manualTestName}
                            onChange={(e) => setManualTestName(e.target.value)}
                            placeholder="e.g., Verify User Login Flow"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description/Requirements <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={manualTestDescription}
                            onChange={(e) => setManualTestDescription(e.target.value)}
                            placeholder="Describe the test scenario, what needs to be tested, and expected behavior..."
                            rows={6}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Provide a clear description of what this test should validate
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Additional Bullet Points (Optional)
                          </label>
                          <textarea
                            value={manualTestBulletPoints}
                            onChange={(e) => setManualTestBulletPoints(e.target.value)}
                            placeholder="Enter additional context, bullet points, or specific steps to consider..."
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Optional: Add any additional context or specific points to consider
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tags (Optional)
                          </label>
                          <input
                            type="text"
                            value={manualTestTags}
                            onChange={handleManualTestTagInput}
                            placeholder="tag1, tag2, tag3"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Enter tags separated by commas (e.g., "manual, smoke, regression")
                          </p>
                          {manualTestTagsArray.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {manualTestTagsArray.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                                >
                                  <Tag className="w-3 h-3" />
                                  {tag}
                                  <button
                                    onClick={() => removeManualTestTag(tag)}
                                    className="ml-1 text-green-600 hover:text-green-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {!openAiConfigured && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex gap-2">
                              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                              <p className="text-sm text-yellow-800">
                                Please configure your OpenAI API key in the Configuration section
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setShowManualTestModal(false);
                            setManualTestName('');
                            setManualTestDescription('');
                            setManualTestBulletPoints('');
                            setManualTestTags('');
                            setManualTestTagsArray([]);
                          }}
                          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleGenerateManualTest}
                          disabled={isGeneratingManual || !manualTestName.trim() || !manualTestDescription.trim() || !openAiConfigured}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                        >
                          {isGeneratingManual ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Generate Test Steps
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Context Suggestions Display */}
                {contextSuggestions && (
                  <div className="border border-amber-200 rounded-lg overflow-hidden mt-6">
                    <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-amber-600" />
                          Domain Context Suggestions
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          contextSuggestions.suggestions.confidence === 'high' ? 'bg-green-100 text-green-700' :
                          contextSuggestions.suggestions.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {contextSuggestions.suggestions.confidence} confidence
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Analyzed {contextSuggestions.analysisSummary.testsAnalyzed} tests from {contextSuggestions.analysisSummary.filesAnalyzed} files
                      </p>
                    </div>
                    <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                      {contextSuggestions.suggestions.newTerminology.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">New Terminology ({contextSuggestions.suggestions.newTerminology.length})</h4>
                          <div className="space-y-2">
                            {contextSuggestions.suggestions.newTerminology.map((term, idx) => (
                              <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                                <p className="font-medium text-gray-900">{term.term}</p>
                                <p className="text-sm text-gray-600 mt-1">{term.definition}</p>
                                {term.examples && term.examples.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">Examples: {term.examples.join(', ')}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {contextSuggestions.suggestions.newWorkflows.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">New Workflows ({contextSuggestions.suggestions.newWorkflows.length})</h4>
                          <div className="space-y-2">
                            {contextSuggestions.suggestions.newWorkflows.map((workflow, idx) => (
                              <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                                <p className="font-medium text-gray-900">{workflow.name}</p>
                                <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                                {workflow.steps && workflow.steps.length > 0 && (
                                  <ol className="text-xs text-gray-500 mt-2 list-decimal list-inside">
                                    {workflow.steps.map((step, stepIdx) => (
                                      <li key={stepIdx}>{step}</li>
                                    ))}
                                  </ol>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {contextSuggestions.suggestions.newFeatures.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">New Features ({contextSuggestions.suggestions.newFeatures.length})</h4>
                          <div className="space-y-2">
                            {contextSuggestions.suggestions.newFeatures.map((feature, idx) => (
                              <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                                <p className="font-medium text-gray-900">{feature.name}</p>
                                <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {contextSuggestions.suggestions.businessRules.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Business Rules ({contextSuggestions.suggestions.businessRules.length})</h4>
                          <div className="space-y-2">
                            {contextSuggestions.suggestions.businessRules.map((rule, idx) => (
                              <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                                <p className="text-sm text-gray-700">{rule.rule}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {contextSuggestions.suggestions.suggestedContextUpdates && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">Suggested Context Updates</h4>
                            <button
                              onClick={handleSaveDomainContext}
                              disabled={isSavingContext || contextSaveSuccess || !editedContextContent.trim()}
                              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                            >
                              {isSavingContext ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Saving...
                                </>
                              ) : contextSaveSuccess ? (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Saved!
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  {contextSuggestions.analysisSummary.hasExistingContext ? 'Update' : 'Create'} domain-context.md
                                </>
                              )}
                            </button>
                          </div>
                          <div className="bg-gray-50 p-3 rounded border border-gray-200">
                            <textarea
                              value={editedContextContent}
                              onChange={(e) => {
                                setEditedContextContent(e.target.value);
                                // Clear success state when user edits content
                                if (contextSaveSuccess) {
                                  setContextSaveSuccess(false);
                                }
                              }}
                              className="w-full h-64 p-3 text-sm text-gray-700 font-mono bg-white border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y"
                              placeholder="Edit the suggested context updates here..."
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              {contextSuggestions.analysisSummary.hasExistingContext ? (
                                <>
                                  The suggested context includes your existing content with new additions marked with <code className="bg-gray-200 px-1 rounded">&lt;!-- NEW --&gt;</code> comments. 
                                  You can edit the content above and click the button to update the domain-context.md file in your repository root.
                                </>
                              ) : (
                                <>
                                  You can edit the suggested context above. Click the button to create the domain-context.md file in your repository root.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {contextSuggestions.suggestions.newTerminology.length === 0 && 
                       contextSuggestions.suggestions.newWorkflows.length === 0 && 
                       contextSuggestions.suggestions.newFeatures.length === 0 && 
                       contextSuggestions.suggestions.businessRules.length === 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm text-green-800">
                            ✓ No new domain concepts found. Your domain context file appears to be up-to-date!
                          </p>
                        </div>
                      )}
                    </div>
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
                  <div className="ml-4">
                    <button
                      onClick={selectedTests.size === scanResults.reduce((acc, file) => acc + file.testMethods.length, 0) ? deselectAllTests : selectAllTests}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                    >
                      {selectedTests.size === scanResults.reduce((acc, file) => acc + file.testMethods.length, 0) ? 'Deselect All' : 'Select All'}
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

                {/* Floating Generate Test Steps Button */}
                {selectedTests.size > 0 && (
                  <div className="fixed bottom-6 right-6 z-40">
                    <button
                      onClick={handleGenerate}
                      disabled={selectedTests.size === 0 || isGenerating || !openAiConfigured}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-lg hover:shadow-xl"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          <span>Generate Test Steps ({selectedTests.size})</span>
                        </>
                      )}
                    </button>
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

                <div className={`grid grid-cols-1 ${(analysisResults.summary.duplicateIdsCount || 0) > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
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
                  {(analysisResults.summary.duplicateIdsCount || 0) > 0 && (
                    <button
                      onClick={() => {
                        const duplicateSection = document.getElementById('duplicate-ids-section');
                        if (duplicateSection) {
                          duplicateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="bg-red-50 border border-red-200 rounded-lg p-4 hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer text-left w-full"
                    >
                      <div className="text-xl font-bold text-red-900">{analysisResults.summary.duplicateIdsCount}</div>
                      <div className="text-sm text-red-700">Duplicate IDs</div>
                    </button>
                  )}
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

                {/* Duplicate IDs */}
                {analysisResults.duplicateIds && analysisResults.duplicateIds.length > 0 && (
                  <div id="duplicate-ids-section" className="border border-red-200 rounded-lg overflow-hidden">
                    <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold text-red-900">Duplicate Test Case IDs</h3>
                        <span className="text-sm text-red-700">
                          ({analysisResults.duplicateIds.length} duplicate ID{analysisResults.duplicateIds.length !== 1 ? 's' : ''} found)
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-red-100 max-h-96 overflow-y-auto">
                      {analysisResults.duplicateIds.map((duplicate, idx) => (
                        <div key={idx} className="bg-white">
                          <button
                            onClick={() => setExpandedDuplicateId(expandedDuplicateId === duplicate.adoId ? null : duplicate.adoId)}
                            className="w-full p-4 hover:bg-red-50 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              {expandedDuplicateId === duplicate.adoId ? (
                                <ChevronDown className="w-4 h-4 text-red-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-red-600" />
                              )}
                              <div>
                                <div className="font-medium text-red-900">
                                  ID: <span className="font-mono">{duplicate.adoId}</span>
                                </div>
                                <div className="text-sm text-red-700">
                                  Used by {duplicate.count} test{duplicate.count !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="px-3 py-1 bg-red-100 text-red-800 text-sm font-semibold rounded">
                              {duplicate.count}x
                            </div>
                          </button>
                          {expandedDuplicateId === duplicate.adoId && (
                            <div className="px-4 pb-4 bg-red-50">
                              <div className="space-y-2">
                                {duplicate.tests.map((test, testIdx) => (
                                  <div key={testIdx} className="bg-white border border-red-200 rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900">{test.name}</div>
                                        <div className="text-sm text-gray-600 mt-1">
                                          <span className="font-medium">{test.className}</span>
                                          <span className="mx-2">•</span>
                                          <span className="text-gray-500">{test.filePath}</span>
                                        </div>
                                        {test.tags && test.tags.length > 0 && (
                                          <div className="mt-2 flex flex-wrap gap-1">
                                            {test.tags.map((tag, tagIdx) => (
                                              <span key={tagIdx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                                                <Tag className="w-3 h-3 inline mr-1" />
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
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
                  <div className="ml-4 flex items-center gap-3 text-xs text-gray-600">
                    <button
                      onClick={selectedForAdo.size === Object.keys(generatedDocs).filter(name => !createdTestCaseIds[name]).length ? deselectAllForAdo : selectAllForAdo}
                      className="hover:text-gray-800 hover:underline"
                    >
                      {selectedForAdo.size === Object.keys(generatedDocs).filter(name => !createdTestCaseIds[name]).length ? 'Deselect All' : 'Select All'} for ADO
                    </button>
                    {Object.keys(generatedDocs).some(testName => !manualTests.has(testName)) && (
                      <>
                        <span>•</span>
                        <button
                          onClick={selectedForFileWrite.size === Object.keys(generatedDocs).filter(name => !manualTests.has(name) && createdTestCaseIds[name] && !writtenToFiles.has(name)).length ? deselectAllForFileWrite : selectAllForFileWrite}
                          className="hover:text-gray-800 hover:underline"
                        >
                          {selectedForFileWrite.size === Object.keys(generatedDocs).filter(name => !manualTests.has(name) && createdTestCaseIds[name] && !writtenToFiles.has(name)).length ? 'Deselect All' : 'Select All'} for Files
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  {/* Only show Write IDs to Files for automated tests */}
                  {Object.keys(generatedDocs).some(testName => !manualTests.has(testName)) && (
                    <button
                      onClick={handleWriteIdsToFiles}
                      disabled={isWritingIds || Object.keys(createdTestCaseIds).length === 0 || selectedForFileWrite.size === 0}
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
                          Write IDs to Files {selectedForFileWrite.size > 0 && `(${selectedForFileWrite.size})`}
                        </>
                      )}
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateInAdo}
                      disabled={isCreatingInAdo || !adoConfigured || selectedForAdo.size === 0}
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
                          Create in ADO {selectedForAdo.size > 0 && `(${selectedForAdo.size})`}
                        </>
                      )}
                    </button>
                    {adoMockMode && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium border border-yellow-300" title="Mock mode is enabled - test cases will be simulated without creating them in ADO">
                        🧪 MOCK MODE
                      </span>
                    )}
                  </div>
                </div>

                {/* Tag Configuration Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="addTags"
                      checked={addTags}
                      onChange={(e) => setAddTags(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="addTags" className="text-sm font-medium text-blue-900 cursor-pointer">
                      Add tag: BTAF_Automation
                    </label>
                  </div>
                </div>

                {Object.entries(generatedDocs).map(([testName, doc]) => {
                  const testCaseId = createdTestCaseIds[testName];
                  
                  // Find the class name for this test from scanResults
                  let className = '';
                  if (scanResults) {
                    scanResults.forEach(file => {
                      file.testMethods.forEach(test => {
                        if (test.name === testName) {
                          className = file.className || '';
                        }
                      });
                    });
                  }
                  
                  // Build ADO link if testCaseId and ADO config exist
                  let adoLink = null;
                  if (testCaseId && adoConfig && adoConfig.organizationUrl && adoConfig.projectName) {
                    const orgUrl = adoConfig.organizationUrl.replace(/\/$/, ''); // Remove trailing slash
                    const projectName = adoConfig.projectName;
                    adoLink = `${orgUrl}/${projectName}/_workitems/edit/${testCaseId}`;
                  }
                  
                  const displayTitle = className ? `${className} - ${testName}` : testName;
                  const isCreatedInAdo = !!testCaseId;
                  const isWrittenToFile = writtenToFiles.has(testName);
                  const canSelectForAdo = !isCreatedInAdo;
                  const canSelectForFileWrite = !manualTests.has(testName) && isCreatedInAdo && !isWrittenToFile;
                  
                  return (
                    <div key={testName} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className={`px-4 py-3 border-b border-gray-200 ${testCaseId ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Checkboxes */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              {/* Create in ADO checkbox */}
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedForAdo.has(testName)}
                                  onChange={() => toggleAdoSelection(testName)}
                                  disabled={!canSelectForAdo}
                                  className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className={`text-xs font-medium ${canSelectForAdo ? 'text-gray-700' : 'text-gray-400'}`}>
                                  ADO
                                </span>
                              </label>
                              {/* Write to Files checkbox */}
                              {!manualTests.has(testName) && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedForFileWrite.has(testName)}
                                    onChange={() => toggleFileWriteSelection(testName)}
                                    disabled={!canSelectForFileWrite}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <span className={`text-xs font-medium ${canSelectForFileWrite ? 'text-gray-700' : 'text-gray-400'}`}>
                                    File
                                  </span>
                                </label>
                              )}
                            </div>
                            {/* Test Name and Badges */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">{displayTitle}</h3>
                              {manualTests.has(testName) && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded font-medium border border-green-300 flex-shrink-0">
                                  Manual
                                </span>
                              )}
                              {isCreatedInAdo && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded font-medium border border-green-300 flex items-center gap-1 flex-shrink-0">
                                  <CheckCircle className="w-3 h-3" />
                                  Created
                                </span>
                              )}
                              {isWrittenToFile && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium border border-blue-300 flex items-center gap-1 flex-shrink-0">
                                  <CheckCircle className="w-3 h-3" />
                                  Written
                                </span>
                              )}
                            </div>
                          </div>
                          {testCaseId && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {adoLink ? (
                                <a
                                  href={adoLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline"
                                >
                                  ID: {testCaseId}
                                </a>
                              ) : (
                                <span className="text-sm font-medium text-green-700">
                                  ID: {testCaseId}
                                </span>
                              )}
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
                      {/* Only show property attribute for automated tests */}
                      {!manualTests.has(testName) && (
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
                      )}
                      {/* Show tags for manual tests */}
                      {manualTests.has(testName) && testTags[testName] && testTags[testName].length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-gray-500">Tags:</span>
                            {testTags[testName].map((tag, idx) => (
                              <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                <Tag className="w-3 h-3 inline mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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