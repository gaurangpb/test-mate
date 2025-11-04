# Domain Context Suggestions Feature

## Overview

The Domain Context Suggestions feature creates a **bidirectional flow** between your test code and domain context file. It analyzes your test code to identify new domain concepts, terminology, workflows, and features that could be added to your domain context file.

This addresses one of the main challenges with domain context files: **maintenance overhead**. Instead of manually maintaining the context file, TestMate can now suggest updates based on your actual test code.

---

## How It Works

1. **Test Analysis**: Scans your test repository and extracts test code
2. **AI Analysis**: Uses OpenAI to analyze test code and identify domain concepts
3. **Comparison**: Compares findings with existing domain context (if provided)
4. **Suggestions**: Provides structured suggestions for:
   - New terminology
   - New workflows
   - New features
   - Business rules
   - Formatted context updates

---

## Usage

### In the UI

1. Navigate to the **Configuration** tab
2. Enter your repository path
3. (Optional) Enter path to existing domain context file
4. Click **"Suggest Context Updates"** button
5. Review suggestions displayed below
6. Manually copy suggestions into your domain context file

### API Endpoint

```bash
POST /api/suggest-context-updates
```

**Request:**
```json
{
  "repoPath": "C:\\Projects\\MyTests",
  "domainContextPath": "C:\\Projects\\domain-context.md",  // Optional
  "testPropertyName": "TestCaseId",
  "limit": 50  // Max number of test files to analyze
}
```

**Response:**
```json
{
  "suggestions": {
    "newTerminology": [
      {
        "term": "Order Status",
        "definition": "Status of an order in the system",
        "examples": ["Pending", "Processing", "Shipped"]
      }
    ],
    "newWorkflows": [
      {
        "name": "Order Fulfillment",
        "description": "Process of fulfilling a customer order",
        "steps": ["Receive order", "Validate inventory", "Process payment", "Ship order"],
        "testEvidence": ["TestOrderFulfillment", "TestOrderProcessing"]
      }
    ],
    "newFeatures": [
      {
        "name": "Payment Processing",
        "description": "Feature for processing customer payments",
        "testEvidence": ["TestPaymentGateway", "TestPaymentValidation"]
      }
    ],
    "businessRules": [
      {
        "rule": "Orders over $100 require manager approval",
        "testEvidence": ["TestOrderApproval", "TestOrderValidation"]
      }
    ],
    "suggestedContextUpdates": "## New Terminology\n\n- **Order Status**: Status of an order...",
    "confidence": "high"
  },
  "analysisSummary": {
    "testsAnalyzed": 45,
    "filesAnalyzed": 12,
    "totalTestFiles": 25,
    "hasExistingContext": true
  }
}
```

---

## Benefits

### 1. **Automatic Discovery**
- Finds new domain concepts as you write tests
- No need to manually track what's missing
- Identifies patterns across multiple tests

### 2. **Reduced Maintenance**
- Suggests updates instead of requiring manual discovery
- Helps keep context file current
- Shows confidence levels for suggestions

### 3. **Better Coverage**
- Analyzes all tests, not just recent ones
- Identifies terminology used across features
- Discovers workflows you might have missed

### 4. **Evidence-Based**
- Each suggestion includes test evidence
- Shows which tests led to each suggestion
- Helps validate suggestions

---

## Workflow

### Recommended Workflow

1. **Initial Setup**: Create basic domain context file manually
2. **Develop Tests**: Write tests for new features
3. **Periodic Analysis**: Run "Suggest Context Updates" monthly/quarterly
4. **Review & Update**: Review suggestions and add valid ones to context file
5. **Iterate**: Repeat as new features are added

### Continuous Improvement Flow

```
┌─────────────────┐
│  Write Tests    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Analyze Tests   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Get Suggestions │─────▶│ Review & Update  │
└────────┬────────┘      │  Context File    │
         │                └────────┬─────────┘
         │                         │
         │                         ▼
         │                ┌──────────────────┐
         │                │ Better Docs      │
         │                │ Generation       │
         │                └──────────────────┘
         │
         └────────────────────────┘
              (Feedback Loop)
```

---

## Understanding Suggestions

### Confidence Levels

- **High**: Strong evidence from multiple tests, clear patterns
- **Medium**: Some evidence, but may need review
- **Low**: Weak evidence, should be carefully reviewed

### What Gets Suggested

1. **Terminology**: Domain-specific terms not in existing context
2. **Workflows**: User journeys implied by test sequences
3. **Features**: Application modules being tested
4. **Business Rules**: Constraints and validations from test logic
5. **Updates**: Formatted markdown ready to add to context file

---

## Best Practices

### 1. **Review Before Adding**
- Don't blindly accept all suggestions
- Verify terminology matches your actual usage
- Check workflows reflect real user journeys

### 2. **Regular Updates**
- Run suggestions monthly or quarterly
- Don't wait until context is completely outdated
- Integrate into your development workflow

### 3. **Combine with Manual Updates**
- Use suggestions as a starting point
- Add domain knowledge that tests don't capture
- Include business context not in code

### 4. **Validate Suggestions**
- Check test evidence provided
- Review multiple tests for consistency
- Ask domain experts for confirmation

### 5. **Iterative Improvement**
- Start with basic context
- Use suggestions to expand
- Refine over time

---

## Limitations

### 1. **Test Code Quality**
- Suggestions depend on test code quality
- Poorly written tests yield poor suggestions
- Tests without clear domain intent are harder to analyze

### 2. **AI Interpretation**
- AI may misinterpret test intent
- Generic test code produces generic suggestions
- Requires human review

### 3. **Context Size**
- Analyzes up to 50 test files by default
- Large repositories may need multiple runs
- Very large context files may be truncated

### 4. **Cost**
- Uses OpenAI API for analysis
- Adds to API costs (similar to documentation generation)
- Consider running periodically, not constantly

---

## Tips for Better Suggestions

### 1. **Write Descriptive Tests**
- Use clear test method names
- Include domain terminology in test names
- Write tests that reflect business scenarios

### 2. **Use Domain Language**
- Use actual business terms in test code
- Avoid generic terms like "item", "thing"
- Reference real entities and workflows

### 3. **Organize Tests by Feature**
- Group related tests together
- Use consistent naming conventions
- Reflect application structure in test structure

### 4. **Include Comments**
- Add comments explaining business rules
- Document why tests exist
- Explain domain-specific logic

---

## Example Scenarios

### Scenario 1: New Feature Added

**Before:**
- Context file doesn't mention "Payment Processing"
- Tests written for payment features

**Action:**
- Run "Suggest Context Updates"
- AI identifies payment terminology and workflows
- Suggestions include payment concepts

**After:**
- Add suggestions to context file
- Future documentation uses correct payment terminology

### Scenario 2: Terminology Evolution

**Before:**
- Context file uses "Order"
- Tests now use "Purchase Order" (PO)

**Action:**
- Run suggestions
- AI identifies "PO" as new terminology
- Suggests adding PO definition

**After:**
- Update context with PO terminology
- Documentation reflects current usage

### Scenario 3: Missing Workflows

**Before:**
- Context file has basic workflows
- Tests show complex multi-step processes

**Action:**
- Run suggestions
- AI identifies complex workflow patterns
- Suggests detailed workflow steps

**After:**
- Add detailed workflows to context
- Documentation reflects actual user journeys

---

## Future Enhancements

Potential improvements:

1. **Auto-Apply Suggestions**: Option to automatically update context file
2. **Diff View**: Show what changed in context file
3. **Version History**: Track context file changes over time
4. **Smart Filtering**: Filter suggestions by confidence or category
5. **Batch Updates**: Apply multiple suggestions at once
6. **Integration**: Hook into CI/CD to suggest updates on test changes

---

## Conclusion

The Domain Context Suggestions feature transforms domain context maintenance from a manual chore into an assisted, data-driven process. By analyzing your actual test code, it helps ensure your domain context file stays current and comprehensive, leading to better test documentation generation.

**Key Takeaway**: Use suggestions as a tool to discover what you might have missed, not as a replacement for domain expertise. Review, validate, and refine suggestions to create the best possible domain context for your application.

