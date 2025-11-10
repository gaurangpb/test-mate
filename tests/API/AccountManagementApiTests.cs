using NUnit.Framework;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class AccountManagementApiTests
    {
        private HttpClient httpClient;
        private string baseUrl = "http://localhost:3001/api";

        [SetUp]
        public void Setup()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(baseUrl);
        }

        [Property("ADOTestCaseId", "100000")]
        [Test, APIOnly]
        public async Task AccountManagementV1PingTest()
        {
            var response = await httpClient.GetAsync("/account/v1/ping");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Account management ping should succeed");
        }

        [Property("ADOTestCaseId", "100000")]
        [Test, APIOnly]
        public async Task AccountManagementV1GetAccountBalanceTest()
        {
            var response = await httpClient.GetAsync("/account/v1/balance/12345");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Should retrieve account balance");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

