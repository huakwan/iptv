import { STREAMS_DIR } from '../../constants'
import { Storage } from '@freearhey/storage-js'
import fs from 'node:fs'
import path from 'node:path'

type StreamEntry = {
  tvgId: string
  name: string
  group?: string
  url: string
  userAgent?: string
  referrer?: string
  labels?: string[]
}

function buildExtinf(entry: StreamEntry): string {
  const attrs: string[] = [`tvg-id="${entry.tvgId}"`]
  if (entry.group) attrs.push(`group-title="${entry.group}"`)
  if (entry.userAgent) attrs.push(`http-user-agent="${entry.userAgent}"`)
  if (entry.referrer) attrs.push(`http-referrer="${entry.referrer}"`)

  const labels = entry.labels ?? []
  const suffix = labels.length ? ` [${labels.join(';')}]` : ''

  return `#EXTINF:-1 ${attrs.join(' ')},${entry.name}${suffix}`
}

async function main() {
  const storage = new Storage(STREAMS_DIR)
  const files = await storage.list('**/*.json')

  for (const filepath of files) {
    const absolute = path.join(process.cwd(), STREAMS_DIR, filepath)
    const raw = fs.readFileSync(absolute, 'utf8')
    const entries: StreamEntry[] = JSON.parse(raw)

    const lines = ['#EXTM3U']
    for (const entry of entries) {
      lines.push(buildExtinf(entry))
      if (entry.referrer) lines.push(`#EXTVLCOPT:http-referrer=${entry.referrer}`)
      if (entry.userAgent) lines.push(`#EXTVLCOPT:http-user-agent=${entry.userAgent}`)
      lines.push(entry.url)
    }

    const outputPath = filepath.replace(/\.json$/, '.m3u')
    fs.writeFileSync(
      path.join(process.cwd(), STREAMS_DIR, outputPath),
      lines.join('\r\n') + '\r\n',
      'utf8'
    )
    console.log(`converted ${filepath} -> ${outputPath} (${entries.length} entries)`)
  }
}

main()
