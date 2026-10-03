import { PUBLIC_DIR } from '../../constants'
import path from 'node:path'
import fs from 'node:fs'

const filepath = path.join(process.cwd(), PUBLIC_DIR, 'guide.xml')

if (!fs.existsSync(filepath)) {
  console.log('guide.xml not found, skipping dedupe')
  process.exit(0)
}

const xml = fs.readFileSync(filepath, 'utf8')

const blockRe = /<channel [\s\S]*?<\/channel>|<programme [\s\S]*?<\/programme>/g
const blocks = [...xml.matchAll(blockRe)]

if (blocks.length === 0) {
  console.log('guide.xml has no channel/programme blocks, skipping dedupe')
  process.exit(0)
}

const headerMatch = xml.match(/^([\s\S]*?)(?=<(?:channel|programme)\b)/)
const header = headerMatch ? headerMatch[1] : ''

function attr(block: string, name: string): string {
  const match = block.match(new RegExp(`<(?:channel|programme)[^>]*${name}="([^"]*)"`))
  return match ? match[1] : ''
}

function titleLength(block: string): number {
  const match = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)
  return match ? match[1].length : 0
}

const channels = new Map<string, string>()
const programmes = new Map<string, string>()

for (const match of blocks) {
  const block = match[0]

  if (block.startsWith('<channel')) {
    const id = attr(block, 'id')
    if (!channels.has(id)) channels.set(id, block)
    continue
  }

  const key = `${attr(block, 'channel')}|${attr(block, 'start')}`
  const existing = programmes.get(key)

  if (!existing || titleLength(block) > titleLength(existing)) {
    programmes.set(key, block)
  }
}

const output =
  header + [...channels.values()].join('\n') + '\n' + [...programmes.values()].join('\n') + '\n</tv>\n'

fs.writeFileSync(filepath, output, 'utf8')

console.log(`deduped guide: ${channels.size} channels, ${programmes.size} programmes`)
