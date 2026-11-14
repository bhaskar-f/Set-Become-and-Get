(() => {
  if (!['/', '/index.html'].includes(location.pathname)) return;
  const API = window.JPEDIA_CONFIG?.API_BASE_URL || '/api';
  const root = document.createElement('section');
  root.className = 'section daily-learning-section';
  root.id = 'daily-learning';
  root.innerHTML = '<div class="section-heading"><div class="daily-learning-heading"><span class="daily-kicker">YOUR DAILY EDGE</span><h2>Daily Learning</h2><p>Small steps. Stronger preparation.</p></div><span class="daily-date" id="dailyLearningDate"></span></div><div class="daily-tabs" role="tablist" aria-label="Daily learning categories"><button type="button" class="daily-tab is-active" role="tab" aria-selected="true" data-deck="affairs">Current Affairs <span id="dailyAffairsCount">0</span></button><button type="button" class="daily-tab" role="tab" aria-selected="false" data-deck="vocabulary">Daily Vocabulary <span id="dailyVocabularyCount">10</span></button></div><div class="daily-deck" id="dailyLearningDeck" aria-live="polite"><p class="daily-empty">Loading today’s learning cards…</p></div>';
  const home = document.querySelector('#home');
  if (!home) return;
  home.insertBefore(root, home.querySelector('#jobs'));
  let data = null, active = 'affairs', index = 0, startX = 0;
  const $ = (s) => root.querySelector(s);
  const esc = (v) => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const items = () => active === 'affairs' ? (data?.currentAffairs || []) : (data?.vocabulary || []);
  function render() {
    const list = items(), deck = $('#dailyLearningDeck');
    if (!list.length) { deck.innerHTML = '<p class="daily-empty">No cards have been published for today yet. Please check back soon.</p>'; return; }
    index = Math.max(0, Math.min(index, list.length - 1));
    const item = list[index];
    const body = active === 'affairs'
      ? `<span class="daily-card-label">CURRENT AFFAIRS · ${index + 1} / ${list.length}</span><h3>${esc(item.title)}</h3><p class="daily-card-copy">${esc(item.summary)}</p>${item.takeaway ? `<div class="daily-takeaway"><span>KEY TAKEAWAY</span><p>${esc(item.takeaway)}</p></div>` : ''}${item.source ? `<div class="daily-source">Source: ${esc(item.source)} ${item.sourceUrl ? `· <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Read source ↗</a>` : ''}</div>` : ''}`
      : `<span class="daily-card-label">WORD OF THE DAY · ${index + 1} / ${list.length}</span><div class="daily-word-line"><h3>${esc(item.word)}</h3><span>${esc(item.partOfSpeech)}</span></div><p class="daily-meaning">${esc(item.meaning)}</p><div class="daily-example"><span>IN A SENTENCE</span><p>“${esc(item.example)}”</p></div>${item.synonyms ? `<p class="daily-synonyms"><b>Similar:</b> ${esc(item.synonyms)}</p>` : ''}`;
    deck.innerHTML = `<article class="daily-card" tabindex="0"><div class="daily-card-content">${body}</div><div class="daily-card-footer"><span>SWIPE TO EXPLORE</span><div class="daily-controls"><button type="button" data-step="-1" aria-label="Previous card" ${index===0?'disabled':''}>←</button><span>${index+1} / ${list.length}</span><button type="button" data-step="1" aria-label="Next card" ${index===list.length-1?'disabled':''}>→</button></div></div></article>`;
    deck.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => move(Number(b.dataset.step))));
  }
  function move(step) { const next = index + step; if (next < 0 || next >= items().length) return; index = next; render(); }
  root.querySelectorAll('.daily-tab').forEach(tab => tab.addEventListener('click', () => {
    active = tab.dataset.deck; index = 0;
    root.querySelectorAll('.daily-tab').forEach(t => { const on = t === tab; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); });
    render();
  }));
  const deck = $('#dailyLearningDeck');
  deck.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; }, { passive: true });
  deck.addEventListener('touchend', e => { const delta = e.changedTouches[0].clientX - startX; if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1); }, { passive: true });
  deck.addEventListener('keydown', e => { if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowLeft') move(-1); });
  async function init() {
    try {
      const response = await fetch(`${API}/daily-learning/today`);
      const result = await response.json();
      if (!response.ok || result.success === false || !result.data) { $('#dailyLearningDeck').innerHTML = '<p class="daily-empty">Today’s cards will appear here once published.</p>'; return; }
      data = result.data;
      $('#dailyLearningDate').textContent = new Date(data.date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      $('#dailyAffairsCount').textContent = data.currentAffairs.length;
      $('#dailyVocabularyCount').textContent = data.vocabulary.length;
      render();
      const key = 'setbget-daily-learning-seen';
      if (localStorage.getItem(key) !== data.date) {
        setTimeout(() => openDailyLearning(), 450);
        localStorage.setItem(key, data.date);
      }
    } catch { $('#dailyLearningDeck').innerHTML = '<p class="daily-empty">Daily Learning is temporarily unavailable.</p>'; }
  }
  function openDailyLearning() {
    const backdrop = document.querySelector('#modalBackdrop'), content = document.querySelector('#modalContent');
    if (!backdrop || !content) { root.scrollIntoView({ behavior: 'smooth' }); return; }
    content.replaceChildren();
    const title = document.createElement('h2'); title.textContent = 'Your Daily Learning';
    const intro = document.createElement('p'); intro.className = 'daily-modal-intro'; intro.textContent = 'Two quick sessions to keep your preparation moving.';
    const clone = root.cloneNode(true); clone.removeAttribute('id'); clone.classList.add('daily-modal-content');
    content.append(title, intro, clone);
    const modalDeck = clone.querySelector('#dailyLearningDeck'); modalDeck.removeAttribute('id');
    const modalTabs = clone.querySelectorAll('.daily-tab');
    const modalState = { active: 'affairs', index: 0 };
    function modalRender() {
      const list = modalState.active === 'affairs' ? data.currentAffairs : data.vocabulary;
      const item = list[modalState.index];
      const card = clone.querySelector('.daily-deck');
      const details = modalState.active === 'affairs'
        ? `<span class="daily-card-label">CURRENT AFFAIRS · ${modalState.index+1} / ${list.length}</span><h3>${esc(item.title)}</h3><p class="daily-card-copy">${esc(item.summary)}</p>${item.takeaway ? `<div class="daily-takeaway"><span>KEY TAKEAWAY</span><p>${esc(item.takeaway)}</p></div>` : ''}${item.source ? `<div class="daily-source">Source: ${esc(item.source)} ${item.sourceUrl ? `· <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Read source ↗</a>` : ''}</div>` : ''}`
        : `<span class="daily-card-label">WORD OF THE DAY · ${modalState.index+1} / 10</span><div class="daily-word-line"><h3>${esc(item.word)}</h3><span>${esc(item.partOfSpeech)}</span></div><p class="daily-meaning">${esc(item.meaning)}</p><div class="daily-example"><span>IN A SENTENCE</span><p>“${esc(item.example)}”</p></div>${item.synonyms ? `<p class="daily-synonyms"><b>Similar:</b> ${esc(item.synonyms)}</p>` : ''}`;
      card.innerHTML = `<article class="daily-card"><div class="daily-card-content">${details}</div><div class="daily-card-footer"><span>SWIPE TO EXPLORE</span><div class="daily-controls"><button data-step="-1" ${modalState.index===0?'disabled':''}>←</button><span>${modalState.index+1} / ${list.length}</span><button data-step="1" ${modalState.index===list.length-1?'disabled':''}>→</button></div></div></article>`;
      card.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { modalState.index = Math.max(0, Math.min(list.length-1, modalState.index + Number(b.dataset.step))); modalRender(); }));
    }
    modalTabs.forEach(tab => tab.addEventListener('click', () => { modalState.active = tab.dataset.deck; modalState.index = 0; modalTabs.forEach(t => { const on=t===tab; t.classList.toggle('is-active',on); t.setAttribute('aria-selected',String(on)); }); modalRender(); }));
    let x=0; modalDeck.addEventListener('touchstart',e=>{x=e.changedTouches[0].clientX},{passive:true}); modalDeck.addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-x;if(Math.abs(d)>45){const list=modalState.active==='affairs'?data.currentAffairs:data.vocabulary;modalState.index=Math.max(0,Math.min(list.length-1,modalState.index+(d<0?1:-1)));modalRender()}},{passive:true});
    modalRender(); backdrop.hidden = false;
  }
  document.addEventListener('click', e => { if (e.target.closest('a[href="#daily-learning"]')) { e.preventDefault(); openDailyLearning(); } });
  window.addEventListener('setbget:daily-learning-open', openDailyLearning);
  init();
})();
