import { sanitizeFilename } from '../logoOverrides'
import { PUBLIC_DIR, STREAMS_DIR, EOL } from '../constants'
import { Generator } from './generator'
import { Stream } from '../models'
import { execSync } from 'node:child_process'
import { File } from '@freearhey/storage-js'
import { Collection } from '@freearhey/core'
import axios from 'axios'
import path from 'node:path'
import fs from 'node:fs'

const CORS_BLOCKED_HOSTS = ['live-iptv.cool-channel.com']

function getBuildVersion(): string {
  let sha = ''
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    sha = ''
  }

  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date())

  return sha ? `${timestamp} · ${sha}` : timestamp
}

function loadChannelNumbers(): Map<string, number> {
  const numbers = new Map<string, number>()
  const dir = path.join(process.cwd(), STREAMS_DIR)
  if (!fs.existsSync(dir)) return numbers

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue
    const entries = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    for (const entry of entries) {
      if (entry.tvgId && typeof entry.number === 'number' && !numbers.has(entry.tvgId)) {
        numbers.set(entry.tvgId, entry.number)
      }
    }
  }

  return numbers
}

function loadChannelGains(): Map<string, number> {
  const gains = new Map<string, number>()
  const dir = path.join(process.cwd(), STREAMS_DIR)
  if (!fs.existsSync(dir)) return gains

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue
    const entries = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    for (const entry of entries) {
      if (entry.tvgId && typeof entry.gain === 'number' && !gains.has(entry.tvgId)) {
        gains.set(entry.tvgId, entry.gain)
      }
    }
  }

  return gains
}

function loadChannelLowUrls(): Map<string, string> {
  const lowUrls = new Map<string, string>()
  const dir = path.join(process.cwd(), STREAMS_DIR)
  if (!fs.existsSync(dir)) return lowUrls

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue
    const entries = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    for (const entry of entries) {
      if (
        entry.tvgId &&
        typeof entry.lowUrl === 'string' &&
        entry.lowUrl.startsWith('https://') &&
        !lowUrls.has(entry.tvgId)
      ) {
        lowUrls.set(entry.tvgId, entry.lowUrl)
      }
    }
  }

  return lowUrls
}

type WebGeneratorProps = {
  streams: Collection<Stream>
  logFile: File
}

type ChannelEntry = {
  tvgId: string
  name: string
  number?: number
  logo: string
  group: string
  url: string
  lowUrl?: string
  referrer: string
  userAgent: string
  labels: string[]
  gain?: number
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/apng': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif'
}

function getLogoExtension(url: string): string {
  try {
    const match = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)
    if (match) {
      const ext = match[1].toLowerCase()
      if (Object.values(EXT_BY_MIME).includes(ext)) return ext
    }
  } catch {
    // ignore malformed logo url
  }

  return 'png'
}

async function downloadLogos(channels: ChannelEntry[], logosDir: string): Promise<number> {
  const overridesDir = path.join(process.cwd(), 'web', 'tv', 'logos')
  const overrides = new Map<string, string>()
  if (fs.existsSync(overridesDir)) {
    for (const filename of fs.readdirSync(overridesDir)) {
      overrides.set(filename.replace(/\.[^.]+$/, ''), filename)
    }
  }

  const existing = new Map<string, string>()
  for (const filename of fs.readdirSync(logosDir)) {
    const base = filename.replace(/\.[^.]+$/, '')
    if (!existing.has(base)) existing.set(base, filename)
  }

  const cache = new Map<string, string | null>()
  const used = new Set<string>()
  let saved = 0

  for (const channel of channels) {
    const base = sanitizeFilename(channel.name || channel.tvgId)

    const override = overrides.get(base)
    if (override && !used.has(override)) {
      fs.copyFileSync(path.join(overridesDir, override), path.join(logosDir, override))
      used.add(override)
      channel.logo = `logos/${override}`
      continue
    }

    const url = channel.logo
    if (!url) continue

    if (cache.has(url)) {
      const local = cache.get(url)
      if (local) channel.logo = local
      continue
    }

    const existingFile = existing.get(base)
    if (existingFile && !used.has(existingFile)) {
      used.add(existingFile)
      const local = `logos/${existingFile}`
      cache.set(url, local)
      channel.logo = local
      continue
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })

      const contentType = String(response.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase()
      const ext = EXT_BY_MIME[contentType] || getLogoExtension(url)

      let filename = `${base}.${ext}`
      let counter = 2
      while (used.has(filename)) {
        filename = `${base}-${counter}.${ext}`
        counter++
      }
      used.add(filename)
      existing.set(base, filename)

      fs.writeFileSync(path.join(logosDir, filename), Buffer.from(response.data))

      const local = `logos/${filename}`
      cache.set(url, local)
      channel.logo = local
      saved++
    } catch {
      cache.set(url, null)
    }
  }

  return saved
}

export class WebGenerator implements Generator {
  streams: Collection<Stream>
  logFile: File

  constructor({ streams, logFile }: WebGeneratorProps) {
    this.streams = streams.clone()
    this.logFile = logFile
  }

  async generate(): Promise<void> {
    const outDir = path.join(process.cwd(), PUBLIC_DIR, 'tv')
    if (fs.existsSync(outDir)) {
      for (const entry of fs.readdirSync(outDir)) {
        if (entry === 'logos') continue
        fs.rmSync(path.join(outDir, entry), { recursive: true, force: true })
      }
    } else {
      fs.mkdirSync(outDir, { recursive: true })
    }

    const channels: ChannelEntry[] = []
    const seen = new Set<string>()
    const channelNumbers = loadChannelNumbers()
    const channelGains = loadChannelGains()
    const channelLowUrls = loadChannelLowUrls()

    this.streams
      .filter(
        (stream: Stream) =>
          stream.isSFW() &&
          !stream.url.startsWith('http://') &&
          !CORS_BLOCKED_HOSTS.some(host => stream.url.includes(host))
      )
      .forEach((stream: Stream) => {
        const tvgId = stream.getTvgId()
        if (!tvgId || seen.has(tvgId)) return
        seen.add(tvgId)

        let group = stream.groupTitle
        if (group === 'Undefined') {
          group = stream
            .getCategories()
            .map(category => category.name)
            .sort()
            .join(';')
        }

        channels.push({
          tvgId,
          name: stream.channelName || stream.title || tvgId,
          number: channelNumbers.get(tvgId),
          logo: stream.getTvgLogo(),
          group: group || '',
          url: stream.url,
          ...(channelLowUrls.get(tvgId) ? { lowUrl: channelLowUrls.get(tvgId) } : {}),
          referrer: stream.referrer || '',
          userAgent: stream.user_agent || '',
          labels: stream.getLabels(),
          ...(channelGains.get(tvgId) !== undefined && channelGains.get(tvgId) !== 0
            ? { gain: channelGains.get(tvgId) }
            : {})
        })
      })

    const logosDir = path.join(outDir, 'logos')
    fs.mkdirSync(logosDir, { recursive: true })
    const logosSaved = await downloadLogos(channels, logosDir)

    fs.writeFileSync(path.join(outDir, 'channels.json'), JSON.stringify(channels), 'utf8')

    const assetsDir = path.join(process.cwd(), 'web', 'tv')
    if (fs.existsSync(assetsDir)) {
      fs.cpSync(assetsDir, outDir, { recursive: true })
    }

    const version = getBuildVersion()
    const injectVersion = (html: string) => html.replace(/__APP_VERSION__/g, version)

    const tvIndexOut = path.join(outDir, 'index.html')
    if (fs.existsSync(tvIndexOut)) {
      fs.writeFileSync(tvIndexOut, injectVersion(fs.readFileSync(tvIndexOut, 'utf8')), 'utf8')
    }

    const tvIndex = path.join(assetsDir, 'index.html')
    if (fs.existsSync(tvIndex)) {
      const html = injectVersion(
        fs
          .readFileSync(tvIndex, 'utf8')
          .replace('<head>', '<head>' + EOL + '    <base href="./tv/" />')
      )
      fs.writeFileSync(path.join(process.cwd(), PUBLIC_DIR, 'index.html'), html, 'utf8')
    }

    this.logFile.append(
      JSON.stringify({
        type: 'web',
        filepath: 'tv/channels.json',
        count: channels.length,
        logos: logosSaved
      }) + EOL
    )
  }
}
