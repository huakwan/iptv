# Thai IPTV

Collection of publicly available IPTV (Internet Protocol television) channels broadcast in Thailand.

This is a Thailand-only fork of [iptv-org/iptv](https://github.com/iptv-org/iptv). Only channels whose channel country is Thailand (`TH`) are included.

## How to use

Paste one of the playlist links below into any video player that supports live streaming (for example VLC, TiviMate, or Kodi) and press _Open_.

| Playlist | URL |
| --- | --- |
| All Thai channels | `https://huakwan.github.io/iptv/countries/th.m3u` |
| Index (grouped) | `https://huakwan.github.io/iptv/index.m3u` |

## Source

Channel data is taken from the [iptv-org/api](https://github.com/iptv-org/api) repository. The playlist sources live in [`streams/`](streams):

- `streams/th.m3u`
- `streams/th_v2hcdn.m3u`

To add or fix a channel, edit the relevant file above and run:

```sh
npm install
npm run playlist:generate
```

The generated playlists are written to `.gh-pages/` and deployed to GitHub Pages by the [update](.github/workflows/update.yml) workflow.

## EPG

An [Electronic Program Guide](https://en.wikipedia.org/wiki/Electronic_program_guide) for most channels can be downloaded using utilities published in the [iptv-org/epg](https://github.com/iptv-org/epg) repository.

## Legal

No video files are stored in this repository. The repository simply contains user-submitted links to publicly available video stream URLs, which to the best of our knowledge have been intentionally made publicly by the copyright holders. If any links in these playlists infringe on your rights as a copyright holder, they may be removed by opening an issue. However, note that we have **no control** over the destination of the link, and just removing the link from the playlist will not remove its contents from the web. Note that linking does not directly infringe copyright because no copy is made on the site providing the link, and thus this is **not** a valid reason to send a DMCA notice to GitHub. To remove this content from the web, you should contact the web host that's actually hosting the content (**not** GitHub, nor the maintainers of this repository).

## License

[![CC0](http://mirrors.creativecommons.org/presskit/buttons/88x31/svg/cc-zero.svg)](LICENSE)

This repository is based on [iptv-org/iptv](https://github.com/iptv-org/iptv), which is released under the [Unlicense](https://unlicense.org/).
