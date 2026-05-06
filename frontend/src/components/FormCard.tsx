import type { ReactNode } from 'react'

type FormCardProps = {
  title: string
  description?: string
  children: ReactNode
}

export function FormCard({ title, description, children }: FormCardProps) {
  return (
    <section className="panel form-card-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}
