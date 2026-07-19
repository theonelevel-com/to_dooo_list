# to dooo

A shared task manager with an embedded AI assistant. Syncs to a dooo-api endpoint
(`/api/todos` on the dooo-api Worker), runs standalone as an installable PWA, or
embedded inside the **dash dooo** shell alongside **pre-dooo**, **note dooo**, and
**shop dooo**.

🌐 Live (standalone): https://to.dooolist.com

## Features

- **Shared sections** — customisable section names + order, synced across devices (timestamped last-write-wins so renames don't revert)
- **Due dates & sorting** — items sorted by due date, then oldest created; today's due items drive the progress bar
- **Auto-archive** — completed items move to the "Done" store the following day
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
| Backend | dooo-api Worker (`/api/todos`) |
| Storage | Cloudflare D1 (via dooo-api) |
| AI | Claude or DeepSeek (direct key standalone, or via the dash dooo relay) |
| Hosting | Cloudflare Pages (or any static host) |

## Sync contract

The app reads and writes tasks over a small pull/push JSON contract served by
dooo-api's `/api/todos`:

**Todo record:** `id, text, section, done, tag, createdAt, dueDate, completedAt, notes, updatedAt`

**Config:** the section layout is stored under a `sections` key as JSON `{ names, order, ts }`. The `ts` is a millisecond timestamp; a `sections` write whose `ts` is older than the stored one is rejected, so a stale client can't clobber the live layout. Task sync is last-write-wins per record on `updatedAt`.

> Historical note: to.dooo originally spoke to a Google Apps Script + Google
> Sheets backend. That endpoint has been retired; dooo-api's `/api/todos` serves
> the same pull/push contract, so the app is unchanged apart from where it points.
> Some internal identifiers (`getSheetsUrl`, `SHEETS_URL_STORAGE`, the
> `sheetsUrl` dash↔to.dooo bridge field) still carry the old name — renaming them
> is a bridge + localStorage + secret migration, left as a follow-up.

## Setup

1. Deploy (or reuse) a dooo-api Worker that serves `/api/todos`.
2. Open the app, click **⚙ Setup needed** in the header, and paste your endpoint URL (e.g. `https://dooo-api.…/api/todos`) plus an optional auth token.
3. Click the **⚪ Offline** badge in the chat panel and paste your [Anthropic API key](https://console.anthropic.com) (standalone only — embedded in dash dooo the key is supplied by the shell).

No secrets live in the code — the endpoint URL and API key are saved in your browser's localStorage. When embedded in dash dooo, both are injected by the shell over `postMessage`.

## Hosting

The app is a single `index.html` plus a manifest, service worker, and icons — any static host works.

**Cloudflare Pages (current):**
```sh
wrangler pages deploy . --project-name=to-dooo --branch=main
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Complete frontend (HTML + CSS + JS) |
| `manifest.json` | PWA manifest |
| `service-worker.js` | PWA offline caching |
| `icons/icon-192.png` | PWA icon (192×192) |
| `icons/icon-512.png` | PWA icon (512×512) |
