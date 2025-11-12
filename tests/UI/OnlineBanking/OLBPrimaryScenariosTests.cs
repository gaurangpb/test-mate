using NUnit.Framework;
using System;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.UI.OnlineBanking
{
    // The Selenium Grid needs to know which browser to use, for that
    // the TestFixture property is used to send the current browser to the test class
    // and use it for the remoteWebDriver instance
    //[TestFixture(Browser.Firefox)]
    //[TestFixture(Browser.Chrome)]
    [TestFixture(Browser.Edge)]
    public class OLBPrimaryScenariosTests(Browser browser) //: BaseClassTestsOLB(browser)
    {
        private Browser currentBrowser = browser;
        private OnlineBankingPage olbPage;

        [SetUp]
        [Ignore("On hold until HUST completes the LPP tests and then move on to other enterprise level automation")]
#pragma warning disable CS1998 // Async method lacks 'await' operators and will run synchronously
        public async Task ResetTriedUsersList()
#pragma warning restore CS1998 // Async method lacks 'await' operators and will run synchronously
        {
            // Reset the list of users that have been tried for testing
            olbPage = new OnlineBankingPage(currentBrowser);
        }

        /// <summary>
        /// Password Reset, View eStatements, Apply, View and Pay with Credit Card, Travel Notifications
        /// </summary>
        // TODO: REENABLE WHEN HUST STARTS TESTING MORE THAN LPP/SDMO
        //[Test, HUST, NotPreProd]
        //[Ignore("On hold until HUST completes the LPP tests and then move on to other enterprise level automation")]
        public async Task OlbPrimaryScenarios()
        {
            olbPage.NavigateTo();
            olbPage.Login("testuser", "password123");

            // Password Reset
            olbPage.ResetPassword();
            Assert.That(olbPage.IsPasswordResetSuccessful(), Is.True, "Password reset should succeed");

            // View eStatements
            olbPage.NavigateToEstatements();
            Assert.That(olbPage.AreEstatementsDisplayed(), Is.True, "eStatements should be displayed");

            // Apply for new account
            olbPage.NavigateToApply();
            olbPage.SubmitApplication();
            Assert.That(olbPage.IsApplicationSubmitted(), Is.True, "Application should be submitted");

            // View and Pay with Credit Card
            olbPage.NavigateToPayments();
            olbPage.PayWithCreditCard("4111111111111111", "12/25", "123");
            Assert.That(olbPage.IsPaymentSuccessful(), Is.True, "Payment should be successful");

            // Travel Notifications
            olbPage.NavigateToTravelNotifications();
            olbPage.SubmitTravelNotification("New York", DateTime.Now.AddDays(7), DateTime.Now.AddDays(14));
            Assert.That(olbPage.IsTravelNotificationSubmitted(), Is.True, "Travel notification should be submitted");
        }

        [Property("ADOTestCaseId", "100000")]
        [Test, HUST]
        public async Task OlbLoginTest()
        {
            olbPage = new OnlineBankingPage(currentBrowser);
            olbPage.NavigateTo();
            olbPage.Login("testuser", "password123");

            Assert.That(olbPage.IsLoggedIn(), Is.True, "User should be logged in successfully");
        }

        [TearDown]
        public void TearDown()
        {
            olbPage?.Close();
        }
    }

    public enum Browser
    {
        Chrome,
        Firefox,
        Edge,
        Safari
    }

    public class OnlineBankingPage
    {
        private Browser browser;

        public OnlineBankingPage(Browser browser)
        {
            this.browser = browser;
        }

        public void NavigateTo() { }
        public void Login(string username, string password) { }
        public void ResetPassword() { }
        public bool IsPasswordResetSuccessful() => true;
        public void NavigateToEstatements() { }
        public bool AreEstatementsDisplayed() => true;
        public void NavigateToApply() { }
        public void SubmitApplication() { }
        public bool IsApplicationSubmitted() => true;
        public void NavigateToPayments() { }
        public void PayWithCreditCard(string cardNumber, string expiry, string cvv) { }
        public bool IsPaymentSuccessful() => true;
        public void NavigateToTravelNotifications() { }
        public void SubmitTravelNotification(string destination, DateTime startDate, DateTime endDate) { }
        public bool IsTravelNotificationSubmitted() => true;
        public bool IsLoggedIn() => true;
        public void Close() { }
    }
}

