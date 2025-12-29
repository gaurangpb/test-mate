# TestMate

An automated test documentation generator for Azure DevOps that scans C# NUnit test files, analyzes test statistics, and generates comprehensive test documentation using OpenAI.

## Features

- **🔍 Test Scanning**: Recursively scans repository for C# test files and extracts test methods using Roslyn (Microsoft's .NET Compiler Platform) for accurate parsing
- **📊 Test Analysis**: Comprehensive statistics including:
  - Total tests, tests with/without ADO IDs
  - Test coverage by class
  - Categories/tags analysis and grouping
  - Test file and class statistics
- **📝 Documentation Generation**: Uses OpenAI to generate business-focused test documentation with:
  - Narrative descriptions
  - Detailed test steps (Action/Expected Result pairs)
  - **🎯 Domain Context Support**: Optional domain context files for enhanced, domain-specific documentation
- **🏷️ Category & Tag Support**: Extracts and reports on:
  - Method-level categories: `[Category("Smoke")]`
  - Class-level categories: `[TestFixture, Category("Integration")]`
  - Supports both `[Category]` and `[Tag]` attributes
- **✅ ADO Integration**: Complete Azure DevOps workflow including:
  - Automatic test case creation in Azure DevOps
  - Update existing test cases in Azure DevOps (steps, description, tags)
  - Writing test case IDs back to source files
  - Test case tracking and coverage reporting
- **✏️ Editable Documentation**: Review and edit generated test steps before exporting
- **📈 Comprehensive Analytics**: Visual statistics dashboard with coverage metrics

## Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **.NET 8 SDK** ([Download here](https://dotnet.microsoft.com/download/dotnet/8.0)) - Required for C# parsing with Roslyn
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **Azure DevOps Personal Access Token** (optional, for ADO integration)

## Installation

1. **Clone the repository** or navigate to the project directory

2. **Install backend dependencies**:

   ```bash
   npm install
   ```

3. **Build the Roslyn parser** (required for C# file parsing):

   ```bash
   npm run build:roslyn
   ```

   Or manually:

   ```bash
   cd roslyn-parser
   dotnet build -c Release
   cd ..
   ```

4. **Install frontend dependencies**:

   ```bash
   cd client
   npm install
   cd ..
   ```

5. **Set up environment variables**:

   - Copy `.env.example` to `.env`
   - Edit `.env` and add your configuration:

     ```env
     PORT=3001
     OPENAI_API_KEY=your-openai-api-key-here

     # Optional: Azure DevOps Configuration
     ADO_ORGANIZATION_URL=https://dev.azure.com/YourOrganization
     ADO_PROJECT_NAME=YourProjectName
     ADO_TEST_PLAN_ID=123456
     ADO_TEST_SUITE_ID=789012
     ADO_PAT=your-personal-access-token
     ```

## Usage

### Starting the Application

#### Option 1: Start Both Servers (Recommended)

```bash
npm run start:all
```

This starts:

- Backend server on `http://localhost:3001`
- Frontend application on `http://localhost:3000`

#### Option 2: Start Servers Separately

**Terminal 1 - Backend:**

```bash
npm start
```

**Terminal 2 - Frontend:**

```bash
npm run client
```

#### Option 3: Development Mode (with auto-reload)

```bash
npm run dev:all
```

#### Option 4: Windows Quick Start

```bash
start-app.bat
```

This script automatically:

- Checks and installs dependencies if needed
- Builds the Roslyn parser if it's not already built
- Starts both backend and frontend servers

### Using the Application

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Configuration Tab**:

   - Enter the path to your test repository (e.g., `C:\Projects\MyTestAutomation\tests`)
   - Configure OpenAI API key (or ensure it's set in `.env`)
   - Set the TestProperty name (default: `ADOTestCaseId`)
   - (Optional) Specify path to domain context file for enhanced documentation generation

   - Click "Analyze Repository" to get comprehensive statistics (recommended first step)
   - Click "Scan for Missing IDs" to find tests without ADO IDs

3. **Analyzer Tab**:

   - View test coverage, categories/tags, and breakdown by class
   - See tag distribution across all tests
   - Review statistics to understand your test coverage

4. **Select Tests Tab**:

   - Review the list of tests without ADO IDs
   - Select tests you want to document
   - Click "Generate Documentation"

5. **Review & Export Tab**:

   - Review generated documentation
   - Edit test steps inline (click any step to edit)
   - Create test cases in Azure DevOps (requires ADO configuration)
   - Write test case IDs automatically back to source files
   - Export documentation as text file
   - Export TestProperty attributes for manual addition

6. **Update Tests in ADO Tab**:
   - Scan for tests that already have ADO test case IDs
   - View and edit test case details (steps, description, tags) from Azure DevOps
   - Update test cases in Azure DevOps with modified documentation
   - Useful for maintaining and updating existing test cases

### Complete Workflow

The typical workflow for documenting tests and integrating with Azure DevOps:

1. **Configure** → Set repository path and OpenAI API key
2. **Analyze** (optional) → Get comprehensive statistics to understand your test coverage
3. **Scan for Missing IDs** → Find tests without ADO IDs
4. **Select** → Choose tests to document
5. **Generate** → Create documentation using OpenAI
6. **Review & Edit** → Refine test steps if needed
7. **Create in ADO** → Create test cases in Azure DevOps (gets test case IDs)
8. **Write IDs** → Automatically add TestProperty attributes to source files

**Alternative Workflow - Updating Existing Test Cases:**

1. **Configure** → Set repository path and OpenAI API key
2. **Scan for Tests with IDs** → Find tests that already have ADO test case IDs
3. **Select Tests** → Choose tests to update
4. **View & Edit** → Review and modify test case details from Azure DevOps
5. **Update in ADO** → Save changes back to Azure DevOps

## Domain Context for Enhanced Documentation

TestMate supports optional domain context files to generate more accurate, domain-specific test documentation. When provided, the AI uses your application's terminology, workflows, and business rules to create better documentation.

### Creating a Domain Context File

Create a domain context file (`.txt`, `.md`, or `.json`) containing:

- **Domain Terminology**: Key terms and concepts specific to your application
- **Features & Modules**: Core features and their purposes
- **User Journeys**: Typical workflows and user paths
- **Business Rules**: Important constraints and validation rules
- **Integration Points**: External systems and their interactions

See `domain-context-example.md` for a complete template.

### Using Domain Context

1. Create your domain context file (e.g., `domain-context.md`)
2. In the Configuration tab, enter the path to your domain context file
3. Generate documentation as usual - the AI will automatically use the context

**Benefits:**

- More accurate domain-specific terminology
- Test steps that reflect actual user workflows
- Better understanding of business context
- Consistent documentation across your test suite

**Note:** Domain context is optional. If not provided, TestMate will generate documentation based on test code alone.

## Supported Test File Structure

The tool works with C# NUnit test files. Supported patterns:

### Test Methods

```csharp
[Test]
[Category("Smoke")]
[Category("Regression")]
public void VerifyLoginSuccess()
{
    // Test code
}

[Test]
[Category("API")]
public async Task VerifyApiEndpoint()
{
    // Async test code
}
```

### TestProperty Attributes

```csharp
[Test]
[Property("ADOTestCaseId", "12345")]
[Category("Feature")]
public void VerifyPasswordReset()
{
    // Test code
}
```

**Note:** The parser supports both `[Property]` and `[TestProperty]` attributes. The attribute can appear before or after the `[Test]` attribute.

### Class-Level Categories

```csharp
[TestFixture]
[Category("Integration")]
public class IntegrationTests
{
    // All tests in this class inherit "Integration" category
}
```

## API Endpoints

### `POST /api/scan`

Scans repository for test files without ADO TestCaseId.

**Request:**

```json
{
  "repoPath": "C:\\path\\to\\tests",
  "testPropertyName": "ADOTestCaseId"
}
```

**Response:**

```json
{
  "results": [
    {
      "fileName": "LoginTests.cs",
      "filePath": "UI/Authentication/LoginTests.cs",
      "testMethods": [...]
    }
  ]
}
```

### `POST /api/analyze`

Provides comprehensive test analysis and statistics.

**Request:**

```json
{
  "repoPath": "C:\\path\\to\\tests",
  "testPropertyName": "ADOTestCaseId"
}
```

**Response:**

```json
{
  "summary": {
    "totalTests": 25,
    "testsWithAdoId": 5,
    "testsWithoutAdoId": 20,
    "coveragePercent": 20,
    "totalClasses": 7,
    "totalFiles": 7,
    "totalTags": 12
  },
  "byClass": [...],
  "byTag": [...],
  "allTests": [...]
}
```

### `POST /api/generate`

Generates documentation for selected tests using OpenAI.

**Request:**

```json
{
  "tests": [
    {
      "name": "VerifyLoginSuccess",
      "code": "// test code",
      "fileName": "LoginTests.cs"
    }
  ],
  "domainContextPath": "C:\\Projects\\MyApp\\domain-context.md"
}
```

**Note:** `domainContextPath` is optional. If provided, the domain context file will be loaded and used to enhance documentation generation.

**Response:**

```json
{
  "generatedDocs": {
    "VerifyLoginSuccess": {
      "description": "Business-focused narrative description...",
      "steps": [
        {
          "action": "Action description",
          "expectedResult": "Expected result description"
        }
      ]
    }
  },
  "usedDomainContext": true
}
```

**Note:** `usedDomainContext` indicates whether domain context was successfully loaded and used.

### `GET /api/config/openai/status`

Checks if OpenAI API key is configured.

**Response:**

```json
{
  "configured": true
}
```

### `POST /api/config/openai`

Configure OpenAI API key (alternative to environment variable).

**Request:**

```json
{
  "apiKey": "your-openai-api-key-here"
}
```

**Response:**

```json
{
  "success": true,
  "message": "OpenAI client configured"
}
```

### `POST /api/ado/create-test-cases`

Creates test cases in Azure DevOps from generated documentation.

**Request:**

```json
{
  "testCases": [
    {
      "testName": "VerifyLoginSuccess",
      "fileName": "LoginTests.cs",
      "description": "Test description...",
      "steps": [
        {
          "action": "Action description",
          "expectedResult": "Expected result description"
        }
      ]
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "testName": "VerifyLoginSuccess",
      "fileName": "LoginTests.cs",
      "testCaseId": "123456",
      "success": true
    }
  ],
  "message": "Successfully created 1 test case(s) in ADO (Mock Mode)"
}
```

**Note:** Requires Azure DevOps configuration in `.env` file:

- `ADO_ORGANIZATION_URL`
- `ADO_PROJECT_NAME`
- `ADO_TEST_PLAN_ID`
- `ADO_TEST_SUITE_ID`
- `ADO_PAT`

### `POST /api/write-test-ids`

Writes test case IDs back to source files as `[TestProperty]` attributes.

**Request:**

```json
{
  "testCaseIds": [
    {
      "testName": "VerifyLoginSuccess",
      "filePath": "C:\\path\\to\\LoginTests.cs",
      "testCaseId": "123456"
    }
  ],
  "testPropertyName": "ADOTestCaseId"
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "filePath": "C:\\path\\to\\LoginTests.cs",
      "fileName": "LoginTests.cs",
      "success": true,
      "testsUpdated": 1
    }
  ],
  "message": "Successfully updated 1 file(s)"
}
```

**Note:** This endpoint automatically:

- Finds the test method in the source file
- Adds or updates the `[TestProperty]` attribute before the `[Test]` attribute
- Preserves existing code formatting and indentation

### `POST /api/scan/scan-with-ids`

Scans repository for test files that already have ADO TestCaseId.

**Request:**

```json
{
  "repoPath": "C:\\path\\to\\tests",
  "testPropertyName": "ADOTestCaseId"
}
```

**Response:**

```json
{
  "results": [
    {
      "fileName": "LoginTests.cs",
      "filePath": "UI/Authentication/LoginTests.cs",
      "testMethods": [
        {
          "name": "VerifyLoginSuccess",
          "testCaseId": "123456"
        }
      ]
    }
  ]
}
```

### `GET /api/ado/test-case/:testCaseId`

Retrieves test case details from Azure DevOps.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123456,
    "title": "VerifyLoginSuccess",
    "description": "Test description...",
    "steps": [
      {
        "action": "Action description",
        "expectedResult": "Expected result description"
      }
    ],
    "tags": ["Smoke", "Regression"]
  }
}
```

### `PATCH /api/ado/test-case/:testCaseId`

Updates a single test case in Azure DevOps.

**Request:**

```json
{
  "steps": [
    {
      "action": "Updated action description",
      "expectedResult": "Updated expected result"
    }
  ],
  "description": "Updated test description",
  "tags": ["Smoke", "Regression", "Updated"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123456,
    "title": "VerifyLoginSuccess"
  }
}
```

### `POST /api/ado/update-test-cases`

Batch updates multiple test cases in Azure DevOps.

**Request:**

```json
{
  "updates": [
    {
      "testCaseId": 123456,
      "steps": [
        {
          "action": "Action description",
          "expectedResult": "Expected result"
        }
      ],
      "description": "Test description",
      "tags": ["Smoke"]
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "testCaseId": 123456,
      "success": true
    }
  ],
  "message": "Successfully updated 1 test case(s)"
}
```

**Note:** Requires Azure DevOps configuration in `.env` file (same as create-test-cases endpoint).

### `GET /api/ado/test-analysis`

Retrieves test analysis data including failed tests with linked bugs from Azure DevOps.

**Query Parameters:**

- `planId` (optional): Test plan ID to filter by
- `bugId` (optional): Bug ID to filter by
- `suiteIds` (optional): Comma-separated list of test suite IDs
- `testOutcome` (optional): Test outcome filter (default: "Failed")
- `bugStatus` (optional): Bug status filter
- `includeAttachments` (optional): Include attachments (default: true)

**Response:**

```json
{
  "success": true,
  "data": {
    "failedTests": [...],
    "linkedBugs": [...]
  },
  "filters": {...}
}
```

**Note:** Requires Azure DevOps configuration in `.env` file.

### `GET /api/browse-directory`

Browses directory structure for file picker functionality.

**Query Parameters:**

- `path` (required): Directory path to browse

**Response:**

```json
{
  "path": "C:\\path\\to\\directory",
  "directories": ["dir1", "dir2"],
  "files": ["file1.cs", "file2.cs"]
}
```

### `POST /api/generate/test-files-list`

Gets a list of all test files in the repository with tree structure.

**Request:**

```json
{
  "repoPath": "C:\\path\\to\\tests"
}
```

**Response:**

```json
{
  "files": [
    {
      "absolutePath": "C:\\path\\to\\tests\\LoginTests.cs",
      "relativePath": "LoginTests.cs",
      "fileName": "LoginTests.cs"
    }
  ],
  "tree": {
    "UI": {
      "type": "directory",
      "children": {
        "Authentication": {
          "type": "directory",
          "children": {
            "LoginTests.cs": {
              "type": "file",
              "absolutePath": "...",
              "relativePath": "UI/Authentication/LoginTests.cs",
              "fileName": "LoginTests.cs"
            }
          }
        }
      }
    }
  }
}
```

### `POST /api/generate/generate-steps`

Generates test steps for an existing test case, optionally merging with existing steps.

**Request:**

```json
{
  "testCode": "// test code here",
  "existingSteps": [
    {
      "action": "Existing action",
      "expectedResult": "Existing result"
    }
  ],
  "testName": "VerifyLoginSuccess",
  "domainContextPath": "C:\\path\\to\\domain-context.md"
}
```

**Response:**

```json
{
  "success": true,
  "steps": [
    {
      "action": "Action description",
      "expectedResult": "Expected result description"
    }
  ]
}
```

**Note:** `domainContextPath` is optional.

### `POST /api/generate/suggest-context-updates`

Analyzes test code to extract domain concepts and suggests updates to domain context file.

**Request:**

```json
{
  "repoPath": "C:\\path\\to\\tests",
  "selectedFilePaths": [
    "tests/API/ApiEndpointTests.cs",
    "tests/Banking/TransferFundsTests.cs"
  ],
  "testPropertyName": "ADOTestCaseId"
}
```

**Response:**

```json
{
  "suggestions": {
    "newTerminology": [...],
    "newWorkflows": [...],
    "newFeatures": [...],
    "businessRules": [...],
    "suggestedContextUpdates": "Complete markdown content...",
    "confidence": "high|medium|low"
  },
  "analysisSummary": {
    "testsAnalyzed": 15,
    "filesAnalyzed": 2,
    "hasExistingContext": true,
    "domainContextPath": "C:\\path\\to\\domain-context.md"
  }
}
```

### `POST /api/generate/save-domain-context`

Saves or updates the domain context file in the repository.

**Request:**

```json
{
  "repoPath": "C:\\path\\to\\tests",
  "content": "# Domain Context\n\n## Domain Terminology\n..."
}
```

**Response:**

```json
{
  "success": true,
  "filePath": "C:\\path\\to\\tests\\domain-context.md",
  "message": "Domain context saved successfully"
}
```

### `POST /api/generate/manual`

Generates test steps from a manual test description.

**Request:**

```json
{
  "testName": "VerifyUserLogin",
  "description": "Test that verifies user can log in successfully",
  "bulletPoints": "• User enters credentials\n• System validates\n• User is redirected",
  "repoPath": "C:\\path\\to\\tests"
}
```

**Response:**

```json
{
  "generatedDoc": {
    "description": "Test description...",
    "steps": [
      {
        "action": "Action description",
        "expectedResult": "Expected result description"
      }
    ]
  },
  "usedDomainContext": true
}
```

**Note:** `bulletPoints` and `repoPath` are optional. If `repoPath` is provided, domain context will be automatically loaded if available.

### `POST /api/generate-mapping-file`

Generates a mapping file (JSON format) for test case IDs.

**Request:**

```json
{
  "testCaseIds": [
    {
      "testName": "VerifyLoginSuccess",
      "filePath": "C:\\path\\to\\LoginTests.cs",
      "testCaseId": "123456"
    }
  ],
  "testPropertyName": "ADOTestCaseId",
  "outputPath": "C:\\path\\to\\mapping.json"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Mapping file created at C:\\path\\to\\mapping.json",
  "filePath": "C:\\path\\to\\mapping.json"
}
```

**Note:** `outputPath` is optional. If not provided, returns the mapping data directly.

## Project Structure

```
test-mate/
├── server.js              # Backend Express server
├── client/                # React frontend
│   ├── src/
│   │   ├── App.js        # Main application component
│   │   └── index.js       # Entry point
│   └── package.json
├── roslyn-parser/         # .NET 8 Roslyn parser for C# parsing
│   ├── Services/
│   │   └── CSharpParser.cs
│   ├── Models/
│   └── RoslynParser.csproj
├── tests/                 # Example test files
│   ├── API/
│   ├── Integration/
│   └── UI/
├── package.json           # Backend dependencies
├── build-roslyn-parser.js # Build script for Roslyn parser
├── start-app.bat          # Windows quick start script (auto-builds Roslyn parser)
├── .env                   # Environment variables (create from .env.example)
└── README.md
```

## Features in Detail

### Test Detection

- Supports both `public void` and `public async Task` methods
- Finds tests across all subdirectories
- Skips common build directories (`bin`, `obj`, `node_modules`, etc.)
- Handles test files with "Test" or "Spec" in the filename

### Category/Tag Extraction

- Extracts categories from test methods and classes using Roslyn syntax tree analysis
- Supports multiple categories per test
- Merges class-level and method-level categories
- Handles attributes on separate lines or combined
- Displays tag statistics in the Analyzer

### Documentation Generation

- Generates business-focused descriptions (user perspective)
- Creates detailed test steps with Action/Expected Result format
- Uses OpenAI gpt-4o-mini for high-quality documentation
- Exportable as plain text files
- Editable steps in the UI before exporting

### Azure DevOps Integration

- Creates test cases in Azure DevOps with generated documentation
- Updates existing test cases in Azure DevOps (steps, description, tags)
- Automatically writes test case IDs back to source files
- Supports custom TestProperty attribute names
- Tracks test coverage and ADO ID mapping
- Batch update support for multiple test cases
- Mock mode available for testing (generates random test case IDs)

### UI Features

- **Configuration Tab**: Repository path, OpenAI status check, TestProperty configuration
- **Analyzer Tab**: Comprehensive statistics dashboard with:
  - Test coverage metrics
  - Breakdown by class with coverage percentages
  - Tag distribution visualization
  - Summary cards with key metrics
- **Select Tests Tab**: Browse and select tests to document with code preview
- **Review & Export Tab**:
  - Inline editing of test steps
  - Visual indicators for test case ID status
  - One-click export options
  - Direct Azure DevOps integration
- **Update Tests in ADO Tab**:
  - Scan for tests with existing ADO IDs
  - View and edit test case details from Azure DevOps
  - Update test cases in Azure DevOps with modified documentation
  - Track unsaved changes

## Troubleshooting

### Tests Not Being Detected

- Ensure test files have "Test" or "Spec" in the filename
- Check that test methods use `[Test]` or `[TestCase]` attribute
- Verify the repository path is correct (use absolute path)
- Ensure .NET 8 SDK is installed and Roslyn parser is built (`npm run build:roslyn`)

### Categories/Tags Not Showing

- Ensure categories use `[Category("Name")]` format
- Verify class-level categories are on `[TestFixture]` attribute or before the class declaration
- The Roslyn parser handles attributes on separate lines automatically

### OpenAI Errors

- Verify API key is set in `.env` file
- Check API key is valid and has credits
- Ensure internet connection is available
- Check OpenAI configuration status via Configuration tab

### Azure DevOps Integration Issues

- Verify all ADO environment variables are set in `.env`:
  - `ADO_ORGANIZATION_URL`
  - `ADO_PROJECT_NAME`
  - `ADO_TEST_PLAN_ID`
  - `ADO_TEST_SUITE_ID`
  - `ADO_PAT`
- Ensure Personal Access Token has Test Management permissions
- Check that Test Plan and Test Suite IDs are valid
- Note: Current implementation uses mock mode (generates random IDs for testing)

### Writing Test IDs to Files

- Ensure source files are writable
- Verify test method names match exactly (case-sensitive)
- Check file paths are absolute and correct
- Review error messages in the response for specific failures

### Roslyn Parser Issues

- Ensure .NET 8 SDK is installed: `dotnet --version` should show 8.x
- Build the parser: `npm run build:roslyn`
- Check that `roslyn-parser/bin/Release/net8.0/RoslynParser.exe` exists (Windows) or `RoslynParser` (Linux/Mac)
- If build fails, verify .NET 8 SDK installation and try building manually: `cd roslyn-parser && dotnet build -c Release`

## Development

### Backend Development

```bash
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development

```bash
cd client
npm start  # Starts React dev server with hot reload
```

## License

MIT

## Support

For issues or questions, please open an issue on the repository.
