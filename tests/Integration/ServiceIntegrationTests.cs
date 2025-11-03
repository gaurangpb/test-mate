using NUnit.Framework;
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.Integration
{
    [TestFixture]
    public class ServiceIntegrationTests
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
        [Category("Integration")]
        [Category("E2E")]
        [Category("Smoke")]
        public async Task VerifyEndToEndTestScanAndAnalyzeWorkflow()
        {
            // Step 1: Configure OpenAI (if needed)
            var configBody = new { apiKey = "test-api-key-12345" };
            var configJson = JsonSerializer.Serialize(configBody);
            var configContent = new StringContent(configJson, Encoding.UTF8, "application/json");
            await httpClient.PostAsync("/config/openai", configContent);

            // Step 2: Scan for test files
            var scanBody = new { repoPath = "C:\\workspace\\test-mate\\tests", testPropertyName = "TestCaseId" };
            var scanJson = JsonSerializer.Serialize(scanBody);
            var scanContent = new StringContent(scanJson, Encoding.UTF8, "application/json");
            var scanResponse = await httpClient.PostAsync("/scan", scanContent);

            Assert.That(scanResponse.IsSuccessStatusCode, Is.True, "Scan should succeed");
            var scanResult = await scanResponse.Content.ReadAsStringAsync();
            var scanData = JsonSerializer.Deserialize<JsonElement>(scanResult);

            Assert.That(scanData.TryGetProperty("results", out var results), Is.True, "Scan should return results");

            // Step 3: Analyze the repository
            var analyzeBody = new { repoPath = "C:\\workspace\\test-mate\\tests", testPropertyName = "TestCaseId" };
            var analyzeJson = JsonSerializer.Serialize(analyzeBody);
            var analyzeContent = new StringContent(analyzeJson, Encoding.UTF8, "application/json");
            var analyzeResponse = await httpClient.PostAsync("/analyze", analyzeContent);

            Assert.That(analyzeResponse.IsSuccessStatusCode, Is.True, "Analyze should succeed");
            var analyzeResult = await analyzeResponse.Content.ReadAsStringAsync();
            var analyzeData = JsonSerializer.Deserialize<JsonElement>(analyzeResult);

            Assert.That(analyzeData.TryGetProperty("totalTests", out var totalTests), Is.True, "Analysis should include total tests");
            Assert.That(totalTests.GetInt32(), Is.GreaterThan(0), "Should find at least one test");
        }

        [Test]
        [Category("Integration")]
        [Category("E2E")]
        [Category("ADO")]
        public async Task VerifyTestCaseCreationWorkflowWithMultipleSteps()
        {
            // Step 1: Scan for tests without TestCaseId
            var scanBody = new { repoPath = "C:\\workspace\\test-mate\\tests", testPropertyName = "TestCaseId" };
            var scanJson = JsonSerializer.Serialize(scanBody);
            var scanContent = new StringContent(scanJson, Encoding.UTF8, "application/json");
            var scanResponse = await httpClient.PostAsync("/scan", scanContent);

            Assert.That(scanResponse.IsSuccessStatusCode, Is.True, "Scan should succeed");

            // Step 2: Create test cases in ADO
            var testCases = new[]
            {
                new { testName = "VerifySuccessfulLogin", fileName = "LoginTests.cs" },
                new { testName = "VerifyCheckoutFlow", fileName = "CheckoutTests.cs" }
            };

            var createBody = new { testCases = testCases };
            var createJson = JsonSerializer.Serialize(createBody);
            var createContent = new StringContent(createJson, Encoding.UTF8, "application/json");
            var createResponse = await httpClient.PostAsync("/ado/create-test-cases", createContent);

            Assert.That(createResponse.IsSuccessStatusCode, Is.True, "Test case creation should succeed");

            var createResult = await createResponse.Content.ReadAsStringAsync();
            var createData = JsonSerializer.Deserialize<JsonElement>(createResult);

            Assert.That(createData.TryGetProperty("results", out var results), Is.True, "Response should contain results");
            Assert.That(results.GetArrayLength(), Is.EqualTo(2), "Should create 2 test cases");

            // Verify each result has a test case ID
            foreach (var result in results.EnumerateArray())
            {
                Assert.That(result.TryGetProperty("testCaseId", out var testCaseId), Is.True, "Each result should have a testCaseId");
                Assert.That(testCaseId.GetString(), Is.Not.Empty, "TestCaseId should not be empty");
            }
        }

        [Test]
        [Category("Integration")]
        [Category("API")]
        [Category("ErrorHandling")]
        public async Task VerifyErrorHandlingAcrossMultipleEndpoints()
        {
            // Test error handling in config endpoint
            var emptyConfigContent = new StringContent("{}", Encoding.UTF8, "application/json");
            var configResponse = await httpClient.PostAsync("/config/openai", emptyConfigContent);
            Assert.That(configResponse.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.BadRequest), "Config should reject empty request");

            // Test error handling in scan endpoint
            var emptyScanContent = new StringContent("{}", Encoding.UTF8, "application/json");
            var scanResponse = await httpClient.PostAsync("/scan", emptyScanContent);
            Assert.That(scanResponse.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.BadRequest), "Scan should reject empty request");

            // Test error handling in ADO endpoint
            var emptyAdoContent = new StringContent("{}", Encoding.UTF8, "application/json");
            var adoResponse = await httpClient.PostAsync("/ado/create-test-cases", emptyAdoContent);
            Assert.That(adoResponse.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.BadRequest), "ADO endpoint should reject empty request");
        }

        [Test]
        [Category("Integration")]
        [Category("Performance")]
        [Category("Load")]
        public async Task VerifyConcurrentRequestsAreHandledCorrectly()
        {
            var tasks = new List<Task<HttpResponseMessage>>();

            // Create 10 concurrent requests to the status endpoint
            for (int i = 0; i < 10; i++)
            {
                tasks.Add(httpClient.GetAsync("/config/openai/status"));
            }

            var responses = await Task.WhenAll(tasks);

            // Verify all requests succeeded
            foreach (var response in responses)
            {
                Assert.That(response.IsSuccessStatusCode, Is.True, "All concurrent requests should succeed");
            }
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

