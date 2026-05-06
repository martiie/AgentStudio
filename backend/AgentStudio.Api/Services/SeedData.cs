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
                    Name = "Frontend Design Staff",
                    Role = "UI Specialist",
                    Description = "Owns the web interface, page flow, component structure, and user-facing polish.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["edit-files", "run-tests", "browser-inspect"],
                    Instructions = "Turn product requests into clean screens, responsive layouts, and easy-to-understand UI code.",
                    Tags = ["office", "frontend", "ui"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Backend Systems Staff",
                    Role = "API Specialist",
                    Description = "Runs the server-side desk, API contracts, business rules, and data flow.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["edit-files", "run-api", "database-migrations"],
                    Instructions = "Keep endpoints clear, DTOs tidy, and service boundaries maintainable for the whole office.",
                    Tags = ["office", "backend", "api"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Automation and Data Staff",
                    Role = "Automation Specialist",
                    Description = "Handles scripts, Python workflows, integrations, and repetitive work that should be automated.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["edit-files", "run-python", "analyze-data"],
                    Instructions = "Automate repeatable tasks, keep data workflows dependable, and make operational work lighter for the team.",
                    Tags = ["office", "automation", "python"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Quality Assurance Staff",
                    Role = "QA Specialist",
                    Description = "Checks finished work for bugs, regressions, risky assumptions, and missing coverage.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["read-files", "diff-review", "run-tests"],
                    Instructions = "Review work like an internal auditor: be precise, practical, and clear about what needs fixing before sign-off.",
                    Tags = ["office", "qa", "review"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Documentation Staff",
                    Role = "Knowledge Specialist",
                    Description = "Writes playbooks, onboarding notes, internal references, and handoff-friendly documentation.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["read-files", "edit-files"],
                    Instructions = "Write so that a new teammate can follow along quickly without needing extra meetings.",
                    Tags = ["office", "docs", "writing"],
                    IsTemplate = true
                },
                new AgentDefinition
                {
                    Name = "Release and Operations Staff",
                    Role = "Operations Specialist",
                    Description = "Prepares builds, release steps, deployment notes, and routine maintenance tasks.",
                    ModelPreference = "claude-3-7-sonnet",
                    ToolsAllowed = ["read-files", "edit-files", "run-tests"],
                    Instructions = "Keep delivery predictable, document release steps, and reduce operational surprises.",
                    Tags = ["office", "ops", "release"],
                    IsTemplate = true
                });
        }

        if (!await dbContext.Skills.AnyAsync())
        {
            dbContext.Skills.AddRange(
                new SkillDefinition
                {
                    Name = "Inbox Triage",
                    Purpose = "Turn a rough incoming request into a clear assignment for the right office staff member.",
                    TriggerCondition = "Use when a request is broad, mixed, or still unclear about ownership.",
                    Steps = ["Summarize the request", "Identify the main deliverable", "Choose the primary owner", "List any supporting staff needed"],
                    Examples = ["A feature request touches both frontend and backend", "A bug report includes UI, API, and docs impact"],
                    IsTemplate = true
                },
                new SkillDefinition
                {
                    Name = "Office Handoff Review",
                    Purpose = "Check that work is ready to hand from one staff role to another without confusion.",
                    TriggerCondition = "Use before sign-off, release, or passing work between specialists.",
                    Steps = ["Confirm the outcome", "Check linked files and commands", "List risks or follow-ups", "Make the next owner explicit"],
                    Examples = ["Frontend work ready for QA", "Backend changes ready for release notes"],
                    IsTemplate = true
                },
                new SkillDefinition
                {
                    Name = "Weekly Status Summary",
                    Purpose = "Wrap up progress, blockers, and next actions in a manager-friendly update.",
                    TriggerCondition = "Use when CLAUDE.md needs a short status report across multiple workstreams.",
                    Steps = ["List completed work", "Call out blockers", "Name the current owner", "State the next action"],
                    Examples = ["Summarize sprint progress", "Prepare a daily handoff note for the team lead"],
                    IsTemplate = true
                });
        }

        if (!await dbContext.ProjectProfiles.AnyAsync())
        {
            dbContext.ProjectProfiles.Add(new ProjectProfile
            {
                ProjectName = "Agent Office Workspace",
                ProjectPath = "D:\\0TOP\\research\\Codex-Agent",
                TechStack = "React + TypeScript frontend, ASP.NET Core backend, and Python automation helpers",
                CodingRules = "- CLAUDE.md acts as the team lead and delegation brief\n- Give each staff file one clear specialty\n- Keep instructions short, practical, and easy to hand off",
                FolderStructure = "/frontend for office-facing UI\n/backend for API and business rules\n/.claude/agents for specialist staff files\n/.claude/skills for reusable office workflows",
                ImportantCommands = "cd frontend && npm run dev\ncd backend/AgentStudio.Api && dotnet run\n.\\publish.ps1 -SkipFrontendInstall"
            });
        }

        await dbContext.SaveChangesAsync();

        if (!await dbContext.RoutingRules.AnyAsync())
        {
            var frontendAgent = await dbContext.Agents.FirstAsync(x => x.Name == "Frontend Design Staff");
            var backendAgent = await dbContext.Agents.FirstAsync(x => x.Name == "Backend Systems Staff");
            var automationAgent = await dbContext.Agents.FirstAsync(x => x.Name == "Automation and Data Staff");
            var qaAgent = await dbContext.Agents.FirstAsync(x => x.Name == "Quality Assurance Staff");
            var docsAgent = await dbContext.Agents.FirstAsync(x => x.Name == "Documentation Staff");

            dbContext.RoutingRules.AddRange(
                new RoutingRule { Name = "UI Desk", Condition = "task is about screens, layout, styling, or UX", AgentId = frontendAgent.Id, Priority = 1, IsEnabled = true },
                new RoutingRule { Name = "API Desk", Condition = "task is about endpoints, business rules, or data flow", AgentId = backendAgent.Id, Priority = 2, IsEnabled = true },
                new RoutingRule { Name = "Automation Desk", Condition = "task is repetitive, Python-based, or integration-heavy", AgentId = automationAgent.Id, Priority = 3, IsEnabled = true },
                new RoutingRule { Name = "QA Desk", Condition = "task is about review, bugs, regressions, or testing", AgentId = qaAgent.Id, Priority = 4, IsEnabled = true },
                new RoutingRule { Name = "Documentation Desk", Condition = "task needs onboarding notes, guides, or handoff docs", AgentId = docsAgent.Id, Priority = 5, IsEnabled = true });

            await dbContext.SaveChangesAsync();
        }
    }
}
