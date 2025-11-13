# ABC Credit Union - Domain Context

## Domain Terminology
- **Account Balance**: The amount of money available in a bank account. (GetAccountBalance)
- **Recent Transactions**: The latest transactions made on an account. (ViewRecentTransactions)
- **Transaction History**: A record of all transactions made in a specified account. (ViewTransactionHistory)
- **Payee**: An entity to whom a payment is made. (AddNewPayee, SelectPayee)
- **Scheduled Payment**: A payment that is set to occur at a specified future date. (CancelScheduledPayment, IsPaymentScheduled)
- **Loan Application**: A request for a loan submitted by a borrower. (ApplyForPersonalLoan, CheckLoanApplicationStatus)
- **Transfer Funds**: The act of moving money from one account to another. (TransferFundsBetweenOwnAccounts, TransferToExternalAccount)
- **Recurring Payment**: A payment that is scheduled to occur regularly over a specified period. (ScheduleRecurringBillPayment)
- **Document Upload**: The process of submitting necessary documents for verification. (UploadRequiredDocumentsForLoan)

## User Journeys and Workflows
- **View Account Balance and Recent Transactions**: User logs in and views the balance and recent transactions of their accounts.  
  Steps: Navigate to banking page, Login, Navigate to accounts, Get account balance, View recent transactions.  
  Test Evidence: ViewAccountBalanceAndRecentTransactions

- **Filter Transactions by Date Range**: User filters transaction history based on a specified date range.  
  Steps: Login, Navigate to accounts, Select account, Filter transactions by date range.  
  Test Evidence: FilterTransactionsByDateRange

- **Export Transaction History**: User exports transaction history to a PDF file.  
  Steps: Login, Navigate to accounts, Select account, Export transactions to PDF.  
  Test Evidence: ExportTransactionHistoryToPdf

- **Add New Payee and Make Payment**: User adds a new payee and schedules a payment.  
  Steps: Login, Navigate to bill pay, Add new payee, Confirm payee addition, Schedule payment.  
  Test Evidence: AddNewPayeeAndMakePayment

- **Apply for Personal Loan**: User applies for a personal loan by providing necessary information.  
  Steps: Login, Navigate to loans, Select loan type, Enter loan details, Submit application.  
  Test Evidence: ApplyForPersonalLoan

- **Transfer Funds Between Accounts**: User transfers funds between their own accounts.  
  Steps: Login, Navigate to transfers, Select from and to accounts, Enter transfer amount, Submit transfer.  
  Test Evidence: TransferFundsBetweenOwnAccounts

## Core Features and Modules
- **Account Management**: Allows users to view account balances and recent transactions.  
  Test Evidence: ViewAccountBalanceAndRecentTransactions

- **Transaction Filtering**: Enables users to filter transaction history by date range.  
  Test Evidence: FilterTransactionsByDateRange

- **Transaction Export**: Allows users to export transaction history to a PDF format.  
  Test Evidence: ExportTransactionHistoryToPdf

- **Bill Payment**: Enables users to add payees and schedule payments.  
  Test Evidence: AddNewPayeeAndMakePayment

- **Loan Application Processing**: Facilitates the application process for personal loans.  
  Test Evidence: ApplyForPersonalLoan

- **Funds Transfer**: Allows users to transfer funds between accounts or to external accounts.  
  Test Evidence: TransferFundsBetweenOwnAccounts, TransferToExternalAccount

## Business Rules and Constraints
- Account balances must be greater than zero for viewing.  
  Test Evidence: ViewAccountBalanceAndRecentTransactions

- Filtered transactions must be within the specified date range.  
  Test Evidence: FilterTransactionsByDateRange

- Payments must be confirmed before scheduling.  
  Test Evidence: AddNewPayeeAndMakePayment

- Loan applications must include all required information.  
  Test Evidence: ApplyForPersonalLoan

- Transfer amounts must not exceed available balance.  
  Test Evidence: TransferFundsBetweenOwnAccounts