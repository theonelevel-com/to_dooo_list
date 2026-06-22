# to dooo

A generic, reusable shared task manager with a Google Sheets backend and an embedded AI assistant. Fork it, plug in your own Sheet + API key, and self-host. Runs standalone as an installable PWA, or embedded inside the **dash dooo** shell alongside **pre-dooo** and **shop dooo**.

🌐 Live (standalone): https://to-dooo-list.pages.dev

## Features

- **Shared sections** — customisable section names + order, synced across devices via Google Sheets (timestamped last-write-wins so renames don't revert)
- **Due dates & sorting** — items sorted by due date, then oldest created; today's due items drive the progress bar
- **Auto-archive** — completed items move to a "Done" sheet the following day
- **Tags** — preset tags (urgent, note, waiting, low) or custom tags on any item
- **Task notes** — timestamped notes per item, stored in a single column; right-click or tap the notepad icon
- **AI assistant** — embedded chat that can add, complete, and delete items and draft messages. Uses Claude or DeepSeek; standalone takes a direct API key, embedded it relays through the dash dooo shell so no key ever touches the browser
- **Cross-app capture** — push an item to the pre-dooo inbox
- **Dark mode** — toggle in the header, preference persisted (forced on when embedded in dash dooo)
- **PWA** — installable on mobile/desktop with offline support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Single HTML file (vanilla JS/CSS) |
| Backend | Google Apps Script |
| Database | Google Sheets (Todos, Done, Config tabs) |
| AI | Claude or DeepSeek (direct key standalone, or via the dash dooo relay) |
| Hosting | Cloudflare Pages (or any static host / GitHub Pages) |

## Google Sheets Schema

**Todos / Done sheets:** `id, text, section, done, tag, createdAt, dueDate, completedAt, notes, updatedAt`

**Config sheet:** `key, value` — stores the section layout (`sections` key) as JSON `{ names, order, ts }`. The `ts` is a millisecond timestamp; `saveConfig` rejects a `sections` write whose `ts` is older than the stored one, so a stale client can't clobber the live layout.

## Setup

1. Create a Google Sheet
2. Go to **Extensions → Apps Script**, paste `TodoAppScript.gs`
3. Replace `YOUR_SHEET_ID_HERE` in the script with your Sheet's ID (the long string in the sheet URL between `/d/` and `/edit`)
4. **Deploy → New deployment → Web app** (Execute as: Me, Access: Anyone)
5. Open the app, click **⚙ Setup needed** in the header, and paste your `/exec` deployment URL
6. Click the **⚪ Offline** badge in the chat panel and paste your [Anthropic API key](https://console.anthropic.com) (standalone only — embedded in dash dooo the key is supplied by the shell)

No secrets live in the code — the deployment URL and API key are saved in your browser's localStorage.

## Hosting

The app is a single `index.html` plus a manifest, service worker, and icons — any static host works.

**Cloudflare Pages (current):**
```sh
wrangler pages deploy . --project-name=to-dooo-list --branch=main
```

**GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `/ (root)`. The app is then live at `https://<user>.github.io/<repo>/`.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Complete frontend (HTML + CSS + JS) |
| `TodoAppScript.gs` | Google Apps Script backend (public template; the live copy with the real Sheet ID is deployed via clasp) |
| `manifest.json` | PWA manifest |
| `service-worker.js` | PWA offline caching |
| `icons/icon-192.png` | PWA icon (192×192) |
| `icons/icon-512.png` | PWA icon (512×512) |

## Backend deployment

When updating the Apps Script backend, always **edit the existing deployment** so the `/exec` URL stays the same:

1. Paste `TodoAppScript.gs` into Apps Script (or `clasp push` from a private working copy)
2. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**
