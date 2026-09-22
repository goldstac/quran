const API = '';
let audio = new Audio();
let queue = [], queueIdx = -1, loopMode = 'off', currentSong = null, progressDrag = false;
let currentList = [];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; };
const fmt = s => { const m=Math.floor(s/60); return m+':'+String(Math.floor(s%60)).padStart(2,'0'); };

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// --- NAVIGATION ---
$$('.nav-item').forEach(btn => btn.addEventListener('click', () => {
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const v = btn.dataset.view;
  $$('.view').forEach(el => el.classList.remove('active'));
  if (v === 'search') {
    $('#search-view').classList.add('active');
  } else {
    $('#library-view').classList.add('active');
    loadLib(v);
  }
}));

// --- SEARCH ---
let searchTimer;
$('#search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) { showEmpty(); return; }
  searchTimer = setTimeout(() => doSearch(q), 350);
});
$('#search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { clearTimeout(searchTimer); doSearch(e.target.value.trim()); }
});

async function doSearch(q) {
  show('loading');
  $('#search-status').textContent = '';
  try {
    const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    if (!data.length) { showEmpty('No results found'); return; }
    queue = data; queueIdx = -1;
    renderList('search-results', data, 'search');
    show('results');
  } catch { showEmpty('Search failed'); }
}

function showEmpty(msg) {
  $('#search-loading').style.display = 'none';
  $('#search-results').style.display = 'none';
  $('#search-empty').style.display = '';
  if (msg) {
    const t = $('#search-empty').querySelector('.empty-title');
    if (t) t.textContent = msg;
  }
}
function show(what) {
  $('#search-empty').style.display = what === 'empty' ? '' : 'none';
  $('#search-loading').style.display = what === 'loading' ? '' : 'none';
  $('#search-results').style.display = what === 'results' ? '' : 'none';
}

// --- RENDER ---
function renderList(containerId, songs, ctx) {
  const c = $(`#${containerId}`);
  c.innerHTML = '';
  currentList = songs;
  songs.forEach((s, i) => c.appendChild(makeRow(s, i, ctx)));
}

function makeRow(song, idx, ctx) {
  const r = document.createElement('div');
  r.className = 'track-row';
  r.dataset.id = song.id;
  if (currentSong && currentSong.id === song.id) r.classList.add('playing');

  r.innerHTML = `
    <img class="track-thumb" src="${song.thumbnail || ''}" onerror="this.style.display='none'" loading="lazy" alt="">
    <div class="track-info">
      <div class="track-name">${esc(song.title)}</div>
      <div class="track-channel">${esc(song.channel)}</div>
    </div>
    ${song.duration_string ? `<span class="track-dur">${song.duration_string}</span>` : ''}
    <div class="track-actions">
      <button class="track-act play-act" title="Play"><i class="fa-solid fa-play"></i></button>
      <button class="track-act dl-act" title="Download"><i class="fa-solid fa-arrow-down"></i></button>
      <button class="track-act fav-act" title="Like"><i class="fa-regular fa-heart"></i></button>
      <button class="track-act pl-act" title="Add to playlist"><i class="fa-solid fa-plus"></i></button>
    </div>`;

  r.addEventListener('dblclick', () => playSong(song, idx, ctx));
  r.querySelector('.play-act').addEventListener('click', e => { e.stopPropagation(); playSong(song, idx, ctx); });
  r.querySelector('.dl-act').addEventListener('click', e => { e.stopPropagation(); download(song); });
  r.querySelector('.fav-act').addEventListener('click', e => { e.stopPropagation(); toggleFav(song); });
  r.querySelector('.pl-act').addEventListener('click', e => { e.stopPropagation(); addToPl(song); });
  return r;
}

// --- PLAYBACK ---
async function playSong(song, idx, ctx) {
  currentSong = song;
  queue = currentList.length ? currentList : queue;
  queueIdx = idx;
  updatePlayer();
  $$('.track-row').forEach(r => r.classList.toggle('playing', r.dataset.id === song.id));
  audio.src = `${API}/api/proxy/${song.id}`;
  audio.load();
  audio.play().catch(err => {
    console.error('Play failed:', err);
    toast('Click play to start');
  });
  fetch(`${API}/api/library/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(song) });
}

function updatePlayer() {
  if (!currentSong) return;
  $('#player-title').textContent = currentSong.title;
  $('#player-artist').textContent = currentSong.channel;
  if (currentSong.thumbnail) {
    $('#player-thumb').src = currentSong.thumbnail;
    $('#player-thumb').style.display = 'block';
    $('#player-thumb-ph').style.display = 'none';
  }
}

// --- CONTROLS ---
$('#play-btn').addEventListener('click', () => {
  if (audio.paused && audio.src) {
    audio.play().catch(() => {});
  } else if (!audio.paused) {
    audio.pause();
  }
});
$('#stop-btn').addEventListener('click', () => { audio.pause(); audio.currentTime = 0; resetPlayer(); });
$('#prev-btn').addEventListener('click', () => {
  if (queue.length && queueIdx > 0) { queueIdx--; playSong(queue[queueIdx], queueIdx, 'search'); }
  else if (queue.length) { queueIdx = queue.length - 1; playSong(queue[queueIdx], queueIdx, 'search'); }
});
$('#next-btn').addEventListener('click', nextTrack);

$('#loop-btn').addEventListener('click', () => {
  loopMode = loopMode === 'off' ? 'one' : 'off';
  const btn = $('#loop-btn');
  btn.classList.toggle('active', loopMode !== 'off');
  btn.title = loopMode === 'one' ? 'Loop: one' : 'Loop: off';
  toast(loopMode === 'one' ? 'Loop on' : 'Loop off');
});

function nextTrack() {
  if (!queue.length) return;
  queueIdx = (queueIdx + 1) % queue.length;
  playSong(queue[queueIdx], queueIdx, 'search');
}

audio.addEventListener('ended', () => {
  if (loopMode === 'one' && currentSong) {
    audio.currentTime = 0;
    audio.play().catch(() => playSong(currentSong, queueIdx, 'search'));
  } else if (loopMode === 'all' && queue.length) {
    nextTrack();
  } else {
    resetPlayer();
  }
});

audio.addEventListener('play', () => {
  $('#play-icon').classList.add('hidden');
  $('#pause-icon').classList.remove('hidden');
});
audio.addEventListener('pause', () => {
  $('#play-icon').classList.remove('hidden');
  $('#pause-icon').classList.add('hidden');
});

function resetPlayer() {
  currentSong = null;
  $('#player-title').textContent = 'No track playing';
  $('#player-artist').textContent = '';
  $('#player-thumb').style.display = 'none';
  $('#player-thumb-ph').style.display = 'flex';
  $('#progress-bar').value = 0;
  $('#time-pos').textContent = '0:00';
  $('#time-dur').textContent = '0:00';
  $$('.track-row').forEach(r => r.classList.remove('playing'));
}

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); $('#play-btn').click(); }
  else if (e.code === 'ArrowRight' && e.shiftKey) { e.preventDefault(); $('#next-btn').click(); }
  else if (e.code === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); $('#prev-btn').click(); }
  else if (e.code === 'ArrowRight') {
    e.preventDefault();
    if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  }
  else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  }
  else if (e.code === 'ArrowUp') {
    e.preventDefault();
    audio.volume = Math.min(1, audio.volume + 0.05);
    updateSliderColor($('#volume-bar'));
    $('#volume-bar').value = audio.volume * 100;
  }
  else if (e.code === 'ArrowDown') {
    e.preventDefault();
    audio.volume = Math.max(0, audio.volume - 0.05);
    updateSliderColor($('#volume-bar'));
    $('#volume-bar').value = audio.volume * 100;
  }
  else if (e.key === 'l' || e.key === 'L') { $('#loop-btn').click(); }
  else if (e.key === 'm' || e.key === 'M') { $('#vol-btn').click(); }
  else if (e.key === '/' || e.key === 's') {
    e.preventDefault();
    const v = $('nav .nav-item.active')?.dataset.view;
    if (v !== 'search') {
      $$('.nav-item').forEach(b => b.classList.remove('active'));
      $('[data-view="search"]').classList.add('active');
      $$('.view').forEach(el => el.classList.remove('active'));
      $('#search-view').classList.add('active');
    }
    $('#search-input').focus();
  }
});

// --- PROGRESS ---
$('#progress-bar').addEventListener('input', e => {
  progressDrag = true;
  updateSliderColor(e.target);
  if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
});
$('#progress-bar').addEventListener('change', () => progressDrag = false);

setInterval(() => {
  if (!audio.duration || progressDrag) return;
  const p = (audio.currentTime / audio.duration) * 100;
  const bar = $('#progress-bar');
  bar.value = p;
  bar.style.setProperty('--val', p + '%');
  $('#time-pos').textContent = fmt(audio.currentTime);
  $('#time-dur').textContent = fmt(audio.duration);
}, 250);

// --- VOLUME ---
$('#volume-bar').addEventListener('input', e => {
  audio.volume = e.target.value / 100;
  updateSliderColor(e.target);
  updateVolIcon();
});
$('#vol-btn').addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateVolIcon();
});
audio.volume = 0.7;
$('#volume-bar').style.setProperty('--val', '70%');

function updateVolIcon() {
  const i = $('#vol-btn i');
  if (audio.muted || audio.volume === 0) i.className = 'fa-solid fa-volume-xmark';
  else if (audio.volume < 0.3) i.className = 'fa-solid fa-volume-off';
  else if (audio.volume < 0.7) i.className = 'fa-solid fa-volume-low';
  else i.className = 'fa-solid fa-volume-high';
}

function updateSliderColor(el) {
  el.style.setProperty('--val', el.value + '%');
}

// --- LIBRARY ---
async function loadLib(mode) {
  const r = await fetch(`${API}/api/library`);
  const lib = await r.json();
  let songs = [], title = 'Your Library';
  if (mode === 'all' || mode === 'library') { songs = lib.songs || []; title = 'Your Library'; }
  else if (mode === 'favorites') { songs = (lib.songs || []).filter(s => s.favorite); title = 'Liked Nasheeds'; }
  else if (mode === 'downloads') { songs = (lib.songs || []).filter(s => s.downloaded); title = 'Downloads'; }
  else if (mode.startsWith('playlist:')) {
    const n = mode.split(':')[1];
    const pl = (lib.playlists || []).find(p => p.name === n);
    songs = pl ? pl.songs : []; title = n;
  }
  $('#lib-title').textContent = title;
  $('#lib-subtitle').textContent = `${songs.length} nasheed${songs.length !== 1 ? 's' : ''}`;
  if (!songs.length) {
    $('#lib-list').style.display = 'none'; $('#lib-empty').style.display = '';
  } else {
    renderList('lib-list', songs, 'library');
    $('#lib-empty').style.display = 'none'; $('#lib-list').style.display = '';
  }
}

async function toggleFav(song) {
  await fetch(`${API}/api/library/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(song) });
  const r = await fetch(`${API}/api/library/fav/${song.id}`, { method: 'POST' });
  const d = await r.json();
  $$(`.track-row[data-id="${song.id}"] .fav-act i`).forEach(i => {
    i.className = d.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
  });
  toast(d.favorite ? 'Added to Liked Nasheeds' : 'Removed from Liked Nasheeds');
}

async function download(song) {
  await fetch(`${API}/api/library/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(song) });
  toast('Downloading: ' + song.title);
  await fetch(`${API}/api/download/${song.id}`, { method: 'POST' });
  toast('Downloaded: ' + song.title);
}

async function addToPl(song) {
  await fetch(`${API}/api/library/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(song) });
  const name = prompt('Playlist name:');
  if (!name) return;
  await fetch(`${API}/api/playlists/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  await fetch(`${API}/api/playlists/${encodeURIComponent(name)}/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(song) });
  loadPlaylists();
  toast('Added to ' + name);
}

// --- PLAYLISTS ---
async function loadPlaylists() {
  const r = await fetch(`${API}/api/playlists`);
  const pls = await r.json();
  const nav = $('#playlist-nav');
  nav.innerHTML = '';
  pls.forEach(pl => {
    const b = document.createElement('button');
    b.className = 'pl-item';
    b.innerHTML = `<i class="fa-solid fa-list-ul"></i>${esc(pl.name)}`;
    b.addEventListener('click', () => {
      $$('.nav-item').forEach(n => n.classList.remove('active'));
      $$('.view').forEach(v => v.classList.remove('active'));
      $('#library-view').classList.add('active');
      loadLib('playlist:' + pl.name);
    });
    nav.appendChild(b);
  });
}
$('#add-pl-btn').addEventListener('click', async () => {
  const name = prompt('New playlist name:');
  if (!name) return;
  await fetch(`${API}/api/playlists/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  loadPlaylists();
  toast('Created playlist: ' + name);
});

loadPlaylists();
