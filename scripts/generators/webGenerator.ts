import { File } from '@freearhey/storage-js'
import { PUBLIC_DIR, EOL } from '../constants'
import { Stream } from '../models'
import { Collection } from '@freearhey/core'
import { Generator } from './generator'
import path from 'node:path'
import fs from 'node:fs'

type WebGeneratorProps = {
  streams: Collection<Stream>
  logFile: File
}

type ChannelEntry = {
  tvgId: string
  name: string
  logo: string
  group: string
  url: string
  referrer: string
  userAgent: string
  labels: string[]
}

type ProgrammeEntry = {
  start: number
  stop: number
  title: string
  desc: string
}

const XMLTV_TIME_RE = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/

function parseXmltvTime(value: string): number {
  const match = value.match(XMLTV_TIME_RE)
  if (!match) return 0

  const [, year, month, day, hour, minute, second, sign, offHour, offMinute] = match
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )
  if (!sign) return utc

  const offset = (Number(offHour) * 60 + Number(offMinute)) * 60000

  return sign === '-' ? utc + offset : utc - offset
}

function parseAttr(block: string, name: string): string {
  const match = block.match(new RegExp(`<programme[^>]*\\s${name}="([^"]*)"`))

  return match ? match[1] : ''
}

function parseTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))

  return match ? match[1].trim() : ''
}

function buildEpg(channelIds: Set<string>, guide: string): Record<string, ProgrammeEntry[]> {
  const epg: Record<string, ProgrammeEntry[]> = {}

  const blockRe = /<programme [\s\S]*?<\/programme>/g
  for (const match of guide.matchAll(blockRe)) {
    const block = match[0]
    const channel = parseAttr(block, 'channel')
    if (!channelIds.has(channel)) continue

    const start = parseXmltvTime(parseAttr(block, 'start'))
    const stop = parseXmltvTime(parseAttr(block, 'stop'))
    if (!start || !stop) continue

    if (!epg[channel]) epg[channel] = []
    epg[channel].push({
      start,
      stop,
      title: parseTag(block, 'title'),
      desc: parseTag(block, 'desc')
    })
  }

  for (const programmes of Object.values(epg)) {
    programmes.sort((a, b) => a.start - b.start)
  }

  return epg
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
    fs.rmSync(outDir, { recursive: true, force: true })
    fs.mkdirSync(outDir, { recursive: true })

    const channels: ChannelEntry[] = []
    const seen = new Set<string>()

    this.streams
      .filter((stream: Stream) => stream.isSFW())
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
          logo: stream.getTvgLogo(),
          group: group || '',
          url: stream.url,
          referrer: stream.referrer || '',
          userAgent: stream.user_agent || '',
          labels: stream.getLabels()
        })
      })

    fs.writeFileSync(path.join(outDir, 'channels.json'), JSON.stringify(channels), 'utf8')

    const guidePath = path.join(process.cwd(), PUBLIC_DIR, 'guide.xml')
    let epg: Record<string, ProgrammeEntry[]> = {}
    if (fs.existsSync(guidePath)) {
      epg = buildEpg(new Set(channels.map(channel => channel.tvgId)), fs.readFileSync(guidePath, 'utf8'))
    }
    fs.writeFileSync(path.join(outDir, 'epg.json'), JSON.stringify(epg), 'utf8')

    const assetsDir = path.join(process.cwd(), 'web', 'tv')
    if (fs.existsSync(assetsDir)) {
      fs.cpSync(assetsDir, outDir, { recursive: true })
    }

    const rootIndex = path.join(process.cwd(), 'web', 'index.html')
    if (fs.existsSync(rootIndex)) {
      fs.copyFileSync(rootIndex, path.join(process.cwd(), PUBLIC_DIR, 'index.html'))
    }

    this.logFile.append(
      JSON.stringify({
        type: 'web',
        filepath: 'tv/channels.json',
        count: channels.length
      }) + EOL
    )
  }
}
