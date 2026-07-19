// sync-bridge.js — glue between to.dooo's classic (global-function) app script
// and the @dooo/core SyncEngine, plus Stage 4 session/scope resolution.
//
// Stage 3: durable outbox + Background Sync (unchanged below).
// Stage 4: resolve the magic-link session BEFORE building the engine, so the
// engine's local DB is namespaced per household (scope) and the app's token
// (getAuthToken) is the session JWT. Standalone with no session and no legacy
// token → show the shared sign-in overlay.

import {
  SyncEngine, createTodoTransport, openDB,
  createSessionStore, consumeMagicLinkLanding, mountSignIn, renewIfStale, drainLegacyOutbox,
} from "./vendor/dooo-core/index.js";

const g = window;
const DOOO_API = "https://dooo-api.apps-8ec.workers.dev"; // auth origin fallback
const IN_DASH = (() => { try { return !!g.parent && g.parent !== g; } catch { return false; } })();

function authApiBase() {
  try { return new URL(g.getEndpointUrl()).origin; } catch { return DOOO_API; }
}

// ── Stage 4: resolve the session, then build the engine with the right scope ──
async function resolveSession() {
  let authIdb;
  try {
    authIdb = await openDB("todooo-auth"); // fixed (unscoped) — holds who is signed in
  } catch {
    return null; // private mode / no IDB → legacy/in-dash paths still work
  }
  const store = createSessionStore(authIdb);
  const apiBase = authApiBase();

  let session = await consumeMagicLinkLanding(apiBase, store);
  if (!session) session = await store.load();

  const legacyToken = (() => { try { return localStorage.getItem("todo_auth_token_v1"); } catch { return ""; } })();

  // Standalone, never signed in, no legacy token → require sign-in.
  if (!session && !IN_DASH && !legacyToken) {
    await mountSignIn({ apiBase, redirect: location.origin + "/", sessionStore: store, appName: "to dooo" });
    location.reload(); // reboot cleanly with the stored session
    return null;
  }

  if (session) {
    g.__applyDoooSession(session);
    // Opportunistic sliding renewal; never blocks boot.
    renewIfStale(apiBase, session).then((s) => s && s.jwt !== session.jwt && store.save(s)).catch(() => {});
  }
  return session;
}

const session = await resolveSession();
const scope = session && session.household ? session.household.id : null;

const engine = new SyncEngine({
  name: "todooo",
  scope, // Stage 4: namespaces the local DB per household
  pollMs: 0, // to.dooo drives its own 30s poll + focus refresh; don't double-poll
  transport: createTodoTransport({
    baseUrl: () => (g.getEndpointUrl ? g.getEndpointUrl() : ""),
    getToken: () => (g.getAuthToken ? g.getAuthToken() : ""),
  }),
  onStatus: (s) => g.setSyncStatus && g.setSyncStatus(s),
});

const ready = engine
  .init()
  .then(async () => {
    // First scoped boot: replay any captures stranded in the old unscoped DB.
    if (scope) {
      try {
        await drainLegacyOutbox("todooo", (records) => engine.transport.push(records));
      } catch (e) { console.warn("[TodoSync] legacy drain skipped:", e && e.message); }
    }
    return true;
  })
  .catch((e) => {
    console.warn("[TodoSync] IndexedDB unavailable — falling back to direct push:", e && e.message);
    return false;
  });

async function queueAndPush(todos) {
  for (const t of todos) await engine.upsertLocal(t);
  try {
    const res = await engine.push();
    if (res && res.ok) return { ok: true };
    if (res && res.unauthorized) return { unauthorized: true };
    await engine.requestBackgroundSync();
    return { queued: true, error: res && res.error };
  } catch (e) {
    await engine.requestBackgroundSync();
    return { queued: true, error: e && e.message };
  }
}

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

g.TodoSync = { engine, ready, queueAndPush, drain, session };
