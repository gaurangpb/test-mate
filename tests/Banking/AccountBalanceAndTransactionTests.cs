using NUnit.Framework;
using System;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.Banking
{
    [TestFixture(Browser.Chrome)]
    public class AccountBalanceAndTransactionTests(Browser browser)
    {
        private Browser currentBrowser = browser;
        private BankingPage bankingPage;

        [SetUp]
        public void SetUp()
        {
            bankingPage = new BankingPage(currentBrowser);
        }

        [Test, HUST]
        public async Task ViewAccountBalanceAndRecentTransactions()
        {
            bankingPage.NavigateTo();
            bankingPage.Login("testuser", "password123");
            bankingPage.NavigateToAccounts();

            var checkingBalance = bankingPage.GetAccountBalance("CHECKING");
            var savingsBalance = bankingPage.GetAccountBalance("SAVINGS");

            Assert.That(checkingBalance, Is.GreaterThan(0), "Checking account should have a balance");
            Assert.That(savingsBalance, Is.GreaterThan(0), "Savings account should have a balance");

            bankingPage.ViewRecentTransactions("CHECKING");
            var transactionCount = bankingPage.GetTransactionCount();
            Assert.That(transactionCount, Is.GreaterThan(0), "Should display recent transactions");
        }

        [Test, HUST]
        public async Task FilterTransactionsByDateRange()
        {
            bankingPage.NavigateTo();
            bankingPage.Login("testuser", "password123");
            bankingPage.NavigateToAccounts();
            bankingPage.SelectAccount("CHECKING");
            bankingPage.ViewTransactionHistory();

            var startDate = DateTime.Now.AddDays(-30);
            var endDate = DateTime.Now;
            bankingPage.FilterTransactionsByDateRange(startDate, endDate);

            var filteredTransactions = bankingPage.GetFilteredTransactions();
            Assert.That(filteredTransactions.Count, Is.GreaterThan(0), "Should display filtered transactions");
            Assert.That(bankingPage.AreTransactionsInDateRange(startDate, endDate), Is.True, "All transactions should be within date range");
        }

        [Property("ADOTestCaseId", "1185073")]
        [Test, HUST]
        public async Task ExportTransactionHistoryToPdf()
        {
            bankingPage.NavigateTo();
            bankingPage.Login("testuser", "password123");
            bankingPage.NavigateToAccounts();
            bankingPage.SelectAccount("SAVINGS");
            bankingPage.ViewTransactionHistory();

            var exportPath = bankingPage.ExportTransactionsToPdf("SAVINGS");
            Assert.That(bankingPage.IsFileDownloaded(exportPath), Is.True, "PDF export should be downloaded");
            Assert.That(bankingPage.IsPdfValid(exportPath), Is.True, "PDF should be valid");
        }

        [Test, HUST]
        public async Task ViewAccountStatementForCurrentMonth()
        {
            bankingPage.NavigateTo();
            bankingPage.Login("testuser", "password123");
            bankingPage.NavigateToStatements();
            bankingPage.SelectAccount("CHECKING");
            bankingPage.SelectStatementPeriod("CURRENT_MONTH");

            var statementData = bankingPage.GetStatementData();
            Assert.That(statementData, Is.Not.Null, "Statement data should be available");
            Assert.That(bankingPage.IsStatementDisplayed(), Is.True, "Statement should be displayed");
            Assert.That(bankingPage.GetStatementBalance(), Is.GreaterThan(0), "Statement should show account balance");
        }

        [TearDown]
        public void TearDown()
        {
            bankingPage?.Close();
        }
    }

    public enum Browser
    {
        Chrome,
        Firefox,
        Edge,
        Safari
    }

    public class BankingPage
    {
        private Browser browser;

        public BankingPage(Browser browser)
        {
            this.browser = browser;
        }

        public void NavigateTo() { }
        public void Login(string username, string password) { }
        public void NavigateToAccounts() { }
        public decimal GetAccountBalance(string accountType) => 1000.00m;
        public void ViewRecentTransactions(string accountType) { }
        public int GetTransactionCount() => 10;
        public void SelectAccount(string accountType) { }
        public void ViewTransactionHistory() { }
        public void FilterTransactionsByDateRange(DateTime startDate, DateTime endDate) { }
        public System.Collections.Generic.List<object> GetFilteredTransactions() => new System.Collections.Generic.List<object>();
        public bool AreTransactionsInDateRange(DateTime startDate, DateTime endDate) => true;
        public string ExportTransactionsToPdf(string accountType) => "export.pdf";
        public bool IsFileDownloaded(string filePath) => true;
        public bool IsPdfValid(string filePath) => true;
        public void NavigateToStatements() { }
        public void SelectStatementPeriod(string period) { }
        public object GetStatementData() => new object();
        public bool IsStatementDisplayed() => true;
        public decimal GetStatementBalance() => 1000.00m;
        public void Close() { }
    }
}

