import { useEffect, useRef, useState } from 'react'
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'
import type { AppLanguage, ProjectProfile, TerminalMode } from '../types'
import { TERMINAL_HUB_URL } from '../lib/runtime'

type ProjectTerminalProps = {
  profiles: ProjectProfile[]
  selectedProfileId: string
  onSelectProfile: (profileId: string) => void
  onStatusMessage?: (message: string) => void
  language: AppLanguage
  visible: boolean
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

const terminalMetrics = {
  fontSize: 14,
  cellWidth: 8.4,
  cellHeight: 18,
  horizontalPadding: 24,
  verticalPadding: 24,
}

export function ProjectTerminal({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onStatusMessage,
  language,
  visible,
}: ProjectTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const connectionRef = useRef<HubConnection | null>(null)
  const sessionStatusRef = useRef('idle')
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [sessionStatus, setSessionStatus] = useState('idle')
  const [activeProjectPath, setActiveProjectPath] = useState('')
  const [terminalMode, setTerminalMode] = useState<TerminalMode>('powershell')
  const [terminalSize, setTerminalSize] = useState({ cols: 100, rows: 30 })
  const resizeHandlerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    sessionStatusRef.current = sessionStatus
  }, [sessionStatus])

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId)
  const isThai = language === 'th'
  const shellOptions: Record<TerminalMode, string> = {
    powershell: 'PowerShell',
    cmd: isThai ? 'Command Prompt' : 'Command Prompt',
  }

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: terminalMetrics.fontSize,
      theme: {
        background: '#0f1724',
        foreground: '#d8e4f3',
        cursor: '#7dd3fc',
      },
    })

    if (containerRef.current) {
      terminal.open(containerRef.current)
      terminal.writeln(isThai ? 'Project Terminal พร้อมใช้งานแล้ว' : 'Project Terminal ready.')
      terminal.writeln(
        isThai
          ? 'เลือกโปรเจ็กต์ เลือก PowerShell หรือ cmd แล้วกด "Start Terminal" ได้เลย'
          : 'Choose a project profile, select PowerShell or cmd, then click "Start Terminal".',
      )
    }

    terminalRef.current = terminal

    function calculateTerminalSize() {
      if (!containerRef.current) {
        return { cols: 100, rows: 30 }
      }

      const width = Math.max(containerRef.current.clientWidth - terminalMetrics.horizontalPadding, 320)
      const height = Math.max(containerRef.current.clientHeight - terminalMetrics.verticalPadding, 216)
      const cols = Math.max(40, Math.floor(width / terminalMetrics.cellWidth))
      const rows = Math.max(12, Math.floor(height / terminalMetrics.cellHeight))
      return { cols, rows }
    }

    function applyTerminalSize(nextSize: { cols: number; rows: number }) {
      terminal.resize(nextSize.cols, nextSize.rows)
      setTerminalSize((current) =>
        current.cols === nextSize.cols && current.rows === nextSize.rows ? current : nextSize,
      )
    }

    const connection = new HubConnectionBuilder()
      .withUrl(TERMINAL_HUB_URL)
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

      void currentConnection.invoke('SendInput', data)
    })

    const handleResize = () => {
      const nextSize = calculateTerminalSize()
      applyTerminalSize(nextSize)

      const currentConnection = connectionRef.current
      if (
        currentConnection &&
        currentConnection.state === HubConnectionState.Connected &&
        sessionStatusRef.current === 'running'
      ) {
        void currentConnection.invoke('ResizeTerminal', nextSize.cols, nextSize.rows)
      }
    }

    resizeHandlerRef.current = handleResize
    handleResize()
    window.addEventListener('resize', handleResize)

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
      window.removeEventListener('resize', handleResize)
      void connection.invoke('StopTerminal').catch(() => undefined)
      void connection.stop()
      terminal.dispose()
      connectionRef.current = null
      terminalRef.current = null
    }
  }, [onStatusMessage])

  useEffect(() => {
    if (visible) {
      resizeHandlerRef.current?.()
    }
  }, [visible])

  async function startTerminal() {
    if (!selectedProfileId) {
      terminalRef.current?.writeln(`\r\n[error] ${isThai ? 'กรุณาเลือก project profile ก่อน' : 'Select a project profile first.'}`)
      return
    }

    const connection = connectionRef.current
    if (!connection || connection.state !== HubConnectionState.Connected) {
      terminalRef.current?.writeln(`\r\n[error] ${isThai ? 'Terminal hub ยังไม่เชื่อมต่อ' : 'Terminal hub is not connected.'}`)
      return
    }

    const terminalLabel = shellOptions[terminalMode]
    terminalRef.current?.writeln(`\r\n[start] Launching ${terminalLabel} in ${selectedProfile?.projectPath ?? 'selected project'} ...`)
    await connection.invoke('StartTerminal', selectedProfileId, terminalMode, terminalSize.cols, terminalSize.rows)
  }

  async function stopTerminal() {
    const connection = connectionRef.current
    if (!connection || connection.state !== HubConnectionState.Connected) {
      return
    }

    await connection.invoke('StopTerminal')
  }

  function clearTerminal() {
    terminalRef.current?.clear()
    terminalRef.current?.writeln(isThai ? 'ล้างหน้าต่าง Terminal เรียบร้อย' : 'Project Terminal cleared.')
  }

  return (
    <div className="page-grid">
      <section className="panel terminal-toolbar-panel">
        <div className="terminal-toolbar">
          <label className="terminal-select">
            {isThai ? 'โปรเจ็กต์' : 'Project profile'}
            <select value={selectedProfileId} onChange={(event) => onSelectProfile(event.target.value)}>
              <option value="">{isThai ? 'เลือก project profile' : 'Select a project profile'}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.projectName}
                </option>
              ))}
            </select>
          </label>

          <label className="terminal-select">
            {isThai ? 'เชลล์' : 'Shell'}
            <select value={terminalMode} onChange={(event) => setTerminalMode(event.target.value as TerminalMode)} disabled={sessionStatus === 'running'}>
              <option value="powershell">PowerShell</option>
              <option value="cmd">{shellOptions.cmd}</option>
            </select>
          </label>

          <div className="terminal-meta">
            <span className="status-pill">{isThai ? 'การเชื่อมต่อ' : 'Connection'}: {connectionStatus}</span>
            <span className="status-pill">{isThai ? 'เซสชัน' : 'Session'}: {sessionStatus}</span>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void startTerminal()}
              disabled={!selectedProfileId || connectionStatus !== 'Connected'}
            >
              {isThai ? 'เริ่ม Terminal' : 'Start Terminal'}
            </button>
            <button type="button" className="secondary-button" onClick={() => void stopTerminal()} disabled={sessionStatus !== 'running'}>
              {isThai ? 'หยุด' : 'Stop'}
            </button>
            <button type="button" className="secondary-button" onClick={clearTerminal}>
              {isThai ? 'ล้างหน้าจอ' : 'Clear terminal'}
            </button>
          </div>
        </div>

        <div className="terminal-path-card">
          <strong>{isThai ? 'พาธโปรเจ็กต์ปัจจุบัน' : 'Current project path'}</strong>
          <code>{activeProjectPath || selectedProfile?.projectPath || (isThai ? 'ยังไม่ได้เลือก project profile' : 'No project profile selected')}</code>
        </div>
      </section>

      <section className="panel">
        <div ref={containerRef} className="terminal-surface" />
      </section>
    </div>
  )
}
