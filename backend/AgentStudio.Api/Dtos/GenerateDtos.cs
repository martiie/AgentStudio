namespace AgentStudio.Api.Dtos;

public sealed record ClaudeGeneratorRequest(
    Guid? ProjectProfileId,
    List<Guid> AgentIds,
    List<Guid> SkillIds,
    List<Guid> RoutingRuleIds);

public sealed record GeneratedFileDto(
    string FileName,
    string RelativePath,
    string Content,
    string FileType);

public sealed record ExportRequest(List<GeneratedFileDto> Files);
