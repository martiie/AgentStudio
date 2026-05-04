namespace AgentStudio.Api.Models;

public sealed class ProjectProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ProjectName { get; set; } = string.Empty;
    public string ProjectPath { get; set; } = string.Empty;
    public string TechStack { get; set; } = string.Empty;
    public string CodingRules { get; set; } = string.Empty;
    public string FolderStructure { get; set; } = string.Empty;
    public string ImportantCommands { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
