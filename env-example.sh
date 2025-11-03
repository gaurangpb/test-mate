# Server Configuration
PORT=3001

# OpenAI API Key (Required)
# Copy this file to .env and set your OpenAI API key
# Get your API key from: https://platform.openai.com/api-keys
# The API key should be set in .env file - no need to enter it in the UI
OPENAI_API_KEY=your-openai-api-key-here

# Azure DevOps Configuration (Required for ADO integration)
# Set these values in your .env file
ADO_ORGANIZATION_URL=https://dev.azure.com/YourOrganization
ADO_PROJECT_NAME=YourProjectName
ADO_TEST_PLAN_ID=123456
ADO_TEST_SUITE_ID=789012
ADO_PAT=your-personal-access-token-here