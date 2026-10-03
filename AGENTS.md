# AGENTS.md

Thailand-only fork of [iptv-org/iptv](https://github.com/iptv-org/iptv). Generated playlists are served from GitHub Pages.

## Language

- Always respond to the user in Thai (ภาษาไทย), including questions and options.

## Commands

- `npm install` — runs `postinstall` → `api:load`, downloading iptv-org API data to `temp/data/`.
- `npm run playlist:generate` — **the main command**. Runs `playlist:build` (JSON → `.m3u`) then generates `.gh-pages/index.m3u` and `.gh-pages/countries/th.m3u`.
- `npm run playlist:build` — regenerates `streams/*.m3u` from `streams/*.json` only.
- `npm run lint` — ESLint over `scripts/**`. Run before committing; CI does not run it.
- `npm run playlist:lint` — m3u-linter over `streams/*.m3u`.
- `npm run playlist:validate` — validates internal playlists against the API data.
- `npm run epg:dedupe` — removes duplicate `<programme>` slots from `.gh-pages/guide.xml`.
- No test suite (`vitest` is a dependency but `tests/` was deleted and there is no `test` script).

## Source of truth

- **`streams/th.json` is the only file to edit by hand.** It feeds `streams/th.m3u` (generated, gitignored via `/streams/*.m3u`).
- Entry fields: `tvgId` (required), `name` (required), `url` (required), `group`, `labels`, `userAgent`, `referrer`.
- Adding/removing a channel = edit `streams/th.json`, then `npm run playlist:generate`.

## Playlist gotchas (verify before assuming)

- `tvgId` must be `{channelId}@{feedId}` and the feed must exist in the API, or the stream is silently dropped by the `hasChannel() && hasFeed()` filter. Example: `3HD.th@SD`. A `tvgId` without `@feed` (e.g. bare `One31.th`) gets dropped.
- `group` in JSON overrides the API category; if omitted, `CountriesGenerator` fills `group-title` from `channel.categories`. `Undefined` in output means neither was set.
- The generate pipeline filters streams to `countryName === 'Thailand'`, so foreign channels in `streams/` are discarded.
- Dead stream URLs are common. Check with `curl -sS -m 15 -o /dev/null -w '%{http_code}\n' "<url>"` — 503/404 means replace it.

## EPG (Thai channels)

- Public playlists advertise the guide via `x-tvg-url="https://huakwan.github.io/iptv/guide.xml"` (from `GUIDE_URL` in `scripts/constants.ts`, merged in `Playlist.getGuideUrls()`).
- `guide.xml` is generated at build time by the `Grab EPG` step in `.github/workflows/update.yml`, which clones `iptv-org/epg` and runs its grabber against `.github/epg/channels.xml`. It is served from `.gh-pages/` (gitignored; never committed).
- `.github/epg/channels.xml` maps each stream `tvgId` (e.g. `3HD.th@SD`) to a source `site` + `site_id`. The EPG `<channel id>` must exactly equal the playlist `tvg-id`, including the `@feed` suffix, or players will not match.
- **Risk:** the grabber depends on `gigatv.3bbtv.co.th` and `tv.trueid.net` staying online and unchanged. If either breaks, that site's channels lose guide data that run.
- **Risk:** EPG grabbing adds several minutes per run (extra clone + `npm ci`). `continue-on-error: true` keeps a broken grab from failing the deploy.
- **Risk:** if the grab produces no file, `guide.xml` returns 404 for clients. The `Ensure guide exists` step writes an empty `<tv></tv>` fallback.
- **Maintenance:** adding/removing a channel in `streams/th.json` does not update the guide. Hand-add/remove the matching `<channel>` entries in `.github/epg/channels.xml`.
- `3HD`, `Channel5` and `One31` have no `xmltv_id` upstream, so they only appear because `channels.xml` sets `xmltv_id` explicitly. Do not switch to `--sites=...` (it drops them and bloats the guide).
- Most channels map to two sources, so the raw grab emits each timeslot twice (overlapping entries in players). The `Deduplicate EPG` step runs `npm run epg:dedupe`, which keeps one `<programme>` per `channel`+`start` (longest title wins) and one `<channel>` per id.
- Upstream `guides.json` (in `temp/data/`) has no `sources` for Thailand, so the old API-driven `x-tvg-url` path yields nothing; this static guide is the only source.

## Code constraints

- ESLint enforces **CRLF line endings** (`@stylistic/linebreak-style: windows`), single quotes, no semicolons. New files written with LF fail `npm run lint`; convert with:
  `perl -0777 -pi -e 's/(?<!\r)\n/\r\n/g' <file>`
- Only two generators remain: `CountriesGenerator` and `IndexGenerator`. `scripts/generators/index.ts` re-exports only these; do not import deleted generators.
- `scripts/constants.ts` `OWNER=huakwan`, `REPO=iptv`.

## Deploy

- GitHub Pages, `build_type: workflow`, served from `huakwan/iptv` at `https://huakwan.github.io/iptv/`.
- `.github/workflows/update.yml` runs **only** on `workflow_dispatch` and a daily cron — **not** on push. After pushing, trigger manually:
  `gh workflow run update.yml --repo huakwan/iptv && gh run watch --repo huakwan/iptv --exit-status`

## Git

- `origin` = `https://github.com/huakwan/iptv.git` (default branch `main`).
- `upstream` = `https://github.com/iptv-org/iptv.git` (source of `streams/th.json` channel data).
- The local clone was shallow (`--depth=1`) and **`git push` fails** with `did not receive expected object` until `git fetch --unshallow upstream master` is run. Do this before pushing from a fresh clone.
