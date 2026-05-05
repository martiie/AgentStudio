using AgentStudio.Api.Dtos;
using AgentStudio.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgentStudio.Api.Controllers;

[ApiController]
[Route("api/workspace")]
public sealed class WorkspaceController(WorkspaceScannerService workspaceScannerService) : ControllerBase
{
    [HttpPost("scan")]
    public ActionResult<WorkspaceScanResultDto> ScanWorkspace([FromBody] WorkspaceScanRequest request)
    {
        try
        {
            return Ok(workspaceScannerService.Scan(request.DirectoryPath));
        }
        catch (Exception exception) when (exception is DirectoryNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
