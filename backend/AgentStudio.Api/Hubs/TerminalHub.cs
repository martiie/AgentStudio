using AgentStudio.Api.Services;
using Microsoft.AspNetCore.SignalR;

namespace AgentStudio.Api.Hubs;

public sealed class TerminalHub(ClaudeTerminalService terminalService) : Hub
{
    public Task StartClaude(Guid projectProfileId) =>
        terminalService.StartClaudeAsync(Context.ConnectionId, projectProfileId);

    public Task SendInput(string input) =>
        terminalService.SendInputAsync(Context.ConnectionId, input);

    public Task StopClaude() =>
        terminalService.StopClaudeAsync(Context.ConnectionId);

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await terminalService.StopClaudeAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
