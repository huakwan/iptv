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
