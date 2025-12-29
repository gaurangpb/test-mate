namespace RoslynParser.Models;

public class TestInfo
{
    public string Name { get; set; } = string.Empty;
    public bool HasTestCaseId { get; set; }
    public string? AdoId { get; set; }
    public List<string> Tags { get; set; } = new();
    public bool HasTestCaseParams { get; set; }
    public string Code { get; set; } = string.Empty;
}

