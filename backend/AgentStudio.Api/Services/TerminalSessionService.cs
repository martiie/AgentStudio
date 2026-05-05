using System.Collections.Concurrent;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using AgentStudio.Api.Data;
using AgentStudio.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Win32.SafeHandles;

namespace AgentStudio.Api.Services;

public sealed class TerminalSessionService(IServiceScopeFactory scopeFactory, IHubContext<TerminalHub> hubContext)
{
    private readonly ConcurrentDictionary<string, TerminalSession> _sessions = new();

    public async Task StartTerminalAsync(string connectionId, Guid projectProfileId, string terminalType, int cols, int rows)
    {
        await StopTerminalAsync(connectionId);

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

        if (!TryGetLaunchConfig(terminalType, out var launchConfig))
        {
            await SendStatusAsync(connectionId, "error", $"Unsupported terminal type: {terminalType}", profile.ProjectPath);
            return;
        }

        if (!OperatingSystem.IsWindows())
        {
            await SendStatusAsync(connectionId, "error", "PTY mode is currently supported only on Windows.", profile.ProjectPath);
            return;
        }

        var terminalSize = NormalizeSize(cols, rows);
        WindowsPtyProcess? ptyProcess = null;
        try
        {
            ptyProcess = WindowsPtyProcess.Start(launchConfig.CommandLine, profile.ProjectPath, terminalSize.cols, terminalSize.rows);
            var session = new TerminalSession(ptyProcess, profile.ProjectPath, launchConfig.DisplayName);
            _sessions[connectionId] = session;

            session.OutputPump = PumpOutputAsync(connectionId, session);
            session.ExitWatcher = WatchForExitAsync(connectionId, session);

            await SendStatusAsync(connectionId, "running", $"{launchConfig.DisplayName} started.", profile.ProjectPath);
        }
        catch (Win32Exception)
        {
            ptyProcess?.Dispose();
            await SendStatusAsync(
                connectionId,
                "error",
                $"{launchConfig.DisplayName} was not found on this machine.",
                profile.ProjectPath);
        }
        catch (Exception exception)
        {
            ptyProcess?.Dispose();
            await SendStatusAsync(connectionId, "error", $"Unable to start {launchConfig.DisplayName}: {exception.Message}", profile.ProjectPath);
        }
    }

    public async Task SendInputAsync(string connectionId, string input)
    {
        if (!_sessions.TryGetValue(connectionId, out var session) || session.Process.HasExited)
        {
            await SendStatusAsync(connectionId, "disconnected", "No active terminal session.");
            return;
        }

        await session.InputLock.WaitAsync();
        try
        {
            await session.Process.WriteInputAsync(input, session.CancellationTokenSource.Token);
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

    public Task ResizeTerminalAsync(string connectionId, int cols, int rows)
    {
        if (!_sessions.TryGetValue(connectionId, out var session) || session.Process.HasExited)
        {
            return Task.CompletedTask;
        }

        var terminalSize = NormalizeSize(cols, rows);
        try
        {
            session.Process.Resize(terminalSize.cols, terminalSize.rows);
        }
        catch
        {
            // Ignore resize failures. Interactive apps can continue using the previous size.
        }

        return Task.CompletedTask;
    }

    public async Task StopTerminalAsync(string connectionId)
    {
        if (!_sessions.TryRemove(connectionId, out var session))
        {
            return;
        }

        await StopSessionAsync(connectionId, session, $"{session.DisplayName} stopped.");
    }

    private async Task PumpOutputAsync(string connectionId, TerminalSession session)
    {
        var decoder = Encoding.UTF8.GetDecoder();
        var byteBuffer = new byte[4096];
        var charBuffer = new char[Encoding.UTF8.GetMaxCharCount(byteBuffer.Length)];

        try
        {
            while (!session.CancellationTokenSource.IsCancellationRequested)
            {
                var bytesRead = await session.Process.ReadOutputAsync(byteBuffer, session.CancellationTokenSource.Token);
                if (bytesRead == 0)
                {
                    break;
                }

                var charsDecoded = decoder.GetChars(byteBuffer, 0, bytesRead, charBuffer, 0, flush: false);
                if (charsDecoded > 0)
                {
                    await SendOutputAsync(connectionId, new string(charBuffer, 0, charsDecoded));
                }
            }

            var flushedChars = decoder.GetChars(Array.Empty<byte>(), 0, 0, charBuffer, 0, flush: true);
            if (flushedChars > 0)
            {
                await SendOutputAsync(connectionId, new string(charBuffer, 0, flushedChars));
            }
        }
        catch (OperationCanceledException)
        {
            // Normal during shutdown.
        }
        catch (ObjectDisposedException)
        {
            // Normal during shutdown.
        }
        catch (IOException)
        {
            // Pipe closed while exiting.
        }
        catch (Exception exception)
        {
            await SendStatusAsync(connectionId, "error", $"Terminal output stream failed: {exception.Message}", session.ProjectPath);
        }
    }

    private async Task WatchForExitAsync(string connectionId, TerminalSession session)
    {
        try
        {
            await session.Process.WaitForExitAsync(session.CancellationTokenSource.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }
        catch
        {
            return;
        }

        if (_sessions.TryRemove(new KeyValuePair<string, TerminalSession>(connectionId, session)))
        {
            await StopSessionAsync(connectionId, session, $"{session.DisplayName} exited.");
        }
    }

    private async Task StopSessionAsync(string connectionId, TerminalSession session, string message)
    {
        if (Interlocked.Exchange(ref session.IsStopping, 1) == 1)
        {
            return;
        }

        session.CancellationTokenSource.Cancel();

        try
        {
            session.Process.Kill();
            await session.Process.WaitForExitAsync(CancellationToken.None);
        }
        catch
        {
            // Ignore shutdown races. The terminal just needs the process gone.
        }
        finally
        {
            session.Process.Dispose();
            session.CancellationTokenSource.Dispose();
            session.InputLock.Dispose();
        }

        await SendStatusAsync(connectionId, "stopped", message, session.ProjectPath);
    }

    private static (int cols, int rows) NormalizeSize(int cols, int rows)
    {
        var normalizedCols = Math.Clamp(cols, 40, 300);
        var normalizedRows = Math.Clamp(rows, 12, 120);
        return (normalizedCols, normalizedRows);
    }

    private static bool TryGetLaunchConfig(string? terminalType, out TerminalLaunchConfig launchConfig)
    {
        switch (terminalType?.Trim().ToLowerInvariant())
        {
            case "cmd":
                launchConfig = new TerminalLaunchConfig("cmd.exe /Q", "Command Prompt");
                return true;
            case "powershell":
                launchConfig = new TerminalLaunchConfig("powershell.exe -NoLogo", "PowerShell");
                return true;
            default:
                launchConfig = default;
                return false;
        }
    }

    private Task SendOutputAsync(string connectionId, string text) =>
        hubContext.Clients.Client(connectionId).SendAsync("TerminalOutput", new TerminalOutputMessage(text, false));

    private Task SendStatusAsync(string connectionId, string status, string message, string? projectPath = null) =>
        hubContext.Clients.Client(connectionId).SendAsync("TerminalStatus", new TerminalStatusMessage(status, message, projectPath));

    private sealed class TerminalSession(WindowsPtyProcess process, string projectPath, string displayName)
    {
        public WindowsPtyProcess Process { get; } = process;
        public string ProjectPath { get; } = projectPath;
        public string DisplayName { get; } = displayName;
        public SemaphoreSlim InputLock { get; } = new(1, 1);
        public CancellationTokenSource CancellationTokenSource { get; } = new();
        public Task? OutputPump { get; set; }
        public Task? ExitWatcher { get; set; }
        public int IsStopping;
    }

    private readonly record struct TerminalLaunchConfig(string CommandLine, string DisplayName);

    private sealed record TerminalOutputMessage(string Text, bool IsError);
    private sealed record TerminalStatusMessage(string Status, string Message, string? ProjectPath);

    private sealed class WindowsPtyProcess : IDisposable
    {
        private const int HandleFlagInherit = 0x00000001;
        private const int ProcThreadAttributePseudoConsole = 0x00020016;
        private const uint ExtendedStartupInfoPresent = 0x00080000;
        private const uint CreateUnicodeEnvironment = 0x00000400;

        private readonly SafePseudoConsoleHandle _pseudoConsole;
        private readonly SafeKernelHandle _threadHandle;
        private readonly FileStream _inputStream;
        private readonly FileStream _outputStream;
        private readonly Process _process;
        private bool _disposed;

        private WindowsPtyProcess(
            SafeFileHandle inputWriter,
            SafeFileHandle outputReader,
            SafePseudoConsoleHandle pseudoConsole,
            SafeKernelHandle threadHandle,
            Process process)
        {
            _pseudoConsole = pseudoConsole;
            _threadHandle = threadHandle;
            _process = process;
            _inputStream = new FileStream(inputWriter, FileAccess.Write, 4096, isAsync: false);
            _outputStream = new FileStream(outputReader, FileAccess.Read, 4096, isAsync: false);
        }

        public bool HasExited => _process.HasExited;

        public static WindowsPtyProcess Start(string commandLine, string workingDirectory, int cols, int rows)
        {
            CreatePipePair(out var ptyInputRead, out var inputWriter);
            CreatePipePair(out var outputReader, out var ptyOutputWrite);
            ClearInheritance(inputWriter);
            ClearInheritance(outputReader);

            try
            {
                var size = new Coord((short)cols, (short)rows);
                var pseudoConsole = CreatePseudoConsoleHandle(size, ptyInputRead, ptyOutputWrite);
                try
                {
                    var (processInfo, threadHandle, processHandle) = CreateProcessAttachedToPseudoConsole(pseudoConsole, commandLine, workingDirectory);
                    try
                    {
                        var process = Process.GetProcessById((int)processInfo.dwProcessId);
                        process.EnableRaisingEvents = true;
                        return new WindowsPtyProcess(inputWriter, outputReader, pseudoConsole, threadHandle, process);
                    }
                    finally
                    {
                        processHandle.Dispose();
                    }
                }
                catch
                {
                    pseudoConsole.Dispose();
                    throw;
                }
            }
            finally
            {
                ptyInputRead.Dispose();
                ptyOutputWrite.Dispose();
            }
        }

        public Task WriteInputAsync(string input, CancellationToken cancellationToken)
        {
            var bytes = Encoding.UTF8.GetBytes(input);
            return WriteAndFlushAsync(bytes, cancellationToken);
        }

        public ValueTask<int> ReadOutputAsync(byte[] buffer, CancellationToken cancellationToken) =>
            _outputStream.ReadAsync(buffer, cancellationToken);

        public void Resize(int cols, int rows)
        {
            ThrowIfDisposed();
            var result = NativeMethods.ResizePseudoConsole(_pseudoConsole.DangerousGetHandle(), new Coord((short)cols, (short)rows));
            if (result != 0)
            {
                throw new Win32Exception(result);
            }
        }

        public void Kill()
        {
            ThrowIfDisposed();
            if (!_process.HasExited)
            {
                _process.Kill(entireProcessTree: true);
            }
        }

        public Task WaitForExitAsync(CancellationToken cancellationToken) =>
            _process.WaitForExitAsync(cancellationToken);

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            _inputStream.Dispose();
            _outputStream.Dispose();
            _process.Dispose();
            _threadHandle.Dispose();
            _pseudoConsole.Dispose();
        }

        private void ThrowIfDisposed()
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
        }

        private static void CreatePipePair(out SafeFileHandle readHandle, out SafeFileHandle writeHandle)
        {
            var securityAttributes = new SecurityAttributes
            {
                nLength = Marshal.SizeOf<SecurityAttributes>(),
                bInheritHandle = 1,
            };

            if (!NativeMethods.CreatePipe(out readHandle, out writeHandle, ref securityAttributes, 0))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
        }

        private static SafePseudoConsoleHandle CreatePseudoConsoleHandle(Coord size, SafeFileHandle inputRead, SafeFileHandle outputWrite)
        {
            var result = NativeMethods.CreatePseudoConsole(size, inputRead, outputWrite, 0, out var pseudoConsoleHandle);
            if (result != 0)
            {
                throw new Win32Exception(result);
            }

            return new SafePseudoConsoleHandle(pseudoConsoleHandle);
        }

        private static (ProcessInformation processInfo, SafeKernelHandle threadHandle, SafeKernelHandle processHandle) CreateProcessAttachedToPseudoConsole(
            SafePseudoConsoleHandle pseudoConsole,
            string commandLine,
            string workingDirectory)
        {
            var attributeListSize = IntPtr.Zero;
            NativeMethods.InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attributeListSize);
            var attributeList = Marshal.AllocHGlobal(attributeListSize);
            var startupInfo = new StartupInfoEx();
            var processInfo = new ProcessInformation();

            try
            {
                if (!NativeMethods.InitializeProcThreadAttributeList(attributeList, 1, 0, ref attributeListSize))
                {
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                }

                startupInfo.StartupInfo.cb = Marshal.SizeOf<StartupInfoEx>();
                startupInfo.lpAttributeList = attributeList;

                if (!NativeMethods.UpdateProcThreadAttribute(
                        startupInfo.lpAttributeList,
                        0,
                        (IntPtr)ProcThreadAttributePseudoConsole,
                        pseudoConsole.DangerousGetHandle(),
                        (IntPtr)IntPtr.Size,
                        IntPtr.Zero,
                        IntPtr.Zero))
                {
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                }

                var commandLineBuffer = new StringBuilder(commandLine);
                var created = NativeMethods.CreateProcess(
                    null,
                    commandLineBuffer,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    false,
                    ExtendedStartupInfoPresent | CreateUnicodeEnvironment,
                    IntPtr.Zero,
                    workingDirectory,
                    ref startupInfo,
                    out processInfo);

                if (!created)
                {
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                }

                var processHandle = new SafeKernelHandle(processInfo.hProcess, ownsHandle: true);
                var threadHandle = new SafeKernelHandle(processInfo.hThread, ownsHandle: true);
                return (processInfo, threadHandle, processHandle);
            }
            finally
            {
                if (startupInfo.lpAttributeList != IntPtr.Zero)
                {
                    NativeMethods.DeleteProcThreadAttributeList(startupInfo.lpAttributeList);
                }

                Marshal.FreeHGlobal(attributeList);
            }
        }

        private async Task WriteAndFlushAsync(byte[] bytes, CancellationToken cancellationToken)
        {
            await _inputStream.WriteAsync(bytes, cancellationToken);
            await _inputStream.FlushAsync(cancellationToken);
        }

        private static void ClearInheritance(SafeHandle handle)
        {
            if (!NativeMethods.SetHandleInformation(handle, HandleFlagInherit, 0))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct Coord(short x, short y)
        {
            public short X = x;
            public short Y = y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct SecurityAttributes
        {
            public int nLength;
            public IntPtr lpSecurityDescriptor;
            public int bInheritHandle;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct StartupInfo
        {
            public int cb;
            public string? lpReserved;
            public string? lpDesktop;
            public string? lpTitle;
            public int dwX;
            public int dwY;
            public int dwXSize;
            public int dwYSize;
            public int dwXCountChars;
            public int dwYCountChars;
            public int dwFillAttribute;
            public int dwFlags;
            public short wShowWindow;
            public short cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct StartupInfoEx
        {
            public StartupInfo StartupInfo;
            public IntPtr lpAttributeList;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ProcessInformation
        {
            public IntPtr hProcess;
            public IntPtr hThread;
            public uint dwProcessId;
            public uint dwThreadId;
        }

        private static class NativeMethods
        {
            [DllImport("kernel32.dll", SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool CreatePipe(
                out SafeFileHandle hReadPipe,
                out SafeFileHandle hWritePipe,
                ref SecurityAttributes lpPipeAttributes,
                int nSize);

            [DllImport("kernel32.dll", SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool SetHandleInformation(
                SafeHandle hObject,
                int dwMask,
                int dwFlags);

            [DllImport("kernel32.dll", SetLastError = true)]
            public static extern int CreatePseudoConsole(
                Coord size,
                SafeFileHandle hInput,
                SafeFileHandle hOutput,
                uint dwFlags,
                out IntPtr phPC);

            [DllImport("kernel32.dll", SetLastError = true)]
            public static extern int ResizePseudoConsole(
                IntPtr hPC,
                Coord size);

            [DllImport("kernel32.dll")]
            public static extern void ClosePseudoConsole(IntPtr hPC);

            [DllImport("kernel32.dll", SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool CloseHandle(IntPtr hObject);

            [DllImport("kernel32.dll", SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool InitializeProcThreadAttributeList(
                IntPtr lpAttributeList,
                int dwAttributeCount,
                int dwFlags,
                ref IntPtr lpSize);

            [DllImport("kernel32.dll", SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool UpdateProcThreadAttribute(
                IntPtr lpAttributeList,
                uint dwFlags,
                IntPtr attribute,
                IntPtr lpValue,
                IntPtr cbSize,
                IntPtr lpPreviousValue,
                IntPtr lpReturnSize);

            [DllImport("kernel32.dll")]
            public static extern void DeleteProcThreadAttributeList(IntPtr lpAttributeList);

            [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool CreateProcess(
                string? lpApplicationName,
                StringBuilder lpCommandLine,
                IntPtr lpProcessAttributes,
                IntPtr lpThreadAttributes,
                [MarshalAs(UnmanagedType.Bool)] bool bInheritHandles,
                uint dwCreationFlags,
                IntPtr lpEnvironment,
                string? lpCurrentDirectory,
                ref StartupInfoEx lpStartupInfo,
                out ProcessInformation lpProcessInformation);
        }

        private sealed class SafePseudoConsoleHandle : SafeHandleZeroOrMinusOneIsInvalid
        {
            public SafePseudoConsoleHandle(IntPtr handle)
                : base(true)
            {
                SetHandle(handle);
            }

            protected override bool ReleaseHandle()
            {
                if (handle == IntPtr.Zero || handle == new IntPtr(-1))
                {
                    return true;
                }

                NativeMethods.ClosePseudoConsole(handle);
                return true;
            }
        }

        private sealed class SafeKernelHandle : SafeHandleZeroOrMinusOneIsInvalid
        {
            public SafeKernelHandle()
                : base(true)
            {
            }

            public SafeKernelHandle(IntPtr handle, bool ownsHandle)
                : base(ownsHandle)
            {
                SetHandle(handle);
            }

            protected override bool ReleaseHandle() => NativeMethods.CloseHandle(handle);
        }
    }
}
