# Domain Context Generator Prompt

Use this prompt with any AI assistant (GPT-4, Claude, etc.) to generate a comprehensive domain-context.md file for your test repository.

---

## The Prompt

```
I need you to analyze my test repository and create a comprehensive domain-context.md file that will help AI generate better, more accurate test documentation. This domain context file will be used by TestMate (or similar tools) to understand the business domain, terminology, workflows, and features of the application being tested.

Please analyze the provided test repository and create a domain-context.md file following this structure:

## Required Information to Provide

**Before using this prompt, please provide:**
1. **Repository structure** (file/folder listing of your test repo)
2. **Sample test files** (2-3 representative test files with actual code)
3. **Application type** (e.g., "E-commerce platform", "Banking system", "Healthcare app")
4. **Brief application description** (1-2 sentences about what the app does)

## Domain Context File Structure

Create a domain-context.md file with these sections:

### 1. Application Overview
- Application name and type
- Primary purpose and core functionality
- Target users/audience

### 2. Domain Terminology
- **Key Terms:** Domain-specific terms used throughout the application
- **Business Entities:** Core objects/entities (Customer, Order, Transaction, etc.)
- **Status Values:** Important status indicators and their meanings
- **Technical Terms:** Application-specific technical terminology

### 3. Core Features and Modules
For each major feature/module:
- Description of what it does
- Key user actions available
- Important business rules and constraints
- Integration points with other features

### 4. User Journeys and Workflows
- **Primary Workflows:** Most common user paths through the application
- **Secondary Workflows:** Less common but important user journeys
- **Edge Case Scenarios:** Important edge cases that tests cover
- **Step-by-step descriptions** with expected system responses

### 5. Business Rules and Constraints
- Validation rules
- Authorization/permission rules
- Data constraints
- Process constraints
- Error conditions and handling

### 6. Integration Points
- External systems the application integrates with
- Data flow between systems
- Key operations performed with external systems
- Authentication/authorization with external systems

### 7. User Roles and Permissions
- Different user types/roles in the system
- What each role can and cannot do
- Access levels and restrictions
- Role-specific workflows

### 8. Test-Specific Context
- Authentication patterns used in tests
- Common test data patterns
- Error scenarios frequently tested
- Performance/load testing considerations
- Security testing aspects

### 9. Notes for Test Documentation Generation
- Preferred terminology for test documentation
- Business language vs technical language preferences
- Important context for interpreting test results
- Domain-specific success criteria

## Analysis Instructions

**Based on the test files provided, please:**

1. **Extract Domain Knowledge:**
   - Identify business terms used in test names and code
   - Recognize user workflows implied by test sequences
   - Understand features being tested
   - Identify business rules from test assertions

2. **Infer Application Structure:**
   - Determine main application modules from test organization
   - Understand user roles from test scenarios
   - Identify external integrations from test setup
   - Recognize data models from test data

3. **Generate Comprehensive Context:**
   - Use specific terminology found in tests
   - Create realistic workflows based on test scenarios
   - Document business rules based on test validations
   - Include edge cases covered by tests

4. **Optimize for Documentation Generation:**
   - Focus on information that will help AI understand business context
   - Use language that bridges technical implementation and business value
   - Provide enough detail for accurate test documentation
   - Include examples that clarify abstract concepts

## Output Format

Please provide the domain-context.md file in proper Markdown format, ready to save and use. Include:
- Clear section headers
- Bullet points and numbered lists where appropriate
- **Bold** emphasis for key terms
- Code examples where relevant
- Realistic examples based on the test code provided

## Quality Guidelines

The generated domain context should be:
- **Specific:** Use actual terms from the test code, not generic placeholders
- **Complete:** Cover all major features/modules evident in tests
- **Business-focused:** Emphasize user value and business logic
- **Actionable:** Provide concrete information AI can use for documentation
- **Maintainable:** Organized in a way that's easy to update

---

## Example Usage

1. **Gather Information:**
   ```
   Repository: MyEcommerceTests
   Structure: [paste your test folder structure]
   Sample Tests: [paste 2-3 representative test files]
   App Type: E-commerce platform
   Description: Online retail platform for electronics
   ```

2. **Run the Prompt:** Use this prompt with the gathered information

3. **Review Output:** Check the generated domain-context.md for accuracy

4. **Refine:** Add any missing business knowledge not evident in test code

5. **Use:** Save as domain-context.md and use with TestMate or similar tools

---

## Tips for Better Results

### Before Running the Prompt:
- Choose representative test files that cover major features
- Include tests with clear business scenarios
- Provide test files with descriptive names and comments
- Include both positive and negative test cases

### Information to Include:
- Test folder structure showing feature organization
- Test class names that indicate modules/features
- Test method names that suggest user workflows
- Any configuration files or test data that reveal business rules

### After Generation:
- Review for accuracy against your actual application
- Add any business context not evident in test code
- Remove or correct any AI assumptions that are wrong
- Consider having domain experts review the context

---

## Benefits of Using This Prompt

1. **Automated Discovery:** Finds domain concepts you might miss manually
2. **Test-Code Alignment:** Ensures context matches what's actually tested
3. **Comprehensive Coverage:** Analyzes all provided test files systematically  
4. **Consistent Structure:** Follows proven template for domain context
5. **Ready to Use:** Generates properly formatted Markdown file
6. **Maintenance Helper:** Can be re-run when tests change significantly

Remember: The generated domain context is a starting point. Always review and enhance it with your domain expertise!
```

---

## Quick Start Checklist

- [ ] Gather test repository structure
- [ ] Select 2-3 representative test files
- [ ] Note application type and purpose
- [ ] Run the prompt with this information
- [ ] Review and refine the generated context
- [ ] Save as `domain-context.md`
- [ ] Test with TestMate documentation generation
- [ ] Iterate and improve based on results

---

*This prompt is designed to work with TestMate's domain context feature but can be adapted for other test documentation tools.*