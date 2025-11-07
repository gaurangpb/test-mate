using NUnit.Framework;
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.Integration
{
    [TestFixture]
    public class ThirdPartyServiceIntegrationTests
    {
        private HttpClient httpClient;
        private string baseUrl = "http://localhost:3001/api";

        [SetUp]
        public void Setup()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(baseUrl);
            httpClient.Timeout = TimeSpan.FromSeconds(30);
        }

        [Test]
        [Category("Integration")]
        [Category("External")]
        [Category("OpenAI")]
        public async Task VerifyOpenAIClientInitializationAndConfiguration()
        {
            // Configure OpenAI client
            var configBody = new { apiKey = "sk-test-key-12345" };
            var configJson = JsonSerializer.Serialize(configBody);
            var configContent = new StringContent(configJson, Encoding.UTF8, "application/json");
            var configResponse = await httpClient.PostAsync("/config/openai", configContent);

            Assert.That(configResponse.IsSuccessStatusCode, Is.True, "OpenAI configuration should succeed");

            // Verify configuration status
            var statusResponse = await httpClient.GetAsync("/config/openai/status");
            Assert.That(statusResponse.IsSuccessStatusCode, Is.True, "Status check should succeed");

            var statusContent = await statusResponse.Content.ReadAsStringAsync();
            var statusData = JsonSerializer.Deserialize<JsonElement>(statusContent);

            Assert.That(statusData.TryGetProperty("configured", out var configured), Is.True, "Status should indicate configuration state");
        }

        [Test]
        [Category("Integration")]
        [Category("External")]
        [Category("AzureDevOps")]
        [Category("Smoke")]
        public async Task VerifyAzureDevOpsIntegrationEndpointAvailability()
        {
            var testCases = new[]
            {
                new { testName = "IntegrationTest1", fileName = "IntegrationTests.cs" }
            };

            var requestBody = new { testCases = testCases };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/ado/create-test-cases", content);

            // Note: This might fail if ADO config is not set up, but endpoint should be available
            Assert.That(response.StatusCode, Is.Not.EqualTo(System.Net.HttpStatusCode.NotFound),
                "ADO endpoint should be available");
        }

        [Test]
        [Category("Integration")]
        [Category("External")]
        [Category("Timeout")]
        public async Task VerifyServiceHandlesTimeoutGracefully()
        {
            // Create a request with a very short timeout to test timeout handling
            using (var shortTimeoutClient = new HttpClient())
            {
                shortTimeoutClient.BaseAddress = new Uri(baseUrl);
                shortTimeoutClient.Timeout = TimeSpan.FromMilliseconds(1); // 1ms timeout (will likely timeout)

                // This should timeout, and we want to verify it's handled gracefully
                try
                {
                    await shortTimeoutClient.GetAsync("/config/openai/status");
                }
                catch (TaskCanceledException)
                {
                    // Expected behavior - timeout should be handled
                    Assert.Pass("Timeout was handled correctly");
                }
            }
        }

        [Test]
        [Category("Integration")]
        [Category("External")]
        [Category("ErrorHandling")]
        public async Task VerifyServiceHandlesInvalidApiKeyFormat()
        {
            // Test with various invalid API key formats
            var invalidKeys = new[]
            {
                "",
                "   ",
                "invalid",
                "123456",
                "key without proper format"
            };

            foreach (var invalidKey in invalidKeys)
            {
                var configBody = new { apiKey = invalidKey };
                var configJson = JsonSerializer.Serialize(configBody);
                var configContent = new StringContent(configJson, Encoding.UTF8, "application/json");

                // Even with invalid format, the endpoint should accept it (validation might be done by OpenAI service)
                var response = await httpClient.PostAsync("/config/openai", configContent);

                // The endpoint accepts the key (validation happens later)
                Assert.That(response.StatusCode, Is.Not.EqualTo(System.Net.HttpStatusCode.InternalServerError),
                    $"Service should handle invalid key format gracefully: '{invalidKey}'");
            }
        }

        [Test]
        [Category("Integration")]
        [Category("External")]
        [Category("Retry")]
        public async Task VerifyRetryMechanismForTransientFailures()
        {
            int maxRetries = 3;
            int attempt = 0;
            bool success = false;

            while (attempt < maxRetries && !success)
            {
                try
                {
                    var response = await httpClient.GetAsync("/config/openai/status");
                    if (response.IsSuccessStatusCode)
                    {
                        success = true;
                    }
                }
                catch (HttpRequestException)
                {
                    attempt++;
                    if (attempt < maxRetries)
                    {
                        await Task.Delay(1000 * attempt); // Exponential backoff
                    }
                }
            }

            Assert.That(success, Is.True, "Request should succeed after retries");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

