# **ABC Credit Union – Domain Context**

---

## **Domain Terminology**

| Term                     | Description                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Account Balance**      | The amount of money available in a user’s account.                                  |
| **Compliance Status**    | The current state of adherence to regulatory requirements.                          |
| **Transfer Funds**       | The process of moving money from one account to another.                            |
| **eStatements**          | Electronic statements summarizing account activity.                                 |
| **Travel Notifications** | Alerts submitted by users to notify the bank of travel plans to avoid fraud alerts. |

| **Payment Processing**    | The handling of transactions involving the transfer of funds through various methods.|
| **Refund**               | The process of returning funds to a user for a previously completed transaction.    |
| **Ping**                 | A simple request sent to a service to check its availability or responsiveness.      |
| **Compliance Status**     | The state of adherence to regulatory requirements related to financial transactions.  |

---

## **User Journeys & Workflows**

### **1. Account Management Workflow**

Covers all operations related to managing user accounts — including balance inquiries, fund transfers, and account details retrieval.

### **2. Regulatory Compliance Workflow**

Ensures all accounts and transactions adhere to compliance regulations. Involves periodic status checks and validation.

### **3. Payment Processing Workflow**

Covers the process of initiating, processing, and managing payments and refunds.

- User initiates a payment request with amount and payment method.
- System processes the payment through the payment API.
- User can request a refund for a completed transaction.

### **4. Online Banking User Journey**

A complete journey for customers interacting with digital banking services — from login to account monitoring, fund transfers, and alerts.

---

## **Core Features & Modules**

| Module                        | Description                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Account Management API**    | Provides endpoints to manage accounts, perform balance checks, and execute fund transfers.                  |
| **Regulatory Compliance API** | Exposes services for checking and verifying compliance status.                                              |
| **Payment Processing API**    | Provides endpoints for processing payments and refunds.                                                    |
| **Online Banking Features**   | Enables users to manage their finances digitally, including access to eStatements and travel notifications. |

---

## **Business Rules & Constraints**

1. **Account Balance Retrieval** must succeed for valid account IDs.
2. **Compliance Status Check** must return success for valid accounts.
3. **Fund Transfers** must complete successfully for valid source and destination accounts with sufficient balance.
4. **Password Reset** must be successful when valid credentials or recovery details are provided.
5. **Travel Notifications** must be accepted only when submitted with valid parameters.

6. **Payment requests must succeed with valid payment details.**
7. **Refund requests must succeed for valid transaction IDs and amounts.**
8. **Ping requests must return success for available services.**
9. **Compliance status retrieval must return success for valid requests.**

### **3. Credit Card Processing Workflow**

The process of handling credit card transactions for both members and non-members.

- User submits credit card details and transaction amount.
- System processes the payment through the payment API.
- System returns a success or failure response based on the transaction validity.

### **4. Password Management Workflow**

Handles user actions related to password management including reset.

### **5. eStatement Access Workflow**

Allows users to view their electronic statements.

### **6. Travel Notification Submission Workflow**

Enables users to submit travel notifications to the bank.

### **7. Payment Processing Workflow**

Covers the process of initiating and completing payments.

### **8. API Configuration Workflow**

Manages the configuration and status verification of the OpenAI client.

---