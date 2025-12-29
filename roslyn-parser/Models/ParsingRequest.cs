namespace RoslynParser.Models;

public class ParsingRequest
{
    public string FilePath { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string TestPropertyName { get; set; } = "ADOTestCaseId";
}

