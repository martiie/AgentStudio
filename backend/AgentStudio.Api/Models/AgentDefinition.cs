namespace AgentStudio.Api.Models;

public sealed class AgentDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ModelPreference { get; set; } = "claude-3-7-sonnet";
    public List<string> ToolsAllowed { get; set; } = [];
    public string Instructions { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = [];
    public bool IsTemplate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
