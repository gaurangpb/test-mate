# Domain Context Template

This file contains application domain knowledge, terminology, workflows, and user journeys that will help AI generate more accurate, domain-specific test documentation.

## Application Overview

**Application Name:** [Your Application Name]

**Application Type:** [e.g., E-commerce Platform, Banking System, Healthcare Management System]

**Primary Purpose:** [Brief description of what the application does]

---

## Domain Terminology

### Key Terms and Concepts

- **Term 1:** Definition and usage context
- **Term 2:** Definition and usage context
- **Term 3:** Definition and usage context

### Business Entities

- **Entity 1:** Description (e.g., "Order", "Customer", "Transaction")
- **Entity 2:** Description
- **Entity 3:** Description

### Status Values

- **Status 1:** Meaning and when it occurs
- **Status 2:** Meaning and when it occurs
- **Status 3:** Meaning and when it occurs

---

## Core Features and Modules

### Feature 1: [Feature Name]
- **Description:** What this feature does
- **Key Actions:** List of main actions users can perform
- **Business Rules:** Important rules or constraints

### Feature 2: [Feature Name]
- **Description:** What this feature does
- **Key Actions:** List of main actions users can perform
- **Business Rules:** Important rules or constraints

### Feature 3: [Feature Name]
- **Description:** What this feature does
- **Key Actions:** List of main actions users can perform
- **Business Rules:** Important rules or constraints

---

## User Journeys and Workflows

### Journey 1: [Journey Name]
**Description:** High-level description of this user journey

**Steps:**
1. User action/step
2. System response/state change
3. User action/step
4. Expected outcome

**Example:** "User logs in → Dashboard loads → User selects product → Product details displayed → User adds to cart → Cart updated"

### Journey 2: [Journey Name]
**Description:** High-level description of this user journey

**Steps:**
1. User action/step
2. System response/state change
3. User action/step
4. Expected outcome

---

## Business Rules and Constraints

### Rule 1: [Rule Name]
- **Description:** What the rule is
- **When it applies:** When this rule is enforced
- **Impact:** What happens when rule is violated

### Rule 2: [Rule Name]
- **Description:** What the rule is
- **When it applies:** When this rule is enforced
- **Impact:** What happens when rule is violated

---

## Integration Points

### External System 1: [System Name]
- **Purpose:** What this integration does
- **Data Flow:** How data flows between systems
- **Key Operations:** Main operations performed

### External System 2: [System Name]
- **Purpose:** What this integration does
- **Data Flow:** How data flows between systems
- **Key Operations:** Main operations performed

---

## Common User Roles

### Role 1: [Role Name]
- **Permissions:** What this role can do
- **Typical Tasks:** Common tasks performed by this role
- **Access Level:** What parts of the system they can access

### Role 2: [Role Name]
- **Permissions:** What this role can do
- **Typical Tasks:** Common tasks performed by this role
- **Access Level:** What parts of the system they can access

---

## Test-Specific Context

### Authentication & Authorization
- How users authenticate
- Session management approach
- Authorization levels and permissions

### Data Management
- How data is stored and retrieved
- Key data transformations
- Data validation rules

### Error Handling
- Common error scenarios
- How errors are presented to users
- Error recovery mechanisms

---

## Notes for Test Documentation Generation

- Use these specific terms when describing test steps
- Reference these workflows when documenting test scenarios
- Consider these business rules when validating expected results
- Use these user roles when describing who performs actions

---

## Example Domain Context (E-commerce)

### Domain Terminology
- **SKU:** Stock Keeping Unit - unique identifier for products
- **Cart:** Shopping cart containing selected items
- **Checkout:** Process of completing a purchase
- **Order:** Confirmed purchase transaction

### User Journey: Product Purchase
1. User browses products
2. User selects product and adds to cart
3. User reviews cart items
4. User proceeds to checkout
5. User enters shipping information
6. User selects payment method
7. User confirms order
8. Order is processed and confirmation shown

### Business Rules
- Orders cannot be cancelled after shipping
- Minimum order value: $10
- Free shipping on orders over $50
- Payment required within 24 hours or order is cancelled

---

## Tips for Creating Your Domain Context

1. **Start Simple:** Begin with key terminology and main workflows
2. **Be Specific:** Use actual terms from your application, not generic ones
3. **Include Examples:** Real examples help AI understand better
4. **Update Regularly:** Keep context file updated as application evolves
5. **Focus on Business Value:** Emphasize what matters to end users

