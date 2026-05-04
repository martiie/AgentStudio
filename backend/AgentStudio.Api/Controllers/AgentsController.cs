using AgentStudio.Api.Data;
using AgentStudio.Api.Dtos;
using AgentStudio.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentStudio.Api.Controllers;

[ApiController]
[Route("api/agents")]
public sealed class AgentsController(AgentStudioDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AgentDefinition>>> GetAgents() =>
        Ok(await dbContext.Agents.OrderByDescending(x => x.IsTemplate).ThenBy(x => x.Name).ToListAsync());

    [HttpPost]
    public async Task<ActionResult<AgentDefinition>> CreateAgent([FromBody] AgentUpsertRequest request)
    {
        var agent = new AgentDefinition();
        Apply(agent, request);
        dbContext.Agents.Add(agent);
        await dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAgents), new { id = agent.Id }, agent);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AgentDefinition>> UpdateAgent(Guid id, [FromBody] AgentUpsertRequest request)
    {
        var agent = await dbContext.Agents.FindAsync(id);
        if (agent is null)
        {
            return NotFound();
        }

        Apply(agent, request);
        await dbContext.SaveChangesAsync();
        return Ok(agent);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAgent(Guid id)
    {
        var agent = await dbContext.Agents.FindAsync(id);
        if (agent is null)
        {
            return NotFound();
        }

        dbContext.Agents.Remove(agent);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(AgentDefinition agent, AgentUpsertRequest request)
    {
        agent.Name = request.Name.Trim();
        agent.Role = request.Role.Trim();
        agent.Description = request.Description.Trim();
        agent.ModelPreference = request.ModelPreference.Trim();
        agent.ToolsAllowed = request.ToolsAllowed.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
        agent.Instructions = request.Instructions.Trim();
        agent.Tags = request.Tags.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
        agent.IsTemplate = request.IsTemplate;
        agent.UpdatedAt = DateTimeOffset.UtcNow;
    }
}
