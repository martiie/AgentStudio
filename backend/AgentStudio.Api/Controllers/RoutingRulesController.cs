using AgentStudio.Api.Data;
using AgentStudio.Api.Dtos;
using AgentStudio.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentStudio.Api.Controllers;

[ApiController]
[Route("api/routing-rules")]
public sealed class RoutingRulesController(AgentStudioDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoutingRule>>> GetRules() =>
        Ok(await dbContext.RoutingRules.Include(x => x.Agent).OrderBy(x => x.Priority).ToListAsync());

    [HttpPost]
    public async Task<ActionResult<RoutingRule>> CreateRule([FromBody] RoutingRuleUpsertRequest request)
    {
        var rule = new RoutingRule();
        Apply(rule, request);
        dbContext.RoutingRules.Add(rule);
        await dbContext.SaveChangesAsync();
        await dbContext.Entry(rule).Reference(x => x.Agent).LoadAsync();
        return CreatedAtAction(nameof(GetRules), new { id = rule.Id }, rule);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RoutingRule>> UpdateRule(Guid id, [FromBody] RoutingRuleUpsertRequest request)
    {
        var rule = await dbContext.RoutingRules.Include(x => x.Agent).FirstOrDefaultAsync(x => x.Id == id);
        if (rule is null)
        {
            return NotFound();
        }

        Apply(rule, request);
        await dbContext.SaveChangesAsync();
        await dbContext.Entry(rule).Reference(x => x.Agent).LoadAsync();
        return Ok(rule);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRule(Guid id)
    {
        var rule = await dbContext.RoutingRules.FindAsync(id);
        if (rule is null)
        {
            return NotFound();
        }

        dbContext.RoutingRules.Remove(rule);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(RoutingRule rule, RoutingRuleUpsertRequest request)
    {
        rule.Name = request.Name.Trim();
        rule.Condition = request.Condition.Trim();
        rule.AgentId = request.AgentId;
        rule.Priority = request.Priority;
        rule.IsEnabled = request.IsEnabled;
    }
}
