using NUnit.Framework;
using System;
using System.Data;
using System.Data.SqlClient;

namespace MyTestAutomation.Tests.Integration
{
    [TestFixture]
    public class DatabaseIntegrationTests
    {
        private string connectionString = "Server=localhost;Database=TestDB;Integrated Security=true;";

        [Test]
        [Category("Integration")]
        [Category("Database")]
        [Category("Smoke")]
        public void VerifyDatabaseConnectionIsSuccessful()
        {
            using (var connection = new SqlConnection(connectionString))
            {
                connection.Open();

                Assert.That(connection.State, Is.EqualTo(ConnectionState.Open), "Database connection should be open");
                Assert.That(connection.Database, Is.Not.Empty, "Database name should be available");
            }
        }

        [Test]
        [Category("Integration")]
        [Category("Database")]
        [Category("Regression")]
        public void VerifyUserTableExistsAndIsAccessible()
        {
            using (var connection = new SqlConnection(connectionString))
            {
                connection.Open();

                var command = new SqlCommand("SELECT COUNT(*) FROM Users", connection);
                var result = command.ExecuteScalar();

                Assert.That(result, Is.Not.Null, "Query should return a result");
                Assert.That(Convert.ToInt32(result), Is.GreaterThanOrEqualTo(0), "User count should be non-negative");
            }
        }

        [Test]
        [Category("Integration")]
        [Category("Database")]
        [Category("DataValidation")]
        public void VerifyUserDataCanBeInsertedAndRetrieved()
        {
            string testUsername = $"testuser_{Guid.NewGuid()}";
            string testEmail = $"test_{Guid.NewGuid()}@example.com";

            using (var connection = new SqlConnection(connectionString))
            {
                connection.Open();

                // Insert test user
                var insertCommand = new SqlCommand(
                    "INSERT INTO Users (Username, Email, CreatedAt) VALUES (@Username, @Email, GETDATE())",
                    connection);
                insertCommand.Parameters.AddWithValue("@Username", testUsername);
                insertCommand.Parameters.AddWithValue("@Email", testEmail);
                insertCommand.ExecuteNonQuery();

                // Retrieve the inserted user
                var selectCommand = new SqlCommand(
                    "SELECT Username, Email FROM Users WHERE Username = @Username",
                    connection);
                selectCommand.Parameters.AddWithValue("@Username", testUsername);

                using (var reader = selectCommand.ExecuteReader())
                {
                    Assert.That(reader.Read(), Is.True, "User should be found in database");
                    Assert.That(reader["Username"].ToString(), Is.EqualTo(testUsername), "Username should match");
                    Assert.That(reader["Email"].ToString(), Is.EqualTo(testEmail), "Email should match");
                }

                // Cleanup
                var deleteCommand = new SqlCommand(
                    "DELETE FROM Users WHERE Username = @Username",
                    connection);
                deleteCommand.Parameters.AddWithValue("@Username", testUsername);
                deleteCommand.ExecuteNonQuery();
            }
        }

        [Test]
        [Category("Integration")]
        [Category("Database")]
        [Category("Negative")]
        public void VerifyDatabaseRejectsInvalidData()
        {
            using (var connection = new SqlConnection(connectionString))
            {
                connection.Open();

                var command = new SqlCommand(
                    "INSERT INTO Users (Username, Email) VALUES (@Username, @Email)",
                    connection);
                command.Parameters.AddWithValue("@Username", ""); // Empty username should fail
                command.Parameters.AddWithValue("@Email", "invalid-email"); // Invalid email format

                Assert.Throws<SqlException>(() => command.ExecuteNonQuery(),
                    "Database should reject invalid data");
            }
        }

        [Test]
        [Category("Integration")]
        [Category("Database")]
        [Category("Transaction")]
        public void VerifyDatabaseTransactionRollbackWorks()
        {
            using (var connection = new SqlConnection(connectionString))
            {
                connection.Open();
                var transaction = connection.BeginTransaction();

                try
                {
                    var command = new SqlCommand(
                        "INSERT INTO Users (Username, Email) VALUES (@Username, @Email)",
                        connection, transaction);
                    command.Parameters.AddWithValue("@Username", "transaction_test");
                    command.Parameters.AddWithValue("@Email", "trans@test.com");
                    command.ExecuteNonQuery();

                    // Rollback transaction
                    transaction.Rollback();

                    // Verify data was not committed
                    var verifyCommand = new SqlCommand(
                        "SELECT COUNT(*) FROM Users WHERE Username = 'transaction_test'",
                        connection);
                    var count = Convert.ToInt32(verifyCommand.ExecuteScalar());

                    Assert.That(count, Is.EqualTo(0), "User should not exist after rollback");
                }
                finally
                {
                    transaction.Dispose();
                }
            }
        }
    }
}

