using AgentStudio.Api.Dtos;
using AgentStudio.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgentStudio.Api.Controllers;

[ApiController]
[Route("api/workspace")]
public sealed class WorkspaceController(WorkspaceScannerService workspaceScannerService) : ControllerBase
{
    [HttpGet("browse")]
    public ActionResult<BrowseWorkspaceResponseDto> BrowseWorkspace()
    {
        try
        {
            var directoryPath = workspaceScannerService.BrowseForDirectory();
            return string.IsNullOrWhiteSpace(directoryPath)
                ? NoContent()
                : Ok(new BrowseWorkspaceResponseDto(directoryPath));
        }
        catch (Exception exception) when (exception is InvalidOperationException or PlatformNotSupportedException)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("recent")]
    public ActionResult<RecentWorkspacesResponseDto> GetRecentWorkspaces()
    {
        return Ok(workspaceScannerService.GetRecentWorkspaces());
    }

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

    [HttpPost("staff-avatar")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public ActionResult<WorkspaceAvatarUploadResponseDto> UploadStaffAvatar([FromForm] WorkspaceAvatarUploadRequest request)
    {
        try
        {
            return Ok(workspaceScannerService.SaveStaffAvatar(request));
        }
        catch (Exception exception) when (exception is DirectoryNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("asset")]
    public IActionResult GetWorkspaceAsset([FromQuery] string directoryPath, [FromQuery] string relativePath)
    {
        try
        {
            var asset = workspaceScannerService.ResolveWorkspaceAsset(directoryPath, relativePath);
            return PhysicalFile(asset.FullPath, asset.ContentType);
        }
        catch (Exception exception) when (exception is DirectoryNotFoundException or FileNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("file")]
    public ActionResult<WorkspaceFileContentDto> GetWorkspaceFile([FromQuery] string directoryPath, [FromQuery] string relativePath)
    {
        try
        {
            return Ok(workspaceScannerService.ReadWorkspaceTextFile(directoryPath, relativePath));
        }
        catch (Exception exception) when (exception is DirectoryNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("file")]
    public ActionResult<WorkspaceFileContentDto> SaveWorkspaceFile([FromBody] SaveWorkspaceFileRequest request)
    {
        try
        {
            return Ok(workspaceScannerService.SaveWorkspaceTextFile(request));
        }
        catch (Exception exception) when (exception is DirectoryNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("open-folder")]
    public ActionResult<WorkspaceFolderOpenResponseDto> OpenWorkspaceFolder([FromBody] OpenWorkspaceFolderRequest request)
    {
        try
        {
            return Ok(workspaceScannerService.OpenWorkspaceFolder(request));
        }
        catch (Exception exception) when (exception is DirectoryNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
