namespace AgentStudio.Api.Dtos;

public sealed record SkillUpsertRequest(
    string Name,
    string Purpose,
    string TriggerCondition,
    List<string> Steps,
    List<string> Examples,
    bool IsTemplate);
