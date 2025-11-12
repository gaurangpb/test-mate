using NUnit.Framework;
using System;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.Banking
{
    [TestFixture(Browser.Chrome)]
    public class LoanApplicationTests(Browser browser)
    {
        private Browser currentBrowser = browser;
        private LoanApplicationPage loanPage;

        [SetUp]
        public void SetUp()
        {
            loanPage = new LoanApplicationPage(currentBrowser);
        }

        [Test, HUST]
        public async Task ApplyForPersonalLoan()
        {
            loanPage.NavigateTo();
            loanPage.Login("testuser", "password123");
            loanPage.NavigateToLoans();
            loanPage.SelectLoanType("PERSONAL");

            loanPage.EnterLoanAmount(10000.00m);
            loanPage.SelectLoanPurpose("DEBT_CONSOLIDATION");
            loanPage.EnterEmploymentInformation("Software Developer", "Tech Corp", 5);
            loanPage.EnterAnnualIncome(75000.00m);
            loanPage.EnterMonthlyExpenses(2500.00m);
            loanPage.SelectRepaymentTerm(36);
            loanPage.SubmitApplication();

            Assert.That(loanPage.IsApplicationSubmitted(), Is.True, "Loan application should be submitted");
            Assert.That(loanPage.GetApplicationReferenceNumber(), Is.Not.Empty, "Should receive application reference number");
        }

        [Property("ADOTestCaseId", "100014")]
        [Test, HUST]
        public async Task CheckLoanApplicationStatus()
        {
            loanPage.NavigateTo();
            loanPage.Login("testuser", "password123");
            loanPage.NavigateToLoans();
            loanPage.ViewMyApplications();

            var applicationId = loanPage.GetMostRecentApplicationId();
            loanPage.SelectApplication(applicationId);
            loanPage.ViewApplicationStatus();

            var status = loanPage.GetApplicationStatus();
            Assert.That(status, Is.Not.Empty, "Should display application status");
            Assert.That(loanPage.IsStatusDetailsAvailable(), Is.True, "Status details should be available");

            if (status == "APPROVED")
            {
                var approvedAmount = loanPage.GetApprovedLoanAmount();
                var interestRate = loanPage.GetInterestRate();
                Assert.That(approvedAmount, Is.GreaterThan(0), "Approved amount should be greater than zero");
                Assert.That(interestRate, Is.GreaterThan(0), "Interest rate should be displayed");
            }
        }

        [Property("ADOTestCaseId", "100015")]
        [Test, HUST]
        public async Task CalculateLoanPaymentEstimate()
        {
            loanPage.NavigateTo();
            loanPage.Login("testuser", "password123");
            loanPage.NavigateToLoans();
            loanPage.OpenLoanCalculator();

            loanPage.EnterCalculatorLoanAmount(20000.00m);
            loanPage.SelectLoanTerm(60);
            loanPage.EnterEstimatedInterestRate(6.5m);
            loanPage.CalculatePayment();

            var monthlyPayment = loanPage.GetEstimatedMonthlyPayment();
            var totalInterest = loanPage.GetTotalInterest();
            var totalAmount = loanPage.GetTotalLoanAmount();

            Assert.That(monthlyPayment, Is.GreaterThan(0), "Monthly payment should be calculated");
            Assert.That(totalInterest, Is.GreaterThan(0), "Total interest should be calculated");
            Assert.That(totalAmount, Is.EqualTo(20000.00m + totalInterest), "Total amount should equal principal plus interest");
        }

        [Test, HUST]
        public async Task UploadRequiredDocumentsForLoan()
        {
            loanPage.NavigateTo();
            loanPage.Login("testuser", "password123");
            loanPage.NavigateToLoans();
            loanPage.ViewMyApplications();

            var applicationId = loanPage.GetApplicationRequiringDocuments();
            loanPage.SelectApplication(applicationId);
            loanPage.NavigateToDocuments();

            loanPage.UploadDocument("PAY_STUB", "paystub.pdf");
            loanPage.UploadDocument("TAX_RETURN", "taxreturn.pdf");
            loanPage.UploadDocument("BANK_STATEMENT", "statement.pdf");
            loanPage.SubmitDocuments();

            Assert.That(loanPage.AreDocumentsUploaded(), Is.True, "Documents should be uploaded");
            Assert.That(loanPage.GetDocumentUploadConfirmation(), Is.Not.Empty, "Should receive upload confirmation");
        }

        [TearDown]
        public void TearDown()
        {
            loanPage?.Close();
        }
    }

    public class LoanApplicationPage
    {
        private Browser browser;

        public LoanApplicationPage(Browser browser)
        {
            this.browser = browser;
        }

        public void NavigateTo() { }
        public void Login(string username, string password) { }
        public void NavigateToLoans() { }
        public void SelectLoanType(string loanType) { }
        public void EnterLoanAmount(decimal amount) { }
        public void SelectLoanPurpose(string purpose) { }
        public void EnterEmploymentInformation(string jobTitle, string employer, int yearsEmployed) { }
        public void EnterAnnualIncome(decimal income) { }
        public void EnterMonthlyExpenses(decimal expenses) { }
        public void SelectRepaymentTerm(int months) { }
        public void SubmitApplication() { }
        public bool IsApplicationSubmitted() => true;
        public string GetApplicationReferenceNumber() => "LOAN123456";
        public void ViewMyApplications() { }
        public string GetMostRecentApplicationId() => "APP001";
        public void SelectApplication(string applicationId) { }
        public void ViewApplicationStatus() { }
        public string GetApplicationStatus() => "UNDER_REVIEW";
        public bool IsStatusDetailsAvailable() => true;
        public decimal GetApprovedLoanAmount() => 10000.00m;
        public decimal GetInterestRate() => 5.5m;
        public void OpenLoanCalculator() { }
        public void EnterCalculatorLoanAmount(decimal amount) { }
        public void SelectLoanTerm(int months) { }
        public void EnterEstimatedInterestRate(decimal rate) { }
        public void CalculatePayment() { }
        public decimal GetEstimatedMonthlyPayment() => 390.00m;
        public decimal GetTotalInterest() => 3400.00m;
        public decimal GetTotalLoanAmount() => 23400.00m;
        public string GetApplicationRequiringDocuments() => "APP002";
        public void NavigateToDocuments() { }
        public void UploadDocument(string documentType, string filePath) { }
        public void SubmitDocuments() { }
        public bool AreDocumentsUploaded() => true;
        public string GetDocumentUploadConfirmation() => "Documents uploaded successfully";
        public void Close() { }
    }
}

