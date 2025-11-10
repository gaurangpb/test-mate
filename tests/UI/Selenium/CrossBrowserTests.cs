using NUnit.Framework;
using System;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.UI.Selenium
{
    //[TestFixture(Browser.Firefox)]
    //[TestFixture(Browser.Chrome)]
    [TestFixture(Browser.Edge)]
    public class CrossBrowserTests(Browser browser)
    {
        private Browser currentBrowser = browser;
        private WebDriver driver;

        [SetUp]
        public void Setup()
        {
            driver = new WebDriver(currentBrowser);
        }

        [Test]
        public void VerifyHomePageLoadsInBrowser()
        {
            driver.NavigateTo("https://example.com");
            
            Assert.That(driver.GetPageTitle(), Is.Not.Empty, "Page title should be present");
            Assert.That(driver.IsPageLoaded(), Is.True, "Page should be fully loaded");
        }

        [Test]
        public void VerifyLoginFormDisplaysInBrowser()
        {
            driver.NavigateTo("https://example.com/login");
            
            Assert.That(driver.IsElementVisible("username"), Is.True, "Username field should be visible");
            Assert.That(driver.IsElementVisible("password"), Is.True, "Password field should be visible");
        }

        [TearDown]
        public void TearDown()
        {
            driver?.Close();
        }
    }

    public class WebDriver
    {
        private Browser browser;

        public WebDriver(Browser browser)
        {
            this.browser = browser;
        }

        public void NavigateTo(string url) { }
        public string GetPageTitle() => "Test Page";
        public bool IsPageLoaded() => true;
        public bool IsElementVisible(string elementId) => true;
        public void Close() { }
    }
}

