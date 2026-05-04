import type { PageKey } from '../types'

type SidebarProps = {
  currentPage: PageKey
  onSelect: (page: PageKey) => void
}

const pages: Array<{ key: PageKey; label: string; helper: string }> = [
  { key: 'dashboard', label: 'Dashboard', helper: 'Overview and quick actions' },
  { key: 'agents', label: 'Agents', helper: 'Create and edit agent files' },
  { key: 'skills', label: 'Skills', helper: 'Capture reusable workflows' },
  { key: 'builder', label: 'CLAUDE Builder', helper: 'Assemble router and context' },
  { key: 'profiles', label: 'Project Profiles', helper: 'Store stack and rules' },
  { key: 'terminal', label: 'Claude Terminal', helper: 'Run Claude in a browser terminal' },
  { key: 'export', label: 'Export Center', helper: 'Copy or export generated files' },
  { key: 'settings', label: 'Settings', helper: 'Environment and conventions' },
]

export function Sidebar({ currentPage, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-card">
        <div className="brand-mark">AS</div>
        <div>
          <p className="eyebrow">Agent Workspace</p>
          <h1>Agent Studio</h1>
        </div>
      </div>

      <nav className="nav-list" aria-label="Primary">
        {pages.map((page) => (
          <button
            key={page.key}
            type="button"
            className={page.key === currentPage ? 'nav-item active' : 'nav-item'}
            onClick={() => onSelect(page.key)}
          >
            <span>{page.label}</span>
            <small>{page.helper}</small>
          </button>
        ))}
      </nav>

      <div className="sidebar-tip">
        <p className="sidebar-tip-title">Beginner tip</p>
        <p>
          Start with templates, then customize the fields on the right until the preview reads the way you want.
        </p>
      </div>
    </aside>
  )
}
