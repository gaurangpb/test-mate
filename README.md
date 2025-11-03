# TestMate

An automated test documentation generator for Azure DevOps that scans C# NUnit test files, analyzes test statistics, and generates comprehensive test documentation using OpenAI.

## Features

- **🔍 Test Scanning**: Recursively scans repository for C# test files and extracts test methods
- **📊 Test Analysis**: Comprehensive statistics including:
  - Total tests, tests with/without ADO IDs
  - Test coverage by class
  - Categories/tags analysis and grouping
  - Test file and class statistics
- **📝 Documentation Generation**: Uses OpenAI to generate business-focused test documentation with:
  - Narrative descriptions
  - Detailed test steps (Action/Expected Result pairs)
- **🏷️ Category & Tag Support**: Extracts and reports on:
  - Method-level categories: `[Category("Smoke")]`
  - Class-level categories: `[TestFixture, Category("Integration")]`
  - Supports both `[Category]` and `[Tag]` attributes
- **✅ ADO Integration**: Complete Azure DevOps workflow including:
  - Automatic test case creation in Azure DevOps
  - Writing test case IDs back to source files
  - Test case tracking and coverage reporting
- **✏️ Editable Documentation**: Review and edit generated test steps before exporting
- **📈 Comprehensive Analytics**: Visual statistics dashboard with coverage metrics

## Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **Azure DevOps Personal Access Token** (optional, for ADO integration)

## Installation

1. **Clone the repository** or navigate to the project directory

2. **Install backend dependencies**:

   ```bash
   npm install
   ```

3. **Install frontend dependencies**:

   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Set up environment variables**:

   - Copy `env-example.sh` to `.env`
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

### Using the Application

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Configuration Tab**:

   - Enter the path to your test repository (e.g., `C:\Projects\MyTestAutomation\tests`)
   - Configure OpenAI API key (or ensure it's set in `.env`)
   - Set the TestProperty name (default: `TestCaseId`)

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
[TestProperty("TestCaseId", "12345")]
[Category("Feature")]
public void VerifyPasswordReset()
{
    // Test code
}
```

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
  "testPropertyName": "TestCaseId"
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
  "testPropertyName": "TestCaseId"
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
  ]
}
```

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
  }
}
```

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
  "testPropertyName": "TestCaseId"
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

## Project Structure

```
test-mate/
├── server.js              # Backend Express server
├── client/                # React frontend
│   ├── src/
│   │   ├── App.js        # Main application component
│   │   └── index.js       # Entry point
│   └── package.json
├── tests/                 # Example test files
│   ├── API/
│   ├── Integration/
│   └── UI/
├── package.json           # Backend dependencies
├── .env                   # Environment variables (create from env-example.sh)
└── README.md
```

## Features in Detail

### Test Detection

- Supports both `public void` and `public async Task` methods
- Finds tests across all subdirectories
- Skips common build directories (`bin`, `obj`, `node_modules`, etc.)
- Handles test files with "Test" or "Spec" in the filename

### Category/Tag Extraction

- Extracts categories from test methods and classes
- Supports multiple categories per test
- Merges class-level and method-level categories
- Displays tag statistics in the Analyzer

### Documentation Generation

- Generates business-focused descriptions (user perspective)
- Creates detailed test steps with Action/Expected Result format
- Uses OpenAI GPT-4o for high-quality documentation
- Exportable as plain text files
- Editable steps in the UI before exporting

### Azure DevOps Integration

- Creates test cases in Azure DevOps with generated documentation
- Automatically writes test case IDs back to source files
- Supports custom TestProperty attribute names
- Tracks test coverage and ADO ID mapping
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

## Troubleshooting

### Tests Not Being Detected

- Ensure test files have "Test" or "Spec" in the filename
- Check that test methods use `[Test]` attribute
- Verify the repository path is correct (use absolute path)

### Categories/Tags Not Showing

- Ensure categories use `[Category("Name")]` format
- Check that tags are within 1000 characters before the test method
- Verify class-level categories are on `[TestFixture]` attribute

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
