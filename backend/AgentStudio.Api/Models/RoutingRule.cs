namespace AgentStudio.Api.Models;

public sealed class RoutingRule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public Guid? AgentId { get; set; }
    public AgentDefinition? Agent { get; set; }
    public int Priority { get; set; }
    public bool IsEnabled { get; set; } = true;
}
