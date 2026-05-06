namespace AgentStudio.Api.Dtos;

public sealed record WorkspaceScanRequest(string DirectoryPath);

public sealed record BrowseWorkspaceResponseDto(string DirectoryPath);
public sealed record RecentWorkspaceDto(string DirectoryPath, string Name, DateTimeOffset LastOpenedAt);
public sealed record RecentWorkspacesResponseDto(List<RecentWorkspaceDto> Items);
public sealed record WorkspaceFileContentDto(string RelativePath, string Content, bool Exists);
public sealed record SaveWorkspaceFileRequest(string DirectoryPath, string RelativePath, string Content);
public sealed record OpenWorkspaceFolderRequest(string DirectoryPath, string RelativePath, string Kind);
public sealed record WorkspaceFolderOpenResponseDto(string FolderPath);

public sealed record DetectedWorkspaceItemDto(
    string FileName,
    string FullPath,
    string RelativePath,
    string SuggestedName,
    string Kind,
    string Content,
    string? Role,
    string? Description,
    string? ModelPreference,
    List<string> ToolsAllowed,
    string? Instructions,
    List<string> Tags,
    string? Purpose,
    string? TriggerCondition,
    List<string> Steps,
    List<string> Examples,
    string? AvatarRelativePath);

public sealed record WorkspaceScanResultDto(
    string DirectoryPath,
    string SuggestedProjectName,
    string SuggestedTechStack,
    string SuggestedFolderStructure,
    string SuggestedImportantCommands,
    List<DetectedWorkspaceItemDto> Agents,
    List<DetectedWorkspaceItemDto> Skills,
    List<string> Notes,
    ParsedClaudeWorkspaceDto? Claude);

public sealed record ParsedClaudeRoutingRuleDto(
    int Priority,
    string Condition,
    string TargetAgentName);

public sealed record ParsedClaudeWorkspaceDto(
    string RelativePath,
    string? ProjectName,
    string? TechStack,
    string? CodingRules,
    string? FolderStructure,
    string? ImportantCommands,
    List<string> ActiveAgentNames,
    List<string> ActiveSkillNames,
    List<ParsedClaudeRoutingRuleDto> RoutingRules);

public sealed class WorkspaceAvatarUploadRequest
{
    public string DirectoryPath { get; set; } = string.Empty;
    public string StaffName { get; set; } = string.Empty;
    public string? StaffFolderName { get; set; }
    public IFormFile? File { get; set; }
}

public sealed record WorkspaceAvatarUploadResponseDto(
    string StaffFolderName,
    string AvatarRelativePath);
