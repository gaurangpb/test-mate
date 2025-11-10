using NUnit.Framework;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class RetailCreditCardApiTests
    {
        private HttpClient httpClient;
        private string baseUrl = "http://localhost:3001/api";

        [SetUp]
        public void Setup()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(baseUrl);
        }

        [Property("ADOTestCaseId", "966309")]
        //  [Test, APIOnly, Test04]
        public async Task RetailNonMemberCreditCardApprovedTestAsync()
        {
            var creditCardRequest = new
            {
                cardNumber = "4111111111111111",
                amount = 500.00,
                merchantId = "MERCHANT123"
            };

            var response = await httpClient.PostAsync("/retail/creditcard/process", null);
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Credit card transaction should be approved");
        }

        [Property("ADOTestCaseId", "966310")]
        [Test, APIOnly]
        public async Task RetailMemberCreditCardApprovedTestAsync()
        {
            var creditCardRequest = new
            {
                cardNumber = "4111111111111112",
                amount = 250.00,
                merchantId = "MERCHANT123",
                memberId = "MEMBER456"
            };

            var response = await httpClient.PostAsync("/retail/creditcard/process", null);
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Member credit card transaction should be approved");
        }

        [Property("ADOTestCaseId", "966311")]
        //  [Test, APIOnly, Test04]
        //  [Ignore("Waiting for merchant integration to be completed")]
        public async Task RetailCreditCardDeclinedTestAsync()
        {
            var creditCardRequest = new
            {
                cardNumber = "4000000000000002",
                amount = 1000.00,
                merchantId = "MERCHANT123"
            };

            var response = await httpClient.PostAsync("/retail/creditcard/process", null);
            
            Assert.That(response.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.BadRequest), "Credit card transaction should be declined");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

