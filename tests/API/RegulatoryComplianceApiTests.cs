using NUnit.Framework;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class RegulatoryComplianceApiTests
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
        public async Task RegulatoryComplianceV1PingTest()
        {
            var response = await httpClient.GetAsync("/regulatory/v1/ping");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Regulatory compliance ping should succeed");
            Assert.That(response.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.OK), "Status code should be 200");
        }

        [Test, APIOnly]
        public async Task RegulatoryComplianceV1GetComplianceStatusTest()
        {
            var response = await httpClient.GetAsync("/regulatory/v1/compliance/status");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "Should retrieve compliance status");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

