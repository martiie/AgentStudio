using AgentStudio.Api.Data;
using AgentStudio.Api.Dtos;
using AgentStudio.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentStudio.Api.Controllers;

[ApiController]
[Route("api/project-profiles")]
public sealed class ProjectProfilesController(AgentStudioDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectProfile>>> GetProfiles() =>
        Ok(await dbContext.ProjectProfiles.OrderBy(x => x.ProjectName).ToListAsync());

    [HttpPost]
    public async Task<ActionResult<ProjectProfile>> CreateProfile([FromBody] ProjectProfileUpsertRequest request)
    {
        var profile = new ProjectProfile();
        Apply(profile, request);
        dbContext.ProjectProfiles.Add(profile);
        await dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetProfiles), new { id = profile.Id }, profile);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectProfile>> UpdateProfile(Guid id, [FromBody] ProjectProfileUpsertRequest request)
    {
        var profile = await dbContext.ProjectProfiles.FindAsync(id);
        if (profile is null)
        {
            return NotFound();
        }

        Apply(profile, request);
        await dbContext.SaveChangesAsync();
        return Ok(profile);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteProfile(Guid id)
    {
        var profile = await dbContext.ProjectProfiles.FindAsync(id);
        if (profile is null)
        {
            return NotFound();
        }

        dbContext.ProjectProfiles.Remove(profile);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(ProjectProfile profile, ProjectProfileUpsertRequest request)
    {
        profile.ProjectName = request.ProjectName.Trim();
        profile.ProjectPath = request.ProjectPath.Trim();
        profile.TechStack = request.TechStack.Trim();
        profile.CodingRules = request.CodingRules.Trim();
        profile.FolderStructure = request.FolderStructure.Trim();
        profile.ImportantCommands = request.ImportantCommands.Trim();
        profile.UpdatedAt = DateTimeOffset.UtcNow;
    }
}
