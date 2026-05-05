import type { PageKey } from '../types'

type SidebarProps = {
  currentPage: PageKey
  onSelect: (page: PageKey) => void
  pages: Array<{ key: PageKey; label: string; helper: string }>
  eyebrow: string
  tipTitle: string
  tipText: string
}

export function Sidebar({ currentPage, onSelect, pages, eyebrow, tipTitle, tipText }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-card">
        <div className="brand-mark">AS</div>
        <div>
          <p className="eyebrow">{eyebrow}</p>
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
        <p className="sidebar-tip-title">{tipTitle}</p>
        <p>{tipText}</p>
      </div>
    </aside>
  )
}
