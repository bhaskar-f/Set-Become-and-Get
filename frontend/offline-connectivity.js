/*
 * SetBGet connectivity controller.
 *
 * One explicit state machine decides whether the offline fallback (Number Rush) may be used:
 *
 *   ONLINE               SetBGet answered a real request, or nothing suggests a problem.
 *   VERIFYING            A reachability check is in flight.
 *   OFFLINE              SetBGet is unreachable AND an independent internet check failed too.
 *   WEBSITE_UNAVAILABLE  The internet works, but SetBGet itself does not answer correctly.
 *
 * Rules:
 *  - Browser `online`/`offline` events and `navigator.onLine` are only HINTS. They start a
 *    verification; they never change the state themselves.
 *  - OFFLINE is only declared after the origin probe fails (twice, for `offline` events on a
 *    page that is already loaded) and the third-party internet check fails as well.
 *  - A saved return URL is navigation data. It is never used to infer connectivity.
 *  - There is no timer while the site is reachable. A retry back-off runs only while the state
 *    is OFFLINE (or WEBSITE_UNAVAILABLE on the fallback page / during an offline session) and
 *    stops the moment the site is reachable again, so a missed `online` event cannot strand
 *    the user.
 */
(function () {
  "use strict";

  const DEFAULTS = {
    checkPath: "/connectivity-check.txt",
    internetCheckUrl: "https://www.gstatic.com/generate_204",
    probeTimeoutMs: 4000,
    confirmDelayMs: 1500,
    retryBaseMs: 2000,
    retryMaxMs: 30000,
    staleSessionMs: 6 * 60 * 60 * 1000,
    reloadGuardMs: 10000,
    resumeCheckAfterMs: 30000,
  };
  const cfg = Object.assign({}, DEFAULTS, window.SETBGET_CONNECTIVITY_CONFIG || {});

  const STATES = Object.freeze({
    ONLINE: "ONLINE",
    VERIFYING: "VERIFYING",
    OFFLINE: "OFFLINE",
    WEBSITE_UNAVAILABLE: "WEBSITE_UNAVAILABLE",
  });
  const SESSION_KEY = "setbget:offline:session";
  const RELOAD_KEY = "setbget:offline:fallback-reload";
  // Keys written by earlier versions. They carried no trustworthy meaning; remove them.
  const LEGACY_KEYS = ["setbget:offline:return-url", "setbget:number-rush:offline-entry"];
  const GAME_PATH = "/number-rush";

  const isGamePath = pathname => pathname === GAME_PATH || pathname.startsWith(`${GAME_PATH}/`);
  const isGame = isGamePath(location.pathname);
  const isFallback = (() => {
    try { return document.documentElement.getAttribute("data-sbg-fallback") === "1"; } catch (_) { return false; }
  })();

  // ---- session (an automatic offline redirect that is still waiting for recovery) ----------
  function checkedReturnUrl(value) {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin || url.username || url.password || isGamePath(url.pathname)) return null;
      return url;
    } catch (_) { return null; }
  }
  const store = {
    read() {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.at !== "number" || Date.now() - parsed.at > cfg.staleSessionMs) return null;
        return { returnUrl: checkedReturnUrl(parsed.returnUrl) ? parsed.returnUrl : null, at: parsed.at };
      } catch (_) { return null; }
    },
    write(returnUrl) {
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ returnUrl, at: Date.now() })); return true; } catch (_) { return false; }
    },
    clear() { try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {} },
    clearLegacy() { try { LEGACY_KEYS.forEach(key => sessionStorage.removeItem(key)); } catch (_) {} },
  };
  store.clearLegacy();

  // ---- service worker registration ---------------------------------------------------------
  let registrationReady = Promise.resolve(false);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    registrationReady = navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => true)
      .catch(() => false);
  }
  async function gameAvailableOffline() {
    // Only redirect to a page that can actually load without a network.
    try {
      if (!(await registrationReady) || typeof caches === "undefined") return false;
      return Boolean(await caches.match("/number-rush/index.html"));
    } catch (_) { return false; }
  }

  // ---- state -------------------------------------------------------------------------------
  const listeners = new Set();
  const initialSession = isGame || isFallback ? store.read() : null;
  let state = STATES.ONLINE;
  let stableState = initialSession ? STATES.OFFLINE : STATES.ONLINE; // last non-VERIFYING state
  let generation = 0;
  let abortController = null;
  let retryTimer = 0;
  let retryAttempt = 0;
  let redirecting = false;
  let restoring = false;
  let hiddenAt = 0;

  function setState(next) {
    if (next === state) return;
    const previous = state;
    const previousStable = stableState;
    state = next;
    if (next !== STATES.VERIFYING) stableState = next;
    listeners.forEach(fn => { try { fn(next, { previous, previousStable }); } catch (_) {} });
  }

  // ---- reachability probe ------------------------------------------------------------------
  async function timedFetch(url, init, readBody) {
    const controller = new AbortController();
    abortController = controller;
    const timer = setTimeout(() => { try { controller.abort(); } catch (_) {} }, cfg.probeTimeoutMs);
    try {
      const response = await fetch(url, Object.assign({ signal: controller.signal }, init));
      const body = readBody ? await response.text() : "";
      return { response, body };
    } finally { clearTimeout(timer); }
  }

  /** Returns "reachable" | "site-down" | "offline". */
  async function probeOnce() {
    const originUrl = new URL(cfg.checkPath, location.origin);
    originUrl.searchParams.set("_", String(Date.now()));
    try {
      const { response, body } = await timedFetch(originUrl.href, {
        method: "GET", mode: "same-origin", redirect: "error", cache: "no-store", credentials: "omit",
      }, true);
      if (response.ok && response.status === 200) {
        // A 200 with the wrong body is a captive portal / proxy, not SetBGet.
        return body.trim() === "ok" ? "reachable" : "offline";
      }
      // The origin answered with an error status: the internet itself clearly works.
      return "site-down";
    } catch (_) {
      if (!navigator.onLine) return "offline";
      try {
        await timedFetch(cfg.internetCheckUrl, {
          method: "GET", mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
        }, false);
        return "site-down"; // the wider internet answered; only SetBGet failed
      } catch (_2) { return "offline"; }
    }
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function cancelPending() {
    generation++;
    clearTimeout(retryTimer);
    retryTimer = 0;
    try { abortController && abortController.abort(); } catch (_) {}
  }

  /**
   * Verify reachability. `confirm` requires two failed origin probes, spaced apart, before OFFLINE
   * (used when a browser `offline` event arrives on a page that is already loaded, because those
   * events also fire for harmless adapter changes).
   */
  async function verify(reason, options = {}) {
    cancelPending();
    const mine = generation;
    setState(STATES.VERIFYING);
    let result = await probeOnce();
    if (mine !== generation) return state;
    if (result === "offline" && options.confirm) {
      await sleep(cfg.confirmDelayMs);
      if (mine !== generation) return state;
      result = await probeOnce();
      if (mine !== generation) return state;
    }
    apply(result);
    return state;
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    const delay = Math.min(cfg.retryMaxMs, cfg.retryBaseMs * Math.pow(2, retryAttempt++));
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      if (document.visibilityState === "hidden") { retryAttempt = Math.max(0, retryAttempt - 1); scheduleRetry(); return; }
      void verify("retry");
    }, delay);
  }

  function apply(result) {
    if (result === "reachable") {
      retryAttempt = 0;
      setState(STATES.ONLINE);
      if (!isGame && !isFallback) store.clear(); // a real SetBGet page loaded: any old session is obsolete
      if (isFallback) reloadFallbackOnce();
      return;
    }
    if (result === "site-down") {
      setState(STATES.WEBSITE_UNAVAILABLE);
      if (isFallback || store.read()) scheduleRetry();
      return;
    }
    setState(STATES.OFFLINE);
    scheduleRetry();
    if (!isGame) void enterOfflineMode();
  }

  async function enterOfflineMode() {
    if (redirecting) return;
    redirecting = true;
    const available = await gameAvailableOffline();
    if (!available || state !== STATES.OFFLINE) { redirecting = false; return; }
    const session = store.read();
    if (!session || !session.returnUrl) store.write(new URL(location.href).href);
    location.replace(`${GAME_PATH}/`);
  }

  function reloadFallbackOnce() {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last < cfg.reloadGuardMs) return; // avoid a reload loop
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch (_) {}
    location.reload();
  }

  function restoreOriginalPage() {
    const session = store.read();
    const target = session && checkedReturnUrl(session.returnUrl);
    store.clear();
    if (!target || restoring) return false;
    restoring = true;
    location.replace(target.href);
    return true;
  }

  // ---- browser signals ---------------------------------------------------------------------
  window.addEventListener("offline", () => { void verify("offline-event", { confirm: !isGame || stableState !== STATES.OFFLINE }); });
  window.addEventListener("online", () => { void verify("online-event"); });
  window.addEventListener("pagehide", () => cancelPending());
  window.addEventListener("pageshow", event => {
    if (event && event.persisted && !navigator.onLine) void verify("pageshow", { confirm: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    // One check when the user comes back: always if we are not ONLINE, otherwise only after a long absence.
    if (state === STATES.VERIFYING) return;
    if (state !== STATES.ONLINE || away >= cfg.resumeCheckAfterMs) void verify("resume", { confirm: state === STATES.ONLINE });
  });

  // ---- initial verification (one-time, never periodic) -------------------------------------
  if (isGame || isFallback) {
    if (initialSession || isFallback || !navigator.onLine) void verify("initial");
  } else if (!navigator.onLine) {
    void verify("initial", { confirm: true });
  } else {
    store.clear(); // a real page loaded over the network proves reachability
  }

  window.SetBGetConnectivity = Object.freeze({
    STATES,
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    verify,
    hasSession() { return Boolean(store.read()); },
    getReturnUrl() { const s = store.read(); return s && s.returnUrl; },
    restoreOriginalPage,
  });
})();
