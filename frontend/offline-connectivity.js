(function () {
  "use strict";
  const RETURN_KEY = "setbget:offline:return-url";
  const OFFLINE_ENTRY_KEY = "setbget:number-rush:offline-entry";
  const GAME_PATH = "/number-rush";
  const CHECK_PATH = "/connectivity-check.txt";
  const CHECK_INTERVAL_MS = 5_000;
  const CHECK_TIMEOUT_MS = 2_500;
  const FAILURES_TO_OFFLINE = 2;
  const SUCCESSES_TO_RESTORE = 2;
  const isGamePath = pathname => pathname === GAME_PATH || pathname.startsWith(`${GAME_PATH}/`);
  const isGame = () => isGamePath(location.pathname);
  const safeStore = {
    get() { try { return sessionStorage.getItem(RETURN_KEY); } catch (_) { return null; } },
    set(value) { try { sessionStorage.setItem(RETURN_KEY, value); return true; } catch (_) { return false; } },
    clear() { try { sessionStorage.removeItem(RETURN_KEY); } catch (_) {} },
    markOfflineEntry() { try { sessionStorage.setItem(OFFLINE_ENTRY_KEY, "1"); return true; } catch (_) { return false; } },
    clearOfflineEntry() { try { sessionStorage.removeItem(OFFLINE_ENTRY_KEY); } catch (_) {} },
  };
  function checkedReturnUrl(value) {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin || url.username || url.password || isGamePath(url.pathname)) return null;
      return url;
    } catch (_) { return null; }
  }

  let pageActive = true;
  let unavailable = isGame() && (Boolean(checkedReturnUrl(safeStore.get())) || !navigator.onLine);
  let redirecting = false;
  let retryingRecovery = false;
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;
  let monitorId = 0;
  let pageGeneration = 0;
  let currentController = null;
  let cancelCurrentProbe = null;
  let currentProbe = null;
  let probeQueued = false;
  if (isGame() && safeStore.get() && !checkedReturnUrl(safeStore.get())) safeStore.clear();

  let registrationReady = Promise.resolve(false);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    registrationReady = navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (navigator.serviceWorker.controller) return true;
        return new Promise(resolve => {
          let settled = false;
          const finish = value => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("controllerchange", changed);
            resolve(value);
          };
          const changed = () => finish(Boolean(navigator.serviceWorker.controller));
          const timeout = setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), 5_000);
          navigator.serviceWorker.addEventListener("controllerchange", changed);
          if (navigator.serviceWorker.controller) finish(true);
        });
      }).catch(() => false);
  }

  async function declareUnavailable() {
    if (unavailable || !pageActive) return;
    unavailable = true;
    consecutiveSuccesses = 0;
    if (isGame()) {
      if (typeof window.NumberRushHandleConnectivityLost === "function") window.NumberRushHandleConnectivityLost();
      return;
    }
    if (redirecting) return;
    const original = checkedReturnUrl(safeStore.get());
    if (!original) safeStore.set(new URL(location.href).href);
    redirecting = true;
    await registrationReady;
    if (!pageActive || isGame()) return;
    const stored = safeStore.markOfflineEntry();
    location.replace(stored ? `${GAME_PATH}/` : `${GAME_PATH}/?offline=1`);
  }

  function handleReachable() {
    if (!unavailable || !pageActive) return;
    unavailable = false;
    consecutiveFailures = 0;
    if (!isGame()) return;
    const target = checkedReturnUrl(safeStore.get());
    const shouldDefer = typeof window.NumberRushHandleConnectionRestored === "function"
      ? window.NumberRushHandleConnectionRestored(target ? target.href : null)
      : false;
    if (!shouldDefer && target) location.replace(target.href);
  }

  async function performProbe() {
    if (!pageActive || document.visibilityState !== "visible") return null;
    const generation = pageGeneration;
    const controller = new AbortController();
    currentController = controller;
    let rejectCancellation;
    const cancelled = new Promise((_, reject) => { rejectCancellation = reject; });
    cancelCurrentProbe = () => {
      controller.abort();
      rejectCancellation(new Error("Connectivity probe cancelled."));
    };
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("Connectivity probe timed out."));
      }, CHECK_TIMEOUT_MS);
    });

    try {
      const url = new URL(CHECK_PATH, location.origin);
      url.searchParams.set("_", String(Date.now()));
      const response = await Promise.race([
        fetch(url.href, {
          method: "GET",
          mode: "same-origin",
          redirect: "error",
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        }),
        timeout,
        cancelled,
      ]);
      if (!pageActive || generation !== pageGeneration) return null;
      if (!response.ok || response.status !== 200) throw new Error(`Connectivity probe returned HTTP ${response.status}.`);
      const body = await Promise.race([response.text(), timeout, cancelled]);
      if (!pageActive || generation !== pageGeneration) return null;
      if (body.trim() !== "ok") throw new Error("Connectivity probe returned an unexpected body.");

      consecutiveFailures = 0;
      if (unavailable) {
        consecutiveSuccesses++;
        if (consecutiveSuccesses >= SUCCESSES_TO_RESTORE) {
          consecutiveSuccesses = 0;
          handleReachable();
        }
      } else {
        consecutiveSuccesses = 0;
      }
      return true;
    } catch (_) {
      if (!pageActive || generation !== pageGeneration) return null;
      consecutiveSuccesses = 0;
      consecutiveFailures++;
      if (consecutiveFailures >= FAILURES_TO_OFFLINE) await declareUnavailable();
      return false;
    } finally {
      clearTimeout(timeoutId);
      if (currentController === controller) currentController = null;
      if (cancelCurrentProbe) cancelCurrentProbe = null;
    }
  }

  function checkConnectivity() {
    if (currentProbe) {
      probeQueued = true;
      return currentProbe.then(() => {
        if (!probeQueued || !pageActive || document.visibilityState !== "visible") return null;
        probeQueued = false;
        return checkConnectivity();
      });
    }
    if (!pageActive || document.visibilityState !== "visible") return Promise.resolve(null);
    const probe = performProbe();
    currentProbe = probe.finally(() => {
      if (currentProbe === wrappedProbe) currentProbe = null;
      if (probeQueued && pageActive && document.visibilityState === "visible") {
        probeQueued = false;
        void checkConnectivity();
      }
    });
    const wrappedProbe = currentProbe;
    return wrappedProbe;
  }

  async function retryReachability() {
    if (retryingRecovery || !pageActive || !isGame()) return;
    retryingRecovery = true;
    const delays = [0, 700, 1_400, 2_800, 5_000, 5_000, 5_000, 5_000];
    try {
      for (const delay of delays) {
        if (!pageActive || !isGame() || !unavailable) return;
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        const result = await checkConnectivity();
        if (result === true || !unavailable) return;
      }
    } finally {
      retryingRecovery = false;
    }
  }

  async function onOffline() {
    const result = await checkConnectivity();
    if (result === false && consecutiveFailures < FAILURES_TO_OFFLINE) {
      await new Promise(resolve => setTimeout(resolve, 300));
      await checkConnectivity();
    }
    return result;
  }

  function onOnline() {
    const currentCheck = checkConnectivity();
    if (isGame() && unavailable) void retryReachability();
    return currentCheck;
  }

  function startMonitoring() {
    if (!monitorId) monitorId = setInterval(() => {
      if (document.visibilityState === "visible") void checkConnectivity();
    }, CHECK_INTERVAL_MS);
  }

  function stopMonitoring() {
    clearInterval(monitorId);
    monitorId = 0;
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") {
      pageGeneration++;
      startMonitoring();
      void checkConnectivity();
      if (isGame() && unavailable) void retryReachability();
    } else {
      pageGeneration++;
      stopMonitoring();
      if (cancelCurrentProbe) cancelCurrentProbe();
    }
  }

  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", () => {
    pageActive = false;
    pageGeneration++;
    stopMonitoring();
    if (cancelCurrentProbe) cancelCurrentProbe();
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    pageGeneration++;
    startMonitoring();
    if (document.visibilityState === "visible") void checkConnectivity();
  });

  startMonitoring();
  if (document.visibilityState === "visible") void checkConnectivity();

  const savedOnThisPage = checkedReturnUrl(safeStore.get());
  if (!isGame() && savedOnThisPage && savedOnThisPage.href === new URL(location.href).href && navigator.onLine) {
    safeStore.clear();
    safeStore.clearOfflineEntry();
  }
})();
