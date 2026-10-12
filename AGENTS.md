# AGENTS.md

Thailand-only fork of [iptv-org/iptv](https://github.com/iptv-org/iptv). Generated playlists and the web player are served from GitHub Pages.

## Language

- Always respond to the user in Thai (ภาษาไทย), including questions and options.

## Commands

- `npm install` — runs `postinstall` → `api:load`, downloading iptv-org API data to `temp/data/`.
- `npm run playlist:generate` — **the main command**. Runs `playlist:build` (JSON → `.m3u`), then regenerates everything in `.gh-pages/`: `index.m3u`, `countries/th.m3u`, `index.html`, and `tv/` (web player + `channels.json` + `epg.json` + logos) via `WebGenerator`.
- `npm run playlist:build` — regenerates `streams/*.m3u` from `streams/*.json` only.
- `npm run playlist:validate` — validates `streams/*.m3u` against the API data (missing channel/feed, duplicate URLs, blocklist). Non-zero exit on errors.
- `npm run playlist:format` — re-normalizes raw upstream-style stream files and rescans quality; writes `raw` playlists. Not used for `streams/th.json`.
- `npm run playlist:lint` — m3u-linter over `streams/*.m3u` (`m3u-linter.json`).
- `npm run lint` — ESLint over `scripts/**` only. Run before committing; CI does not run it.
- `npm run epg:dedupe` — removes duplicate `<channel>`/`<programme>` slots from `.gh-pages/guide.xml`.
- `make serve` — local preview of the web player: copies `web/tv` into `.gh-pages/tv`, injects `<base href="./tv/">` + a `dev` version, serves `.gh-pages` on `:8080`.
- `make deploy` / `make status` / `make check-url` — wrappers over `gh workflow run`, `gh run list`, and a `curl` status check.
- No test suite (`vitest` is a dependency but `tests/` was deleted and there is no `test` script).

## Source of truth

- **`streams/th.json` is the only file to edit by hand.** It feeds `streams/th.m3u` (generated, gitignored via `/streams/*.m3u`) and the web app's `channels.json`.
- Entry fields: `tvgId` (required), `name` (required), `url` (required), `number` (channel number in the web app), `group`, `gain` (per-channel volume trim, dB), `labels`, `userAgent`, `referrer`. The labels `Not 24/7` and `Geo-blocked` may also be written as a `name` suffix like `[Not 24/7]`.
- Adding/removing a channel = edit `streams/th.json`, then `npm run playlist:generate`. The same change must add/remove the matching `<channel>` entries in `.github/epg/channels.xml`.

## Playlist gotchas (verify before assuming)

- `tvgId` must be `{channelId}@{feedId}` and the feed must exist in the API, or the stream is silently dropped by the `hasChannel() && hasFeed()` filter. Example: `3HD.th@SD`. A `tvgId` without `@feed` (e.g. bare `One31.th`) gets dropped.
- `group` in JSON overrides the API category; if omitted, `CountriesGenerator` fills `group-title` from `channel.categories`. `Undefined` in output means neither was set.
- The generate pipeline filters streams to `countryName === 'Thailand'`, so foreign channels in `streams/` are discarded.
- The web player also drops `http://` streams (mixed content) and hosts listed in `CORS_BLOCKED_HOSTS` (`live-iptv.cool-channel.com`) — see `scripts/generators/webGenerator.ts`.
- Dead stream URLs are common. Check with `curl -sS -m 15 -o /dev/null -w '%{http_code}\n' "<url>"` — 503/404 means replace it.

## EPG (Thai channels)

- Public playlists advertise the guide via `x-tvg-url="https://huakwan.github.io/iptv/guide.xml"` (from `GUIDE_URL` in `scripts/constants.ts`, merged in `Playlist.getGuideUrls()`).
- `guide.xml` is generated at build time by the `Grab EPG` step in `.github/workflows/update.yml`, which clones `iptv-org/epg` and runs its grabber against `.github/epg/channels.xml`. It is served from `.gh-pages/` (gitignored; never committed).
- `.github/epg/channels.xml` maps each stream `tvgId` (e.g. `3HD.th@SD`) to a source `site` + `site_id`. The EPG `<channel id>` must exactly equal the playlist `tvg-id`, including the `@feed` suffix, or players will not match.
- **Risk:** the grabber depends on `gigatv.3bbtv.co.th` and `tv.trueid.net` staying online and unchanged. If either breaks, that site's channels lose guide data that run.
- **Risk:** EPG grabbing adds several minutes per run (extra clone + `npm ci`). `continue-on-error: true` keeps a broken grab from failing the deploy.
- **Risk:** if the grab produces no file, `guide.xml` returns 404 for clients. The `Ensure guide exists` step writes an empty `<tv></tv>` fallback.
- **Maintenance:** every channel change must be done as a set. When adding a stream to `streams/th.json`, add the matching `<channel>` entry to `.github/epg/channels.xml` in the same change (find the source `site` + `site_id` in `iptv-org/epg` `sites/*/*.channels.xml`). When removing a stream, delete its `<channel>` entries. A stream with no EPG mapping will still play but show no guide.
- `3HD`, `Channel5` and `One31` have no `xmltv_id` upstream, so they only appear because `channels.xml` sets `xmltv_id` explicitly. Do not switch to `--sites=...` (it drops them and bloats the guide).
- Most channels map to two sources, so the raw grab emits each timeslot twice (overlapping entries in players). The `Deduplicate EPG` step runs `npm run epg:dedupe`, which keeps one `<programme>` per `channel`+`start` (longest title wins) and one `<channel>` per id.
- Upstream `guides.json` (in `temp/data/`) has no `sources` for Thailand, so the old API-driven `x-tvg-url` path yields nothing; this static guide is the only source.

## Web app (`web/tv`)

- `web/tv/` is the source; `WebGenerator` copies it into `.gh-pages/tv/` at build time (`.gh-pages/` is gitignored and never committed). Never edit `.gh-pages/`.
- `WebGenerator` also writes `channels.json` and `epg.json` (parsed from `.gh-pages/guide.xml`, keyed by `tvgId`), downloads each channel logo into `.gh-pages/tv/logos/`, and emits `.gh-pages/index.html` from `web/tv/index.html` with `<base href="./tv/">` added and `__APP_VERSION__` replaced.
- Logo overrides: drop an image in `web/tv/logos/` named after the sanitized channel name (e.g. `NBT_2_HD.webp`, `Vipa_TV.png`). `logoOverrides.ts` matches by that base name; the same override also replaces `tvg-logo` in the `.m3u`.
- Auto night theme: `web/tv/index.html` head holds an inline script that is the **single source of truth**. It adds `theme-night` to `<html>` when the local clock is 18:00–06:00, before `styles.css` loads, so there is no light flash. It re-checks at each 18:00/06:00 boundary via `setTimeout`.
  - It deliberately uses the device's local timezone (`new Date().getHours()`), not a pinned `Asia/Bangkok`, so a device set to another timezone follows that timezone.
  - The dark values live in `web/tv/styles.css` under `html.theme-night` (overrides `--bg`, `--panel`, `--logo-bg`, `--name-bg`, `--border`). Change the window in the inline script; change colors in the CSS. `app.js` does not handle the theme.
  - Only `index.html` gets it; static pages (`about.html`, `privacy.html`, `disclaimer.html`) link `styles.css` but have no night script, so they stay on the default palette.
- Player (`app.js`): pins live in `localStorage` key `hk-iptv-pins` (long-press a card to toggle), the thaimomo single-tier master is rebuilt/cached, and per-channel `gain` is applied through a WebAudio gain + limiter.

## Code constraints

- ESLint enforces **CRLF line endings** (`@stylistic/linebreak-style: windows`), single quotes, no semicolons. New `scripts/**` files written with LF fail `npm run lint`; convert with:
  `perl -0777 -pi -e 's/(?<!\r)\n/\r\n/g' <file>`
- Web files (`web/tv/*`) are not linted, but keep them CRLF too.
- Three generators remain: `CountriesGenerator`, `IndexGenerator`, `WebGenerator`; `scripts/generators/index.ts` re-exports all three. Do not import deleted generators.
- `scripts/constants.ts`: `OWNER=huakwan`, `REPO=iptv`, `PUBLIC_DIR=.gh-pages`, `GUIDE_URL=https://huakwan.github.io/iptv/guide.xml`.

## Deploy

- GitHub Pages, `build_type: workflow`, served from `huakwan/iptv` at `https://huakwan.github.io/iptv/`.
- `.github/workflows/update.yml` runs **only** on `workflow_dispatch` and a daily cron (`0 0 * * *`) — **not** on push. Steps: `npm install` → checkout `iptv-org/epg` into `.epg` + install its deps → grab `guide.xml` (continue-on-error) → ensure guide exists → `epg:dedupe` → `playlist:generate` → upload + deploy `.gh-pages`.
- After pushing, trigger manually: `gh workflow run update.yml --repo huakwan/iptv && gh run watch --repo huakwan/iptv --exit-status` (or `make deploy`).
- `.github/dependabot.yml` bumps GitHub Actions weekly.

## Git

- `origin` = `https://github.com/huakwan/iptv.git` (default branch `main`).
- `upstream` = `https://github.com/iptv-org/iptv.git` (source of `streams/th.json` channel data).
- The local clone was shallow (`--depth=1`) and **`git push` fails** with `did not receive expected object` until `git fetch --unshallow upstream master` is run. Do this before pushing from a fresh clone.
