import { markdownToHtml } from '../lib/markdown'

type MarkdownPreviewProps = {
  title: string
  markdown: string
  path?: string
}

export function MarkdownPreview({ title, markdown, path }: MarkdownPreviewProps) {
  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{path ?? 'Live markdown preview'}</p>
        </div>
      </div>
      <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }} />
    </section>
  )
}
