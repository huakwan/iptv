import { OWNER, REPO } from './constants'
import path from 'node:path'
import fs from 'node:fs'

const OVERRIDES_DIR = path.join(process.cwd(), 'web', 'tv', 'logos')

export function sanitizeFilename(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

let overrides: Map<string, string> | null = null

function loadOverrides(): Map<string, string> {
  if (overrides) return overrides

  const items = new Map<string, string>()
  if (fs.existsSync(OVERRIDES_DIR)) {
    for (const filename of fs.readdirSync(OVERRIDES_DIR)) {
      items.set(filename.replace(/\.[^.]+$/, ''), filename)
    }
  }

  overrides = items
  return overrides
}

export function getLogoOverrideUrl(base: string): string {
  const filename = loadOverrides().get(base)
  if (!filename) return ''

  return `https://${OWNER}.github.io/${REPO}/tv/logos/${filename}`
}
