using System.Collections.Concurrent;
using System.ComponentModel;
using System.Diagnostics;
using AgentStudio.Api.Data;
using AgentStudio.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AgentStudio.Api.Services;

public sealed class ClaudeTerminalService(IServiceScopeFactory scopeFactory, IHubContext<TerminalHub> hubContext)
{
    private readonly ConcurrentDictionary<string, ClaudeTerminalSession> _sessions = new();

    public async Task StartClaudeAsync(string connectionId, Guid projectProfileId)
    {
        await StopClaudeAsync(connectionId);

        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AgentStudioDbContext>();
        var profile = await dbContext.ProjectProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == projectProfileId);

        if (profile is null)
        {
            await SendStatusAsync(connectionId, "error", "Selected project profile was not found.");
            return;
        }

        if (string.IsNullOrWhiteSpace(profile.ProjectPath))
        {
            await SendStatusAsync(connectionId, "error", "Selected project profile does not have a project path.");
            return;
        }

        if (!Directory.Exists(profile.ProjectPath))
        {
            await SendStatusAsync(connectionId, "error", $"Project path does not exist: {profile.ProjectPath}");
            return;
        }

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "claude",
                WorkingDirectory = profile.ProjectPath,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            },
            EnableRaisingEvents = true,
        };

        var session = new ClaudeTerminalSession(process, profile.ProjectPath);
        _sessions[connectionId] = session;

        process.OutputDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrEmpty(eventArgs.Data))
            {
                _ = SendOutputAsync(connectionId, $"{eventArgs.Data}\r\n");
            }
        };

        process.ErrorDataReceived += (_, eventArgs) =>
        {
            if (!string.IsNullOrEmpty(eventArgs.Data))
            {
                _ = SendOutputAsync(connectionId, $"{eventArgs.Data}\r\n", isError: true);
            }
        };

        process.Exited += (_, _) => _ = OnProcessExitedAsync(connectionId, session);

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            await SendStatusAsync(connectionId, "running", "Claude process started.", profile.ProjectPath);
        }
        catch (Win32Exception)
        {
            _sessions.TryRemove(connectionId, out _);
            process.Dispose();
            await SendStatusAsync(
                connectionId,
                "error",
                "Claude CLI not found. Please install Claude Code and ensure 'claude' is available in PATH.",
                profile.ProjectPath);
        }
        catch (Exception exception)
        {
            _sessions.TryRemove(connectionId, out _);
            process.Dispose();
            await SendStatusAsync(connectionId, "error", $"Unable to start Claude: {exception.Message}", profile.ProjectPath);
        }
    }

    public async Task SendInputAsync(string connectionId, string input)
    {
        if (!_sessions.TryGetValue(connectionId, out var session) || session.Process.HasExited)
        {
            await SendStatusAsync(connectionId, "disconnected", "No active Claude process.");
            return;
        }

        await session.InputLock.WaitAsync();
        try
        {
            await session.Process.StandardInput.WriteAsync(input);
            await session.Process.StandardInput.FlushAsync();
        }
        catch (Exception exception)
        {
            await SendStatusAsync(connectionId, "error", $"Unable to send input: {exception.Message}", session.ProjectPath);
        }
        finally
        {
            session.InputLock.Release();
        }
    }

    public async Task StopClaudeAsync(string connectionId)
    {
        if (!_sessions.TryRemove(connectionId, out var session))
        {
            return;
        }

        if (Interlocked.Exchange(ref session.IsStopping, 1) == 1)
        {
            return;
        }

        try
        {
            if (!session.Process.HasExited)
            {
                session.Process.Kill(entireProcessTree: true);
                await session.Process.WaitForExitAsync();
            }
        }
        catch
        {
            // Ignore shutdown races. The terminal just needs the process gone.
        }
        finally
        {
            session.Process.Dispose();
        }

        await SendStatusAsync(connectionId, "stopped", "Claude process stopped.", session.ProjectPath);
    }

    private async Task OnProcessExitedAsync(string connectionId, ClaudeTerminalSession session)
    {
        _sessions.TryRemove(new KeyValuePair<string, ClaudeTerminalSession>(connectionId, session));

        if (Interlocked.Exchange(ref session.IsStopping, 1) == 1)
        {
            return;
        }

        session.Process.Dispose();
        await SendStatusAsync(connectionId, "stopped", "Claude process exited.", session.ProjectPath);
    }

    private Task SendOutputAsync(string connectionId, string text, bool isError = false) =>
        hubContext.Clients.Client(connectionId).SendAsync("TerminalOutput", new TerminalOutputMessage(text, isError));

    private Task SendStatusAsync(string connectionId, string status, string message, string? projectPath = null) =>
        hubContext.Clients.Client(connectionId).SendAsync("TerminalStatus", new TerminalStatusMessage(status, message, projectPath));

    private sealed class ClaudeTerminalSession(Process process, string projectPath)
    {
        public Process Process { get; } = process;
        public string ProjectPath { get; } = projectPath;
        public SemaphoreSlim InputLock { get; } = new(1, 1);
        public int IsStopping;
    }

    private sealed record TerminalOutputMessage(string Text, bool IsError);
    private sealed record TerminalStatusMessage(string Status, string Message, string? ProjectPath);
}
