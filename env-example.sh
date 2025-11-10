# Server Configuration
PORT=3001

# OpenAI API Key (Required)
# Copy this file to .env and set your OpenAI API key
# Get your API key from: https://platform.openai.com/api-keys
# The API key should be set in .env file - no need to enter it in the UI
OPENAI_API_KEY=your-openai-api-key-here

# Azure DevOps Configuration (Required for ADO integration)
# Set these values in your .env file for real ADO integration
# Example: ADO_ORGANIZATION_URL=https://dev.azure.com/YourCompany
ADO_ORGANIZATION_URL=https://dev.azure.com/YourOrganization
# The name of your ADO project
ADO_PROJECT_NAME=YourProjectName
# The ID of the test plan where test cases will be created
ADO_TEST_PLAN_ID=123456
# The ID of the test suite within the test plan
ADO_TEST_SUITE_ID=789012
# Personal Access Token with Test Management permissions
# Create at: https://dev.azure.com/YourOrganization/_usersSettings/tokens
# Required scopes: Test management (read & write), Work items (read & write)
ADO_PAT=your-personal-access-token-here

# ADO Mock Mode (Optional)
# Set to 'true' to enable mock mode - test cases will be simulated without actually creating them in ADO
# This is useful for testing and development without affecting your ADO instance
ADO_MOCK_MODE=false