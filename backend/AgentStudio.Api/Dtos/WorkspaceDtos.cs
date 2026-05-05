namespace AgentStudio.Api.Dtos;

public sealed record WorkspaceScanRequest(string DirectoryPath);

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
    List<string> Examples);

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
