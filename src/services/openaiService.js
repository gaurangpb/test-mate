const OpenAI = require('openai');

/**
 * OpenAI service for documentation generation
 */
class OpenAIService {
  constructor() {
    this.client = null;
    this.initializeFromEnv();
  }

  initializeFromEnv() {
    console.log('Checking for OPENAI_API_KEY...');
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('OpenAI client initialized from environment variable');
    } else {
      console.log('Warning: OPENAI_API_KEY not found in environment variables');
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  setClient(apiKey) {
    this.client = new OpenAI({ apiKey });
  }

  async generateDocumentationForTests(tests) {
    const documentationResults = [];
    
    for (const test of tests) {
      try {
        console.log(`Generating documentation for: ${test.name}`);
        const docs = await this.generateDocumentation(test);
        documentationResults.push({ name: test.name, docs });
        console.log(`Successfully generated documentation for: ${test.name}`);
      } catch (error) {
        console.error(`Failed to generate documentation for ${test.name}:`, error);
        documentationResults.push({ 
          name: test.name, 
          docs: {
            description: `Failed to generate documentation for ${test.name}: ${error.message}`,
            steps: [
              {
                action: "Manual documentation required",
                expectedResult: "Test documentation should be created manually"
              }
            ]
          }
        });
      }
    }
    
    const generatedDocs = {};
    documentationResults.forEach(({ name, docs }) => {
      generatedDocs[name] = docs;
    });

    return generatedDocs;
  }

  async generateDocumentation(test) {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }

    const prompt = `You are a QA documentation expert. Analyze this automated test code and generate comprehensive test documentation.

Test Method Name: ${test.name}

Test Code:
\`\`\`csharp
${test.code}
\`\`\`

Please provide:

1. A narrative description (2-3 sentences) explaining what business scenario this test validates. Focus on the user perspective and business value, not technical implementation details.

2. Detailed test steps in the format of Action and Expected Result pairs. Each step should be clear and testable. Include steps for setup, execution, and verification.

Return your response in this exact JSON format:
{
  "description": "Your narrative description here",
  "steps": [
    {
      "action": "Action description",
      "expectedResult": "Expected result description"
    }
  ]
}

Important guidelines:
- Make the description business-focused and user-centric
- Steps should be clear enough for manual testing if needed
- Include verification steps based on assertions in the code
- Keep technical jargon minimal in the description
- Number of steps should match the logical flow of the test (typically 3-7 steps)`;

    try {
      console.log(`Generating documentation for test: ${test.name}`);
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a QA documentation expert who creates clear, comprehensive test documentation from automated test code. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      console.log(`OpenAI response for ${test.name}:`, content);
      
      try {
        const parsedContent = JSON.parse(content);
        return parsedContent;
      } catch (parseError) {
        console.error(`JSON parse error for ${test.name}:`, parseError);
        console.error(`Raw content:`, content);
        
        return {
          description: `Test method ${test.name} validates system functionality. This test needs manual documentation review.`,
          steps: [
            {
              action: "Execute the test method",
              expectedResult: "Test should pass successfully"
            }
          ]
        };
      }
    } catch (error) {
      console.error(`Error generating docs for ${test.name}:`, error);
      
      if (error.response) {
        console.error('OpenAI API Error Status:', error.response.status);
        console.error('OpenAI API Error Data:', error.response.data);
      }
      
      return {
        description: `Test method ${test.name} validates system functionality. Documentation generation failed: ${error.message}`,
        steps: [
          {
            action: "Execute the test method",
            expectedResult: "Test should pass successfully"
          }
        ]
      };
    }
  }
}

module.exports = OpenAIService;