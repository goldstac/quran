const API = '';
let audio = new Audio();
let queue = [];
let queueIdx = -1;
let loopMode = 'off';
let currentSong = null;
let progressDragging = false;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Navigation
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#${view}-view`).classList.add('active');
    if (view === 'library') loadLibrary('all');
    if (view === 'favorites') loadLibrary('favorites');
    if (view === 'downloads') loadLibrary('downloads');
  });
});

// Search
let searchTimeout;
$('#search-input').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (!q) { showSearchEmpty(); return; }
  searchTimeout = setTimeout(() => doSearch(q), 400);
});
$('#search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimeout);
    doSearch(e.target.value.trim());
  }
});

async function doSearch(q) {
  $('#search-empty').style.display = 'none';
  $('#search-results').style.display = 'none';
  $('#search-loading').style.display = '';
  $('#search-status').textContent = '';
  try {
    const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    $('#search-loading').style.display = 'none';
    if (!data.length) {
      $('#search-empty').style.display = '';
      $('#search-empty').querySelector('p').textContent = 'No results found';
      return;
    }
    queue = data;
    queueIdx = -1;
    showResults(data);
  } catch(e) {
    $('#search-loading').style.display = 'none';
    $('#search-empty').style.display = '';
    $('#search-empty').querySelector('p').textContent = 'Search failed';
  }
}

function showSearchEmpty() {
  $('#search-empty').style.display = '';
  $('#search-empty').querySelector('p').textContent = 'Search for nasheeds';
  $('#search-results').style.display = 'none';
  $('#search-loading').style.display = 'none';
}

function showResults(songs) {
  const list = $('#search-results');
  list.innerHTML = '';
  songs.forEach((s, i) => list.appendChild(createSongRow(s, i, 'search')));
  list.style.display = '';
}

function createSongRow(song, idx, context) {
  const row = document.createElement('div');
  row.className = 'song-row';
  row.dataset.id = song.id;
  row.dataset.idx = idx;
  row.dataset.context = context;
  if (currentSong && currentSong.id === song.id) row.classList.add('playing');

  row.innerHTML = `
    <img class="song-thumb" src="${song.thumbnail || ''}" onerror="this.style.display='none'" loading="lazy">
    <div class="song-meta">
      <div class="song-title">${esc(song.title)}</div>
      <div class="song-channel">${esc(song.channel)}</div>
    </div>
    <span class="song-duration">${song.duration_string || ''}</span>
    <div class="song-actions">
      <button class="icon-btn play-row-btn" title="Play">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <button class="icon-btn dl-btn" title="Download">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="icon-btn fav-btn" title="Favorite">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button class="icon-btn pl-add-btn" title="Add to playlist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>`;

  row.addEventListener('dblclick', () => playSong(song, idx, context));
  row.querySelector('.play-row-btn').addEventListener('click', e => { e.stopPropagation(); playSong(song, idx, context); });
  row.querySelector('.dl-btn').addEventListener('click', e => { e.stopPropagation(); downloadSong(song); });
  row.querySelector('.fav-btn').addEventListener('click', e => { e.stopPropagation(); toggleFav(song); });
  row.querySelector('.pl-add-btn').addEventListener('click', e => { e.stopPropagation(); addToPlaylist(song); });
  return row;
}

async function playSong(song, idx, context) {
  currentSong = song;
  if (context === 'search') { queueIdx = idx; }
  updatePlayerUI();
  markPlaying();
  try {
    const r = await fetch(`${API}/api/stream/${song.id}`);
    const data = await r.json();
    if (data.url) {
      audio.src = data.url;
      audio.play().catch(() => {});
    } else {
      $('#search-status').textContent = 'Failed to load stream';
    }
  } catch(e) {
    $('#search-status').textContent = 'Error loading stream';
  }
  fetch(`${API}/api/library/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(song)});
}

function updatePlayerUI() {
  if (!currentSong) return;
  $('#player-title').textContent = currentSong.title;
  $('#player-artist').textContent = currentSong.channel;
  const thumb = $('#player-thumb');
  if (currentSong.thumbnail) {
    thumb.src = currentSong.thumbnail;
    thumb.style.display = '';
    $('#player-thumb-placeholder').style.display = 'none';
  }
}

function markPlaying() {
  $$('.song-row').forEach(r => r.classList.toggle('playing', r.dataset.id === currentSong?.id));
}

// Player controls
$('#play-btn').addEventListener('click', () => {
  if (audio.paused && audio.src) audio.play();
  else audio.pause();
});
$('#stop-btn').addEventListener('click', () => { audio.pause(); audio.currentTime = 0; resetPlayer(); });
$('#prev-btn').addEventListener('click', () => { if (queue.length && queueIdx > 0) playSong(queue[--queueIdx], queueIdx, 'search'); });
$('#next-btn').addEventListener('click', () => nextTrack());
$('#loop-btn').addEventListener('click', () => {
  const modes = ['off','all','one'];
  loopMode = modes[(modes.indexOf(loopMode) + 1) % 3];
  updateLoopUI();
});

function nextTrack() {
  if (!queue.length) return;
  queueIdx = (queueIdx + 1) % queue.length;
  playSong(queue[queueIdx], queueIdx, 'search');
}

function updateLoopUI() {
  const btn = $('#loop-btn');
  btn.classList.toggle('active', loopMode !== 'off');
  btn.title = `Loop: ${loopMode}`;
}

audio.addEventListener('ended', () => {
  if (loopMode === 'one' && currentSong) playSong(currentSong, queueIdx, 'search');
  else if (loopMode === 'all' && queue.length) nextTrack();
  else resetPlayer();
});

audio.addEventListener('play', () => { $('#play-icon').style.display='none'; $('#pause-icon').style.display=''; });
audio.addEventListener('pause', () => { $('#play-icon').style.display=''; $('#pause-icon').style.display='none'; });

function resetPlayer() {
  currentSong = null;
  $('#player-title').textContent = 'No track playing';
  $('#player-artist').textContent = '';
  $('#player-thumb').style.display = 'none';
  $('#player-thumb-placeholder').style.display = '';
  $('#progress-bar').value = 0;
  $('#time-pos').textContent = '0:00';
  $('#time-dur').textContent = '0:00';
  $$('.song-row').forEach(r => r.classList.remove('playing'));
}

// Progress
$('#progress-bar').addEventListener('input', e => {
  progressDragging = true;
  if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
});
$('#progress-bar').addEventListener('change', () => progressDragging = false);

setInterval(() => {
  if (!audio.duration || progressDragging) return;
  $('#progress-bar').value = (audio.currentTime / audio.duration) * 100;
  $('#time-pos').textContent = fmt(audio.currentTime);
  $('#time-dur').textContent = fmt(audio.duration);
}, 250);

// Volume
$('#volume-bar').addEventListener('input', e => { audio.volume = e.target.value / 100; });
$('#vol-btn').addEventListener('click', () => {
  audio.muted = !audio.muted;
  $('#vol-btn').classList.toggle('active', audio.muted);
});
audio.volume = 0.7;

// Library
async function loadLibrary(mode) {
  const r = await fetch(`${API}/api/library`);
  const lib = await r.json();
  let songs = [];
  let title = 'My Library';
  if (mode === 'all') { songs = lib.songs || []; title = 'My Library'; }
  else if (mode === 'favorites') { songs = (lib.songs || []).filter(s => s.favorite); title = 'Favorites'; }
  else if (mode === 'downloads') { songs = (lib.songs || []).filter(s => s.downloaded); title = 'Downloads'; }
  else if (mode.startsWith('playlist:')) {
    const name = mode.split(':')[1];
    const pls = lib.playlists || [];
    const pl = pls.find(p => p.name === name);
    songs = pl ? pl.songs : [];
    title = name;
  }
  $('#lib-title').textContent = title;
  $('#lib-subtitle').textContent = `${songs.length} nasheed${songs.length !== 1 ? 's' : ''}`;
  const list = $('#lib-list');
  list.innerHTML = '';
  if (!songs.length) {
    list.style.display = 'none';
    $('#lib-empty').style.display = '';
  } else {
    $('#lib-empty').style.display = 'none';
    songs.forEach((s, i) => list.appendChild(createSongRow(s, i, 'library')));
    list.style.display = '';
  }
}

async function toggleFav(song) {
  await fetch(`${API}/api/library/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(song)});
  const r = await fetch(`${API}/api/library/fav/${song.id}`, {method:'POST'});
  const d = await r.json();
  const btns = $$(`.song-row[data-id="${song.id}"] .fav-btn`);
  btns.forEach(b => b.classList.toggle('active', d.favorite));
}

async function downloadSong(song) {
  await fetch(`${API}/api/library/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(song)});
  $('#search-status').textContent = `Downloading: ${song.title}...`;
  await fetch(`${API}/api/download/${song.id}`, {method:'POST'});
  $('#search-status').textContent = `Downloaded: ${song.title}`;
}

async function addToPlaylist(song) {
  await fetch(`${API}/api/library/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(song)});
  const name = prompt('Playlist name:');
  if (!name) return;
  await fetch(`${API}/api/playlists/create`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})});
  await fetch(`${API}/api/playlists/${encodeURIComponent(name)}/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(song)});
  loadPlaylists();
}

// Playlists
async function loadPlaylists() {
  const r = await fetch(`${API}/api/playlists`);
  const pls = await r.json();
  const nav = $('#playlist-nav');
  nav.innerHTML = '';
  pls.forEach(pl => {
    const btn = document.createElement('button');
    btn.className = 'pl-nav-btn';
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> ${esc(pl.name)}`;
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.view').forEach(v => v.classList.remove('active'));
      $('#library-view').classList.add('active');
      loadLibrary('playlist:' + pl.name);
    });
    nav.appendChild(btn);
  });
}

$('#add-playlist-btn').addEventListener('click', async () => {
  const name = prompt('New playlist name:');
  if (!name) return;
  await fetch(`${API}/api/playlists/create`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})});
  loadPlaylists();
});

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function fmt(s) { const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; }

loadPlaylists();
