using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using RoslynParser.Models;

namespace RoslynParser.Services;

public class CSharpParser
{
    private static readonly HashSet<string> ExcludedMethods = new()
    {
        "Setup", "TearDown", "SetUp", "OneTimeSetUp", "OneTimeTearDown"
    };

    public ParsingResponse ParseFile(ParsingRequest request)
    {
        try
        {
            var syntaxTree = CSharpSyntaxTree.ParseText(request.Content);
            var root = syntaxTree.GetCompilationUnitRoot();

            var testClasses = root.DescendantNodes()
                .OfType<ClassDeclarationSyntax>()
                .Where(IsTestClass)
                .ToList();

            if (testClasses.Count == 0)
            {
                return new ParsingResponse
                {
                    ClassName = null,
                    Tests = new List<TestInfo>()
                };
            }

            // Get the first test class (or primary class if multiple)
            var testClass = testClasses.First();
            var className = testClass.Identifier.ValueText;

            // Get class-level tags
            var classLevelTags = ExtractTagsFromAttributes(testClass.AttributeLists);

            // Get all test methods
            var tests = new List<TestInfo>();
            var methods = testClass.DescendantNodes()
                .OfType<MethodDeclarationSyntax>()
                .Where(m => IsTestMethod(m) && !ExcludedMethods.Contains(m.Identifier.ValueText))
                .ToList();

            foreach (var method in methods)
            {
                var testInfo = ExtractTestInfo(method, classLevelTags, request.TestPropertyName);
                tests.Add(testInfo);
            }

            return new ParsingResponse
            {
                ClassName = className,
                Tests = tests
            };
        }
        catch (Exception ex)
        {
            return new ParsingResponse
            {
                Error = $"Error parsing file: {ex.Message}"
            };
        }
    }

    private bool IsTestClass(ClassDeclarationSyntax classDecl)
    {
        // Check if class has [TestFixture] attribute or contains test methods
        var hasTestFixture = classDecl.AttributeLists
            .SelectMany(al => al.Attributes)
            .Any(attr => IsAttributeNamed(attr, "TestFixture"));

        if (hasTestFixture)
            return true;

        // Fallback: check if class contains any test methods
        return classDecl.DescendantNodes()
            .OfType<MethodDeclarationSyntax>()
            .Any(IsTestMethod);
    }

    private bool IsTestMethod(MethodDeclarationSyntax method)
    {
        return method.AttributeLists
            .SelectMany(al => al.Attributes)
            .Any(attr => IsAttributeNamed(attr, "Test") || IsAttributeNamed(attr, "TestCase"));
    }

    private TestInfo ExtractTestInfo(
        MethodDeclarationSyntax method,
        List<string> classLevelTags,
        string testPropertyName)
    {
        var methodName = method.Identifier.ValueText;
        var allAttributes = method.AttributeLists.SelectMany(al => al.Attributes).ToList();

        // Extract tags (Category and Tag attributes)
        var methodTags = ExtractTagsFromAttributes(method.AttributeLists);
        var allTags = classLevelTags.Concat(methodTags).Distinct().ToList();

        // Extract TestProperty for ADO ID
        var testPropertyValue = ExtractTestPropertyValue(allAttributes, testPropertyName);
        var hasTestCaseId = !string.IsNullOrEmpty(testPropertyValue);

        // Check for TestCase attribute (has parameters)
        var hasTestCaseParams = allAttributes.Any(attr => IsAttributeNamed(attr, "TestCase"));

        // Extract method code
        var methodCode = method.ToFullString().Trim();

        return new TestInfo
        {
            Name = methodName,
            HasTestCaseId = hasTestCaseId,
            AdoId = testPropertyValue,
            Tags = allTags,
            HasTestCaseParams = hasTestCaseParams,
            Code = methodCode
        };
    }

    private List<string> ExtractTagsFromAttributes(SyntaxList<AttributeListSyntax> attributeLists)
    {
        var tags = new List<string>();

        foreach (var attrList in attributeLists)
        {
            foreach (var attr in attrList.Attributes)
            {
                var attrName = GetAttributeName(attr);
                
                if (attrName == "Category" || attrName == "Tag")
                {
                    var value = ExtractAttributeStringValue(attr);
                    if (!string.IsNullOrEmpty(value))
                    {
                        tags.Add(value);
                    }
                }
            }
        }

        return tags;
    }

    private string? ExtractTestPropertyValue(List<AttributeSyntax> attributes, string propertyName)
    {
        foreach (var attr in attributes)
        {
            var attrName = GetAttributeName(attr);
            
            if (attrName == "Property" || attrName == "TestProperty")
            {
                // Property attributes have format: [Property("Name", "Value")]
                var argList = attr.ArgumentList;
                if (argList != null)
                {
                    var args = argList.Arguments;
                    if (args.Count >= 2)
                    {
                        var firstArg = args[0];
                        var propertyNameValue = ExtractAttributeArgumentValue(firstArg);
                        
                        if (propertyNameValue?.Equals(propertyName, StringComparison.OrdinalIgnoreCase) == true)
                        {
                            var secondArg = args[1];
                            return ExtractAttributeArgumentValue(secondArg);
                        }
                    }
                }
            }
        }

        return null;
    }

    private string? ExtractAttributeStringValue(AttributeSyntax attr)
    {
        var argList = attr.ArgumentList;
        if (argList == null || argList.Arguments.Count == 0)
            return null;

        var firstArg = argList.Arguments[0];
        return ExtractAttributeArgumentValue(firstArg);
    }

    private string? ExtractAttributeArgumentValue(AttributeArgumentSyntax arg)
    {
        // Handle string literals
        if (arg.Expression is LiteralExpressionSyntax literal)
        {
            return literal.Token.Value?.ToString();
        }

        // Handle other expression types (could be expanded)
        return arg.Expression.ToFullString().Trim('"', '\'');
    }

    private bool IsAttributeNamed(AttributeSyntax attr, string name)
    {
        var attrName = GetAttributeName(attr);
        return attrName.Equals(name, StringComparison.OrdinalIgnoreCase);
    }

    private string GetAttributeName(AttributeSyntax attr)
    {
        // Handle simple names: [Test]
        if (attr.Name is SimpleNameSyntax simpleName)
        {
            return simpleName.Identifier.ValueText;
        }

        // Handle qualified names: [NUnit.Framework.Test]
        if (attr.Name is QualifiedNameSyntax qualifiedName)
        {
            return qualifiedName.Right.Identifier.ValueText;
        }

        // Handle generic names: [Test<T>]
        if (attr.Name is GenericNameSyntax genericName)
        {
            return genericName.Identifier.ValueText;
        }

        return attr.Name.ToFullString();
    }
}

