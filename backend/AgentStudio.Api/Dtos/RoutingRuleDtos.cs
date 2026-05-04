namespace AgentStudio.Api.Dtos;

public sealed record RoutingRuleUpsertRequest(
    string Name,
    string Condition,
    Guid? AgentId,
    int Priority,
    bool IsEnabled);
