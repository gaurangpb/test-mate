using NUnit.Framework;
using System;

namespace MyTestAutomation.Tests.Authentication
{
    [TestFixture]
    public class LoginTests
    {
        private LoginPage loginPage;
        private HomePage homePage;

        [SetUp]
        public void Setup()
        {
            loginPage = new LoginPage();
            homePage = new HomePage();
        }

        [Test]
        [Category("Smoke")]
        [Category("Regression")]
        public void VerifySuccessfulLoginWithValidCredentials()
        {
            loginPage.NavigateTo();
            loginPage.EnterUsername("testuser@example.com");
            loginPage.EnterPassword("Password123!");
            loginPage.ClickLoginButton();

            Assert.That(homePage.IsDisplayed(), Is.True, "Home page should be displayed after successful login");
            Assert.That(homePage.GetWelcomeMessage(), Does.Contain("Welcome"), "Welcome message should be visible");
        }

        [Test]
        [Category("Regression")]
        [Category("Negative")]
        public void VerifyLoginFailsWithInvalidPassword()
        {
            loginPage.NavigateTo();
            loginPage.EnterUsername("testuser@example.com");
            loginPage.EnterPassword("WrongPassword");
            loginPage.ClickLoginButton();

            Assert.That(loginPage.GetErrorMessage(), Is.EqualTo("Invalid credentials"), "Error message should be displayed");
            Assert.That(loginPage.IsDisplayed(), Is.True, "User should remain on login page");
        }

        [Test]
        [Category("Regression")]
        [Category("Validation")]
        public void VerifyLoginFailsWithEmptyUsername()
        {
            loginPage.NavigateTo();
            loginPage.EnterUsername("");
            loginPage.EnterPassword("Password123!");
            loginPage.ClickLoginButton();

            Assert.That(loginPage.GetValidationError(), Does.Contain("Username is required"), "Validation error should appear");
        }

        [Test]
        [Category("Smoke")]
        [Category("Feature")]
        [TestProperty("TestCaseId", "12345")]
        public void VerifyPasswordResetFunctionality()
        {
            loginPage.NavigateTo();
            loginPage.ClickForgotPassword();
            loginPage.EnterEmailForReset("testuser@example.com");
            loginPage.ClickSendResetLink();

            Assert.That(loginPage.GetSuccessMessage(), Does.Contain("reset link has been sent"), "Success message should appear");
        }

        [TearDown]
        public void TearDown()
        {
            // Cleanup
        }
    }
}