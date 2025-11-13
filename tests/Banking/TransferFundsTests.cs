using NUnit.Framework;
using System;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.Banking
{
    [TestFixture(Browser.Edge)]
    public class TransferFundsTests(Browser browser)
    {
        private Browser currentBrowser = browser;
        private TransferPage transferPage;

        [SetUp]
        public void SetUp()
        {
            transferPage = new TransferPage(currentBrowser);
        }

        [Test, HUST]
        public async Task TransferFundsBetweenOwnAccounts()
        {
            transferPage.NavigateTo();
            transferPage.Login("testuser", "password123");
            transferPage.NavigateToTransfers();

            var fromAccount = "CHECKING";
            var toAccount = "SAVINGS";
            var amount = 250.00m;

            transferPage.SelectFromAccount(fromAccount);
            transferPage.SelectToAccount(toAccount);
            transferPage.EnterTransferAmount(amount);
            transferPage.EnterTransferMemo("Monthly savings transfer");
            transferPage.SubmitTransfer();

            Assert.That(transferPage.IsTransferSuccessful(), Is.True, "Transfer should be successful");
            Assert.That(transferPage.GetConfirmationNumber(), Is.Not.Empty, "Should receive confirmation number");
        }

        [Test, HUST]
        public async Task ScheduleRecurringTransfer()
        {
            transferPage.NavigateTo();
            transferPage.Login("testuser", "password123");
            transferPage.NavigateToTransfers();
            transferPage.SelectTransferType("RECURRING");

            transferPage.SelectFromAccount("CHECKING");
            transferPage.SelectToAccount("SAVINGS");
            transferPage.EnterTransferAmount(500.00m);
            transferPage.SetRecurrenceFrequency("MONTHLY");
            transferPage.SetStartDate(DateTime.Now.AddDays(7));
            transferPage.SetEndDate(DateTime.Now.AddMonths(12));
            transferPage.SubmitTransfer();

            Assert.That(transferPage.IsRecurringTransferScheduled(), Is.True, "Recurring transfer should be scheduled");
            Assert.That(transferPage.GetNextTransferDate(), Is.EqualTo(DateTime.Now.AddDays(7).Date), "Next transfer date should be set correctly");
        }

        [Property("ADOTestCaseId", "100007")]
        [Test, HUST]
        public async Task TransferToExternalAccount()
        {
            transferPage.NavigateTo();
            transferPage.Login("testuser", "password123");
            transferPage.NavigateToTransfers();
            transferPage.SelectTransferType("EXTERNAL");

            transferPage.SelectFromAccount("CHECKING");
            transferPage.EnterExternalAccountDetails("123456789", "987654321", "EXTERNAL_BANK");
            transferPage.EnterTransferAmount(100.00m);
            transferPage.EnterRecipientName("John Doe");
            transferPage.VerifyExternalAccount();
            transferPage.SubmitTransfer();

            Assert.That(transferPage.IsExternalTransferInitiated(), Is.True, "External transfer should be initiated");
            Assert.That(transferPage.GetEstimatedDeliveryDate(), Is.GreaterThan(DateTime.Now), "Should show estimated delivery date");
        }

        [Property("ADOTestCaseId", "100007")]
        [Test, HUST]
        public async Task CancelScheduledTransfer()
        {
            transferPage.NavigateTo();
            transferPage.Login("testuser", "password123");
            transferPage.NavigateToScheduledTransfers();

            var scheduledTransferId = transferPage.GetFirstScheduledTransferId();
            transferPage.SelectScheduledTransfer(scheduledTransferId);
            transferPage.CancelTransfer();

            Assert.That(transferPage.IsTransferCancelled(), Is.True, "Transfer should be cancelled");
            Assert.That(transferPage.GetCancellationConfirmation(), Is.Not.Empty, "Should receive cancellation confirmation");
        }

        [TearDown]
        public void TearDown()
        {
            transferPage?.Close();
        }
    }

    public class TransferPage
    {
        private Browser browser;

        public TransferPage(Browser browser)
        {
            this.browser = browser;
        }

        public void NavigateTo() { }
        public void Login(string username, string password) { }
        public void NavigateToTransfers() { }
        public void SelectTransferType(string transferType) { }
        public void SelectFromAccount(string accountType) { }
        public void SelectToAccount(string accountType) { }
        public void EnterTransferAmount(decimal amount) { }
        public void EnterTransferMemo(string memo) { }
        public void SubmitTransfer() { }
        public bool IsTransferSuccessful() => true;
        public string GetConfirmationNumber() => "CONF123456";
        public void SetRecurrenceFrequency(string frequency) { }
        public void SetStartDate(DateTime date) { }
        public void SetEndDate(DateTime date) { }
        public bool IsRecurringTransferScheduled() => true;
        public DateTime GetNextTransferDate() => DateTime.Now.AddDays(7).Date;
        public void EnterExternalAccountDetails(string routingNumber, string accountNumber, string bankName) { }
        public void EnterRecipientName(string name) { }
        public void VerifyExternalAccount() { }
        public bool IsExternalTransferInitiated() => true;
        public DateTime GetEstimatedDeliveryDate() => DateTime.Now.AddDays(3);
        public void NavigateToScheduledTransfers() { }
        public string GetFirstScheduledTransferId() => "TRANSFER001";
        public void SelectScheduledTransfer(string transferId) { }
        public void CancelTransfer() { }
        public bool IsTransferCancelled() => true;
        public string GetCancellationConfirmation() => "CANCELLED";
        public void Close() { }
    }
}

