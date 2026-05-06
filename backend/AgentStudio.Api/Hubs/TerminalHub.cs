using AgentStudio.Api.Services;
using Microsoft.AspNetCore.SignalR;

namespace AgentStudio.Api.Hubs;

public sealed class TerminalHub(TerminalSessionService terminalService) : Hub
{
    public Task StartTerminalAtPath(string projectPath, string terminalType, int cols, int rows) =>
        terminalService.StartTerminalAtPathAsync(Context.ConnectionId, projectPath, terminalType, cols, rows);

    public Task StartTerminal(Guid projectProfileId, string terminalType, int cols, int rows) =>
        terminalService.StartTerminalAsync(Context.ConnectionId, projectProfileId, terminalType, cols, rows);

    public Task SendInput(string input) =>
        terminalService.SendInputAsync(Context.ConnectionId, input);

    public Task ResizeTerminal(int cols, int rows) =>
        terminalService.ResizeTerminalAsync(Context.ConnectionId, cols, rows);

    public Task StopTerminal() =>
        terminalService.StopTerminalAsync(Context.ConnectionId);

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await terminalService.StopTerminalAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
