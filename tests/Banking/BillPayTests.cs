using NUnit.Framework;
using System;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.Banking
{
    [TestFixture(Browser.Firefox)]
    public class BillPayTests(Browser browser)
    {
        private Browser currentBrowser = browser;
        private BillPayPage billPayPage;

        [SetUp]
        public void SetUp()
        {
            billPayPage = new BillPayPage(currentBrowser);
        }

        [Test, HUST]
        public async Task AddNewPayeeAndMakePayment()
        {
            billPayPage.NavigateTo();
            billPayPage.Login("testuser", "password123");
            billPayPage.NavigateToBillPay();

            billPayPage.AddNewPayee("Electric Company", "123 Main St", "City", "ST", "12345", "1234567890");
            billPayPage.VerifyPayeeAccount("1234567890");
            billPayPage.ConfirmPayeeAddition();

            Assert.That(billPayPage.IsPayeeAdded(), Is.True, "Payee should be added successfully");

            billPayPage.SelectPayee("Electric Company");
            billPayPage.SelectPaymentAccount("CHECKING");
            billPayPage.EnterPaymentAmount(150.00m);
            billPayPage.SetPaymentDate(DateTime.Now.AddDays(5));
            billPayPage.SubmitPayment();

            Assert.That(billPayPage.IsPaymentScheduled(), Is.True, "Payment should be scheduled");
            Assert.That(billPayPage.GetPaymentConfirmationNumber(), Is.Not.Empty, "Should receive payment confirmation");
        }

        [Test, HUST]
        public async Task ScheduleRecurringBillPayment()
        {
            billPayPage.NavigateTo();
            billPayPage.Login("testuser", "password123");
            billPayPage.NavigateToBillPay();

            billPayPage.SelectPayee("Internet Provider");
            billPayPage.SelectPaymentAccount("CHECKING");
            billPayPage.EnterPaymentAmount(79.99m);
            billPayPage.SetPaymentType("RECURRING");
            billPayPage.SetRecurrenceSchedule("MONTHLY", 15);
            billPayPage.SetStartDate(DateTime.Now.AddDays(10));
            billPayPage.SubmitPayment();

            Assert.That(billPayPage.IsRecurringPaymentScheduled(), Is.True, "Recurring payment should be scheduled");
            Assert.That(billPayPage.GetNextPaymentDate(), Is.EqualTo(DateTime.Now.AddDays(10).Date), "Next payment date should be set correctly");
        }

        [Property("ADOTestCaseId", "100011")]
        [Test, HUST]
        public async Task ViewPaymentHistoryAndStatus()
        {
            billPayPage.NavigateTo();
            billPayPage.Login("testuser", "password123");
            billPayPage.NavigateToBillPay();
            billPayPage.ViewPaymentHistory();

            var paymentHistory = billPayPage.GetPaymentHistory();
            Assert.That(paymentHistory.Count, Is.GreaterThan(0), "Should display payment history");

            var recentPayment = billPayPage.GetMostRecentPayment();
            billPayPage.ViewPaymentDetails(recentPayment);

            Assert.That(billPayPage.IsPaymentDetailsDisplayed(), Is.True, "Payment details should be displayed");
            Assert.That(billPayPage.GetPaymentStatus(), Is.Not.Empty, "Should show payment status");
        }

        [Property("ADOTestCaseId", "100011")]
        [Test, HUST]
        public async Task CancelScheduledPayment()
        {
            billPayPage.NavigateTo();
            billPayPage.Login("testuser", "password123");
            billPayPage.NavigateToBillPay();
            billPayPage.ViewScheduledPayments();

            var scheduledPaymentId = billPayPage.GetFirstScheduledPaymentId();
            billPayPage.SelectScheduledPayment(scheduledPaymentId);
            billPayPage.CancelPayment();

            Assert.That(billPayPage.IsPaymentCancelled(), Is.True, "Payment should be cancelled");
            Assert.That(billPayPage.GetCancellationMessage(), Is.Not.Empty, "Should receive cancellation confirmation");
        }

        [TearDown]
        public void TearDown()
        {
            billPayPage?.Close();
        }
    }

    public class BillPayPage
    {
        private Browser browser;

        public BillPayPage(Browser browser)
        {
            this.browser = browser;
        }

        public void NavigateTo() { }
        public void Login(string username, string password) { }
        public void NavigateToBillPay() { }
        public void AddNewPayee(string name, string address, string city, string state, string zip, string accountNumber) { }
        public void VerifyPayeeAccount(string accountNumber) { }
        public void ConfirmPayeeAddition() { }
        public bool IsPayeeAdded() => true;
        public void SelectPayee(string payeeName) { }
        public void SelectPaymentAccount(string accountType) { }
        public void EnterPaymentAmount(decimal amount) { }
        public void SetPaymentDate(DateTime date) { }
        public void SubmitPayment() { }
        public bool IsPaymentScheduled() => true;
        public string GetPaymentConfirmationNumber() => "PAY123456";
        public void SetPaymentType(string paymentType) { }
        public void SetRecurrenceSchedule(string frequency, int dayOfMonth) { }
        public void SetStartDate(DateTime date) { }
        public bool IsRecurringPaymentScheduled() => true;
        public DateTime GetNextPaymentDate() => DateTime.Now.AddDays(10).Date;
        public void ViewPaymentHistory() { }
        public System.Collections.Generic.List<object> GetPaymentHistory() => new System.Collections.Generic.List<object>();
        public object GetMostRecentPayment() => new object();
        public void ViewPaymentDetails(object payment) { }
        public bool IsPaymentDetailsDisplayed() => true;
        public string GetPaymentStatus() => "PROCESSED";
        public void ViewScheduledPayments() { }
        public string GetFirstScheduledPaymentId() => "PAYMENT001";
        public void SelectScheduledPayment(string paymentId) { }
        public void CancelPayment() { }
        public bool IsPaymentCancelled() => true;
        public string GetCancellationMessage() => "Payment cancelled successfully";
        public void Close() { }
    }
}

