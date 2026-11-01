(function (root) {
  'use strict';
  const KEY = 'setbget:number-rush:v1';
  const fallback = { best: 0, games: 0, muted: true };
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { best: Number.isFinite(value.best) ? Math.max(0, value.best) : 0, games: Number.isFinite(value.games) ? Math.max(0, value.games) : 0, muted: value.muted !== false };
    } catch (_) { return { ...fallback }; }
  }
  function write(patch) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch (_) { /* storage is optional */ }
  }
  root.NumberRushStorage = { read, write };
})(window);
