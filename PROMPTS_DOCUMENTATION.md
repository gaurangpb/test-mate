# TestMate Prompts Documentation

This document describes the prompts used by TestMate for generating test documentation and updating domain context.

---

## 1. Generating Test Steps from Code

### Purpose

Converts automated test code into human-readable test documentation with steps and expected results.

### Endpoint

`POST /api/generate`

### Prompt Structure

The prompt is built dynamically based on whether domain context is provided:

#### Base Prompt (Always Included)

```
You are a QA documentation expert. Analyze this automated test code and generate comprehensive test documentation.

Test Method Name: {test.name}

Test Code:
```

```csharp
{test.code}
```

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
- Number of steps should match the logical flow of the test (typically 3-7 steps)

```

```

#### With Domain Context (If Provided)

When a `domainContextPath` is provided, the prompt is enhanced:

```

You are a QA documentation expert. Analyze this automated test code and generate comprehensive test documentation.

=== APPLICATION DOMAIN CONTEXT ===
The following information describes the application's domain, features, workflows, and terminology. Use this context to generate more accurate, domain-specific test documentation:

{domainContext}

=== END DOMAIN CONTEXT ===

Test Method Name: {test.name}

Test Code:

{test.code}
```

Please provide:

1. A narrative description (2-3 sentences) explaining what business scenario this test validates. Focus on the user perspective and business value, not technical implementation details. Use the domain context provided above to ensure the description uses correct domain terminology and reflects actual user workflows.

2. Detailed test steps in the format of Action and Expected Result pairs. Each step should be clear and testable. Include steps for setup, execution, and verification. Reference the domain context to ensure steps align with actual application workflows and use proper domain terminology.

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
- Use domain-specific terminology from the context provided above
- Ensure test steps reflect actual user journeys and workflows described in the context
- Steps should be clear enough for manual testing if needed
- Include verification steps based on assertions in the code
- Keep technical jargon minimal in the description
- Number of steps should match the logical flow of the test (typically 3-7 steps)

```

```

### System Message

```

You are a QA documentation expert who creates clear, comprehensive test documentation from automated test code. Always respond with valid JSON.

```

### API Configuration

- **Model**: `gpt-4o-mini`
- **Temperature**: `0.7`
- **Max Tokens**: `1000`
- **Response Format**: `json_object`

### Context Inclusion

**YES, existing context content IS sent with the code snippet when generating steps.**

- If `domainContextPath` is provided in the request, the entire domain context file is read and included in the prompt
- The context is placed before the test code in a clearly marked section
- The context helps the AI:
  - Use correct domain terminology
  - Align steps with actual user workflows
  - Generate more accurate, business-focused descriptions

### Implementation Location

- **Service**: `src/services/openaiService.js` → `generateDocumentation()` method
- **Route**: `src/routes/generate.js` → `/generate` endpoint

---

## 2. Context Update / Domain Concept Extraction

### Purpose

Analyzes test code to extract domain concepts, terminology, workflows, and features that should be added to the domain context file.

### Endpoint

`POST /api/suggest-context-updates`

### Prompt Structure

The prompt varies based on whether existing context exists:

#### Without Existing Context

```

You are a domain analysis expert. Analyze the following test code samples and extract domain-specific concepts that would be valuable for test documentation generation.

Your task is to identify:

1. **Domain Terminology**: Specialized terms, business entities, status values used in tests
2. **Workflows**: User journeys and business processes reflected in the tests
3. **Features**: Application features and modules being tested
4. **Business Rules**: Constraints, validations, or rules implied by test logic
5. **Relationships**: How different entities or features relate to each other

Test Samples:
{JSON.stringify(testSamples, null, 2)}

Extract all domain concepts that would be useful for creating comprehensive domain context.

IMPORTANT: For the "suggestedContextUpdates" field, generate a COMPLETE domain-context.md file that includes:

1. A "Domain Terminology" section with ALL extracted terminology items as markdown bullet points
2. A "User Journeys and Workflows" section with ALL extracted workflows
3. A "Core Features and Modules" section with ALL extracted features
4. A "Business Rules and Constraints" section with ALL extracted business rules

Return your analysis in this exact JSON format:
{
"newTerminology": [
{
"term": "Term name",
"definition": "What this term means in the domain",
"examples": ["example usage from tests"]
}
],
"newWorkflows": [
{
"name": "Workflow name",
"description": "What this workflow does",
"steps": ["step1", "step2", "step3"],
"testEvidence": ["test names or code snippets that show this workflow"]
}
],
"newFeatures": [
{
"name": "Feature name",
"description": "What this feature does",
"testEvidence": ["test names that test this feature"]
}
],
"businessRules": [
{
"rule": "Rule description",
"testEvidence": ["test names that validate this rule"]
}
],
"suggestedContextUpdates": "COMPLETE formatted markdown file content that includes ALL extracted concepts.",
"confidence": "high|medium|low - confidence in these suggestions"
}

CRITICAL: The "suggestedContextUpdates" field must include ALL terminology, workflows, features, and business rules extracted above. Do not summarize - include everything in properly formatted markdown.

```

#### With Existing Context

```

You are a domain analysis expert. Analyze the following test code samples and extract domain-specific concepts that would be valuable for test documentation generation.

Your task is to identify:

1. **Domain Terminology**: Specialized terms, business entities, status values used in tests
2. **Workflows**: User journeys and business processes reflected in the tests
3. **Features**: Application features and modules being tested
4. **Business Rules**: Constraints, validations, or rules implied by test logic
5. **Relationships**: How different entities or features relate to each other

Test Samples:
{JSON.stringify(testSamples, null, 2)}

=== EXISTING DOMAIN CONTEXT ===
{existingContext (up to 10,000 chars, or truncated with note)}
=== END EXISTING CONTEXT ===

Compare the test code with the existing domain context above. Identify:

- **New Concepts**: Terminology, workflows, or features not in existing context
- **Missing Information**: Details that should be added to existing sections
- **Potential Updates**: Information that might be outdated or incomplete

IMPORTANT: For the "suggestedContextUpdates" field, generate the COMPLETE domain-context.md file content that includes:

1. All existing content from the context above (preserve it)
2. All new terminology items formatted as markdown bullet points in a "Domain Terminology" section
3. All new workflows formatted in a "User Journeys and Workflows" section
4. All new features formatted in a "Core Features and Modules" section
5. All business rules formatted in a "Business Rules and Constraints" section
6. Mark new additions with HTML comments like <!-- NEW --> before new items so they can be easily identified
7. Integrate new content into appropriate existing sections where relevant

Return your analysis in this exact JSON format:
{
"newTerminology": [...],
"newWorkflows": [...],
"newFeatures": [...],
"businessRules": [...],
"suggestedContextUpdates": "COMPLETE formatted markdown file content that includes ALL extracted concepts. If existing context was provided, include the full file with new content integrated and marked with <!-- NEW --> comments.",
"confidence": "high|medium|low - confidence in these suggestions"
}

CRITICAL: The "suggestedContextUpdates" field must include ALL terminology, workflows, features, and business rules extracted above. Do not summarize - include everything in properly formatted markdown.

```

### System Message

```

You are a domain analysis expert who extracts business concepts from test code. Always respond with valid JSON. Focus on domain-specific terminology and workflows that would help generate better test documentation.

```

### API Configuration

- **Model**: `gpt-4o-mini`
- **Temperature**: `0.5` (lower for more consistent extraction)
- **Max Tokens**: `4000` (increased to allow comprehensive context updates)
- **Response Format**: `json_object`

### Context Inclusion

**YES, existing context content IS sent with the test code when extracting domain concepts.**

- The system automatically looks for `domain-context.md` in the repository root
- If found, the existing context is loaded and included in the prompt
- **Context Truncation**: If the context is larger than 10,000 characters, only the first 10,000 characters are included with a note: `[... existing context continues ...]`
- The AI is instructed to:
  - Compare test code with existing context
  - Identify new concepts not in the context
  - Generate a complete updated context file that preserves existing content and adds new items

### Test Code Processing

- Up to 20 test methods are analyzed per request
- Each test code sample is limited to 2,000 characters
- Test methods are extracted from selected files using pattern matching for `[Test]` attributes

### Implementation Location

- **Service**: `src/services/openaiService.js` → `extractDomainConcepts()` method
- **Route**: `src/routes/generate.js` → `/suggest-context-updates` endpoint

---

## Summary

### Context Inclusion in Step Generation

✅ **YES** - When `domainContextPath` is provided, the entire domain context file is included in the prompt before the test code.

### Context Inclusion in Context Updates

✅ **YES** - If `domain-context.md` exists in the repository root, it is automatically loaded and included (up to 10,000 characters) in the prompt for comparison and merging.

### Key Differences

| Feature               | Step Generation                          | Context Updates                       |
| --------------------- | ---------------------------------------- | ------------------------------------- |
| **Primary Input**     | Single test code snippet                 | Multiple test code samples (up to 20) |
| **Context Inclusion** | Full context (if provided)               | Up to 10,000 chars (if exists)        |
| **Context Source**    | User-provided path                       | Auto-detected from repo root          |
| **Purpose**           | Generate test steps                      | Extract domain concepts               |
| **Output**            | Test documentation (description + steps) | Domain context suggestions            |
| **Temperature**       | 0.7 (more creative)                      | 0.5 (more consistent)                 |
| **Max Tokens**        | 1000                                     | 4000                                  |

---

## Notes

- Both prompts use the `gpt-4o-mini` model for cost efficiency
- Both require JSON responses with structured formats
- Domain context significantly improves the quality of generated documentation
- Context updates preserve existing content and mark new additions with HTML comments
- The system gracefully handles missing context files (continues without failing)

```

```
