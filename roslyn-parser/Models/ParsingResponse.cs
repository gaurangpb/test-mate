namespace RoslynParser.Models;

public class ParsingResponse
{
    public string? ClassName { get; set; }
    public List<TestInfo> Tests { get; set; } = new();
    public string? Error { get; set; }
}

