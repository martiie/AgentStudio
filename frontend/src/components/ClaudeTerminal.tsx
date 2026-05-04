import { useEffect, useRef, useState } from 'react'
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'
import type { ProjectProfile } from '../types'

const hubBaseUrl =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' &&
  (window.location.port === '5173' || window.location.port === '4173')
    ? 'http://localhost:5298/api'
    : `${window.location.origin}/api`)

const HUB_URL = hubBaseUrl.replace(/\/api$/, '/hubs/terminal')

type ClaudeTerminalProps = {
  profiles: ProjectProfile[]
  selectedProfileId: string
  onSelectProfile: (profileId: string) => void
  onStatusMessage?: (message: string) => void
}

type TerminalStatusPayload = {
  status: string
  message: string
  projectPath?: string | null
}

type TerminalOutputPayload = {
  text: string
  isError: boolean
}

export function ClaudeTerminal({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onStatusMessage,
}: ClaudeTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const connectionRef = useRef<HubConnection | null>(null)
  const sessionStatusRef = useRef('idle')
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [sessionStatus, setSessionStatus] = useState('idle')
  const [activeProjectPath, setActiveProjectPath] = useState('')

  useEffect(() => {
    sessionStatusRef.current = sessionStatus
  }, [sessionStatus])

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId)

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#0f1724',
        foreground: '#d8e4f3',
        cursor: '#7dd3fc',
      },
    })

    if (containerRef.current) {
      terminal.open(containerRef.current)
      terminal.writeln('Claude Terminal ready.')
      terminal.writeln('Choose a project profile and click "Start Claude".')
    }

    terminalRef.current = terminal

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build()

    connection.on('TerminalOutput', (payload: TerminalOutputPayload) => {
      terminal.write(payload.text)
    })

    connection.on('TerminalStatus', (payload: TerminalStatusPayload) => {
      setSessionStatus(payload.status)
      setActiveProjectPath(payload.projectPath ?? '')
      terminal.writeln(`\r\n[${payload.status}] ${payload.message}`)
      onStatusMessage?.(payload.message)
    })

    connection.onreconnecting(() => {
      setConnectionStatus('Reconnecting...')
      onStatusMessage?.('Terminal reconnecting...')
    })

    connection.onreconnected(() => {
      setConnectionStatus('Connected')
      onStatusMessage?.('Terminal reconnected.')
    })

    connection.onclose(() => {
      setConnectionStatus('Disconnected')
      setSessionStatus('idle')
    })

    terminal.onData((data) => {
      const currentConnection = connectionRef.current
      if (
        !currentConnection ||
        currentConnection.state !== HubConnectionState.Connected ||
        sessionStatusRef.current !== 'running'
      ) {
        return
      }

      if (data === '\r') {
        terminal.write('\r\n')
      } else if (data === '\u007f') {
        terminal.write('\b \b')
      } else {
        terminal.write(data)
      }

      void currentConnection.invoke('SendInput', data)
    })

    void connection
      .start()
      .then(() => {
        connectionRef.current = connection
        setConnectionStatus('Connected')
        onStatusMessage?.('Terminal connected.')
      })
      .catch(() => {
        setConnectionStatus('Disconnected')
        terminal.writeln('\r\n[error] Could not connect to the terminal hub.')
        onStatusMessage?.('Could not connect to the terminal hub.')
      })

    return () => {
      void connection.invoke('StopClaude').catch(() => undefined)
      void connection.stop()
      terminal.dispose()
      connectionRef.current = null
      terminalRef.current = null
    }
  }, [onStatusMessage])

  async function startClaude() {
    if (!selectedProfileId) {
      terminalRef.current?.writeln('\r\n[error] Select a project profile first.')
      return
    }

    const connection = connectionRef.current
    if (!connection || connection.state !== HubConnectionState.Connected) {
      terminalRef.current?.writeln('\r\n[error] Terminal hub is not connected.')
      return
    }

    terminalRef.current?.writeln(`\r\n[start] Launching Claude in ${selectedProfile?.projectPath ?? 'selected project'} ...`)
    await connection.invoke('StartClaude', selectedProfileId)
  }

  async function stopClaude() {
    const connection = connectionRef.current
    if (!connection || connection.state !== HubConnectionState.Connected) {
      return
    }

    await connection.invoke('StopClaude')
  }

  function clearTerminal() {
    terminalRef.current?.clear()
    terminalRef.current?.writeln('Claude Terminal cleared.')
  }

  return (
    <div className="page-grid">
      <section className="panel terminal-toolbar-panel">
        <div className="terminal-toolbar">
          <label className="terminal-select">
            Project profile
            <select value={selectedProfileId} onChange={(event) => onSelectProfile(event.target.value)}>
              <option value="">Select a project profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.projectName}
                </option>
              ))}
            </select>
          </label>

          <div className="terminal-meta">
            <span className="status-pill">Connection: {connectionStatus}</span>
            <span className="status-pill">Session: {sessionStatus}</span>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void startClaude()}
              disabled={!selectedProfileId || connectionStatus !== 'Connected'}
            >
              Start Claude
            </button>
            <button type="button" className="secondary-button" onClick={() => void stopClaude()} disabled={sessionStatus !== 'running'}>
              Stop
            </button>
            <button type="button" className="secondary-button" onClick={clearTerminal}>
              Clear terminal
            </button>
          </div>
        </div>

        <div className="terminal-path-card">
          <strong>Current project path</strong>
          <code>{activeProjectPath || selectedProfile?.projectPath || 'No project profile selected'}</code>
        </div>
      </section>

      <section className="panel">
        <div ref={containerRef} className="terminal-surface" />
      </section>
    </div>
  )
}
