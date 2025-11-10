using NUnit.Framework;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class PaymentProcessingApiTests
    {
        private HttpClient httpClient;
        private string baseUrl = "http://localhost:3001/api";

        [SetUp]
        public void Setup()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(baseUrl);
        }

        [Test, APIOnly]
        public async Task PaymentProcessingV1PingTest()
        {
            var response = await httpClient.GetAsync("/payment/v1/ping");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Payment processing ping should succeed");
        }

        [Ignore("Can't get test data from DNA")]
        [Test, APIOnly, Test04]
        public async Task PaymentProcessingV1ProcessPaymentTest()
        {
            var paymentRequest = new
            {
                amount = 100.00,
                currency = "USD",
                paymentMethod = "credit_card"
            };

            var response = await httpClient.PostAsync("/payment/v1/process", null);
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Payment should be processed successfully");
        }

        [Ignore("Functionality not implemented yet")]
        [Test, APIOnly, Test04]
        public async Task PaymentProcessingV1RefundTest()
        {
            var refundRequest = new
            {
                transactionId = "TXN123456",
                amount = 50.00
            };

            var response = await httpClient.PostAsync("/payment/v1/refund", null);
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Refund should be processed successfully");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

