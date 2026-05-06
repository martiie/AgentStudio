using System.Text;
using AgentStudio.Api.Models;

namespace AgentStudio.Api.Services;

public sealed class MarkdownComposer
{
    public string BuildAgentMarkdown(AgentDefinition agent)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"# {agent.Name}");
        builder.AppendLine();
        builder.AppendLine($"**Role:** {agent.Role}");
        builder.AppendLine();
        builder.AppendLine("## Office Responsibility");
        builder.AppendLine("This file describes one office staff member who reports up through `CLAUDE.md`.");
        builder.AppendLine();
        builder.AppendLine("## Description");
        builder.AppendLine(agent.Description);
        builder.AppendLine();
        builder.AppendLine("## Model Preference");
        builder.AppendLine(agent.ModelPreference);
        builder.AppendLine();
        builder.AppendLine("## Allowed Tools");
        foreach (var tool in agent.ToolsAllowed)
        {
            builder.AppendLine($"- {tool}");
        }
        builder.AppendLine();
        builder.AppendLine("## Instructions");
        builder.AppendLine(agent.Instructions);
        builder.AppendLine();
        builder.AppendLine("## Tags");
        builder.AppendLine(string.Join(", ", agent.Tags));
        return builder.ToString().Trim();
    }

    public string BuildSkillMarkdown(SkillDefinition skill)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"# {skill.Name}");
        builder.AppendLine();
        builder.AppendLine("## Purpose");
        builder.AppendLine(skill.Purpose);
        builder.AppendLine();
        builder.AppendLine("## Trigger Condition");
        builder.AppendLine(skill.TriggerCondition);
        builder.AppendLine();
        builder.AppendLine("## Steps");
        foreach (var step in skill.Steps)
        {
            builder.AppendLine($"- {step}");
        }
        builder.AppendLine();
        builder.AppendLine("## Examples");
        foreach (var example in skill.Examples)
        {
            builder.AppendLine($"- {example}");
        }
        return builder.ToString().Trim();
    }

    public string BuildClaudeMarkdown(
        ProjectProfile? profile,
        IReadOnlyCollection<AgentDefinition> agents,
        IReadOnlyCollection<SkillDefinition> skills,
        IReadOnlyCollection<RoutingRule> rules)
    {
        var builder = new StringBuilder();
        builder.AppendLine("# CLAUDE.md");
        builder.AppendLine();
        builder.AppendLine("## Office Leadership");
        builder.AppendLine("`CLAUDE.md` is the office manager. It keeps the shared context, sets the rules, and delegates work to the right specialist files in `.claude/agents/`.");
        builder.AppendLine();
        builder.AppendLine("## Project Context");
        if (profile is null)
        {
            builder.AppendLine("No project profile selected yet.");
        }
        else
        {
            builder.AppendLine($"**Project:** {profile.ProjectName}");
            builder.AppendLine($"**Tech Stack:** {profile.TechStack}");
            builder.AppendLine();
            builder.AppendLine("### Coding Rules");
            builder.AppendLine(profile.CodingRules);
            builder.AppendLine();
            builder.AppendLine("### Folder Structure");
            builder.AppendLine(profile.FolderStructure);
            builder.AppendLine();
            builder.AppendLine("### Important Commands");
            builder.AppendLine(profile.ImportantCommands);
        }

        builder.AppendLine();
        builder.AppendLine("## Office Staff");
        foreach (var agent in agents.OrderBy(x => x.Name))
        {
            builder.AppendLine($"- **{agent.Name}**: {agent.Role} ({agent.ModelPreference})");
        }

        builder.AppendLine();
        builder.AppendLine("## Active Skills");
        foreach (var skill in skills.OrderBy(x => x.Name))
        {
            builder.AppendLine($"- **{skill.Name}**: {skill.TriggerCondition}");
        }

        builder.AppendLine();
        builder.AppendLine("## Routing Rules");
        foreach (var rule in rules.OrderBy(x => x.Priority))
        {
            var target = rule.Agent?.Name ?? "Unassigned agent";
            builder.AppendLine($"{rule.Priority}. If {rule.Condition} -> use {target}");
        }

        builder.AppendLine();
        builder.AppendLine("## Delegation Notes");
        builder.AppendLine("- `CLAUDE.md` should assign one primary owner per task.");
        builder.AppendLine("- Pull in support staff only when a task crosses specialties.");
        builder.AppendLine("- Keep handoffs short, explicit, and tied to files or commands.");
        builder.AppendLine();
        builder.AppendLine("## File Conventions");
        builder.AppendLine("- `CLAUDE.md` is the boss brief for the whole office.");
        builder.AppendLine("- Agent files live in `.claude/agents/`.");
        builder.AppendLine("- Skill files live in `.claude/skills/`.");
        builder.AppendLine("- Keep instructions concise, task-specific, and easy to scan.");

        return builder.ToString().Trim();
    }
}
