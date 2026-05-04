using AgentStudio.Api.Data;
using AgentStudio.Api.Dtos;
using AgentStudio.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentStudio.Api.Controllers;

[ApiController]
[Route("api/skills")]
public sealed class SkillsController(AgentStudioDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SkillDefinition>>> GetSkills() =>
        Ok(await dbContext.Skills.OrderByDescending(x => x.IsTemplate).ThenBy(x => x.Name).ToListAsync());

    [HttpPost]
    public async Task<ActionResult<SkillDefinition>> CreateSkill([FromBody] SkillUpsertRequest request)
    {
        var skill = new SkillDefinition();
        Apply(skill, request);
        dbContext.Skills.Add(skill);
        await dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSkills), new { id = skill.Id }, skill);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SkillDefinition>> UpdateSkill(Guid id, [FromBody] SkillUpsertRequest request)
    {
        var skill = await dbContext.Skills.FindAsync(id);
        if (skill is null)
        {
            return NotFound();
        }

        Apply(skill, request);
        await dbContext.SaveChangesAsync();
        return Ok(skill);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSkill(Guid id)
    {
        var skill = await dbContext.Skills.FindAsync(id);
        if (skill is null)
        {
            return NotFound();
        }

        dbContext.Skills.Remove(skill);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(SkillDefinition skill, SkillUpsertRequest request)
    {
        skill.Name = request.Name.Trim();
        skill.Purpose = request.Purpose.Trim();
        skill.TriggerCondition = request.TriggerCondition.Trim();
        skill.Steps = request.Steps.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
        skill.Examples = request.Examples.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
        skill.IsTemplate = request.IsTemplate;
        skill.UpdatedAt = DateTimeOffset.UtcNow;
    }
}
