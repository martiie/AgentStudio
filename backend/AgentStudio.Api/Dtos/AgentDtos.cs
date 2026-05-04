namespace AgentStudio.Api.Dtos;

public sealed record AgentUpsertRequest(
    string Name,
    string Role,
    string Description,
    string ModelPreference,
    List<string> ToolsAllowed,
    string Instructions,
    List<string> Tags,
    bool IsTemplate);
