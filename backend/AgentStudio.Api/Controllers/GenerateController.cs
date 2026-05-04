using AgentStudio.Api.Data;
using AgentStudio.Api.Dtos;
using AgentStudio.Api.Models;
using AgentStudio.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentStudio.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class GenerateController(AgentStudioDbContext dbContext, MarkdownComposer markdownComposer) : ControllerBase
{
    [HttpPost("generate/claude-md")]
    public async Task<ActionResult<IEnumerable<GeneratedFileDto>>> GenerateClaude([FromBody] ClaudeGeneratorRequest request)
    {
        var agents = await dbContext.Agents
            .Where(x => request.AgentIds.Contains(x.Id))
            .OrderBy(x => x.Name)
            .ToListAsync();

        var skills = await dbContext.Skills
            .Where(x => request.SkillIds.Contains(x.Id))
            .OrderBy(x => x.Name)
            .ToListAsync();

        var rules = await dbContext.RoutingRules
            .Include(x => x.Agent)
            .Where(x => request.RoutingRuleIds.Contains(x.Id))
            .OrderBy(x => x.Priority)
            .ToListAsync();

        var profile = request.ProjectProfileId is null
            ? null
            : await dbContext.ProjectProfiles.FindAsync(request.ProjectProfileId.Value);

        var files = new List<GeneratedFileDto>
        {
            new(
                "CLAUDE.md",
                "/CLAUDE.md",
                markdownComposer.BuildClaudeMarkdown(profile, agents, skills, rules),
                "claude")
        };

        files.AddRange(agents.Select(agent => new GeneratedFileDto(
            $"{ToSlug(agent.Name)}.md",
            $"/.claude/agents/{ToSlug(agent.Name)}.md",
            markdownComposer.BuildAgentMarkdown(agent),
            "agent")));

        files.AddRange(skills.Select(skill => new GeneratedFileDto(
            $"{ToSlug(skill.Name)}.md",
            $"/.claude/skills/{ToSlug(skill.Name)}.md",
            markdownComposer.BuildSkillMarkdown(skill),
            "skill")));

        return Ok(files);
    }

    [HttpPost("export")]
    public async Task<ActionResult<IEnumerable<GeneratedFileRecord>>> ExportFiles([FromBody] ExportRequest request)
    {
        var records = request.Files.Select(file => new GeneratedFileRecord
        {
            FileName = file.FileName,
            RelativePath = file.RelativePath,
            Content = file.Content,
            FileType = file.FileType
        }).ToList();

        dbContext.GeneratedFiles.AddRange(records);
        await dbContext.SaveChangesAsync();
        return Ok(records);
    }

    private static string ToSlug(string value) =>
        string.Join('-', value
            .ToLowerInvariant()
            .Split([' ', '/', '\\', '_'], StringSplitOptions.RemoveEmptyEntries));
}
