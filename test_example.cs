using System.Threading.Tasks;
using NUnit.Framework;

[TestFixture]
public class TestExample
{
    // This should be detected as having ADOTestCaseId
    [Test,Art, olb, tp_vulnerability]
    [Svc_Pp_zelle_api,Svc_Pr_zelle_api,svc_voyager,svc_voyager45,svc_voyager45pp,svc_voyagerpp]
    [digital_tokenapi_inside_becu_org,digital_tokenapi_inside_test,digital_tokenapipp_inside_becu_org]
    [Property("Title", "Verify Zelle Launches")]
    [Property("ADOTestCaseId", "950316")]
    public async Task ART_ZelleLaunchesFromOlb()
    {
        // Test implementation
    }

    // This should be detected as NOT having ADOTestCaseId
    [Test]
    [Property("Title", "Some other test")]
    public async Task SomeOtherTest()
    {
        // Test implementation
    }

    // This should be ignored (commented out)
    //[Test]
    //[Property("ADOTestCaseId", "123456")]
    public async Task CommentedOutTest()
    {
        // Test implementation
    }
}