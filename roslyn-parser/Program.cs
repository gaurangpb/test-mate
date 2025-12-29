using System.Text;
using System.Text.Json;
using RoslynParser.Models;
using RoslynParser.Services;

namespace RoslynParser;

class Program
{
    static void Main(string[] args)
    {
        // Read from stdin
        var input = new StringBuilder();
        string? line;
        
        while ((line = Console.ReadLine()) != null)
        {
            input.AppendLine(line);
        }

        var jsonInput = input.ToString().Trim();
        
        if (string.IsNullOrEmpty(jsonInput))
        {
            WriteErrorResponse("No input provided");
            return;
        }

        try
        {
            var request = JsonSerializer.Deserialize<ParsingRequest>(jsonInput, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (request == null)
            {
                WriteErrorResponse("Invalid request format");
                return;
            }

            var parser = new CSharpParser();
            var response = parser.ParseFile(request);

            var jsonOutput = JsonSerializer.Serialize(response, new JsonSerializerOptions
            {
                WriteIndented = false,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            Console.WriteLine(jsonOutput);
        }
        catch (Exception ex)
        {
            WriteErrorResponse($"Error processing request: {ex.Message}");
        }
    }

    static void WriteErrorResponse(string error)
    {
        var errorResponse = new ParsingResponse
        {
            Error = error,
            Tests = new List<TestInfo>()
        };

        var jsonOutput = JsonSerializer.Serialize(errorResponse, new JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Console.WriteLine(jsonOutput);
    }
}

