const API = '';

interface Song {
  id: string;
  title: string;
  channel: string;
  thumbnail?: string;
  duration?: number;
  duration_string?: string;
  url?: string;
  favorite?: boolean;
  kind?: 'quran';
  stream_url?: string;
  arabic?: string;
  reciter_id?: number;
  chapter_id?: number;
  verses_count?: number;
}

interface Playlist {
  name: string;
  songs: Song[];
}

interface Library {
  songs: Song[];
  playlists: Playlist[];
}

type LoopMode = 'off' | 'one';
type SortMode = 'added' | 'title' | 'channel';

const audio = new Audio();
let queue: Song[] = [];
let queueIdx = -1;
let loopMode: LoopMode = 'off';
let currentSong: Song | null = null;
let progressDrag = false;
let currentList: Song[] = [];
let currentPlaylistName: string | null = null;
let shuffleOn = false;
let preShuffleQueue: Song[] = [];
let currentLibMode: string | undefined;
let currentLibSource: Song[] = [];
let sortMode: SortMode = 'added';
let startingId: string | null = null;
let buffering = false;

const SORT_LABELS: Record<SortMode, string> = {
  added: 'Recently added',
  title: 'Title A–Z',
  channel: 'Channel',
};

function $(s: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(s);
  if (!el) throw new Error('missing element: ' + s);
  return el;
}
function $$<T extends HTMLElement = HTMLElement>(s: string): T[] {
  return Array.from(document.querySelectorAll<T>(s));
}
function esc(s?: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  return r.json() as Promise<T>;
}
function toast(msg: string) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function store(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function shuffleArr<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function recordRecent(song: Song) {
  const list = load<Song[]>('ns_recent', []).filter((s) => s.id !== song.id);
  list.unshift(song);
  store('ns_recent', list.slice(0, 50));
}

class Modal {
  private readonly backdrop: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly onCloseCb: (() => void) | null;

  constructor(title: string, content: HTMLElement, onClose?: () => void, className?: string) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.panel = document.createElement('div');
    this.panel.className = 'modal' + (className ? ` ${className}` : '');
    const h = document.createElement('div');
    h.className = 'modal-title';
    h.textContent = title;
    this.panel.append(h, content);
    this.backdrop.append(this.panel);
    this.panel.tabIndex = -1;
    this.onCloseCb = onClose ?? null;
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.backdrop.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') this.close();
      },
      true
    );
    document.body.appendChild(this.backdrop);
    this.panel.focus();
  }

  close() {
    this.backdrop.remove();
    this.onCloseCb?.();
  }
}

function promptText(title: string, placeholder: string, okLabel: string, value = ''): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-input';
    input.placeholder = placeholder;
    input.value = value;
    input.spellcheck = false;
    const cancel = document.createElement('button');
    cancel.className = 'modal-btn';
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.className = 'modal-btn modal-btn-primary';
    ok.textContent = okLabel;
    const row = document.createElement('div');
    row.className = 'modal-actions';
    row.append(cancel, ok);
    const wrap = document.createElement('div');
    wrap.className = 'modal-body';
    wrap.append(input, row);
    const m = new Modal(title, wrap, () => finish(null));
    const submit = () => {
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return;
      }
      finish(v);
    };
    ok.addEventListener('click', submit);
    cancel.addEventListener('click', () => finish(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    window.setTimeout(() => input.focus(), 30);
  });
}

function confirmDialog(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const content = document.createElement('div');
    content.className = 'modal-body';
    const msg = document.createElement('div');
    msg.className = 'modal-msg';
    msg.textContent = message;
    const row = document.createElement('div');
    row.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'modal-btn';
    cancel.textContent = 'Cancel';
    const del = document.createElement('button');
    del.className = 'modal-btn modal-btn-danger';
    del.innerHTML = '<i class="fa-solid fa-trash" style="margin-right:6px"></i>Delete';
    row.append(cancel, del);
    content.append(msg, row);
    const m = new Modal(title, content, () => finish(false));
    cancel.addEventListener('click', () => finish(false));
    del.addEventListener('click', () => finish(true));
    window.setTimeout(() => cancel.focus(), 30);
  });
}

async function showPlaylistPicker(): Promise<string | null> {
  const pls = await getJSON<Playlist[]>(`${API}/api/playlists`);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const content = document.createElement('div');
    content.className = 'modal-body';
    const list = document.createElement('div');
    list.className = 'modal-list';
    if (pls.length) {
      pls.forEach((pl) => {
        const opt = document.createElement('button');
        opt.className = 'modal-opt';
        opt.style.display = 'flex';
        opt.style.alignItems = 'center';
        opt.style.gap = '10px';
        opt.innerHTML = `<i class="fa-solid fa-list-ul" style="width:16px;text-align:center;color:#b3b3b3"></i><span style="flex:1">${esc(pl.name)}</span>`;
        opt.addEventListener('click', () => finish(pl.name));
        list.appendChild(opt);
      });
    } else {
      const hint = document.createElement('div');
      hint.className = 'modal-hint';
      hint.innerHTML = '<i class="fa-solid fa-circle-info" style="margin-right:8px"></i>No playlists yet';
      list.appendChild(hint);
    }
    const sep = document.createElement('div');
    sep.className = 'modal-sep';
    const newRow = document.createElement('div');
    newRow.className = 'modal-actions';
    const newBtn = document.createElement('button');
    newBtn.className = 'modal-btn modal-btn-primary';
    newBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right:6px"></i>New playlist';
    newBtn.addEventListener('click', async () => {
      const name = await promptText('New playlist', 'Playlist name', 'Create');
      if (!name) {
        finish(null);
        return;
      }
      await getJSON<{ ok: boolean }>(`${API}/api/playlists/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      loadPlaylists();
      finish(name);
    });
    newRow.append(newBtn);
    content.append(list, sep, newRow);
    const m = new Modal('Add to playlist', content, () => finish(null));
  });
}

function showReciterPicker() {
  if (!quranReciters.length) return;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    m.close();
  };
  const content = document.createElement('div');
  content.className = 'modal-body reciter-picker';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'modal-input';
  input.placeholder = 'Search reciters…';
  input.spellcheck = false;
  const count = document.createElement('div');
  count.className = 'modal-hint reciter-picker-count';
  const list = document.createElement('div');
  list.className = 'modal-list reciter-picker-list';
  const render = (q: string) => {
    const term = q.trim().toLowerCase();
    const items = quranReciters.filter(
      (r) =>
        !term ||
        (r.label || '').toLowerCase().includes(term) ||
        r.reciter_name.toLowerCase().includes(term) ||
        (r.style || '').toLowerCase().includes(term)
    );
    list.innerHTML = '';
    if (!items.length) {
      const h = document.createElement('div');
      h.className = 'modal-hint';
      h.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="margin-right:8px"></i>No reciters found';
      list.appendChild(h);
    } else {
      items.forEach((r) => {
        const on = r.id === quranReciterId;
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'modal-opt reciter-opt' + (on ? ' active' : '');
        opt.innerHTML = `
          <i class="fa-solid ${on ? 'fa-check' : 'fa-microphone-lines'}"></i>
          <span class="reciter-opt-text">
            <span class="reciter-opt-name">${esc(r.label || r.reciter_name)}</span>
            ${r.style ? `<span class="reciter-opt-style">${esc(r.style)}</span>` : ''}
          </span>`;
        opt.addEventListener('click', () => {
          applyQuranReciter(r.id, true);
          finish();
        });
        list.appendChild(opt);
      });
    }
    count.textContent = term
      ? `${items.length} of ${quranReciters.length} reciters`
      : `${quranReciters.length} reciters`;
  };
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = list.querySelector<HTMLElement>('.reciter-opt');
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
  });
  content.append(input, count, list);
  const m = new Modal('Choose reciter', content, () => finish(), 'modal-reciter');
  render('');
  window.setTimeout(() => input.focus(), 30);
}

class Slider {
  private readonly root: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly thumb: HTMLElement;
  private value = 0;
  private dragging = false;
  onInput: ((v: number) => void) | null = null;
  onChange: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.classList.add('slider');
    this.root.tabIndex = 0;
    const env = document.createElement('div');
    env.className = 'slider-env';
    this.fill = document.createElement('div');
    this.fill.className = 'slider-fill';
    this.thumb = document.createElement('div');
    this.thumb.className = 'slider-thumb';
    this.root.append(env, this.fill, this.thumb);

    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    this.root.addEventListener('pointermove', (e) => this.onMove(e));
    this.root.addEventListener('pointerup', (e) => this.onUp(e));
    this.root.addEventListener('pointercancel', () => this.endDrag());
    this.root.addEventListener('keydown', (e) => this.onKey(e));
  }

  private pos(pct: number): number {
    const rect = this.root.getBoundingClientRect();
    let p = ((pct - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, p));
  }

  private onDown(e: PointerEvent) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    this.dragging = true;
    this.root.classList.add('dragging');
    this.root.setPointerCapture(e.pointerId);
    this.setValue(this.pos(e.clientX));
    this.onInput?.(this.value);
  }

  private onMove(e: PointerEvent) {
    if (!this.dragging) return;
    this.setValue(this.pos(e.clientX));
    this.onInput?.(this.value);
  }

  private onUp(e: PointerEvent) {
    if (!this.dragging) return;
    this.setValue(this.pos(e.clientX));
    this.onInput?.(this.value);
    this.endDrag();
    this.onChange?.();
  }

  private endDrag() {
    this.dragging = false;
    this.root.classList.remove('dragging');
  }

  private onKey(e: KeyboardEvent) {
    let d = 0;
    if (e.key === 'ArrowRight') d = 1;
    else if (e.key === 'ArrowLeft') d = -1;
    else if (e.key === 'PageUp') d = 10;
    else if (e.key === 'PageDown') d = -10;
    else if (e.key === 'Home') d = -100;
    else if (e.key === 'End') d = 100;
    if (d) {
      e.preventDefault();
      const v = this.value + d;
      this.setValue(Math.max(0, Math.min(100, v)));
      this.onInput?.(this.value);
      this.onChange?.();
    }
  }

  setValue(v: number): number {
    this.value = Math.max(0, Math.min(100, v));
    this.fill.style.width = this.value + '%';
    this.thumb.style.left = this.value + '%';
    this.root.setAttribute('aria-valuenow', String(Math.round(this.value)));
    return this.value;
  }

  getValue(): number {
    return this.value;
  }
}

const $seekOrigin = $('#progress-bar');
const seek = new Slider($seekOrigin);
const $volOrigin = $('#volume-bar');
const vol = new Slider($volOrigin);

// --- NAVIGATION ---
function setSidebarOpen(open: boolean) {
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar-backdrop').classList.toggle('show', open);
}
$('#menu-btn').addEventListener('click', () => setSidebarOpen(true));
$('#menu-close').addEventListener('click', () => setSidebarOpen(false));
$('#sidebar-backdrop').addEventListener('click', () => setSidebarOpen(false));
$('#playlist-nav').addEventListener('click', () => setSidebarOpen(false));

$$<HTMLElement>('.nav-item').forEach((btn) =>
  btn.addEventListener('click', () => {
    setSidebarOpen(false);
    $$<HTMLElement>('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.view;
    $$<HTMLElement>('.view').forEach((el) => el.classList.remove('active'));
    if (v === 'search') {
      $('#search-view').classList.add('active');
    } else if (v === 'quran') {
      $('#quran-view').classList.add('active');
      loadQuran();
    } else if (v === 'settings') {
      $('#settings-view').classList.add('active');
      void loadSettings();
    } else {
      $('#library-view').classList.add('active');
      loadLib(v);
    }
  })
);

// --- QURAN ---
interface QuranChapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  translated_name?: { name: string };
}

interface QuranReciter {
  id: number;
  reciter_name: string;
  style?: string | null;
  label?: string;
  server?: string;
}

const QURAN_DEFAULT_RECITER = '123';

let quranChapters: QuranChapter[] = [];
let quranLoaded = false;
let quranReciters: QuranReciter[] = [];
let quranReciterId = Number(QURAN_DEFAULT_RECITER);

function quranReciterName(id: number): string {
  const r = quranReciters.find((x) => x.id === id);
  return r ? r.label || r.reciter_name : 'Quran';
}

function currentQuranReciterId(): number {
  return quranReciterId;
}

function quranReciterIndex(): number {
  return quranReciters.findIndex((r) => r.id === quranReciterId);
}

function buildQuranSong(ch: QuranChapter, reciterId: number): Song {
  const reciter = quranReciterName(reciterId);
  return {
    id: `quran:${reciterId}:${ch.id}`,
    title: `${ch.id}. ${ch.name_simple}`,
    channel: reciter,
    arabic: ch.name_arabic,
    kind: 'quran',
    reciter_id: reciterId,
    chapter_id: ch.id,
    verses_count: ch.verses_count,
  };
}

function quranSongs(): Song[] {
  const reciterId = currentQuranReciterId();
  return quranChapters.map((ch) => buildQuranSong(ch, reciterId));
}

function renderQuranList() {
  const songs = quranSongs();
  if (!songs.length) {
    $('#quran-list').style.display = 'none';
    $('#quran-empty').style.display = '';
    $('#quran-actions').classList.add('hidden');
    $('#quran-subtitle').textContent = 'Listen to the Quran';
    return;
  }
  $('#quran-empty').style.display = 'none';
  $('#quran-list').style.display = '';
  $('#quran-actions').classList.remove('hidden');
  $('#quran-subtitle').textContent = `${songs.length} surahs · ${quranReciterName(quranReciterId)}`;
  renderList('quran-list', songs, 'quran');
}

function syncQuranReciterUI(scrollIntoView = false) {
  const scroller = $('#quran-reciter-scroller');
  const chips = Array.from(scroller.querySelectorAll<HTMLElement>('.quran-reciter-chip'));
  chips.forEach((chip) => {
    const on = Number(chip.dataset.id) === quranReciterId;
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const idx = quranReciterIndex();
  const pos = $('#quran-reciter-pos');
  if (quranReciters.length) {
    pos.textContent = `${idx >= 0 ? idx + 1 : 1} / ${quranReciters.length}`;
  } else {
    pos.textContent = '';
  }
  $('#quran-reciter-prev').toggleAttribute('disabled', idx <= 0);
  $('#quran-reciter-next').toggleAttribute('disabled', idx < 0 || idx >= quranReciters.length - 1);
  updateReciterEdgeBtns();
  if (scrollIntoView && idx >= 0 && chips[idx]) {
    chips[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function updateReciterEdgeBtns() {
  const scroller = $('#quran-reciter-scroller');
  const max = scroller.scrollWidth - scroller.clientWidth;
  $('#quran-reciter-scroll-l').classList.toggle('show', scroller.scrollLeft > 4);
  $('#quran-reciter-scroll-r').classList.toggle('show', scroller.scrollLeft < max - 4 && max > 4);
}

function applyQuranReciter(id: number, scroll = true) {
  if (!quranReciters.some((r) => r.id === id)) return;
  const changed = quranReciterId !== id;
  quranReciterId = id;
  store('ns_qreciter', String(id));
  if (changed) {
    queue.forEach((s) => {
      if (s.kind === 'quran') {
        s.reciter_id = id;
        s.stream_url = undefined;
        s.id = `quran:${id}:${s.chapter_id}`;
      }
    });
    preShuffleQueue.forEach((s) => {
      if (s.kind === 'quran') {
        s.reciter_id = id;
        s.stream_url = undefined;
        s.id = `quran:${id}:${s.chapter_id}`;
      }
    });
    if (currentSong?.kind === 'quran') {
      currentSong.reciter_id = id;
      currentSong.channel = quranReciterName(id);
      currentSong.stream_url = undefined;
      currentSong.id = `quran:${id}:${currentSong.chapter_id}`;
      updatePlayer();
      pushDiscord(true);
    }
    renderQuranList();
  }
  syncQuranReciterUI(scroll);
}

function stepQuranReciter(delta: number) {
  if (!quranReciters.length) return;
  let i = quranReciterIndex();
  if (i < 0) i = 0;
  const next = Math.max(0, Math.min(quranReciters.length - 1, i + delta));
  applyQuranReciter(quranReciters[next].id, true);
}

// --- QURAN AYAH READER ---
let transLang = load<string>('ns_qtrans', 'en');
let transDataLang = transLang === 'off' ? 'en' : transLang;
const transCache = new Map<string, { name: string; verses: { num: number; arabic: string; text: string }[] }>();
let transLoadedKey = '';
let transAyahIdx = -1;

function transHint(text: string) {
  $('#quran-trans-body').innerHTML = `<div class="quran-trans-hint">${esc(text)}</div>`;
  $('#quran-trans-body').classList.remove('hide-tr');
  $('#quran-trans-src').textContent = '';
  $('#quran-ayah-pos').textContent = '';
  $('#ayah-prev').toggleAttribute('disabled', true);
  $('#ayah-next').toggleAttribute('disabled', true);
}

function seekToAyah(num: number) {
  const rows = $$('.quran-trans-body .quran-ayah');
  const n = rows.length;
  if (!n || !audio.duration || currentSong?.kind !== 'quran') return;
  const target = Math.max(0, Math.min(num - 1, n - 1));
  audio.currentTime = ((target + 0.01) / n) * audio.duration;
  audio.play().catch(playError);
}

function highlightTransAyah(scroll: boolean) {
  if (!currentSong || currentSong.kind !== 'quran') return;
  const rows = $$('.quran-trans-body .quran-ayah');
  if (!rows.length) return;
  const dur = audio.duration || currentSong.duration || 0;
  if (!dur) return;
  let idx = Math.floor((audio.currentTime / dur) * rows.length);
  if (idx < 0) idx = 0;
  if (idx >= rows.length) idx = rows.length - 1;
  if (idx === transAyahIdx) return;
  transAyahIdx = idx;
  rows.forEach((r, i) => r.classList.toggle('active', i === idx));
  $('#quran-ayah-pos').textContent = `${idx + 1} / ${rows.length}`;
  $('#ayah-prev').toggleAttribute('disabled', idx <= 0);
  $('#ayah-next').toggleAttribute('disabled', idx >= rows.length - 1);
  if (scroll) rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function syncQuranTranslation() {
  $$('.quran-trans-lang').forEach((b) => b.classList.toggle('active', b.dataset.lang === transLang));
  const body = $('#quran-trans-body');
  const ch = currentSong && currentSong.kind === 'quran' ? currentSong.chapter_id ?? 0 : 0;
  if (!ch) {
    transLoadedKey = '';
    transAyahIdx = -1;
    transHint('Play a surah to read along');
    return;
  }
  const dataLang = transLang === 'off' ? transDataLang : transLang;
  body.classList.toggle('hide-tr', transLang === 'off');
  const key = `${ch}:${dataLang}`;
  if (key === transLoadedKey) return;
  transLoadedKey = key;
  transAyahIdx = -1;
  $('#quran-trans-src').textContent = '';
  $('#quran-ayah-pos').textContent = '';
  $('#ayah-prev').toggleAttribute('disabled', true);
  $('#ayah-next').toggleAttribute('disabled', true);
  body.innerHTML = '<div class="quran-trans-hint">Loading ayahs...</div>';
  const render = (data: { name: string; verses: { num: number; arabic: string; text: string }[] }) => {
    if (transLoadedKey !== key) return;
    if (!data.verses.length) {
      transLoadedKey = '';
      transHint('Could not load ayahs');
      return;
    }
    $('#quran-trans-src').textContent = transLang === 'off' ? 'Arabic only' : data.name;
    body.classList.toggle('hide-tr', transLang === 'off');
    body.innerHTML = '';
    data.verses.forEach((v) => {
      const row = document.createElement('div');
      row.className = 'quran-ayah';
      row.innerHTML = `
        <div class="quran-ayah-ar" dir="rtl">${esc(v.arabic)}<span class="quran-ayah-badge">${v.num}</span></div>
        <div class="quran-ayah-text">${esc(v.text)}</div>`;
      row.addEventListener('click', () => seekToAyah(v.num));
      body.appendChild(row);
    });
    highlightTransAyah(true);
  };
  const cached = transCache.get(key);
  if (cached) {
    render(cached);
    return;
  }
  void (async () => {
    try {
      const r = await fetch(`${API}/api/quran/translation/${ch}?lang=${dataLang}`);
      if (!r.ok) throw new Error('trans');
      const d = (await r.json()) as { name?: string; verses?: { num: number; arabic: string; text: string }[] };
      const data = { name: d.name || '', verses: d.verses || [] };
      transCache.set(key, data);
      render(data);
    } catch {
      if (transLoadedKey === key) {
        transLoadedKey = '';
        transHint('Could not load ayahs');
      }
    }
  })();
}

$$<HTMLElement>('.quran-trans-lang').forEach((b) =>
  b.addEventListener('click', () => {
    transLang = b.dataset.lang || 'en';
    if (transLang !== 'off') transDataLang = transLang;
    store('ns_qtrans', transLang);
    transLoadedKey = '';
    syncQuranTranslation();
  })
);

$('#ayah-prev').addEventListener('click', () => {
  if (transAyahIdx > 0) seekToAyah(transAyahIdx);
});
$('#ayah-next').addEventListener('click', () => {
  const n = $$('.quran-trans-body .quran-ayah').length;
  if (transAyahIdx >= 0 && transAyahIdx < n - 1) seekToAyah(transAyahIdx + 2);
});

function renderQuranReciterChips() {
  const scroller = $('#quran-reciter-scroller');
  scroller.innerHTML = '';
  quranReciters.forEach((r) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quran-reciter-chip';
    chip.dataset.id = String(r.id);
    chip.setAttribute('role', 'option');
    chip.setAttribute('aria-selected', 'false');
    chip.innerHTML = `<i class="fa-solid fa-microphone-lines"></i><span>${esc(r.label || r.reciter_name)}</span>`;
    chip.addEventListener('click', () => applyQuranReciter(r.id, true));
    scroller.appendChild(chip);
  });
}

let quranRecitersPromise: Promise<void> | null = null;

async function loadQuranReciters() {
  if (quranReciters.length) {
    syncQuranReciterUI(false);
    return;
  }
  if (quranRecitersPromise) {
    await quranRecitersPromise;
    return;
  }
  quranRecitersPromise = (async () => {
    try {
      const r = await fetch(`${API}/api/quran/reciters`);
      if (!r.ok) throw new Error('reciters');
      const data = (await r.json()) as { recitations?: QuranReciter[] };
      quranReciters = data.recitations || [];
    } catch {
      quranReciters = [
        { id: Number(QURAN_DEFAULT_RECITER), reciter_name: 'Mishary Alafasi', label: 'Mishary Alafasi' },
      ];
    }
    const saved = Number(load<string>('ns_qreciter', QURAN_DEFAULT_RECITER));
    if (quranReciters.some((r) => r.id === saved)) {
      quranReciterId = saved;
    } else {
      const preferred =
        quranReciters.find((r) => r.id === Number(QURAN_DEFAULT_RECITER)) ||
        quranReciters.find((r) => /alafasi|alafasy|afasy|mishary/i.test(r.reciter_name)) ||
        quranReciters[0];
      quranReciterId = preferred ? preferred.id : Number(QURAN_DEFAULT_RECITER);
      store('ns_qreciter', String(quranReciterId));
    }
    renderQuranReciterChips();
    syncQuranReciterUI(true);
  })();
  try {
    await quranRecitersPromise;
  } finally {
    quranRecitersPromise = null;
  }
}

let quranLoadPromise: Promise<void> | null = null;

async function loadQuran() {
  if (quranLoadPromise) {
    await quranLoadPromise;
    return;
  }
  $('#quran-loading').style.display = '';
  $('#quran-list').style.display = 'none';
  $('#quran-empty').style.display = 'none';
  quranLoadPromise = (async () => {
    await loadQuranReciters();
    if (quranLoaded && quranChapters.length) {
      $('#quran-loading').style.display = 'none';
      renderQuranList();
      return;
    }
    try {
      const r = await fetch(`${API}/api/quran/chapters`);
      if (!r.ok) throw new Error('chapters');
      const data = (await r.json()) as { chapters?: QuranChapter[] };
      quranChapters = data.chapters || [];
      quranLoaded = true;
      $('#quran-loading').style.display = 'none';
      renderQuranList();
    } catch {
      $('#quran-loading').style.display = 'none';
      $('#quran-list').style.display = 'none';
      $('#quran-empty').style.display = '';
      $('#quran-actions').classList.add('hidden');
    }
  })();
  try {
    await quranLoadPromise;
  } finally {
    quranLoadPromise = null;
  }
}

$('#quran-reciter-prev').addEventListener('click', () => stepQuranReciter(-1));
$('#quran-reciter-next').addEventListener('click', () => stepQuranReciter(1));
$('#quran-reciter-browse').addEventListener('click', () => showReciterPicker());
$('#quran-reciter-scroll-l').addEventListener('click', () => {
  $('#quran-reciter-scroller').scrollBy({ left: -240, behavior: 'smooth' });
});
$('#quran-reciter-scroll-r').addEventListener('click', () => {
  $('#quran-reciter-scroller').scrollBy({ left: 240, behavior: 'smooth' });
});
$('#quran-reciter-scroller').addEventListener('scroll', updateReciterEdgeBtns, { passive: true });
window.addEventListener('resize', updateReciterEdgeBtns);
$('#quran-reciter-scroller').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    stepQuranReciter(1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    stepQuranReciter(-1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    if (quranReciters[0]) applyQuranReciter(quranReciters[0].id, true);
  } else if (e.key === 'End') {
    e.preventDefault();
    const last = quranReciters[quranReciters.length - 1];
    if (last) applyQuranReciter(last.id, true);
  }
});
$('#quran-reciter-scroller').addEventListener(
  'wheel',
  (e) => {
    const el = e.currentTarget as HTMLElement | null;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  },
  { passive: false }
);

$('#quran-retry').addEventListener('click', () => void loadQuran());
$('#quran-play').addEventListener('click', () => {
  const songs = quranSongs();
  if (!songs.length) return;
  const idx = shuffleOn ? Math.floor(Math.random() * songs.length) : 0;
  playSong(songs[idx], idx, 'quran');
});

$('#quran-shuffle').addEventListener('click', () => {
  const songs = quranSongs();
  if (!songs.length) return;
  if (!shuffleOn) setShuffle(true);
  const idx = Math.floor(Math.random() * songs.length);
  playSong(songs[idx], idx, 'quran');
});

// --- SEARCH ---
let searchTimer: number | undefined;

function syncSearchUI() {
  const hasQ = !!(($('#search-input') as HTMLInputElement).value.trim());
  $('#search-clear').classList.toggle('hidden', !hasQ);
  const box = $('#recent-q');
  if (hasQ || !box.children.length) box.classList.add('hidden');
  else box.classList.remove('hidden');
}

function saveRecentQ(q: string) {
  const list = load<string[]>('ns_recentq', []).filter((x) => x !== q);
  list.unshift(q);
  store('ns_recentq', list.slice(0, 8));
}

function renderRecentQ() {
  const qs = load<string[]>('ns_recentq', []);
  const box = $('#recent-q');
  box.innerHTML = '';
  if (!qs.length) {
    box.classList.add('hidden');
    return;
  }
  const label = document.createElement('div');
  label.className = 'recent-q-label';
  label.textContent = 'Recent searches';
  box.appendChild(label);
  qs.forEach((q) => {
    const chip = document.createElement('button');
    chip.className = 'q-chip';
    chip.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>${esc(q)}`;
    chip.addEventListener('click', () => {
      ($('#search-input') as HTMLInputElement).value = q;
      syncSearchUI();
      doSearch(q);
    });
    box.appendChild(chip);
  });
}

$('#search-input').addEventListener('input', (e) => {
  syncSearchUI();
  clearTimeout(searchTimer);
  const q = (e.target as HTMLInputElement).value.trim();
  if (!q) {
    showEmpty();
    return;
  }
  searchTimer = window.setTimeout(() => doSearch(q), 350);
});
$('#search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimer);
    const q = (e.target as HTMLInputElement).value.trim();
    if (q) doSearch(q);
  } else if (e.key === 'Escape') {
    (e.target as HTMLInputElement).value = '';
    clearTimeout(searchTimer);
    showEmpty();
    syncSearchUI();
  }
});
$('#search-clear').addEventListener('click', () => {
  ($('#search-input') as HTMLInputElement).value = '';
  clearTimeout(searchTimer);
  showEmpty();
  syncSearchUI();
  $('#search-input').focus();
});

async function doSearch(q: string) {
  show('loading');
  $('#search-status').textContent = '';
  try {
    const data = await getJSON<Song[]>(`${API}/api/search?q=${encodeURIComponent(q)}`);
    saveRecentQ(q);
    renderRecentQ();
    if (!data.length) {
      showEmpty('No results found');
      return;
    }
    queue = data;
    queueIdx = -1;
    renderList('search-results', data, 'search');
    show('results');
  } catch {
    showEmpty('Search failed');
  }
}

function showEmpty(msg?: string) {
  $('#search-loading').style.display = 'none';
  $('#search-results').style.display = 'none';
  $('#search-empty').style.display = '';
  if (msg) {
    const t = $('#search-empty').querySelector('.empty-title');
    if (t) t.textContent = msg;
  }
}
function show(what: 'empty' | 'loading' | 'results') {
  $('#search-empty').style.display = what === 'empty' ? '' : 'none';
  $('#search-loading').style.display = what === 'loading' ? '' : 'none';
  $('#search-results').style.display = what === 'results' ? '' : 'none';
}

// --- RENDER ---
function renderList(containerId: string, songs: Song[], ctx: string) {
  const c = $(`#${containerId}`);
  c.innerHTML = '';
  currentList = songs;
  songs.forEach((s, i) => c.appendChild(makeRow(s, i, ctx)));
}

function makeRow(song: Song, idx: number, ctx: string): HTMLElement {
  const r = document.createElement('div');
  r.className = 'track-row';
  r.dataset.id = song.id;
  if (currentSong && currentSong.id === song.id) r.classList.add('playing');
  const isQuran = ctx === 'quran' || song.kind === 'quran';
  const canRemove = ctx !== 'search' && !isQuran;
  const heart = song.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
  const sub = isQuran
    ? `<span class="track-ar">${esc(song.arabic || '')}</span><span class="track-ayahs">${song.verses_count ? `${song.verses_count} ayahs` : ''}</span>`
    : esc(song.channel);

  if (isQuran) r.classList.add('quran-row');

  r.innerHTML = `
    ${isQuran
      ? `<div class="track-num">${(song.chapter_id ?? idx + 1)}</div>`
      : `<img class="track-thumb" src="${song.thumbnail || ''}" onerror="this.style.display='none'" loading="lazy" alt="">`}
    <div class="track-info">
      <div class="track-name">${esc(song.title)}</div>
      <div class="track-channel">${sub}</div>
    </div>
    ${song.duration_string ? `<span class="track-dur">${song.duration_string}</span>` : ''}
    <div class="track-actions">
      <button class="track-act play-act" title="Play"><i class="fa-solid fa-play"></i></button>
      ${canRemove ? '<button class="track-act rem-act" title="Remove"><i class="fa-solid fa-trash"></i></button>' : ''}
      ${isQuran ? '' : `<button class="track-act fav-act" title="Like"><i class="${heart}"></i></button>
      <button class="track-act pl-act" title="Add to playlist"><i class="fa-solid fa-plus"></i></button>
      <button class="track-act disc-act" title="Shown in Discord presence"><i class="fa-solid fa-eye"></i></button>`}
    </div>`;

  r.addEventListener('dblclick', () => playSong(song, idx, ctx));
  let warmTimer: number | undefined;
  if (!isQuran) {
    r.addEventListener('mouseenter', () => {
      warmTimer = window.setTimeout(() => warm(song.id), 150);
    });
    r.addEventListener('mouseleave', () => clearTimeout(warmTimer));
  }
  r.querySelector('.play-act')!.addEventListener('click', (e) => { e.stopPropagation(); playSong(song, idx, ctx); });
  if (!isQuran) {
    r.querySelector('.fav-act')!.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(song); });
    r.querySelector('.pl-act')!.addEventListener('click', (e) => { e.stopPropagation(); addToPl(song); });
    const discBtn = r.querySelector<HTMLElement>('.disc-act');
    if (discBtn) {
      const hidden = discIsHidden(song.id);
      const icon = discBtn.querySelector('i');
      if (icon) icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      discBtn.classList.toggle('disc-hide', hidden);
      discBtn.title = hidden ? 'Hidden from Discord presence' : 'Shown in Discord presence';
      discBtn.addEventListener('click', (e) => { e.stopPropagation(); discToggleSong(song); });
    }
  }
  if (canRemove) {
    r.querySelector('.rem-act')!.addEventListener('click', (e) => { e.stopPropagation(); removeFromList(song); });
  }
  return r;
}

// --- PLAYBACK ---
const warmed = new Set<string>();

function warm(id: string) {
  if (warmed.has(id)) return;
  warmed.add(id);
  fetch(`${API}/api/warm/${id}`).then((r) => {
    if (!r.ok) warmed.delete(id);
  }).catch(() => warmed.delete(id));
}

function syncIcons() {
  const paused = audio.paused;
  $('#buf-icon').classList.toggle('hidden', !buffering);
  $('#play-icon').classList.toggle('hidden', !paused || buffering);
  $('#pause-icon').classList.toggle('hidden', paused || buffering);
}

function setBuffering(on: boolean) {
  buffering = on;
  syncIcons();
}

function playError(e: unknown) {
  const name = (e as DOMException)?.name;
  if (name === 'AbortError') return;
  setBuffering(false);
  if (name === 'NotAllowedError') toast('Click play to start');
}

function songSrc(song: Song): string {
  if (song.kind === 'quran') {
    if (song.stream_url) return song.stream_url;
    const reciter = song.reciter_id ?? currentQuranReciterId();
    const chapter = song.chapter_id ?? 1;
    return `${API}/api/quran/chapter_audio/${reciter}/${chapter}`;
  }
  return `${API}/api/proxy/${song.id}`;
}

async function ensureQuranSrc(song: Song): Promise<string> {
  if (song.kind !== 'quran') return songSrc(song);
  if (song.stream_url) return song.stream_url;
  const reciter = song.reciter_id ?? currentQuranReciterId();
  const chapter = song.chapter_id ?? 1;
  const r = await fetch(`${API}/api/quran/chapter_audio/${reciter}/${chapter}`);
  if (!r.ok) throw new Error('quran audio');
  const data = (await r.json()) as { url?: string };
  if (!data.url) throw new Error('quran audio');
  const nowReciter = song.reciter_id ?? currentQuranReciterId();
  if (nowReciter !== reciter) throw new Error('quran audio');
  song.stream_url = data.url;
  return data.url;
}

async function playSong(song: Song, idx: number, _ctx: string, keepQueue = false) {
  if (startingId === song.id && !audio.error) {
    audio.play().catch(playError);
    return;
  }
  currentSong = song;
  if (keepQueue) {
    queueIdx = idx;
  } else {
    const base = currentList.length ? currentList : queue.slice();
    if (shuffleOn && base.length > 1) {
      preShuffleQueue = base.slice();
      queue = [song, ...shuffleArr(base.filter((s) => s.id !== song.id))];
      queueIdx = 0;
    } else {
      queue = base;
      queueIdx = idx;
    }
  }
  if (song.kind !== 'quran') recordRecent(song);
  updatePlayer();
  pushDiscord(true);
  $$('.track-row').forEach((r) => r.classList.toggle('playing', r.dataset.id === song.id));
  startingId = song.id;
  setBuffering(true);
  try {
    if (song.kind === 'quran') {
      const src = await ensureQuranSrc(song);
      if (currentSong?.id !== song.id) return;
      audio.src = src;
    } else {
      audio.src = songSrc(song);
    }
    audio.load();
    audio.play().catch(playError);
  } catch {
    startingId = null;
    setBuffering(false);
    toast('Could not load Quran audio');
    return;
  }
  if (song.kind !== 'quran') {
    getJSON<{ ok: boolean }>(`${API}/api/library/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
  }
}

function updatePlayer() {
  if (!currentSong) return;
  $('#player-title').textContent = currentSong.title;
  $('#player-artist').textContent = currentSong.channel;
  const th = $('#player-thumb') as HTMLImageElement;
  const ph = $('#player-thumb-ph');
  if (currentSong.thumbnail) {
    th.src = currentSong.thumbnail;
    th.style.display = 'block';
    ph.style.display = 'none';
  } else {
    th.removeAttribute('src');
    th.style.display = 'none';
    ph.style.display = '';
    const icon = ph.querySelector('i');
    if (icon) icon.className = currentSong.kind === 'quran' ? 'fa-solid fa-book-quran' : 'fa-solid fa-music';
  }
  $('#fav-btn i').className = currentSong.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
  syncQuranTranslation();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.channel,
      album: currentSong.kind === 'quran' ? 'Quran' : 'Quran',
      artwork: currentSong.thumbnail ? [{ src: currentSong.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }
}

// --- CONTROLS ---
$('#fav-btn').addEventListener('click', () => {
  if (!currentSong) return;
  if (currentSong.kind === 'quran') {
    toast('Quran cannot be liked');
    return;
  }
  void toggleFav(currentSong);
});
$('#play-btn').addEventListener('click', () => {
  if (audio.paused && audio.src) {
    audio.play().catch(playError);
  } else if (!audio.paused) {
    audio.pause();
  }
});
$('#stop-btn').addEventListener('click', () => {
  audio.pause();
  audio.currentTime = 0;
  resetPlayer();
});
$('#prev-btn').addEventListener('click', () => {
  if (!queue.length) return;
  if (queueIdx > 0) {
    playSong(queue[queueIdx - 1], queueIdx - 1, 'search', true);
  } else {
    queueIdx = queue.length - 1;
    playSong(queue[queueIdx], queueIdx, 'search', true);
  }
});
$('#next-btn').addEventListener('click', nextTrack);

$('#shuffle-btn').addEventListener('click', () => {
  setShuffle(!shuffleOn);
  toast(shuffleOn ? 'Shuffle on' : 'Shuffle off');
});

function setShuffle(on: boolean) {
  shuffleOn = on;
  store('ns_shuffle', on);
  const btn = $('#shuffle-btn');
  btn.classList.toggle('active', on);
  btn.title = on ? 'Shuffle: on' : 'Shuffle: off';
  const cur = currentSong;
  if (!cur || !queue.length) return;
  if (on) {
    preShuffleQueue = queue.slice();
    queue = [...queue.slice(0, queueIdx + 1), ...shuffleArr(queue.slice(queueIdx + 1))];
  } else if (preShuffleQueue.length) {
    queue = preShuffleQueue;
    const i = queue.findIndex((s) => s.id === cur.id);
    if (i >= 0) queueIdx = i;
    preShuffleQueue = [];
  }
}

$('#loop-btn').addEventListener('click', () => {
  loopMode = loopMode === 'off' ? 'one' : 'off';
  store('ns_loop', loopMode);
  const btn = $('#loop-btn');
  btn.classList.toggle('active', loopMode !== 'off');
  btn.title = loopMode === 'one' ? 'Loop: one' : 'Loop: off';
  toast(loopMode === 'one' ? 'Loop on' : 'Loop off');
});

function nextTrack() {
  if (!queue.length) return;
  if (queueIdx < queue.length - 1) {
    playSong(queue[queueIdx + 1], queueIdx + 1, 'search', true);
  } else {
    resetPlayer();
  }
}

audio.addEventListener('ended', () => {
  if (loopMode === 'one' && currentSong) {
    const cur = currentSong;
    audio.currentTime = 0;
    audio.play().catch(() => playSong(cur, queueIdx, 'search', true));
  } else if (queueIdx < queue.length - 1) {
    playSong(queue[queueIdx + 1], queueIdx + 1, 'search', true);
  } else {
    resetPlayer();
  }
});

audio.addEventListener('play', () => {
  syncIcons();
  dcLastRefresh = 0;
  pushDiscord(true);
});
audio.addEventListener('pause', () => {
  startingId = null;
  setBuffering(false);
  if (discordEnabled) dcClear();
});
audio.addEventListener('playing', () => {
  startingId = null;
  setBuffering(false);
});
audio.addEventListener('waiting', () => setBuffering(true));
audio.addEventListener('error', () => {
  startingId = null;
  setBuffering(false);
  if (audio.src) toast(currentSong?.kind === 'quran' ? 'Could not load Quran audio' : 'Could not load nasheed');
});

function resetPlayer() {
  currentSong = null;
  queueIdx = -1;
  startingId = null;
  setBuffering(false);
  $('#player-title').textContent = 'No track playing';
  $('#player-artist').textContent = '';
  $('#player-thumb').style.display = 'none';
  $('#player-thumb-ph').style.display = 'flex';
  $('#fav-btn i').className = 'fa-regular fa-heart';
  seek.setValue(0);
  $('#time-pos').textContent = '0:00';
  $('#time-dur').textContent = '0:00';
  $$('.track-row').forEach((r) => r.classList.remove('playing'));
  audio.removeAttribute('src');
  syncQuranTranslation();
  dcLastRefresh = 0;
  if (discordEnabled) dcClear();
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    $('#play-btn').click();
  } else if (e.code === 'ArrowRight' && e.shiftKey) {
    e.preventDefault();
    $('#next-btn').click();
  } else if (e.code === 'ArrowLeft' && e.shiftKey) {
    e.preventDefault();
    $('#prev-btn').click();
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    audio.volume = Math.min(1, audio.volume + 0.05);
    vol.setValue(audio.volume * 100);
    updateVolIcon();
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    audio.volume = Math.max(0, audio.volume - 0.05);
    vol.setValue(audio.volume * 100);
    updateVolIcon();
  } else if (e.key === 'l' || e.key === 'L') {
    $('#loop-btn').click();
  } else if (e.key === 'm' || e.key === 'M') {
    $('#vol-btn').click();
  } else if (e.key === '/' || e.key === 's') {
    e.preventDefault();
    const v = $('nav .nav-item.active')?.dataset.view;
    if (v !== 'search') {
      $$<HTMLElement>('.nav-item').forEach((b) => b.classList.remove('active'));
      $('[data-view="search"]').classList.add('active');
      $$<HTMLElement>('.view').forEach((el) => el.classList.remove('active'));
      $('#search-view').classList.add('active');
    }
    $('#search-input').focus();
  }
});

// --- PROGRESS ---
seek.onInput = (p) => {
  progressDrag = true;
  if (audio.duration) audio.currentTime = (p / 100) * audio.duration;
};
seek.onChange = () => {
  progressDrag = false;
  dcLastRefresh = 0;
  pushDiscord(true);
};

const seekTip = document.createElement('div');
seekTip.className = 'seek-tip';
$seekOrigin.appendChild(seekTip);
$seekOrigin.addEventListener('mousemove', (e) => {
  if (!audio.duration) {
    seekTip.classList.remove('show');
    return;
  }
  const rect = $seekOrigin.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  seekTip.textContent = fmt(pct * audio.duration);
  seekTip.style.left = pct * 100 + '%';
  seekTip.classList.add('show');
});
$seekOrigin.addEventListener('mouseleave', () => seekTip.classList.remove('show'));

setInterval(() => {
  if (!audio.duration || progressDrag) return;
  const p = (audio.currentTime / audio.duration) * 100;
  seek.setValue(p);
  $('#time-pos').textContent = fmt(audio.currentTime);
  $('#time-dur').textContent = fmt(audio.duration);
  highlightTransAyah(true);
  pushDiscord();
}, 250);

// --- VOLUME ---
const savedVol = load<number>('ns_vol', 70);
vol.setValue(savedVol);
audio.volume = savedVol / 100;
vol.onInput = (p) => {
  audio.volume = p / 100;
  store('ns_vol', Math.round(p));
  updateVolIcon();
  syncSettingsVol();
};
$('#vol-btn').addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateVolIcon();
});

function updateVolIcon() {
  const i = $('#vol-btn i');
  if (audio.muted || audio.volume === 0) i.className = 'fa-solid fa-volume-xmark';
  else if (audio.volume < 0.3) i.className = 'fa-solid fa-volume-off';
  else if (audio.volume < 0.7) i.className = 'fa-solid fa-volume-low';
  else i.className = 'fa-solid fa-volume-high';
}

// --- LIBRARY ---
function applyLibSort(src: Song[]): Song[] {
  const s = src.slice();
  if (sortMode === 'title') s.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortMode === 'channel') s.sort((a, b) => a.channel.localeCompare(b.channel));
  return s;
}

function syncSortUI() {
  $('#lib-sort-label').textContent = SORT_LABELS[sortMode];
  $$('.lib-sort-opt').forEach((o) => o.classList.toggle('active', o.dataset.sort === sortMode));
}

async function loadLib(mode: string | undefined) {
  const lib = await getJSON<Library>(`${API}/api/library`);
  let songs: Song[] = [];
  let title = 'Your Library';
  let isPlaylist = false;
  if (mode === 'all' || mode === 'library') {
    songs = [...(lib.songs || [])].reverse();
    title = 'Your Library';
  } else if (mode === 'favorites') {
    songs = (lib.songs || []).filter((s) => s.favorite).reverse();
    title = 'Liked Nasheeds';
  } else if (mode === 'recent') {
    const stored = load<Song[]>('ns_recent', []);
    songs = stored.map((r) => {
      const inLib = (lib.songs || []).find((s) => s.id === r.id);
      return { ...r, favorite: inLib ? inLib.favorite : false };
    });
    title = 'Recently Played';
  } else if (mode && mode.startsWith('playlist:')) {
    const n = mode.slice('playlist:'.length);
    const pl = (lib.playlists || []).find((p) => p.name === n);
    songs = pl ? pl.songs : [];
    title = n;
    currentPlaylistName = n;
    isPlaylist = true;
  }
  if (!isPlaylist) currentPlaylistName = null;
  currentLibMode = mode;
  currentLibSource = songs;
  $('#lib-del').classList.toggle('hidden', !isPlaylist);
  $('#lib-rename').classList.toggle('hidden', !isPlaylist);
  $('#lib-title').textContent = title;
  $('#lib-subtitle').textContent = `${songs.length} nasheed${songs.length !== 1 ? 's' : ''}`;
  $('#lib-actions').classList.toggle('hidden', !songs.length);
  if (!songs.length) {
    $('#lib-list').style.display = 'none';
    $('#lib-empty').style.display = '';
  } else {
    renderList('lib-list', applyLibSort(songs), 'library');
    $('#lib-empty').style.display = 'none';
    $('#lib-list').style.display = '';
  }
}

async function removeFromList(song: Song) {
  if (currentPlaylistName && currentLibMode && currentLibMode.startsWith('playlist:')) {
    const plName = currentPlaylistName;
    const ok = await confirmDialog('Remove from playlist', `Remove "${song.title}" from ${plName}?`);
    if (!ok) return;
    await getJSON<{ ok: boolean }>(`${API}/api/playlists/${encodeURIComponent(plName)}/remove/${song.id}`, { method: 'POST' });
    toast('Removed from ' + plName);
    loadLib('playlist:' + plName);
  } else {
    const ok = await confirmDialog('Remove from library', `Remove "${song.title}" from Your Library?`);
    if (!ok) return;
    await getJSON<{ ok: boolean }>(`${API}/api/library/remove/${song.id}`, { method: 'POST' });
    toast('Removed from Your Library');
    loadLib(currentLibMode ?? 'library');
  }
}

async function toggleFav(song: Song) {
  if (song.kind === 'quran') {
    toast('Quran cannot be liked');
    return;
  }
  await getJSON<{ ok: boolean }>(`${API}/api/library/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  });
  const d = await getJSON<{ favorite: boolean }>(`${API}/api/library/fav/${song.id}`, { method: 'POST' });
  $$<HTMLElement>(`.track-row[data-id="${song.id}"] .fav-act i`).forEach((i) => {
    i.className = d.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
  });
  if (currentSong && currentSong.id === song.id) {
    currentSong.favorite = d.favorite;
    $('#fav-btn i').className = d.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
  }
  toast(d.favorite ? 'Added to Liked Nasheeds' : 'Removed from Liked Nasheeds');
}

async function addToPl(song: Song) {
  await getJSON<{ ok: boolean }>(`${API}/api/library/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  });
  const name = await showPlaylistPicker();
  if (!name) return;
  await getJSON<{ ok: boolean }>(`${API}/api/playlists/${encodeURIComponent(name)}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  });
  loadPlaylists();
  toast('Added to ' + name);
}

// --- PLAYLISTS ---
async function deletePlaylist(name: string): Promise<boolean> {
  const d = await getJSON<{ ok?: boolean }>(`${API}/api/playlists/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return !!d.ok;
}

function activateLibraryNav() {
  $$<HTMLElement>('.nav-item').forEach((n) => n.classList.remove('active'));
  $$<HTMLElement>('.nav-item').find((n) => n.dataset.view === 'library')?.classList.add('active');
  $$('.view').forEach((v) => v.classList.remove('active'));
  $('#library-view').classList.add('active');
}

function gotoLibrary() {
  activateLibraryNav();
  loadLib('library');
}

async function loadPlaylists() {
  const pls = await getJSON<Playlist[]>(`${API}/api/playlists`);
  const nav = $('#playlist-nav');
  nav.innerHTML = '';
  pls.forEach((pl) => {
    const row = document.createElement('div');
    row.className = 'pl-item-row';
    const b = document.createElement('button');
    b.className = 'pl-item';
    b.innerHTML = `<i class="fa-solid fa-list-ul"></i><span>${esc(pl.name)}</span>`;
    b.addEventListener('click', () => {
      activateLibraryNav();
      loadLib('playlist:' + pl.name);
    });
    const del = document.createElement('button');
    del.className = 'pl-del';
    del.title = 'Delete playlist';
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog('Delete playlist', `Delete "${pl.name}"? It will be removed from your playlists.`);
      if (!ok) return;
      if (!(await deletePlaylist(pl.name))) {
        toast('Could not delete playlist');
        return;
      }
      loadPlaylists();
      toast('Deleted playlist: ' + pl.name);
      if (currentPlaylistName === pl.name && $('#library-view').classList.contains('active')) gotoLibrary();
    });
    row.append(b, del);
    nav.appendChild(row);
  });
}

$('#lib-del').addEventListener('click', async () => {
  const name = currentPlaylistName;
  if (!name) return;
  const ok = await confirmDialog('Delete playlist', `Delete "${name}"? It will be removed from your playlists.`);
  if (!ok) return;
  if (!(await deletePlaylist(name))) {
    toast('Could not delete playlist');
    return;
  }
  currentPlaylistName = null;
  loadPlaylists();
  toast('Deleted playlist: ' + name);
  gotoLibrary();
});

$('#lib-rename').addEventListener('click', async () => {
  const oldName = currentPlaylistName;
  if (!oldName) return;
  const newName = await promptText('Rename playlist', 'Playlist name', 'Rename', oldName);
  if (!newName || newName === oldName) return;
  const d = await getJSON<{ ok?: boolean; error?: string }>(`${API}/api/playlists/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old: oldName, new: newName }),
  });
  if (!d.ok) {
    toast(d.error === 'exists' ? 'A playlist with that name already exists' : 'Could not rename playlist');
    return;
  }
  loadPlaylists();
  toast('Renamed to ' + newName);
  loadLib('playlist:' + newName);
});

$('#pl-play').addEventListener('click', () => {
  if (!currentList.length) return;
  const idx = shuffleOn ? Math.floor(Math.random() * currentList.length) : 0;
  playSong(currentList[idx], idx, 'library');
});

$('#shuffle-play-btn').addEventListener('click', () => {
  if (!currentList.length) return;
  if (!shuffleOn) setShuffle(true);
  const idx = Math.floor(Math.random() * currentList.length);
  playSong(currentList[idx], idx, 'library');
});

$('#lib-sort-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#lib-sort-menu').classList.toggle('hidden');
});
$$('.lib-sort-opt').forEach((b) =>
  b.addEventListener('click', () => {
    sortMode = (b.dataset.sort as SortMode) || 'added';
    store('ns_sort', sortMode);
    syncSortUI();
    $('#lib-sort-menu').classList.add('hidden');
    if (currentLibSource.length && $('#library-view').classList.contains('active')) {
      renderList('lib-list', applyLibSort(currentLibSource), 'library');
    }
  })
);
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#lib-sort')) $('#lib-sort-menu').classList.add('hidden');
});

$('#add-pl-btn').addEventListener('click', async () => {
  const name = await promptText('New playlist', 'Playlist name', 'Create');
  if (!name) return;
  await getJSON<{ ok: boolean }>(`${API}/api/playlists/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  loadPlaylists();
  toast('Created playlist: ' + name);
});

// --- DISCORD PRESENCE ---
let discordEnabled = load<boolean>('ns_discord', false);
let dcLastRefresh = 0;

function discHiddenIds(): string[] {
  return load<string[]>('ns_discord_hidden', []);
}
function discIsHidden(id: string): boolean {
  return discHiddenIds().includes(id);
}
function discSetHidden(id: string, hidden: boolean) {
  const set = discHiddenIds().filter((x) => x !== id);
  if (hidden) set.push(id);
  store('ns_discord_hidden', set);
}
function syncDiscBtns(id: string) {
  const hidden = discIsHidden(id);
  $$<HTMLElement>(`.track-row[data-id="${id}"] .disc-act`).forEach((b) => {
    const icon = b.querySelector('i');
    if (icon) icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    b.classList.toggle('disc-hide', hidden);
    b.title = hidden ? 'Hidden from Discord presence' : 'Shown in Discord presence';
  });
}
function discToggleSong(song: Song) {
  const hidden = !discIsHidden(song.id);
  discSetHidden(song.id, hidden);
  syncDiscBtns(song.id);
  toast(hidden ? 'Hidden from Discord presence' : 'Shown in Discord presence');
  if (currentSong && currentSong.id === song.id) pushDiscord(true);
}

function setDiscordStatus(state: 'off' | 'connecting' | 'connected' | 'error') {
  const el = $('#set-discord-status');
  if (!el) return;
  el.classList.remove('ok', 'warn', 'err');
  if (state === 'connected') {
    el.textContent = 'Connected';
    el.classList.add('ok');
  } else if (state === 'connecting') {
    el.textContent = 'Connecting...';
    el.classList.add('warn');
  } else if (state === 'error') {
    el.textContent = 'Discord not running';
    el.classList.add('err');
  } else {
    el.textContent = 'Off';
  }
}

function dcActivity(): Record<string, unknown> | null {
  if (!currentSong || discIsHidden(currentSong.id)) return null;
  return {
    details: currentSong.title,
    state: currentSong.channel || 'Quran',
    timestamps: { start: Date.now() - Math.floor(audio.currentTime * 1000) },
  };
}

function dcPost(body: { enabled: boolean; activity?: Record<string, unknown> | null }) {
  void getJSON<{ ok: boolean }>(`${API}/api/discord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

function pushDiscord(force = false) {
  const now = Date.now();
  if (!discordEnabled || now - dcLastRefresh < (force ? 0 : 30000)) return;
  dcLastRefresh = now;
  dcPost({ enabled: true, activity: dcActivity() });
}

function dcClear() {
  if (!discordEnabled) return;
  dcPost({ enabled: true, activity: null });
}

function pollDiscordStatus() {
  if (!discordEnabled) return;
  void getJSON<{ state?: string }>(`${API}/api/discord/status`)
    .then((d) => {
      if (!discordEnabled) return;
      if (d.state === 'connected') setDiscordStatus('connected');
      else if (d.state === 'connecting') setDiscordStatus('connecting');
      else setDiscordStatus('error');
    })
    .catch(() => {
      if (discordEnabled) setDiscordStatus('error');
    });
}

function syncDiscordUI() {
  ($('#set-discord') as HTMLInputElement).checked = discordEnabled;
  if (discordEnabled) pollDiscordStatus();
  else setDiscordStatus('off');
}

$('#set-discord').addEventListener('change', (e) => {
  discordEnabled = (e.target as HTMLInputElement).checked;
  store('ns_discord', discordEnabled);
  dcLastRefresh = 0;
  if (discordEnabled) {
    pollDiscordStatus();
    pushDiscord(true);
  } else {
    dcPost({ enabled: false, activity: null });
    setDiscordStatus('off');
  }
});

setInterval(pollDiscordStatus, 2000);

// --- SETTINGS ---
let appVersion = '';

type UpdateAsset = { name: string; size: number; url: string };
type UpdateRelease = {
  tag: string;
  name: string;
  prerelease: boolean;
  published_at: string | null;
  asset: UpdateAsset | null;
};
type UpdateStatus = {
  state: string;
  tag: string;
  asset: string;
  downloaded: number;
  total: number;
  path: string;
  error: string;
};
type VersionEntry = {
  tag: string;
  asset: string;
  size: number;
  kind: string;
  active: boolean;
  present: boolean;
};
type VersionsResp = { running: string; active: string; versions: VersionEntry[] };
type UpdatesResp = { current: string; releases: UpdateRelease[]; error?: string | null };

let updateBusy = false;
let updatePoll: number | null = null;
let pendingSwitch = '';

const $settingsVolOrigin = $('#settings-volume-bar');
const settingsVol = new Slider($settingsVolOrigin);

function syncSettingsVol() {
  const p = Math.round(vol.getValue());
  settingsVol.setValue(p);
  $('#set-vol-label').textContent = p + '%';
}

settingsVol.onInput = (p) => {
  audio.volume = p / 100;
  store('ns_vol', Math.round(p));
  vol.setValue(p);
  updateVolIcon();
  $('#set-vol-label').textContent = Math.round(p) + '%';
};

async function loadSettings() {
  try {
    const d = await getJSON<{ version?: string }>(`${API}/api/version`);
    appVersion = d.version || '';
    $('#set-version').textContent = appVersion ? 'v' + appVersion : 'unknown';
  } catch {
    $('#set-version').textContent = 'unknown';
  }
  void refreshVersions();
}

async function loadSidebarVersion() {
  const ver = $('#sidebar-ver');
  try {
    const d = await getJSON<{ version?: string }>(`${API}/api/version`);
    if (d.version) ver.textContent = 'v' + d.version;
  } catch {
    ver.textContent = '';
  }
}

function fmtMB(n: number): string {
  if (!n || n <= 0) return '';
  return (n / 1048576).toFixed(1) + ' MB';
}

function setUpdateBusy(busy: boolean) {
  updateBusy = busy;
  $('#set-check').classList.toggle('disabled', busy);
  $('#set-browse').classList.toggle('disabled', busy);
}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return (await r.json()) as T;
}

async function refreshVersions(): Promise<VersionsResp | null> {
  try {
    const v = await getJSON<VersionsResp>(`${API}/api/versions`);
    $('#set-active').textContent = v.active || 'none';
    return v;
  } catch {
    $('#set-active').textContent = 'unknown';
    return null;
  }
}

async function showVersionPicker() {
  if (updateBusy) {
    toast('A download is already in progress');
    return;
  }
  const note = $('#set-check-note');
  note.textContent = 'Loading versions...';
  let updates: UpdatesResp;
  let local: VersionsResp;
  try {
    [updates, local] = await Promise.all([
      getJSON<UpdatesResp>(`${API}/api/updates`),
      getJSON<VersionsResp>(`${API}/api/versions`),
    ]);
  } catch {
    note.textContent = 'Could not load the version list.';
    return;
  }
  note.textContent = '';
  const installed = new Map(local.versions.map((v) => [v.tag, v]));
  const releases = updates.releases || [];

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    m.close();
  };

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'modal-input';
  input.placeholder = 'Search versions...';
  input.spellcheck = false;
  const count = document.createElement('div');
  count.className = 'modal-hint';
  const list = document.createElement('div');
  list.className = 'modal-list';

  const render = (q: string) => {
    const term = q.trim().toLowerCase();
    const items = releases.filter((r) => !term || r.tag.toLowerCase().includes(term));
    list.innerHTML = '';
    if (!items.length) {
      const h = document.createElement('div');
      h.className = 'modal-hint';
      h.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="margin-right:8px"></i>No versions found';
      list.appendChild(h);
    }
    items.forEach((r) => {
      const local_ = installed.get(r.tag);
      const isInstalled = !!local_ && local_.present;
      const isActive = isInstalled && (local_!.active || r.tag === local.running);
      const marks: string[] = [];
      if (r.prerelease) marks.push('pre-release');
      if (isActive) marks.push('active');
      else if (isInstalled) marks.push('installed');
      else if (!r.asset) marks.push('no installer for this platform');

      const row = document.createElement('div');
      row.className = 'version-opt' + (isActive ? ' active' : '');
      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'version-opt-main';
      main.disabled = !r.asset && !isInstalled;
      main.innerHTML =
        '<i class="fa-solid ' +
        (isActive ? 'fa-circle-check' : isInstalled ? 'fa-hard-drive' : 'fa-cloud-arrow-down') +
        '"></i><span class="version-opt-text"><span class="version-opt-name">' +
        esc(r.tag) +
        '</span>' +
        (marks.length ? '<span class="version-opt-mark">' + esc(marks.join(', ')) + '</span>' : '') +
        '</span>';
      main.addEventListener('click', () => {
        finish();
        if (isActive) {
          toast('Already on ' + r.tag);
        } else if (isInstalled) {
          void switchTo(r.tag);
        } else {
          void installVersion(r.tag);
        }
      });
      row.appendChild(main);
      if (isInstalled && !isActive) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'version-opt-remove';
        rm.title = 'Remove this downloaded version';
        rm.innerHTML = '<i class="fa-solid fa-trash"></i>';
        rm.addEventListener('click', async () => {
          const d = await postJSON<{ ok?: boolean; error?: string }>('/api/versions/remove', { tag: r.tag });
          toast(d.ok ? 'Removed ' + r.tag : d.error || 'Could not remove it');
          finish();
          void refreshVersions();
        });
        row.appendChild(rm);
      }
      list.appendChild(row);
    });
    count.textContent = term
      ? `${items.length} of ${releases.length} versions`
      : `${releases.length} versions`;
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = list.querySelector<HTMLButtonElement>('.version-opt-main:not([disabled])');
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
  });
  const body = document.createElement('div');
  body.className = 'modal-body reciter-picker';
  body.append(input, count, list);
  const m = new Modal('Choose version', body, () => finish(), 'modal-reciter');
  render('');
  window.setTimeout(() => input.focus(), 30);
}

async function switchTo(tag: string) {
  const note = $('#set-check-note');
  note.textContent = 'Switching to ' + tag + '...';
  try {
    const d = await postJSON<{ ok?: boolean; error?: string }>('/api/versions/switch', { tag });
    if (!d.ok) {
      note.textContent = d.error || 'Could not switch versions.';
      toast(d.error || 'Could not switch');
      return;
    }
    await refreshVersions();
    note.innerHTML = 'Active version is now <b>' + esc(tag) + '</b>. Restart Quran to run it.';
    toast('Switched to ' + tag);
  } catch {
    note.textContent = 'Could not reach the updater.';
  }
}

async function installVersion(tag: string) {
  const note = $('#set-check-note');
  setUpdateBusy(true);
  note.textContent = 'Starting download of ' + tag + '...';
  try {
    const d = await postJSON<{ ok?: boolean; error?: string; cached?: boolean }>('/api/update', { tag });
    if (!d.ok) {
      note.textContent = d.error || 'Could not start the download.';
      setUpdateBusy(false);
      return;
    }
    if (d.cached) {
      setUpdateBusy(false);
      await switchTo(tag);
      return;
    }
    pendingSwitch = tag;
    startUpdatePoll();
  } catch {
    note.textContent = 'Could not reach the updater.';
    setUpdateBusy(false);
  }
}

function startUpdatePoll() {
  if (updatePoll !== null) return;
  updatePoll = window.setInterval(pollUpdate, 700);
  void pollUpdate();
}

function stopUpdatePoll() {
  if (updatePoll !== null) {
    clearInterval(updatePoll);
    updatePoll = null;
  }
}

async function pollUpdate() {
  let s: UpdateStatus;
  try {
    s = await getJSON<UpdateStatus>(`${API}/api/update/status`);
  } catch {
    return;
  }
  const wrap = $('#set-progress-wrap');
  const fill = $('#set-progress-fill');
  const text = $('#set-progress-text');
  const note = $('#set-check-note');
  if (s.state === 'downloading') {
    wrap.hidden = false;
    const pct = s.total ? Math.round((s.downloaded / s.total) * 100) : 0;
    fill.style.width = pct + '%';
    text.textContent =
      'Downloading ' + s.asset + '  ' + fmtMB(s.downloaded) + (s.total ? ' / ' + fmtMB(s.total) + ' (' + pct + '%)' : '');
    note.textContent = 'Downloading ' + s.tag + '...';
    setUpdateBusy(true);
    return;
  }
  stopUpdatePoll();
  setUpdateBusy(false);
  wrap.hidden = true;
  if (s.state === 'downloaded') {
    await refreshVersions();
    const tag = pendingSwitch || s.tag;
    pendingSwitch = '';
    await switchTo(tag);
  } else if (s.state === 'error') {
    pendingSwitch = '';
    note.textContent = 'Update failed: ' + (s.error || 'unknown error');
  }
}

$('#set-browse').addEventListener('click', () => {
  void showVersionPicker();
});

$('#set-check').addEventListener('click', async () => {
  if (updateBusy) return;
  const note = $('#set-check-note');
  note.textContent = 'Refreshing...';
  await getJSON<UpdatesResp>(`${API}/api/updates?refresh=1`).catch(() => null);
  await refreshVersions();
  note.textContent = 'Version list refreshed.';
});

try {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      audio.play().catch(playError);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => $('#prev-btn').click());
    navigator.mediaSession.setActionHandler('nexttrack', () => $('#next-btn').click());
  }
} catch {}

loopMode = load<LoopMode>('ns_loop', 'off');
$('#loop-btn').classList.toggle('active', loopMode !== 'off');
$('#loop-btn').title = loopMode === 'one' ? 'Loop: one' : 'Loop: off';
shuffleOn = load<boolean>('ns_shuffle', false);
$('#shuffle-btn').classList.toggle('active', shuffleOn);
$('#shuffle-btn').title = shuffleOn ? 'Shuffle: on' : 'Shuffle: off';
sortMode = load<SortMode>('ns_sort', 'added');
syncSortUI();
updateVolIcon();
renderRecentQ();
syncSearchUI();
loadPlaylists();
void loadQuranReciters();
syncSettingsVol();
syncDiscordUI();
void loadSidebarVersion();