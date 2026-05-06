type StaffCardProps = {
  name: string
  role: string
  pathLabel: string
  avatarUrl?: string | null
  accent?: 'sage' | 'amber' | 'peach'
  onOpen: () => void
  onUpload: (file: File) => void
  uploading?: boolean
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function SilhouetteIcon() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="staff-silhouette">
      <circle cx="60" cy="42" r="22" fill="currentColor" opacity="0.92" />
      <path d="M24 105c4-20 18-31 36-31s32 11 36 31" fill="currentColor" opacity="0.92" />
    </svg>
  )
}

export function StaffCard({
  name,
  role,
  pathLabel,
  avatarUrl,
  accent = 'sage',
  onOpen,
  onUpload,
  uploading = false,
}: StaffCardProps) {
  const initials = initialsFromName(name) || 'AI'

  return (
    <article className={`staff-card ${accent}`}>
      <div className="staff-card-top">
        <div className="staff-avatar-shell">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${name} avatar`} className="staff-avatar-image" />
          ) : (
            <div className="staff-avatar-placeholder">
              <SilhouetteIcon />
              <span className="staff-avatar-initials">{initials}</span>
            </div>
          )}
        </div>
        <div className="staff-card-copy">
          <h3>{name}</h3>
          <p className="staff-card-role">{role}</p>
          <p className="staff-card-path">{pathLabel}</p>
        </div>
      </div>

      <div className="staff-card-actions">
        <button type="button" className="secondary-button" onClick={onOpen}>
          View profile
        </button>
        <label className={uploading ? 'staff-upload-button busy' : 'staff-upload-button'}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                onUpload(file)
              }
              event.currentTarget.value = ''
            }}
            disabled={uploading}
          />
          <span>{uploading ? 'Uploading...' : 'Photo'}</span>
        </label>
      </div>
    </article>
  )
}
