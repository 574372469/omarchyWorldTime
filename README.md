# World Clock

**English** | [简体中文](README.zh-CN.md)

A web recreation of **Elsewhen**, the world-clock panel built into [Omarchy](https://github.com/omacom/omarchy). Each city gets a row with its local time and a 24-hour daylight strip, alongside a rotatable globe.

- Reference project: [Omarchy](https://github.com/omacom/omarchy), especially `shell/plugins/panels/elsewhen/`. See [the reference notes](docs/omarchy-reference.md).
- Stack: Vite, React, and TypeScript. Time-zone calculations use `Intl.DateTimeFormat`.
- Hosting: Cloudflare Pages or Cloudflare Workers static assets. The app is a static frontend with no backend or API calls.

## Why I made this

I recently started using Omarchy Linux and was impressed by its design sensibility. I happened to discover its built-in Elsewhen world clock. It seemed especially useful for people in international trade and anyone who works or communicates across time zones. I recreated it for the web so people who don't use Omarchy can try similar functionality and get a feel for it. I chose the web because there is no app-store review wait or download: just open it and use it. I hope you like it.

## Features

| Feature | Details |
|---|---|
| City list | Shows local time and date, day differences, time-zone abbreviations, and offsets. Fresh defaults are your local time zone, New York (US), London (UK), Dubai (UAE), and Sydney (Australia); duplicate zones are omitted when your local zone matches one of them. Existing customized city lists are kept. The local row stays pinned at the top and cannot be removed. |
| Daylight strip | Shows sunrise, sunset, and the moon phase. Drag or use the arrow keys to preview a time across all cities and the globe; select the preview button to return to live time. |
| Greetings | Shows Elsewhen's time-of-day greetings, with romanization where available. |
| Globe | Rotatable globe with a day/night line and selectable city labels. Page pinch zoom remains available outside the draggable globe and reorder grips. |
| Search | Browse all time zones supported by your browser. Each option shows the zone's name in your language and in its own, and either spelling finds it; zones already on the clock are left out. |
| Reordering and touch | Reorder cities with the explicit grip. The list remains scrollable by touch, and draggable controls do not select text. |
| Language | Follows the browser's detected language by default, with a manual choice of English, Simplified Chinese, Traditional Chinese, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Italian, or Dutch. |
| Themes | Choose from 23 Omarchy themes, including light themes, and optionally enable rounded corners. |
| Preferences | Your city list, theme, language, and clock settings are saved in browser local storage. |
| Layout | Responsive layouts for phones, tablets, and desktop screens. |

Keyboard shortcuts: `T` switches between 12- and 24-hour time, `G` toggles the globe, and `Esc` backs out one level.

## Development

Requires Node.js `^20.19.0` or `>=22.12.0` (the Vite 8 requirement).

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build in `dist/` (runs `tsc -b` before the Vite build):

```bash
npm run build
```

## Deployment

### Cloudflare Pages

Connect the repository in Cloudflare Dashboard → Workers & Pages → Create → Pages, then use these settings:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `^20.19.0` or `>=22.12.0` |

The app has no client-side routes. `public/_headers` is copied into the build output.

### Cloudflare Workers static assets

The `deploy` script builds the app and runs Wrangler using the settings in `wrangler.jsonc` (`assets.directory` is `./dist`). To deploy from the command line:

```bash
npm run deploy
```

If Wrangler asks you to sign in, run:

```bash
npx wrangler login
```

## Desktop widget

The same panel also runs as a frameless desktop widget (Tauri 2), on Windows and macOS. It sits above other windows, keeps the list of cities, and has its own title bar: drag it to move the window, ◆ pins it on top, × closes it.

Requires the Rust toolchain (`rustup`). Run it against the dev server:

```bash
npm run desktop
```

Build the app and its installer for the current platform:

```bash
npm run desktop:build
```

Installers land in `src-tauri/target/release/bundle/` (`.msi`/`.exe` on Windows, `.dmg`/`.app` on macOS). The app icon is drawn by `src-tauri/icons/app-icon.svg`; after changing it, regenerate the platform set with `npx tauri icon src-tauri/icons/app-icon.png`.

### Releases

`.github/workflows/release.yml` builds the site and the desktop app for both platforms on GitHub's runners. Push a version tag to publish one release holding all three downloads — `world-clock-web.zip` (the static site), the Windows installer, and the macOS disk image:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Running the workflow by hand (Actions → Release → Run workflow) builds the same files without creating a release; download them from the run's artifacts. The macOS build is unsigned, so the first open needs right-click → Open or an allow in System Settings → Privacy & Security.

## Project structure

- `src/App.tsx` — application layout, city list, globe view, settings bar, and keyboard shortcuts.
- `src/components/` — city rows, daylight strips, globe, city search, theme picker, and title globe.
- `src/lib/` — time-zone and solar calculations, greetings, translations, city names, themes, and settings storage.
- `src/data/` — bundled city and world coastline data, and the generated zone-to-country table.
- `src-tauri/` — the desktop widget's Tauri shell, window config, capabilities, and icons.
- `tools/` — the generator for `src/data/zoneCountries.ts`.
- `public/_headers` — response headers for the static deployment.

## How it differs from Elsewhen

Elsewhen runs as an Omarchy panel and uses a system `date` process to read time-zone offsets. This web version uses `Intl.DateTimeFormat`, so it can run as a static site. It also adds theme and language selection, city reordering, responsive layouts, and 12/24-hour clock controls. Weather settings and desktop IPC are not included.

## Credits and license

This project is distributed under the MIT License; see [LICENSE](LICENSE). Portions of its city and coastline data, theme palettes, and ported logic are based on [Omarchy](https://github.com/omacom/omarchy), copyright David Heinemeier Hansson, and its Elsewhen panel by Jason Fried. See [the reference notes](docs/omarchy-reference.md) for more detail.
