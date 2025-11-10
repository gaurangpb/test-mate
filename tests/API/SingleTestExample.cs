using NUnit.Framework;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class SingleTestExample
    {
        private HttpClient httpClient;
        private string baseUrl = "http://localhost:3001/api";

        [SetUp]
        public void Setup()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(baseUrl);
        }

        /// <summary>
        /// Single test method example with APIOnly attribute
        /// </summary>
        [Test, APIOnly]
        public async Task SingleApiPingTest()
        {
            var response = await httpClient.GetAsync("/api/v1/ping");
            
            Assert.That(response.IsSuccessStatusCode, Is.True, "API ping should succeed");
            Assert.That(response.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.OK), "Status code should be 200");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

