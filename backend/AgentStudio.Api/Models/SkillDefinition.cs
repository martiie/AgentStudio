namespace AgentStudio.Api.Models;

public sealed class SkillDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public string TriggerCondition { get; set; } = string.Empty;
    public List<string> Steps { get; set; } = [];
    public List<string> Examples { get; set; } = [];
    public bool IsTemplate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
