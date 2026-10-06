import { LOGS_DIR, STREAMS_DIR } from '../../constants'
import { Storage, File } from '@freearhey/storage-js'
import { PlaylistParser } from '../../core'
import { loadData, data } from '../../api'
import { Logger } from '@freearhey/core'
import uniqueId from 'lodash.uniqueid'
import { Stream } from '../../models'
import { CountriesGenerator, IndexGenerator, WebGenerator } from '../../generators'
import path from 'node:path'
import fs from 'node:fs'

function loadChannelOrder(): Map<string, number> {
  const order = new Map<string, number>()
  const dir = path.join(process.cwd(), STREAMS_DIR)
  if (!fs.existsSync(dir)) return order

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue
    const entries = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    entries.forEach((entry: { tvgId?: string }, index: number) => {
      if (entry.tvgId && !order.has(entry.tvgId)) {
        order.set(entry.tvgId, index)
      }
    })
  }

  return order
}

async function main() {
  const logger = new Logger()
  const logFile = new File('generators.log')

  logger.info('loading data from api...')
  await loadData()

  logger.info('loading streams...')
  const streamsStorage = new Storage(STREAMS_DIR)
  const parser = new PlaylistParser({
    storage: streamsStorage
  })
  const files = await streamsStorage.list('**/*.m3u')
  let streams = await parser.parse(files)

  logger.info('filtering streams to Thailand only...')
  streams = streams.filter((stream: Stream) => stream.countryName === 'Thailand')
  const totalStreams = streams.count()
  logger.info(`found ${totalStreams} streams`)

  logger.info('create unique names...')
  const channelCountries = new Map<string, Set<string>>()
  streams.forEach((stream: Stream) => {
    if (!channelCountries.has(stream.channelName)) {
      channelCountries.set(stream.channelName, new Set())
    }
    channelCountries.get(stream.channelName)!.add(stream.countryName)
  })
  for (const stream of streams.all()) {
    const countries = channelCountries.get(stream.channelName)
    stream.hasUniqueName = countries ? countries.size === 1 : false
  }

  logger.info('sorting streams...')
  const channelOrder = loadChannelOrder()
  streams = streams.sortBy(
    [
      (stream: Stream) => channelOrder.get(stream.getTvgId()) ?? 9999,
      (stream: Stream) => stream.channelUniqueName,
      (stream: Stream) => (stream.hasMainFeed ? 1 : 0),
      (stream: Stream) => stream.feedName,
      (stream: Stream) => (stream.isGeoBlocked ? -1 : 0),
      (stream: Stream) => (stream.isNot247 ? -1 : 0),
      (stream: Stream) => stream.getVerticalResolution()
    ],
    ['asc', 'asc', 'desc', 'asc', 'desc', 'desc', 'desc']
  )

  logger.info('filtering streams...')
  streams = streams
    .filter((stream: Stream) => stream.hasChannel() && stream.hasFeed())
    .uniqBy((stream: Stream) => stream.getId() || uniqueId())

  const { countries } = data

  logger.info('generating countries/...')
  await new CountriesGenerator({ countries, streams, logFile }).generate()

  logger.info('generating index.m3u...')
  await new IndexGenerator({ streams, logFile }).generate()

  logger.info('generating tv/...')
  await new WebGenerator({ streams, logFile }).generate()

  logger.info('saving generators.log...')
  const logStorage = new Storage(LOGS_DIR)
  logStorage.saveFile(logFile)
}

main()
