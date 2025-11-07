using NUnit.Framework;
using System;

namespace MyTestAutomation.Tests.Ecommerce
{
    [TestFixture]
    public class CheckoutTests
    {
        private ProductPage productPage;
        private CartPage cartPage;
        private CheckoutPage checkoutPage;

        [SetUp]
        public void Setup()
        {
            productPage = new ProductPage();
            cartPage = new CartPage();
            checkoutPage = new CheckoutPage();
        }

        [Test]
        [Category("Smoke")]
        [Category("E2E")]
        [Category("Payment")]
        public void VerifyUserCanCompleteCheckoutWithValidPayment()
        {
            productPage.NavigateTo();
            productPage.SelectProduct("Laptop");
            productPage.ClickAddToCart();

            cartPage.NavigateTo();
            cartPage.ClickProceedToCheckout();

            checkoutPage.EnterShippingAddress("123 Main St", "New York", "10001");
            checkoutPage.EnterPaymentDetails("4111111111111111", "12/25", "123");
            checkoutPage.ClickPlaceOrder();

            Assert.That(checkoutPage.GetConfirmationMessage(), Does.Contain("Order confirmed"), "Order confirmation should be displayed");
            Assert.That(checkoutPage.GetOrderNumber(), Is.Not.Empty, "Order number should be generated");
        }

        [Test]
        [Property("ADOTestCaseId", "1179753")]
        [Category("Regression")]
        [Category("Negative")]
        [Category("Payment")]
        public void VerifyCheckoutFailsWithInvalidCreditCard()
        {
            productPage.NavigateTo();
            productPage.SelectProduct("Mouse");
            productPage.ClickAddToCart();

            cartPage.NavigateTo();
            cartPage.ClickProceedToCheckout();

            checkoutPage.EnterShippingAddress("456 Oak Ave", "Boston", "02101");
            checkoutPage.EnterPaymentDetails("1234567890123456", "12/25", "123");
            checkoutPage.ClickPlaceOrder();

            Assert.That(checkoutPage.GetErrorMessage(), Does.Contain("Invalid card"), "Error message for invalid card should appear");
        }

        [TearDown]
        public void TearDown()
        {
            // Cleanup
        }
    }
}