// Shown only when a navigation failed at the network level. offline-connectivity.js verifies
// reachability and then redirects to Number Rush (no internet), reloads (recovered) or reports
// that SetBGet itself is unavailable. This script only renders the state.
(function () {
  const $ = id => document.getElementById(id);
  $('retry').addEventListener('click', () => location.reload());
  const conn = window.SetBGetConnectivity;
  if (!conn) return;
  const copy = {
    OFFLINE: ['NO INTERNET', 'No internet? Play Number Rush.', 'Your connection is taking a break. Keep your mind active while you wait.'],
    WEBSITE_UNAVAILABLE: ['SETBGET IS TEMPORARILY UNAVAILABLE', 'SetBGet is taking a short break.', 'Your internet connection works, but we could not reach SetBGet. We will keep trying.'],
  };
  function render(state) {
    const text = copy[state];
    if (!text) return;
    $('signal').textContent = text[0];
    $('heading').textContent = text[1];
    $('message').textContent = text[2];
    $('status').textContent = state === 'OFFLINE' ? 'OFFLINE · READY TO PLAY' : 'WILL RETRY AUTOMATICALLY';
  }
  conn.subscribe(render);
  render(conn.state);
})();
