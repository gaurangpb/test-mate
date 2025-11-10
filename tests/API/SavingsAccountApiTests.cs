using NUnit.Framework;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class SavingsAccountApiTests
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
        public async Task SavingsAcctV2PingTest()
        {
            var response = await httpClient.GetAsync("/savings/v2/ping");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Ping endpoint should return success");
            Assert.That(response.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.OK), "Status code should be 200");
        }

        [Ignore("Can't get test data from DNA")]
        [Test, APIOnly, Test04]
        public async Task SavingsAcctV2GetAccountDetailsTest()
        {
            var response = await httpClient.GetAsync("/savings/v2/account/12345");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Should retrieve account details");
        }

        [Ignore("Functionality not implemented yet")]
        [Test, APIOnly, Test04]
        public async Task SavingsAcctV2TransferFundsTest()
        {
            var transferRequest = new
            {
                fromAccount = "12345",
                toAccount = "67890",
                amount = 100.00
            };

            var response = await httpClient.PostAsync("/savings/v2/transfer", null);
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Transfer should complete successfully");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

