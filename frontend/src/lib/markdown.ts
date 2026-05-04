function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n')
  const html: string[] = []
  let inList = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const safeLine = escapeHtml(line)

    if (!line.trim()) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      continue
    }

    if (line.startsWith('### ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h3>${safeLine.slice(4)}</h3>`)
      continue
    }

    if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h2>${safeLine.slice(3)}</h2>`)
      continue
    }

    if (line.startsWith('# ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h1>${safeLine.slice(2)}</h1>`)
      continue
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${safeLine.slice(2)}</li>`)
      continue
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }

    const withBold = safeLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html.push(`<p>${withBold}</p>`)
  }

  if (inList) {
    html.push('</ul>')
  }

  return html.join('')
}
