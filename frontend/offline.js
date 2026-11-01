document.getElementById('retry').addEventListener('click',()=>location.reload());
document.querySelector('.play').addEventListener('click', event => {
  const url = new URL(location.href);
  if (url.pathname === '/number-rush' || url.pathname.startsWith('/number-rush/')) return;
  try {
    if (!sessionStorage.getItem('setbget:offline:return-url'))
      sessionStorage.setItem('setbget:offline:return-url', url.href);
    sessionStorage.setItem('setbget:number-rush:offline-entry', '1');
  } catch (_) {
    event.currentTarget.href = '/number-rush/?offline=1';
  }
});
