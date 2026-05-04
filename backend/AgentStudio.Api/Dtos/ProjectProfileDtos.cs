namespace AgentStudio.Api.Dtos;

public sealed record ProjectProfileUpsertRequest(
    string ProjectName,
    string ProjectPath,
    string TechStack,
    string CodingRules,
    string FolderStructure,
    string ImportantCommands);
