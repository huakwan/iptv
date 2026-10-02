import { Storage, File } from '@freearhey/storage-js'
import { PUBLIC_DIR, EOL } from '../constants'
import { Stream, Playlist } from '../models'
import { Collection } from '@freearhey/core'
import { Generator } from './generator'

type CountriesGeneratorProps = {
  streams: Collection<Stream>
  countries: Collection<unknown>
  logFile: File
}

export class CountriesGenerator implements Generator {
  streams: Collection<Stream>
  countries: Collection<unknown>
  storage: Storage
  logFile: File

  constructor({ streams, countries, logFile }: CountriesGeneratorProps) {
    this.streams = streams.clone()
    this.countries = countries
    this.storage = new Storage(PUBLIC_DIR)
    this.logFile = logFile
  }

  async generate(): Promise<void> {
    const streams = this.streams.filter((stream: Stream) => stream.isSFW())

    const filepath = 'countries/th.m3u'
    const playlist = new Playlist(streams, { public: true, raw: false })
    await this.storage.save(filepath, playlist.toString())
    this.logFile.append(
      JSON.stringify({ type: 'country', filepath, count: playlist.streams.count() }) + EOL
    )
  }
}
