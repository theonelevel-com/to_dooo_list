// sync-bridge.js — glue between to.dooo's classic (global-function) app script
// and the @dooo/core SyncEngine. Loaded as <script type="module">.
//
// Stage 3 goal for to.dooo: a durable outbox + Background Sync so an edit made
// offline is never lost, even if the app is closed before signal returns. This
// bridge is ADDITIVE: to.dooo keeps its own pull/merge (sheetsToState) and all
// mutation sites untouched. Only the PUSH path routes through the engine, and it
// falls back to the app's original path if IndexedDB is unavailable (private
// mode etc.), so nothing regresses.
//
// It self-initialises after the classic script has defined its globals (module
// scripts are deferred), and exposes `window.TodoSync`.

import { SyncEngine, createTodoTransport } from "./vendor/dooo-core/index.js";

const g = window;

const engine = new SyncEngine({
  name: "todooo",
  pollMs: 0, // to.dooo drives its own 30s poll + focus refresh; don't double-poll
  transport: createTodoTransport({
    baseUrl: () => (g.getSheetsUrl ? g.getSheetsUrl() : ""),
    getToken: () => (g.getAuthToken ? g.getAuthToken() : ""),
  }),
  onStatus: (s) => g.setSyncStatus && g.setSyncStatus(s),
});

const ready = engine
  .init()
  .then(() => true)
  .catch((e) => {
    console.warn("[TodoSync] IndexedDB unavailable — falling back to direct push:", e && e.message);
    return false;
  });

// Push a batch of already-stamped flat todos through the engine's outbox. The
// items are enqueued FIRST (durable), then a push is attempted. On success the
// outbox is cleared; on failure the items remain queued and a Background Sync is
// registered so the service worker replays them after the app closes.
//   returns: { ok } | { unauthorized } | { queued }  (queued = offline, retained)
async function queueAndPush(todos) {
  for (const t of todos) await engine.upsertLocal(t);
  try {
    const res = await engine.push();
    if (res && res.ok) return { ok: true };
    if (res && res.unauthorized) return { unauthorized: true };
    // Server rejected for another reason — keep queued, surface as offline-ish.
    await engine.requestBackgroundSync();
    return { queued: true, error: res && res.error };
  } catch (e) {
    // Network failure (offline): items are safe in the outbox; replay later.
    await engine.requestBackgroundSync();
    return { queued: true, error: e && e.message };
  }
}

// Drain the outbox (called on `online` and on the SW's background-sync message).
// After a successful drain, ask the app to reconcile by pulling the merged state.
async function drain() {
  if (!(await ready)) return;
  if ((await engine.outbox.size()) === 0) return;
  try {
    const res = await engine.push();
    if (res && res.ok && g.reconcileAfterDrain) g.reconcileAfterDrain();
  } catch {
    // still offline — leave queued
  }
}

addEventListener("online", () => drain());
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e && e.data && e.data.type === "dooo-sync") drain();
  });
}

g.TodoSync = { engine, ready, queueAndPush, drain };
