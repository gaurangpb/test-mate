using NUnit.Framework;
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace MyTestAutomation.Tests.API
{
    [TestFixture]
    public class AzureDevOpsApiTests
    {
        private HttpClient httpClient;
        private string baseUrl = "http://localhost:3001/api";

        [SetUp]
        public void Setup()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(baseUrl);
        }

        [Property("ADOTestCaseId", "100001")]
        [Test]
        [Category("API")]
        [Category("ADO")]
        [Category("Integration")]
        public async Task VerifyCreateTestCaseEndpointAcceptsValidTestCases()
        {
            var testCases = new[]
            {
                new { testName = "Test Case 1", fileName = "LoginTests.cs" },
                new { testName = "Test Case 2", fileName = "CheckoutTests.cs" }
            };

            var requestBody = new { testCases = testCases };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/ado/create-test-cases", content);

            Assert.That(response.IsSuccessStatusCode, Is.True, "Create test case endpoint should return success");

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

            Assert.That(jsonResponse.TryGetProperty("success", out var success), Is.True, "Response should contain 'success' property");
            Assert.That(success.GetBoolean(), Is.True, "Success should be true");

            Assert.That(jsonResponse.TryGetProperty("results", out var results), Is.True, "Response should contain 'results' array");
            Assert.That(results.GetArrayLength(), Is.EqualTo(2), "Results should contain 2 test cases");
        }

        [Test]
        [Category("API")]
        [Category("ADO")]
        [Category("Negative")]
        public async Task VerifyCreateTestCaseEndpointRejectsEmptyTestCases()
        {
            var requestBody = new { testCases = new object[0] };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/ado/create-test-cases", content);

            Assert.That(response.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.BadRequest), "Should return 400 for empty test cases");

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

            Assert.That(jsonResponse.TryGetProperty("error", out var error), Is.True, "Response should contain error message");
            Assert.That(error.GetString(), Does.Contain("No test cases provided"), "Error message should indicate no test cases provided");
        }

        [Test]
        [Category("API")]
        [Category("ADO")]
        [Category("Regression")]
        public async Task VerifyCreateTestCaseResponseContainsTestCaseIds()
        {
            var testCases = new[]
            {
                new { testName = "VerifySuccessfulLogin", fileName = "LoginTests.cs" }
            };

            var requestBody = new { testCases = testCases };
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("/ado/create-test-cases", content);

            Assert.That(response.IsSuccessStatusCode, Is.True, "Create test case endpoint should return success");

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

            Assert.That(jsonResponse.TryGetProperty("results", out var results), Is.True, "Response should contain 'results' array");

            var firstResult = results[0];
            Assert.That(firstResult.TryGetProperty("testCaseId", out var testCaseId), Is.True, "Result should contain testCaseId");
            Assert.That(testCaseId.GetString(), Is.Not.Empty, "TestCaseId should not be empty");
            Assert.That(testCaseId.GetString().Length, Is.EqualTo(6), "TestCaseId should be 6 digits");
        }

        [TearDown]
        public void TearDown()
        {
            httpClient?.Dispose();
        }
    }
}

