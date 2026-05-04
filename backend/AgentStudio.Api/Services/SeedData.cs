using AgentStudio.Api.Data;
using AgentStudio.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AgentStudio.Api.Services;

public static class SeedData
{
    public static async Task EnsureSeededAsync(AgentStudioDbContext dbContext)
    {
        await dbContext.Database.EnsureCreatedAsync();

        if (!await dbContext.Agents.AnyAsync())
        {
            dbContext.Agents.AddRange(
                new AgentDefinition
                {
                    Name = "Frontend React Agent",
                    Role = "Frontend Engineer",
                    Description = "Builds React + TypeScript UI with strong UX and clear component structure.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["edit-files", "run-tests", "browser-inspect"],
                    Instructions = "Focus on usability, responsive layout, and understandable code.",
                    Tags = ["react", "frontend", "ui"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "ASP.NET Core Backend Agent",
                    Role = "Backend Engineer",
                    Description = "Designs APIs, business rules, and clean service boundaries in ASP.NET Core.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["edit-files", "run-api", "database-migrations"],
                    Instructions = "Prefer simple REST endpoints, clear DTOs, and maintainable service code.",
                    Tags = ["backend", "dotnet", "api"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Python ML Agent",
                    Role = "ML Engineer",
                    Description = "Maintains Python pipelines, inference services, and lightweight model integrations.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["edit-files", "run-python", "analyze-data"],
                    Instructions = "Keep inference reliable, measurable, and easy to deploy.",
                    Tags = ["python", "ml", "inference"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "AI Vision Defect Detection Agent",
                    Role = "Computer Vision Specialist",
                    Description = "Handles image inspection, defect detection logic, and annotation workflow design.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["edit-files", "run-python", "review-images"],
                    Instructions = "Prioritize explainability, threshold tuning, and production-safe validation.",
                    Tags = ["vision", "inspection", "qa"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Code Reviewer Agent",
                    Role = "Reviewer",
                    Description = "Finds bugs, regressions, and missing test coverage before merge.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["read-files", "diff-review", "run-tests"],
                    Instructions = "Lead with concrete findings and reference files clearly.",
                    Tags = ["review", "quality", "testing"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Documentation Writer Agent",
                    Role = "Technical Writer",
                    Description = "Creates onboarding docs, architecture notes, and developer-friendly guides.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["read-files", "edit-files"],
                    Instructions = "Write clearly for beginners and keep docs close to the code.",
                    Tags = ["docs", "writing", "onboarding"],
                    IsTemplate = true
                });
        }

        if (!await dbContext.Skills.AnyAsync())
        {
            dbContext.Skills.AddRange(
                new SkillDefinition
                {
                    Name = "Debug API",
                    Purpose = "Systematically diagnose backend request failures.",
                    TriggerCondition = "Use when an API endpoint returns errors or unexpected data.",
                    Steps = ["Check logs", "Reproduce request", "Inspect DTO mapping", "Verify data source"],
                    Examples = ["500 error on POST /api/agents", "Null response from profile endpoint"],
                    IsTemplate = true
                },
                new SkillDefinition
                {
                    Name = "Review Pull Request",
                    Purpose = "Evaluate code changes for bugs, readability, and test gaps.",
                    TriggerCondition = "Use when reviewing changed files before merge.",
                    Steps = ["Read diff", "Check behavior changes", "Look for edge cases", "Call out missing tests"],
                    Examples = ["Review API controller changes", "Review React form validation changes"],
                    IsTemplate = true
                });
        }

        if (!await dbContext.ProjectProfiles.AnyAsync())
        {
            dbContext.ProjectProfiles.Add(new ProjectProfile
            {
                ProjectName = "Starter Full-Stack Workspace",
                ProjectPath = "D:\\0TOP\\research\\Codex-Agent",
                TechStack = "React + TypeScript frontend, ASP.NET Core backend, Python ML inference pipeline",
                CodingRules = "- Keep components small\n- Prefer REST APIs\n- Write practical comments only when needed",
                FolderStructure = "/frontend for UI\n/backend for Web API\n/ml for Python inference services",
                ImportantCommands = "npm run dev\ndotnet run\npython app.py"
            });
        }

        await dbContext.SaveChangesAsync();

        if (!await dbContext.RoutingRules.AnyAsync())
        {
            var frontendAgent = await dbContext.Agents.FirstAsync(x => x.Name == "Frontend React Agent");
            var backendAgent = await dbContext.Agents.FirstAsync(x => x.Name == "ASP.NET Core Backend Agent");
            var mlAgent = await dbContext.Agents.FirstAsync(x => x.Name == "Python ML Agent");

            dbContext.RoutingRules.AddRange(
                new RoutingRule { Name = "Frontend Tasks", Condition = "task is frontend", AgentId = frontendAgent.Id, Priority = 1, IsEnabled = true },
                new RoutingRule { Name = "Backend Tasks", Condition = "task is backend", AgentId = backendAgent.Id, Priority = 2, IsEnabled = true },
                new RoutingRule { Name = "ML Tasks", Condition = "task is ML", AgentId = mlAgent.Id, Priority = 3, IsEnabled = true });

            await dbContext.SaveChangesAsync();
        }
    }
}
