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

Channel data is taken from the [iptv-org/api](https://github.com/iptv-org/api) repository. The playlist source lives in [`streams/th.json`](streams/th.json). The `.m3u` files in `streams/` are generated from it and are not tracked in git.

Each entry supports these fields:

| Field | Required | Description |
| --- | --- | --- |
| `tvgId` | yes | Channel id plus feed, e.g. `3HD.th@SD` |
| `name` | yes | Display name shown in the player |
| `url` | yes | Stream URL |
| `group` | no | Group title. Falls back to the channel category from the API when omitted |
| `labels` | no | Extra labels, e.g. `["Not 24/7", "Geo-blocked"]` |
| `userAgent` | no | `http-user-agent` header required by the stream |
| `referrer` | no | `http-referrer` header required by the stream |

To add, fix, or remove a channel, edit `streams/th.json` and run:

```sh
npm install
npm run playlist:generate
```

The `.m3u` sources are rebuilt from JSON, then the public playlists are written to `.gh-pages/` and deployed to GitHub Pages by the [update](.github/workflows/update.yml) workflow.

### Publishing changes

```sh
make generate
git add streams/th.json
git commit -m "Update Thai playlist"
git push origin main
make deploy
```

Deploy is manual: the [update](.github/workflows/update.yml) workflow runs only on `workflow_dispatch` and a daily schedule, not on push.

## Makefile

Common tasks are wrapped in a `Makefile`:

| Command | Description |
| --- | --- |
| `make install` | Install dependencies |
| `make generate` | Rebuild `.m3u` from JSON and generate public playlists |
| `make build` | Rebuild `streams/*.m3u` from `streams/*.json` only |
| `make lint` | Run ESLint over `scripts/` |
| `make playlist-lint` | Run m3u-linter over `streams/*.m3u` |
| `make validate` | Validate playlists against the API data |
| `make deploy` | Trigger the update workflow and wait for it |
| `make status` | Show recent workflow runs |
| `make check-url` | Check the HTTP status of the live playlist |

`REPO`, `BRANCH`, and `URL` can be overridden, e.g. `make deploy REPO=huakwan/iptv`.

## EPG

The generated playlists do not include an [Electronic Program Guide](https://en.wikipedia.org/wiki/Electronic_program_guide) (`x-tvg-url`). Guide data for many channels can still be obtained via the [iptv-org/epg](https://github.com/iptv-org/epg) repository.

## Legal

No video files are stored in this repository. The repository simply contains user-submitted links to publicly available video stream URLs, which to the best of our knowledge have been intentionally made publicly by the copyright holders. If any links in these playlists infringe on your rights as a copyright holder, they may be removed by opening an issue. However, note that we have **no control** over the destination of the link, and just removing the link from the playlist will not remove its contents from the web. Note that linking does not directly infringe copyright because no copy is made on the site providing the link, and thus this is **not** a valid reason to send a DMCA notice to GitHub. To remove this content from the web, you should contact the web host that's actually hosting the content (**not** GitHub, nor the maintainers of this repository).

## License

[![CC0](https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/cc-zero.svg)](LICENSE)

This repository is based on [iptv-org/iptv](https://github.com/iptv-org/iptv), which is released under the [Unlicense](https://unlicense.org/).
