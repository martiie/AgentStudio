import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from './components/EmptyState'
import { FormCard } from './components/FormCard'
import { MarkdownPreview } from './components/MarkdownPreview'
import { ProjectTerminal } from './components/ProjectTerminal'
import { Sidebar } from './components/Sidebar'
import { StaffCard } from './components/StaffCard'
import { api } from './lib/api'
import type { DetectedWorkspaceItem, PageKey, ProjectProfile, RecentWorkspace, WorkspaceScanResult } from './types'

type WorkspaceCard = {
  key: string
  kind: 'agent' | 'skill'
  name: string
  subtitle: string
  relativePath: string
  avatarRelativePath?: string | null
  item: DetectedWorkspaceItem
}

type ProfileFact = {
  label: string
  value: string
}

type ProfileSection = {
  title: string
  items: string[]
}

function buildProfileFromWorkspace(scan: WorkspaceScanResult | null, workspaceDirectory: string): ProjectProfile[] {
  const projectPath = scan?.directoryPath || workspaceDirectory.trim()
  if (!projectPath) {
    return []
  }

  return [
    {
      id: 'current-workspace',
      projectName: scan?.suggestedProjectName || 'Current Project',
      projectPath,
      techStack: scan?.suggestedTechStack || '',
      codingRules: '',
      folderStructure: scan?.suggestedFolderStructure || '',
      importantCommands: scan?.suggestedImportantCommands || '',
      createdAt: '',
      updatedAt: '',
    },
  ]
}

function buildAccessibleFolder(card: WorkspaceCard | null) {
  if (!card) {
    return ''
  }

  if (card.kind === 'agent') {
    const baseName = card.item.fileName.replace(/\.md$/i, '')
    return `.claude/agents/${baseName}/`
  }

  return card.relativePath.split('/').slice(0, -1).join('/') || '.'
}

function buildEditableAreas(card: WorkspaceCard | null) {
  if (!card) {
    return []
  }

  const defaults = ['Markdown content', 'File name and folder placement', 'Avatar image']

  if (card.kind === 'agent') {
    return [
      'Role and operating notes',
      'Allowed tools and tags',
      'Model preference and behavior rules',
      ...defaults,
    ]
  }

  return [
    'Purpose and trigger condition',
    'Step-by-step instructions',
    'Examples and reusable notes',
    ...defaults,
  ]
}

function buildProfileFacts(card: WorkspaceCard | null, workspaceDirectory: string): ProfileFact[] {
  if (!card) {
    return []
  }

  return [
    { label: 'Profile type', value: card.kind === 'agent' ? 'Employee / Agent' : 'Skill / Capability' },
    { label: 'Responsible file', value: card.relativePath },
    { label: 'Workspace root', value: workspaceDirectory || 'No workspace selected' },
    { label: 'Managed folder', value: buildAccessibleFolder(card) },
    { label: 'Full file path', value: card.item.fullPath },
  ]
}

function buildProfileSections(card: WorkspaceCard | null): ProfileSection[] {
  if (!card) {
    return []
  }

  if (card.kind === 'agent') {
    return [
      {
        title: 'Responsibility',
        items: [card.item.role?.trim() || 'No role summary found in this markdown file yet.'],
      },
      {
        title: 'Access and tools',
        items: card.item.toolsAllowed.length > 0 ? card.item.toolsAllowed : ['No tool list detected.'],
      },
      {
        title: 'Tags',
        items: card.item.tags.length > 0 ? card.item.tags : ['No tags detected.'],
      },
    ]
  }

  return [
    {
      title: 'Purpose',
      items: [card.item.purpose?.trim() || 'No purpose summary found in this markdown file yet.'],
    },
    {
      title: 'Trigger condition',
      items: [card.item.triggerCondition?.trim() || 'No trigger condition detected.'],
    },
    {
      title: 'Steps',
      items: card.item.steps.length > 0 ? card.item.steps : ['No step list detected.'],
    },
  ]
}

function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Pick a project folder to begin.')
  const [workspaceDirectory, setWorkspaceDirectory] = useState('')
  const [workspaceScan, setWorkspaceScan] = useState<WorkspaceScanResult | null>(null)
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([])
  const [selectedItemPath, setSelectedItemPath] = useState('')
  const [markdownDraft, setMarkdownDraft] = useState('')
  const [isMarkdownEditing, setIsMarkdownEditing] = useState(false)
  const [avatarUploadingKey, setAvatarUploadingKey] = useState('')
  const [terminalProfileId, setTerminalProfileId] = useState('')

  const sidebarTip = workspaceScan?.directoryPath || workspaceDirectory || 'No folder selected.'

  const workspaceCards = useMemo<WorkspaceCard[]>(
    () => [
      ...(workspaceScan?.agents ?? []).map((item) => ({
        key: item.fullPath,
        kind: 'agent' as const,
        name: item.suggestedName,
        subtitle: item.role?.trim() || 'Agent file',
        relativePath: item.relativePath,
        avatarRelativePath: item.avatarRelativePath,
        item,
      })),
      ...(workspaceScan?.skills ?? []).map((item) => ({
        key: item.fullPath,
        kind: 'skill' as const,
        name: item.suggestedName,
        subtitle: item.triggerCondition?.trim() || item.purpose?.trim() || 'Skill file',
        relativePath: item.relativePath,
        avatarRelativePath: item.avatarRelativePath,
        item,
      })),
    ],
    [workspaceScan],
  )

  const selectedCard = useMemo(
    () => workspaceCards.find((card) => card.key === selectedItemPath) ?? workspaceCards[0] ?? null,
    [selectedItemPath, workspaceCards],
  )

  const pages = [
    { key: 'dashboard' as PageKey, label: 'Front Desk', helper: 'Folder and cards' },
    { key: 'terminal' as PageKey, label: 'Terminal', helper: 'Current path' },
  ]

  const terminalProfiles = useMemo(
    () => buildProfileFromWorkspace(workspaceScan, workspaceDirectory),
    [workspaceDirectory, workspaceScan],
  )

  const selectedWorkspacePath = workspaceScan?.directoryPath || workspaceDirectory
  const profileFacts = useMemo(
    () => buildProfileFacts(selectedCard, selectedWorkspacePath),
    [selectedCard, selectedWorkspacePath],
  )
  const profileSections = useMemo(() => buildProfileSections(selectedCard), [selectedCard])
  const editableAreas = useMemo(() => buildEditableAreas(selectedCard), [selectedCard])

  useEffect(() => {
    setTerminalProfileId(terminalProfiles[0]?.id ?? '')
  }, [terminalProfiles])

  useEffect(() => {
    void loadRecentWorkspaces()
  }, [])

  useEffect(() => {
    if (!selectedCard) {
      if (page === 'profile') {
        setPage('dashboard')
      }
      setSelectedItemPath('')
      setMarkdownDraft('')
      return
    }

    setSelectedItemPath(selectedCard.key)
    setMarkdownDraft(selectedCard.item.content)
  }, [selectedCard?.key])

  async function loadRecentWorkspaces() {
    try {
      const result = await api.getRecentWorkspaces()
      setRecentWorkspaces(result.items)
    } catch {
      setRecentWorkspaces([])
    }
  }

  async function browseWorkspaceDirectory() {
    setBusy(true)
    try {
      const result = await api.browseWorkspace()
      if (!result?.directoryPath) {
        setMessage('Folder selection was cancelled.')
        return
      }

      setWorkspaceDirectory(result.directoryPath)
      await scanWorkspace(result.directoryPath)
      await loadRecentWorkspaces()
    } catch {
      setMessage('Could not open the folder browser.')
    } finally {
      setBusy(false)
    }
  }

  async function scanWorkspace(directoryOverride?: string) {
    const nextDirectory = directoryOverride ?? workspaceDirectory.trim()
    if (!nextDirectory) {
      setMessage('Choose a project folder first.')
      return
    }

    setBusy(true)
    try {
      const result = await api.scanWorkspace(nextDirectory)
      setWorkspaceScan(result)
      setWorkspaceDirectory(result.directoryPath)
      setSelectedItemPath(result.agents[0]?.fullPath ?? result.skills[0]?.fullPath ?? '')
      await loadRecentWorkspaces()
      setMessage('Project folder scanned successfully.')
    } catch {
      setMessage('Could not scan that folder. Double-check the path and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function reloadSelectedItem() {
    const directoryPath = workspaceScan?.directoryPath || workspaceDirectory.trim()
    if (!directoryPath || !selectedCard) {
      setMessage('Open a project file first.')
      return
    }

    setBusy(true)
    try {
      const file = await api.getWorkspaceFile(directoryPath, selectedCard.relativePath)
      setMarkdownDraft(file.content)
      setMessage(`Reloaded ${selectedCard.name}.`)
    } catch {
      setMessage('Could not reload that markdown file.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSelectedItem(returnToPreview = false) {
    const directoryPath = workspaceScan?.directoryPath || workspaceDirectory.trim()
    if (!directoryPath || !selectedCard) {
      setMessage('Open a project file first.')
      return
    }

    setBusy(true)
    try {
      await api.saveWorkspaceFile({
        directoryPath,
        relativePath: selectedCard.relativePath,
        content: markdownDraft,
      })

      const refreshed = await api.scanWorkspace(directoryPath)
      setWorkspaceScan(refreshed)
      if (returnToPreview) {
        setIsMarkdownEditing(false)
      }
      setMessage(`Saved ${selectedCard.name}.`)
    } catch {
      setMessage('Could not save that markdown file.')
    } finally {
      setBusy(false)
    }
  }

  async function openSelectedWorkFolder() {
    const directoryPath = workspaceScan?.directoryPath || workspaceDirectory.trim()
    if (!directoryPath || !selectedCard) {
      setMessage('Open a profile first.')
      return
    }

    setBusy(true)
    try {
      const result = await api.openWorkspaceFolder({
        directoryPath,
        relativePath: selectedCard.relativePath,
        kind: selectedCard.kind,
      })

      setMessage(`Opened ${result.folderPath}.`)
    } catch {
      setMessage('Could not open that work folder.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadAvatar(card: WorkspaceCard, file: File) {
    const directoryPath = workspaceScan?.directoryPath || workspaceDirectory.trim()
    if (!directoryPath) {
      setMessage('Choose a project folder first.')
      return
    }

    setAvatarUploadingKey(card.key)
    try {
      await api.uploadStaffAvatar({
        directoryPath,
        staffName: card.name,
        staffFolderName: card.item.fileName.replace(/\.md$/i, ''),
        file,
      })

      const refreshed = await api.scanWorkspace(directoryPath)
      setWorkspaceScan(refreshed)
      setMessage(`Uploaded a photo for ${card.name}.`)
    } catch {
      setMessage('Could not upload that image.')
    } finally {
      setAvatarUploadingKey('')
    }
  }

  function getAvatarUrl(relativePath?: string | null) {
    if (!workspaceScan?.directoryPath || !relativePath) {
      return undefined
    }

    return api.workspaceAssetUrl(workspaceScan.directoryPath, relativePath)
  }

  function renderFrontDesk() {
    return (
      <div className="page-grid">
        <FormCard title="Front Desk">
          <div className="browse-desk">
            <div className="browse-desk-bar">
              <div className="browse-desk-input">
                <span className="browse-desk-icon" aria-hidden="true">
                  Dir
                </span>
                <div className="browse-desk-copy">
                  <strong>Project folder</strong>
                  <p>{workspaceScan?.directoryPath || workspaceDirectory || 'No project folder selected yet.'}</p>
                </div>
              </div>
              <div className="button-row">
                <button type="button" className="primary-button" onClick={() => void browseWorkspaceDirectory()}>
                  Browse
                </button>
                <button type="button" className="secondary-button" onClick={() => void scanWorkspace()}>
                  Refresh
                </button>
              </div>
            </div>
            <div className="workspace-quick-stats">
              <span>{workspaceCards.length} files</span>
              <span>{workspaceScan?.agents.length ?? 0} agents</span>
              <span>{workspaceScan?.skills.length ?? 0} skills</span>
              {workspaceScan?.suggestedTechStack ? <span>{workspaceScan.suggestedTechStack}</span> : null}
            </div>
            {recentWorkspaces.length > 0 ? (
              <div className="recent-workspaces">
                {recentWorkspaces.map((item) => (
                  <button
                    key={item.directoryPath}
                    type="button"
                    className={item.directoryPath === selectedWorkspacePath ? 'recent-workspace active' : 'recent-workspace'}
                    onClick={() => {
                      setWorkspaceDirectory(item.directoryPath)
                      void scanWorkspace(item.directoryPath)
                    }}
                    title={item.directoryPath}
                  >
                    <strong>{item.name || item.directoryPath}</strong>
                    <span>{item.directoryPath}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </FormCard>

        <section className="office-roster">
          <div className="office-roster-header">
            <div>
              <h2>Staff</h2>
            </div>
          </div>
          <div className="staff-grid">
            {workspaceCards.length > 0 ? (
              workspaceCards.map((card, index) => (
                <StaffCard
                  key={card.key}
                  name={card.name}
                  role={card.subtitle}
                  pathLabel={card.relativePath}
                  avatarUrl={getAvatarUrl(card.avatarRelativePath)}
                  accent={index % 3 === 0 ? 'sage' : index % 3 === 1 ? 'amber' : 'peach'}
                  onOpen={() => {
                    setSelectedItemPath(card.key)
                    setMarkdownDraft(card.item.content)
                    setIsMarkdownEditing(false)
                    setPage('profile')
                  }}
                  onUpload={(file) => void uploadAvatar(card, file)}
                  uploading={avatarUploadingKey === card.key}
                />
              ))
            ) : (
              <EmptyState
                title="No staff files"
                message="Choose a folder with `.claude/agents` or `.claude/skills`."
              />
            )}
          </div>
        </section>

      </div>
    )
  }

  function renderProfilePage() {
    if (!selectedCard) {
      return <EmptyState title="No profile selected" message="Choose a card from Front Desk first, then open its dedicated profile page." />
    }

    return (
      <div className="page-grid">
        <FormCard title={selectedCard.name}>
          <div className="profile-page-toolbar">
            <button type="button" className="secondary-button" onClick={() => setPage('dashboard')}>
              Back
            </button>
            <button type="button" className="secondary-button" onClick={() => void openSelectedWorkFolder()}>
              Open folder
            </button>
            <button type="button" className="secondary-button" onClick={() => void reloadSelectedItem()}>
              Reload
            </button>
            {isMarkdownEditing ? (
              <button type="button" className="primary-button" onClick={() => void saveSelectedItem(true)}>
                Save
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={() => setIsMarkdownEditing(true)}>
                Edit
              </button>
            )}
          </div>
        </FormCard>

        <div className="profile-page-layout">
          <FormCard
            title={selectedCard.kind === 'agent' ? 'Profile' : 'Skill'}
          >
            <div className="stack">
              <section className="profile-desk">
                <div className="profile-desk-hero">
                  <div className="profile-desk-avatar">
                    {selectedCard.avatarRelativePath ? (
                      <img src={getAvatarUrl(selectedCard.avatarRelativePath)} alt={`${selectedCard.name} avatar`} className="staff-avatar-image" />
                    ) : (
                      <div className="staff-avatar-placeholder">
                        <span className="profile-desk-avatar-label">{selectedCard.kind === 'agent' ? 'AG' : 'SK'}</span>
                      </div>
                    )}
                  </div>
                  <div className="profile-desk-copy">
                    <h3>{selectedCard.name}</h3>
                    <p className="muted-copy">{selectedCard.subtitle}</p>
                    <div className="profile-chip-row">
                      <span className="workspace-pill">{selectedCard.relativePath}</span>
                      <span className="workspace-pill mint">{buildAccessibleFolder(selectedCard)}</span>
                    </div>
                  </div>
                </div>

                <div className="profile-fact-grid">
                  {profileFacts.map((fact) => (
                    <article key={fact.label} className="profile-fact-card">
                      <strong>{fact.label}</strong>
                      <p>{fact.value}</p>
                    </article>
                  ))}
                </div>

                <div className="profile-section-grid">
                  {profileSections.map((section) => (
                    <article key={section.title} className="profile-section-card">
                      <strong>{section.title}</strong>
                      <ul className="profile-list">
                        {section.items.map((item) => (
                          <li key={`${section.title}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>

                <section className="profile-section-card profile-section-card--wide">
                  <strong>Editable</strong>
                  <div className="profile-chip-row">
                    {editableAreas.map((item) => (
                      <span key={item} className="workspace-pill">
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              </section>
            </div>
          </FormCard>

          {isMarkdownEditing ? (
            <FormCard title="Editor">
              <label className="full-width markdown-editor-field">
                Markdown
                <textarea
                  value={markdownDraft}
                  onChange={(event) => setMarkdownDraft(event.target.value)}
                  rows={22}
                  placeholder="# Markdown file"
                />
              </label>
            </FormCard>
          ) : (
            <MarkdownPreview
              title="Markdown"
              markdown={markdownDraft || '# Nothing selected yet'}
              path={selectedCard.relativePath}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentPage={page}
        onSelect={setPage}
        pages={pages}
        eyebrow="Workspace front desk"
        tipTitle="Current path"
        tipText={sidebarTip}
      />

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="topbar-badge">Agent Office</span>
            <h2>{page === 'dashboard' ? 'Front Desk' : page === 'profile' ? selectedCard?.name || 'Profile' : 'Project Terminal'}</h2>
          </div>
          <div className="topbar-actions">
            <span className={busy ? 'status-pill busy' : 'status-pill'}>{message}</span>
          </div>
        </header>

        {page === 'terminal' ? (
          <ProjectTerminal
            profiles={terminalProfiles}
            selectedProfileId={terminalProfileId}
            onSelectProfile={setTerminalProfileId}
            currentProjectPath={workspaceScan?.directoryPath || workspaceDirectory}
            onStatusMessage={setMessage}
            language="en"
            visible
          />
        ) : null}

        {page === 'dashboard' ? renderFrontDesk() : null}
        {page === 'profile' ? renderProfilePage() : null}
      </main>
    </div>
  )
}

export default App
