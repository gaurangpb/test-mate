using NUnit.Framework;
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class ApiEndpointTests
    {
        private HttpClient httpClient;
        private string baseUrl = "http://localhost:3001/api";

        [SetUp]
        public void Setup()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(baseUrl);
        }

        [Test]
        [Category("Smoke")]
        [Category("API")]
        public async Task VerifyOpenAIStatusEndpointReturnsConfiguredStatus()
        {
            var response = await httpClient.GetAsync("/config/openai/status");

            Assert.That(response.IsSuccessStatusCode, Is.True, "Status endpoint should return success");

            var content = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(content);

            Assert.That(jsonResponse.TryGetProperty("configured", out var configured), Is.True, "Response should contain 'configured' property");
            Assert.That(configured.ValueKind, Is.EqualTo(JsonValueKind.True).Or.EqualTo(JsonValueKind.False), "Configured should be a boolean");
        }

        [Test]
        [Category("API")]
        [Category("Configuration")]
        public async Task VerifyOpenAIConfigEndpointAcceptsValidApiKey()
        {
            var requestBody = new { apiKey = "test-api-key-12345" };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/config/openai", content);

            Assert.That(response.IsSuccessStatusCode, Is.True, "Config endpoint should accept valid API key");

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

            Assert.That(jsonResponse.TryGetProperty("success", out var success), Is.True, "Response should contain 'success' property");
            Assert.That(success.GetBoolean(), Is.True, "Success should be true");
        }

        [Test]
        [Category("API")]
        [Category("Negative")]
        public async Task VerifyOpenAIConfigEndpointRejectsMissingApiKey()
        {
            var requestBody = new { };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/config/openai", content);

            Assert.That(response.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.BadRequest), "Should return 400 for missing API key");

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

            Assert.That(jsonResponse.TryGetProperty("error", out var error), Is.True, "Response should contain error message");
            Assert.That(error.GetString(), Does.Contain("API key is required"), "Error message should indicate API key is required");
        }

        [Test]
        [Category("API")]
        [Category("Regression")]
        public async Task VerifyScanEndpointReturnsTestFiles()
        {
            var requestBody = new { repoPath = "C:\\workspace\\test-mate\\tests", testPropertyName = "TestCaseId" };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/scan", content);

            Assert.That(response.IsSuccessStatusCode, Is.True, "Scan endpoint should return success");

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

            Assert.That(jsonResponse.TryGetProperty("results", out var results), Is.True, "Response should contain 'results' array");
            Assert.That(results.ValueKind, Is.EqualTo(JsonValueKind.Array), "Results should be an array");
        }

        [Test]
        [Category("API")]
        [Category("Negative")]
        public async Task VerifyScanEndpointRejectsMissingRepoPath()
        {
            var requestBody = new { testPropertyName = "TestCaseId" };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/scan", content);

            Assert.That(response.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.BadRequest), "Should return 400 for missing repo path");
        }

        [Test]
        [Category("API")]
        [Category("Regression")]
        public async Task VerifyAnalyzeEndpointReturnsComprehensiveStatistics()
        {
            var requestBody = new { repoPath = "C:\\workspace\\test-mate\\tests", testPropertyName = "TestCaseId" };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/analyze", content);

            Assert.That(response.IsSuccessStatusCode, Is.True, "Analyze endpoint should return success");

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

            Assert.That(jsonResponse.TryGetProperty("totalTests", out var totalTests), Is.True, "Response should contain totalTests");
            Assert.That(jsonResponse.TryGetProperty("testsWithAdoId", out _), Is.True, "Response should contain testsWithAdoId");
            Assert.That(jsonResponse.TryGetProperty("testsWithoutAdoId", out _), Is.True, "Response should contain testsWithoutAdoId");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

