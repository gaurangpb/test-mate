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

  async generateDocumentationForTests(tests, domainContext = null, styleGuide = null) {
    const documentationResults = [];
    
    for (const test of tests) {
      try {
        console.log(`Generating documentation for: ${test.name}`);
        const docs = await this.generateDocumentation(test, domainContext, styleGuide);
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

  async generateDocumentation(test, domainContext = null, styleGuide = null) {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }

    // Import style guide loader
    const styleGuideLoader = require('../utils/styleGuideLoader');

    // Build prompt with optional domain context
    let prompt = `You are a QA documentation expert. Analyze this automated test code and generate comprehensive test documentation.`;

    // Add domain context if provided
    if (domainContext) {
      prompt += `\n\n=== APPLICATION DOMAIN CONTEXT ===\nThe following information describes the application's domain, features, workflows, and terminology. Use this context to generate more accurate, domain-specific test documentation:\n\n${domainContext}\n\n=== END DOMAIN CONTEXT ===\n`;
    }

    // Add style guide instructions if provided
    if (styleGuide) {
      prompt += styleGuideLoader.buildStyleGuideInstructions(styleGuide);
    }

    prompt += `\nTest Method Name: ${test.name}\n\nTest Code:\n\`\`\`csharp\n${test.code}\n\`\`\`\n\nPlease provide:\n\n1. A narrative description (2-3 sentences) explaining what business scenario this test validates. Focus on the user perspective and business value, not technical implementation details.`;

    // Domain context guidance (only if no style guide covers this)
    if (domainContext && (!styleGuide || !styleGuide.terminology)) {
      prompt += ` Use the domain context provided above to ensure the description uses correct domain terminology and reflects actual user workflows.`;
    }

    prompt += `\n\n2. Detailed test steps in the format of Action and Expected Result pairs. Each step should be clear and testable.`;

    // Structure guidance (only if style guide doesn't specify)
    if (!styleGuide || !styleGuide.structure) {
      prompt += ` Include steps for setup, execution, and verification.`;
    }

    // Step count guidance (only if style guide doesn't specify)
    if (!styleGuide || !styleGuide.formatting || !styleGuide.formatting.minStepsPerTest) {
      prompt += ` Number of steps should match the logical flow of the test (typically 3-7 steps).`;
    }

    prompt += `\n\nReturn your response in this exact JSON format:\n{\n  "description": "Your narrative description here",\n  "steps": [\n    {\n      "action": "Action description",\n      "expectedResult": "Expected result description"\n    }\n  ]\n}\n\nImportant guidelines:`;

    // Only add domain context reminders if provided (style guide already covers terminology)
    if (domainContext) {
      prompt += `\n- Use domain-specific terminology from the context provided above`;
      prompt += `\n- Ensure test steps reflect actual user journeys and workflows described in the context`;
    }

    // General guidelines (style guide already covers formatting specifics)
    prompt += `\n- Steps should be clear enough for manual testing if needed`;

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

  /**
   * Generate steps for a test case, merging with existing steps
   * @param {Object} params - { testCode, existingSteps, testName, domainContext, styleGuide }
   * @returns {Promise<Array>} - Array of steps with action and expectedResult
   */
  async generateStepsForTest({ testCode, existingSteps = [], testName, domainContext = null, styleGuide = null }) {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }

    // Import style guide loader
    const styleGuideLoader = require('../utils/styleGuideLoader');

    let prompt = `You are a QA documentation expert. Analyze this automated test code and generate or update test steps.`;

    // Add domain context if provided
    if (domainContext) {
      prompt += `\n\n=== APPLICATION DOMAIN CONTEXT ===\n${domainContext}\n=== END DOMAIN CONTEXT ===\n`;
    }

    // Add style guide instructions if provided
    if (styleGuide) {
      prompt += styleGuideLoader.buildStyleGuideInstructions(styleGuide);
    }

    prompt += `\nTest Method Name: ${testName || 'Test'}\n\nTest Code:\n\`\`\`csharp\n${testCode}\n\`\`\`\n\n`;

    if (existingSteps && existingSteps.length > 0) {
      prompt += `=== EXISTING TEST STEPS ===\n`;
      existingSteps.forEach((step, idx) => {
        prompt += `${idx + 1}. Action: ${step.action || ''}\n   Expected Result: ${step.expectedResult || ''}\n\n`;
      });
      prompt += `=== END EXISTING STEPS ===\n\n`;
      prompt += `Your task:\n`;
      prompt += `1. Review the existing steps above\n`;
      prompt += `2. Analyze the test code to understand what it actually does\n`;
      prompt += `3. Update, add, or remove steps as needed to accurately reflect the test code\n`;
      prompt += `4. Ensure steps are clear, testable, and match the logical flow of the test\n`;
      prompt += `5. Keep steps that are still accurate, update steps that need changes, add missing steps, remove obsolete steps\n`;
    } else {
      prompt += `Generate detailed test steps in the format of Action and Expected Result pairs. `;
      prompt += `Each step should be clear and testable.`;
      
      if (styleGuide && styleGuide.structure) {
        if (styleGuide.structure.includeSetupSteps) {
          prompt += ` Include setup steps.`;
        }
        if (styleGuide.structure.includeTeardownSteps) {
          prompt += ` Include teardown steps.`;
        }
        if (styleGuide.structure.verificationRequired) {
          prompt += ` Include verification steps.`;
        }
      } else {
        prompt += ` Include steps for setup, execution, and verification.`;
      }
    }

    if (domainContext) {
      prompt += `\n\nUse the domain context provided above to ensure steps use correct domain terminology and reflect actual user workflows.`;
    }

    if (styleGuide && styleGuide.terminology) {
      if (styleGuide.terminology.preference === 'business') {
        prompt += ` Use business-focused language and avoid technical jargon.`;
      }
      if (styleGuide.terminology.domainSpecificTerms && styleGuide.terminology.domainSpecificTerms.length > 0) {
        prompt += ` Use these domain-specific terms: ${styleGuide.terminology.domainSpecificTerms.join(', ')}.`;
      }
    }

    prompt += `\n\nReturn your response in this exact JSON format:\n{\n  "steps": [\n    {\n      "action": "Action description",\n      "expectedResult": "Expected result description"\n    }\n  ]\n}\n\nImportant guidelines:\n`;
    if (domainContext) {
      prompt += `- Use domain-specific terminology from the context provided\n`;
      prompt += `- Ensure test steps reflect actual user journeys and workflows described in the context\n`;
    }
    
    if (styleGuide && styleGuide.formatting) {
      if (styleGuide.formatting.actionFormat === 'imperative') {
        prompt += `- Write actions in imperative mood (e.g., "Navigate to...", "Click on...", "Enter...")\n`;
      }
      if (styleGuide.examples && styleGuide.examples.goodAction) {
        prompt += `- Follow this example for good actions: "${styleGuide.examples.goodAction}"\n`;
      }
      if (styleGuide.examples && styleGuide.examples.badAction) {
        prompt += `- Avoid actions like: "${styleGuide.examples.badAction}"\n`;
      }
      const minSteps = styleGuide.formatting.minStepsPerTest || 3;
      const maxSteps = styleGuide.formatting.maxStepsPerTest || 10;
      prompt += `- Generate between ${minSteps} and ${maxSteps} steps\n`;
    } else {
      prompt += `- Number of steps should match the logical flow of the test (typically 3-7 steps)\n`;
    }
    
    prompt += `- Steps should be clear enough for manual testing if needed\n`;
    prompt += `- Include verification steps based on assertions in the code\n`;
    if (existingSteps && existingSteps.length > 0) {
      prompt += `- Preserve the intent of existing steps that are still accurate\n`;
      prompt += `- Only change steps that need updates based on the actual test code\n`;
    }

    try {
      console.log(`Generating steps for test: ${testName || 'Unknown'}`);
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a QA documentation expert who creates clear, comprehensive test steps from automated test code. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      console.log(`OpenAI response for ${testName || 'Unknown'}:`, content);
      
      try {
        const parsedContent = JSON.parse(content);
        return parsedContent.steps || [];
      } catch (parseError) {
        console.error(`JSON parse error for ${testName || 'Unknown'}:`, parseError);
        console.error(`Raw content:`, content);
        
        // Return existing steps if parsing fails
        return existingSteps.length > 0 ? existingSteps : [
          {
            action: "Execute the test method",
            expectedResult: "Test should pass successfully"
          }
        ];
      }
    } catch (error) {
      console.error(`Error generating steps for ${testName || 'Unknown'}:`, error);
      
      // Return existing steps if generation fails
      return existingSteps.length > 0 ? existingSteps : [
        {
          action: "Execute the test method",
          expectedResult: "Test should pass successfully"
        }
      ];
    }
  }

  /**
   * Analyze test code to extract domain concepts, terminology, and workflows
   * that could be added to domain context file
   * @param {Array} tests - Array of test objects with name and code
   * @param {string} existingContext - Current domain context (if any)
   * @returns {Promise<Object>} - Extracted domain concepts and suggestions
   */
  async extractDomainConcepts(tests, existingContext = null) {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }

    // Prepare test code samples for analysis
    const testSamples = tests.slice(0, 20).map(test => ({
      name: test.name,
      code: test.code.substring(0, 2000) // Limit code length
    }));

    let prompt = `You are a domain analysis expert. Analyze the following test code samples and extract domain-specific concepts that would be valuable for test documentation generation.

Your task is to identify:
1. **Domain Terminology**: Specialized terms, business entities, status values used in tests
2. **Workflows**: User journeys and business processes reflected in the tests
3. **Features**: Application features and modules being tested
4. **Business Rules**: Constraints, validations, or rules implied by test logic
5. **Relationships**: How different entities or features relate to each other

Test Samples:
${JSON.stringify(testSamples, null, 2)}`;

    if (existingContext) {
      // Include full context if reasonable size, otherwise include a larger portion
      const contextToInclude = existingContext.length > 10000 
        ? existingContext.substring(0, 10000) + '\n\n[... existing context continues ...]'
        : existingContext;
      prompt += `\n\n=== EXISTING DOMAIN CONTEXT ===\n${contextToInclude}\n=== END EXISTING CONTEXT ===\n\n`;
      prompt += `Compare the test code with the existing domain context above. Identify:\n`;
      prompt += `- **New Concepts**: Terminology, workflows, or features not in existing context\n`;
      prompt += `- **Missing Information**: Details that should be added to existing sections\n`;
      prompt += `- **Potential Updates**: Information that might be outdated or incomplete\n\n`;
      prompt += `IMPORTANT: For the "suggestedContextUpdates" field, generate the COMPLETE domain-context.md file content that includes:\n`;
      prompt += `1. All existing content from the context above (preserve it)\n`;
      prompt += `2. All new terminology items formatted as markdown bullet points in a "Domain Terminology" section\n`;
      prompt += `3. All new workflows formatted in a "User Journeys and Workflows" section\n`;
      prompt += `4. All new features formatted in a "Core Features and Modules" section\n`;
      prompt += `5. All business rules formatted in a "Business Rules and Constraints" section\n`;
      prompt += `6. Mark new additions with HTML comments like <!-- NEW --> before new items so they can be easily identified\n`;
      prompt += `7. Integrate new content into appropriate existing sections where relevant\n`;
    } else {
      prompt += `\n\nExtract all domain concepts that would be useful for creating comprehensive domain context.\n\n`;
      prompt += `IMPORTANT: For the "suggestedContextUpdates" field, generate a COMPLETE domain-context.md file that includes:\n`;
      prompt += `1. A "Domain Terminology" section with ALL extracted terminology items as markdown bullet points\n`;
      prompt += `2. A "User Journeys and Workflows" section with ALL extracted workflows\n`;
      prompt += `3. A "Core Features and Modules" section with ALL extracted features\n`;
      prompt += `4. A "Business Rules and Constraints" section with ALL extracted business rules\n`;
    }

    prompt += `\n\nReturn your analysis in this exact JSON format:\n{\n  "newTerminology": [\n    {\n      "term": "Term name",\n      "definition": "What this term means in the domain",\n      "examples": ["example usage from tests"]\n    }\n  ],\n  "newWorkflows": [\n    {\n      "name": "Workflow name",\n      "description": "What this workflow does",\n      "steps": ["step1", "step2", "step3"],\n      "testEvidence": ["test names or code snippets that show this workflow"]\n    }\n  ],\n  "newFeatures": [\n    {\n      "name": "Feature name",\n      "description": "What this feature does",\n      "testEvidence": ["test names that test this feature"]\n    }\n  ],\n  "businessRules": [\n    {\n      "rule": "Rule description",\n      "testEvidence": ["test names that validate this rule"]\n    }\n  ],\n  "suggestedContextUpdates": "COMPLETE formatted markdown file content that includes ALL extracted concepts. If existing context was provided, include the full file with new content integrated and marked with <!-- NEW --> comments.",\n  "confidence": "high|medium|low - confidence in these suggestions"\n}\n\nCRITICAL: The "suggestedContextUpdates" field must include ALL terminology, workflows, features, and business rules extracted above. Do not summarize - include everything in properly formatted markdown.`;

    try {
      console.log(`Extracting domain concepts from ${tests.length} test(s)`);
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a domain analysis expert who extracts business concepts from test code. Always respond with valid JSON. Focus on domain-specific terminology and workflows that would help generate better test documentation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5, // Lower temperature for more consistent extraction
        max_tokens: 4000, // Increased to allow for comprehensive context updates
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      console.log(`Domain concept extraction completed`);
      
      try {
        const parsedContent = JSON.parse(content);
        return parsedContent;
      } catch (parseError) {
        console.error(`JSON parse error in domain concept extraction:`, parseError);
        console.error(`Raw content:`, content);
        
        return {
          newTerminology: [],
          newWorkflows: [],
          newFeatures: [],
          businessRules: [],
          suggestedContextUpdates: 'Error parsing AI response. Please review test code manually.',
          confidence: 'low'
        };
      }
    } catch (error) {
      console.error(`Error extracting domain concepts:`, error);
      
      return {
        newTerminology: [],
        newWorkflows: [],
        newFeatures: [],
        businessRules: [],
        suggestedContextUpdates: `Error extracting domain concepts: ${error.message}`,
        confidence: 'low'
      };
    }
  }

  /**
   * Generate test steps from a manual test description
   * @param {string} testName - Name of the test case
   * @param {string} description - Description or requirements for the test
   * @param {string} bulletPoints - Optional bullet points or additional context
   * @param {string} domainContext - Optional domain context for better generation
   * @returns {Promise<Object>} - Generated test documentation with description and steps
   */
  async generateManualTestSteps(testName, description, bulletPoints = null, domainContext = null) {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }

    let prompt = `You are a QA documentation expert. Generate comprehensive test documentation for a manual test case based on the following information.`;

    // Add domain context if provided
    if (domainContext) {
      prompt += `\n\n=== APPLICATION DOMAIN CONTEXT ===\nThe following information describes the application's domain, features, workflows, and terminology. Use this context to generate more accurate, domain-specific test documentation:\n\n${domainContext}\n\n=== END DOMAIN CONTEXT ===\n`;
    }

    prompt += `\nTest Name: ${testName}\n\nTest Description/Requirements:\n${description}`;

    if (bulletPoints && bulletPoints.trim()) {
      prompt += `\n\nAdditional Context/Bullet Points:\n${bulletPoints}`;
    }

    prompt += `\n\nPlease provide:\n\n1. A narrative description (2-3 sentences) explaining what business scenario this test validates. Focus on the user perspective and business value.`;

    if (domainContext) {
      prompt += ` Use the domain context provided above to ensure the description uses correct domain terminology and reflects actual user workflows.`;
    }

    prompt += `\n\n2. Detailed test steps in the format of Action and Expected Result pairs. Each step should be clear and testable. Include steps for setup, execution, and verification.`;

    if (domainContext) {
      prompt += ` Reference the domain context to ensure steps align with actual application workflows and use proper domain terminology.`;
    }

    prompt += `\n\nReturn your response in this exact JSON format:\n{\n  "description": "Your narrative description here",\n  "steps": [\n    {\n      "action": "Action description",\n      "expectedResult": "Expected result description"\n    }\n  ]\n}\n\nImportant guidelines:\n- Make the description business-focused and user-centric`;

    if (domainContext) {
      prompt += `\n- Use domain-specific terminology from the context provided above`;
      prompt += `\n- Ensure test steps reflect actual user journeys and workflows described in the context`;
    }

    prompt += `\n- Steps should be clear enough for manual testing\n- Include verification steps based on the requirements provided\n- Keep technical jargon minimal in the description\n- Number of steps should match the logical flow of the test (typically 3-10 steps)\n- Each step should be actionable and testable`;

    try {
      console.log(`Generating manual test steps for: ${testName}`);
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a QA documentation expert who creates clear, comprehensive test documentation from manual test descriptions. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      console.log(`OpenAI response for manual test ${testName}:`, content);
      
      try {
        const parsedContent = JSON.parse(content);
        return parsedContent;
      } catch (parseError) {
        console.error(`JSON parse error for manual test ${testName}:`, parseError);
        console.error(`Raw content:`, content);
        
        return {
          description: `Manual test case: ${testName}. ${description}`,
          steps: [
            {
              action: "Review the test requirements",
              expectedResult: "Requirements are understood"
            },
            {
              action: "Execute the test scenario",
              expectedResult: "Test scenario is executed as described"
            },
            {
              action: "Verify the results",
              expectedResult: "Results match expected outcomes"
            }
          ]
        };
      }
    } catch (error) {
      console.error(`Error generating manual test steps for ${testName}:`, error);
      
      if (error.response) {
        console.error('OpenAI API Error Status:', error.response.status);
        console.error('OpenAI API Error Data:', error.response.data);
      }
      
      return {
        description: `Manual test case: ${testName}. ${description}`,
        steps: [
          {
            action: "Review the test requirements",
            expectedResult: "Requirements are understood"
          },
          {
            action: "Execute the test scenario",
            expectedResult: "Test scenario is executed as described"
          },
          {
            action: "Verify the results",
            expectedResult: "Results match expected outcomes"
          }
        ]
      };
    }
  }
}

module.exports = OpenAIService;