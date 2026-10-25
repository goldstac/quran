"use strict";
const API = '';
const audio = new Audio();
let queue = [];
let queueIdx = -1;
let loopMode = 'off';
let currentSong = null;
let progressDrag = false;
let currentList = [];
let currentPlaylistName = null;
let shuffleOn = false;
let preShuffleQueue = [];
let currentLibMode;
let currentLibSource = [];
let sortMode = 'added';
let startingId = null;
let buffering = false;
const downloadedIds = new Set();
const dlActive = new Set();
let dlPollTimer;
const SORT_LABELS = {
    added: 'Recently added',
    title: 'Title A–Z',
    channel: 'Channel',
};
function $(s) {
    const el = document.querySelector(s);
    if (!el)
        throw new Error('missing element: ' + s);
    return el;
}
function $$(s) {
    return Array.from(document.querySelectorAll(s));
}
function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmt(s) {
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
async function getJSON(url, init) {
    const r = await fetch(url, init);
    return r.json();
}
function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}
function store(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    }
    catch { }
}
function load(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
function shuffleArr(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}
function recordRecent(song) {
    const list = load('ns_recent', []).filter((s) => s.id !== song.id);
    list.unshift(song);
    store('ns_recent', list.slice(0, 50));
}
class Modal {
    constructor(title, content, onClose, className) {
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
            if (e.target === this.backdrop)
                this.close();
        });
        this.backdrop.addEventListener('keydown', (e) => {
            if (e.key === 'Escape')
                this.close();
        }, true);
        document.body.appendChild(this.backdrop);
        this.panel.focus();
    }
    close() {
        this.backdrop.remove();
        this.onCloseCb?.();
    }
}
function promptText(title, placeholder, okLabel, value = '') {
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
            if (done)
                return;
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
            if (e.key === 'Enter')
                submit();
        });
        window.setTimeout(() => input.focus(), 30);
    });
}
function confirmDialog(title, message) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
            if (done)
                return;
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
async function showPlaylistPicker() {
    const pls = await getJSON(`${API}/api/playlists`);
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
            if (done)
                return;
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
        }
        else {
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
            await getJSON(`${API}/api/playlists/create`, {
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
    if (!quranReciters.length)
        return;
    let done = false;
    const finish = () => {
        if (done)
            return;
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
    const render = (q) => {
        const term = q.trim().toLowerCase();
        const items = quranReciters.filter((r) => !term ||
            (r.label || '').toLowerCase().includes(term) ||
            r.reciter_name.toLowerCase().includes(term) ||
            (r.style || '').toLowerCase().includes(term));
        list.innerHTML = '';
        if (!items.length) {
            const h = document.createElement('div');
            h.className = 'modal-hint';
            h.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="margin-right:8px"></i>No reciters found';
            list.appendChild(h);
        }
        else {
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
            const first = list.querySelector('.reciter-opt');
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
    constructor(container) {
        this.value = 0;
        this.dragging = false;
        this.onInput = null;
        this.onChange = null;
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
    pos(pct) {
        const rect = this.root.getBoundingClientRect();
        let p = ((pct - rect.left) / rect.width) * 100;
        return Math.max(0, Math.min(100, p));
    }
    onDown(e) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse')
            return;
        this.dragging = true;
        this.root.classList.add('dragging');
        this.root.setPointerCapture(e.pointerId);
        this.setValue(this.pos(e.clientX));
        this.onInput?.(this.value);
    }
    onMove(e) {
        if (!this.dragging)
            return;
        this.setValue(this.pos(e.clientX));
        this.onInput?.(this.value);
    }
    onUp(e) {
        if (!this.dragging)
            return;
        this.setValue(this.pos(e.clientX));
        this.onInput?.(this.value);
        this.endDrag();
        this.onChange?.();
    }
    endDrag() {
        this.dragging = false;
        this.root.classList.remove('dragging');
    }
    onKey(e) {
        let d = 0;
        if (e.key === 'ArrowRight')
            d = 1;
        else if (e.key === 'ArrowLeft')
            d = -1;
        else if (e.key === 'PageUp')
            d = 10;
        else if (e.key === 'PageDown')
            d = -10;
        else if (e.key === 'Home')
            d = -100;
        else if (e.key === 'End')
            d = 100;
        if (d) {
            e.preventDefault();
            const v = this.value + d;
            this.setValue(Math.max(0, Math.min(100, v)));
            this.onInput?.(this.value);
            this.onChange?.();
        }
    }
    setValue(v) {
        this.value = Math.max(0, Math.min(100, v));
        this.fill.style.width = this.value + '%';
        this.thumb.style.left = this.value + '%';
        this.root.setAttribute('aria-valuenow', String(Math.round(this.value)));
        return this.value;
    }
    getValue() {
        return this.value;
    }
}
const $seekOrigin = $('#progress-bar');
const seek = new Slider($seekOrigin);
const $volOrigin = $('#volume-bar');
const vol = new Slider($volOrigin);
// --- NAVIGATION ---
function setSidebarOpen(open) {
    $('#sidebar').classList.toggle('open', open);
    $('#sidebar-backdrop').classList.toggle('show', open);
}
$('#menu-btn').addEventListener('click', () => setSidebarOpen(true));
$('#menu-close').addEventListener('click', () => setSidebarOpen(false));
$('#sidebar-backdrop').addEventListener('click', () => setSidebarOpen(false));
$('#playlist-nav').addEventListener('click', () => setSidebarOpen(false));
$$('.nav-item').forEach((btn) => btn.addEventListener('click', () => {
    setSidebarOpen(false);
    $$('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.view;
    $$('.view').forEach((el) => el.classList.remove('active'));
    if (v === 'search') {
        $('#search-view').classList.add('active');
    }
    else if (v === 'quran') {
        $('#quran-view').classList.add('active');
        loadQuran();
    }
    else if (v === 'settings') {
        $('#settings-view').classList.add('active');
        void loadSettings();
    }
    else {
        $('#library-view').classList.add('active');
        loadLib(v);
    }
}));
const QURAN_DEFAULT_RECITER = '123';
let quranChapters = [];
let quranLoaded = false;
let quranReciters = [];
let quranReciterId = Number(QURAN_DEFAULT_RECITER);
function quranReciterName(id) {
    const r = quranReciters.find((x) => x.id === id);
    return r ? r.label || r.reciter_name : 'Quran';
}
function currentQuranReciterId() {
    return quranReciterId;
}
function quranReciterIndex() {
    return quranReciters.findIndex((r) => r.id === quranReciterId);
}
function buildQuranSong(ch, reciterId) {
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
function quranSongs() {
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
    const chips = Array.from(scroller.querySelectorAll('.quran-reciter-chip'));
    chips.forEach((chip) => {
        const on = Number(chip.dataset.id) === quranReciterId;
        chip.classList.toggle('active', on);
        chip.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const idx = quranReciterIndex();
    const pos = $('#quran-reciter-pos');
    if (quranReciters.length) {
        pos.textContent = `${idx >= 0 ? idx + 1 : 1} / ${quranReciters.length}`;
    }
    else {
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
function applyQuranReciter(id, scroll = true) {
    if (!quranReciters.some((r) => r.id === id))
        return;
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
function stepQuranReciter(delta) {
    if (!quranReciters.length)
        return;
    let i = quranReciterIndex();
    if (i < 0)
        i = 0;
    const next = Math.max(0, Math.min(quranReciters.length - 1, i + delta));
    applyQuranReciter(quranReciters[next].id, true);
}
// --- QURAN AYAH READER ---
let transLang = load('ns_qtrans', 'en');
let transDataLang = transLang === 'off' ? 'en' : transLang;
const transCache = new Map();
let transLoadedKey = '';
let transAyahIdx = -1;
function transHint(text) {
    $('#quran-trans-body').innerHTML = `<div class="quran-trans-hint">${esc(text)}</div>`;
    $('#quran-trans-body').classList.remove('hide-tr');
    $('#quran-trans-src').textContent = '';
    $('#quran-ayah-pos').textContent = '';
    $('#ayah-prev').toggleAttribute('disabled', true);
    $('#ayah-next').toggleAttribute('disabled', true);
}
function seekToAyah(num) {
    const rows = $$('.quran-trans-body .quran-ayah');
    const n = rows.length;
    if (!n || !audio.duration || currentSong?.kind !== 'quran')
        return;
    const target = Math.max(0, Math.min(num - 1, n - 1));
    audio.currentTime = ((target + 0.01) / n) * audio.duration;
    audio.play().catch(playError);
}
function highlightTransAyah(scroll) {
    if (!currentSong || currentSong.kind !== 'quran')
        return;
    const rows = $$('.quran-trans-body .quran-ayah');
    if (!rows.length)
        return;
    const dur = audio.duration || currentSong.duration || 0;
    if (!dur)
        return;
    let idx = Math.floor((audio.currentTime / dur) * rows.length);
    if (idx < 0)
        idx = 0;
    if (idx >= rows.length)
        idx = rows.length - 1;
    if (idx === transAyahIdx)
        return;
    transAyahIdx = idx;
    rows.forEach((r, i) => r.classList.toggle('active', i === idx));
    $('#quran-ayah-pos').textContent = `${idx + 1} / ${rows.length}`;
    $('#ayah-prev').toggleAttribute('disabled', idx <= 0);
    $('#ayah-next').toggleAttribute('disabled', idx >= rows.length - 1);
    if (scroll)
        rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    if (key === transLoadedKey)
        return;
    transLoadedKey = key;
    transAyahIdx = -1;
    $('#quran-trans-src').textContent = '';
    $('#quran-ayah-pos').textContent = '';
    $('#ayah-prev').toggleAttribute('disabled', true);
    $('#ayah-next').toggleAttribute('disabled', true);
    body.innerHTML = '<div class="quran-trans-hint">Loading ayahs...</div>';
    const render = (data) => {
        if (transLoadedKey !== key)
            return;
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
        <div class="quran-ayah-ar" dir="rtl">${esc(v.arabic)}<span class="quran-ayah-badge">${esc(String(v.num))}</span></div>
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
            if (!r.ok)
                throw new Error('trans');
            const d = (await r.json());
            const data = { name: d.name || '', verses: d.verses || [] };
            transCache.set(key, data);
            render(data);
        }
        catch {
            if (transLoadedKey === key) {
                transLoadedKey = '';
                transHint('Could not load ayahs');
            }
        }
    })();
}
$$('.quran-trans-lang').forEach((b) => b.addEventListener('click', () => {
    transLang = b.dataset.lang || 'en';
    if (transLang !== 'off')
        transDataLang = transLang;
    store('ns_qtrans', transLang);
    transLoadedKey = '';
    syncQuranTranslation();
}));
$('#ayah-prev').addEventListener('click', () => {
    if (transAyahIdx > 0)
        seekToAyah(transAyahIdx);
});
$('#ayah-next').addEventListener('click', () => {
    const n = $$('.quran-trans-body .quran-ayah').length;
    if (transAyahIdx >= 0 && transAyahIdx < n - 1)
        seekToAyah(transAyahIdx + 2);
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
let quranRecitersPromise = null;
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
            if (!r.ok)
                throw new Error('reciters');
            const data = (await r.json());
            quranReciters = data.recitations || [];
        }
        catch {
            quranReciters = [
                { id: Number(QURAN_DEFAULT_RECITER), reciter_name: 'Mishary Alafasi', label: 'Mishary Alafasi' },
            ];
        }
        const saved = Number(load('ns_qreciter', QURAN_DEFAULT_RECITER));
        if (quranReciters.some((r) => r.id === saved)) {
            quranReciterId = saved;
        }
        else {
            const preferred = quranReciters.find((r) => r.id === Number(QURAN_DEFAULT_RECITER)) ||
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
    }
    finally {
        quranRecitersPromise = null;
    }
}
let quranLoadPromise = null;
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
            if (!r.ok)
                throw new Error('chapters');
            const data = (await r.json());
            quranChapters = data.chapters || [];
            quranLoaded = true;
            $('#quran-loading').style.display = 'none';
            renderQuranList();
        }
        catch {
            $('#quran-loading').style.display = 'none';
            $('#quran-list').style.display = 'none';
            $('#quran-empty').style.display = '';
            $('#quran-actions').classList.add('hidden');
        }
    })();
    try {
        await quranLoadPromise;
    }
    finally {
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
    }
    else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepQuranReciter(-1);
    }
    else if (e.key === 'Home') {
        e.preventDefault();
        if (quranReciters[0])
            applyQuranReciter(quranReciters[0].id, true);
    }
    else if (e.key === 'End') {
        e.preventDefault();
        const last = quranReciters[quranReciters.length - 1];
        if (last)
            applyQuranReciter(last.id, true);
    }
});
$('#quran-reciter-scroller').addEventListener('wheel', (e) => {
    const el = e.currentTarget;
    if (!el)
        return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
    }
}, { passive: false });
$('#quran-retry').addEventListener('click', () => void loadQuran());
$('#quran-play').addEventListener('click', () => {
    const songs = quranSongs();
    if (!songs.length)
        return;
    const idx = shuffleOn ? Math.floor(Math.random() * songs.length) : 0;
    playSong(songs[idx], idx, 'quran');
});
$('#quran-shuffle').addEventListener('click', () => {
    const songs = quranSongs();
    if (!songs.length)
        return;
    if (!shuffleOn)
        setShuffle(true);
    const idx = Math.floor(Math.random() * songs.length);
    playSong(songs[idx], idx, 'quran');
});
// --- SEARCH ---
let searchTimer;
function syncSearchUI() {
    const hasQ = !!($('#search-input').value.trim());
    $('#search-clear').classList.toggle('hidden', !hasQ);
    const box = $('#recent-q');
    if (hasQ || !box.children.length)
        box.classList.add('hidden');
    else
        box.classList.remove('hidden');
}
function saveRecentQ(q) {
    const list = load('ns_recentq', []).filter((x) => x !== q);
    list.unshift(q);
    store('ns_recentq', list.slice(0, 8));
}
function renderRecentQ() {
    const qs = load('ns_recentq', []);
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
            $('#search-input').value = q;
            syncSearchUI();
            doSearch(q);
        });
        box.appendChild(chip);
    });
}
$('#search-input').addEventListener('input', (e) => {
    syncSearchUI();
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (!q) {
        showEmpty();
        return;
    }
    searchTimer = window.setTimeout(() => doSearch(q), 350);
});
$('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(searchTimer);
        const q = e.target.value.trim();
        if (q)
            doSearch(q);
    }
    else if (e.key === 'Escape') {
        e.target.value = '';
        clearTimeout(searchTimer);
        showEmpty();
        syncSearchUI();
    }
});
$('#search-clear').addEventListener('click', () => {
    $('#search-input').value = '';
    clearTimeout(searchTimer);
    showEmpty();
    syncSearchUI();
    $('#search-input').focus();
});
async function doSearch(q) {
    show('loading');
    $('#search-status').textContent = '';
    try {
        const data = await getJSON(`${API}/api/search?q=${encodeURIComponent(q)}`);
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
    }
    catch {
        showEmpty('Search failed');
    }
}
function showEmpty(msg) {
    $('#search-loading').style.display = 'none';
    $('#search-results').style.display = 'none';
    $('#search-empty').style.display = '';
    if (msg) {
        const t = $('#search-empty').querySelector('.empty-title');
        if (t)
            t.textContent = msg;
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
function thumbSrc(song) {
    const t = song.thumbnail || '';
    if (t.startsWith('/') || t.startsWith('https://') || t.startsWith('http://'))
        return esc(t);
    return '';
}
function makeRow(song, idx, ctx) {
    const r = document.createElement('div');
    r.className = 'track-row';
    r.dataset.id = song.id;
    if (currentSong && currentSong.id === song.id)
        r.classList.add('playing');
    const isQuran = ctx === 'quran' || song.kind === 'quran';
    const isLocal = !!song.local;
    const canRemove = ctx !== 'search' && !isQuran;
    const heart = song.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
    const sub = isQuran
        ? `<span class="track-ar">${esc(song.arabic || '')}</span><span class="track-ayahs">${song.verses_count ? `${esc(String(song.verses_count))} ayahs` : ''}</span>`
        : esc(song.channel);
    if (isQuran)
        r.classList.add('quran-row');
    r.innerHTML = `
    ${isQuran
        ? `<div class="track-num">${esc(String(song.chapter_id ?? idx + 1))}</div>`
        : song.local && !song.thumbnail
            ? `<div class="track-thumb track-thumb-ph"><i class="fa-solid fa-music"></i></div>`
            : `<img class="track-thumb" src="${thumbSrc(song)}" loading="lazy" alt="">`}
    <div class="track-info">
      <div class="track-name">${esc(song.title)}</div>
      <div class="track-channel">${sub}</div>
    </div>
    ${song.duration_string ? `<span class="track-dur">${esc(song.duration_string)}</span>` : ''}
    <div class="track-actions">
      <button class="track-act play-act" title="Play"><i class="fa-solid fa-play"></i></button>
      ${canRemove ? '<button class="track-act rem-act" title="Remove"><i class="fa-solid fa-trash"></i></button>' : ''}
      ${isQuran ? '' : `<button class="track-act fav-act" title="Like"><i class="${heart}"></i></button>
      <button class="track-act pl-act" title="Add to playlist"><i class="fa-solid fa-plus"></i></button>
      ${isLocal ? '' : '<button class="track-act dl-act" title="Download for offline"><i class="fa-solid fa-download"></i></button>'}
      ${isLocal ? '' : '<button class="track-act yt-act" title="See on YouTube"><i class="fa-brands fa-youtube"></i></button>'}
      <button class="track-act disc-act" title="Shown in Discord"><i class="fa-solid fa-eye"></i></button>`}
    </div>`;
    const rowImg = r.querySelector('img.track-thumb');
    if (rowImg) {
        const hideImg = () => { rowImg.style.display = 'none'; };
        rowImg.addEventListener('error', hideImg);
        if (rowImg.complete && rowImg.naturalWidth === 0)
            hideImg();
    }
    r.addEventListener('dblclick', () => playSong(song, idx, ctx));
    let warmTimer;
    if (!isQuran) {
        r.addEventListener('mouseenter', () => {
            warmTimer = window.setTimeout(() => warm(song.id), 150);
        });
        r.addEventListener('mouseleave', () => clearTimeout(warmTimer));
    }
    r.querySelector('.play-act').addEventListener('click', (e) => { e.stopPropagation(); playSong(song, idx, ctx); });
    if (!isQuran) {
        r.querySelector('.fav-act').addEventListener('click', (e) => { e.stopPropagation(); toggleFav(song); });
        r.querySelector('.pl-act').addEventListener('click', (e) => { e.stopPropagation(); addToPl(song); });
        const ytBtn = r.querySelector('.yt-act');
        if (ytBtn) {
            ytBtn.addEventListener('click', (e) => { e.stopPropagation(); seeOnYouTube(song); });
        }
        const dlBtn = r.querySelector('.dl-act');
        if (dlBtn) {
            dlBtnUi(dlBtn, song.id);
            dlBtn.addEventListener('click', (e) => { e.stopPropagation(); void dlAction(song); });
        }
        const discBtn = r.querySelector('.disc-act');
        if (discBtn) {
            const hidden = discIsHidden(song.id);
            const icon = discBtn.querySelector('i');
            if (icon)
                icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            discBtn.classList.toggle('disc-hide', hidden);
            discBtn.title = hidden ? 'Hidden from Discord' : 'Shown in Discord';
            discBtn.addEventListener('click', (e) => { e.stopPropagation(); discToggleSong(song); });
        }
    }
    if (canRemove) {
        r.querySelector('.rem-act').addEventListener('click', (e) => { e.stopPropagation(); removeFromList(song); });
    }
    return r;
}
// --- PLAYBACK ---
const warmed = new Set();
function warm(id) {
    if (id.startsWith('local-') || downloadedIds.has(id))
        return;
    if (warmed.has(id))
        return;
    warmed.add(id);
    fetch(`${API}/api/warm/${encodeURIComponent(id)}`).then((r) => {
        if (!r.ok)
            warmed.delete(id);
    }).catch(() => warmed.delete(id));
}
// --- DOWNLOADS ---
function dlBtnUi(btn, id) {
    const active = dlActive.has(id);
    const done = downloadedIds.has(id);
    btn.classList.toggle('dl-active', active);
    btn.classList.toggle('dl-done', done);
    const i = btn.querySelector('i');
    if (i) {
        i.className = active
            ? 'fa-solid fa-arrows-rotate fa-spin'
            : done
                ? 'fa-solid fa-circle-check'
                : 'fa-solid fa-download';
    }
    btn.title = active ? 'Downloading, click to cancel' : done ? 'Downloaded, click to remove' : 'Download for offline';
}
function refreshDl(id) {
    $$(`.track-row[data-id="${CSS.escape(id)}"] .dl-act`).forEach((b) => dlBtnUi(b, id));
    if (currentSong && currentSong.id === id)
        dlBtnUi($('#dl-btn'), id);
}
async function dlAction(song) {
    if (song.kind === 'quran' || song.local)
        return;
    if (dlActive.has(song.id)) {
        await getJSON(`${API}/api/download/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: song.id }),
        }).catch(() => undefined);
        dlActive.delete(song.id);
        refreshDl(song.id);
        toast('Download canceled');
        return;
    }
    if (downloadedIds.has(song.id)) {
        const ok = await confirmDialog('Remove download', `Remove the downloaded copy of "${song.title}"? It will need wifi to play again.`);
        if (!ok)
            return;
        await getJSON(`${API}/api/download/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: song.id }),
        }).catch(() => undefined);
        downloadedIds.delete(song.id);
        if (currentSong && currentSong.id === song.id)
            currentSong.downloaded = false;
        refreshDl(song.id);
        toast('Download removed');
        return;
    }
    await getJSON(`${API}/api/library/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
    }).catch(() => undefined);
    const r = await getJSON(`${API}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: song.id }),
    }).catch(() => ({ error: 'failed' }));
    if (r.error || r.ok === false) {
        toast('Could not start download');
        return;
    }
    dlActive.add(song.id);
    refreshDl(song.id);
    toast(`Downloading "${song.title}"`);
    startDlPoll();
}
function startDlPoll() {
    if (dlPollTimer)
        return;
    dlPollTimer = window.setInterval(() => void pollDownloads(), 1000);
}
async function pollDownloads() {
    const d = await getJSON(`${API}/api/download/status`).catch(() => null);
    if (!d)
        return;
    let active = 0;
    for (const id of Object.keys(d.downloads || {})) {
        const st = d.downloads[id];
        if (st.state === 'downloading') {
            active++;
            if (!dlActive.has(id)) {
                dlActive.add(id);
                refreshDl(id);
            }
        }
        else if (st.state === 'done') {
            if (dlActive.has(id))
                toast('Downloaded. Plays without wifi now');
            dlActive.delete(id);
            downloadedIds.add(id);
            if (currentSong && currentSong.id === id)
                currentSong.downloaded = true;
            refreshDl(id);
        }
        else if (st.state === 'error') {
            if (dlActive.has(id))
                toast('Download failed' + (st.error ? `: ${st.error}` : ''));
            dlActive.delete(id);
            refreshDl(id);
        }
    }
    if (!active && dlPollTimer) {
        window.clearInterval(dlPollTimer);
        dlPollTimer = undefined;
    }
}
async function initDownloads() {
    try {
        const lib = await getJSON(`${API}/api/library`);
        (lib.songs || []).forEach((s) => {
            if (s.downloaded || s.local)
                downloadedIds.add(s.id);
        });
    }
    catch { }
    void pollDownloads();
}
function syncIcons() {
    const paused = audio.paused;
    $('#buf-icon').classList.toggle('hidden', !buffering);
    $('#play-icon').classList.toggle('hidden', !paused || buffering);
    $('#pause-icon').classList.toggle('hidden', paused || buffering);
}
function setBuffering(on) {
    buffering = on;
    syncIcons();
}
function playError(e) {
    const name = e?.name;
    if (name === 'AbortError')
        return;
    setBuffering(false);
    if (name === 'NotAllowedError')
        toast('Click play to start');
}
function songSrc(song) {
    if (song.kind === 'quran') {
        if (song.stream_url)
            return song.stream_url;
        const reciter = song.reciter_id ?? currentQuranReciterId();
        const chapter = song.chapter_id ?? 1;
        return `${API}/api/quran/chapter_audio/${reciter}/${chapter}`;
    }
    if (song.local)
        return `${API}/api/file/${encodeURIComponent(song.id)}`;
    return `${API}/api/proxy/${encodeURIComponent(song.id)}`;
}
async function ensureQuranSrc(song) {
    if (song.kind !== 'quran')
        return songSrc(song);
    if (song.stream_url)
        return song.stream_url;
    const reciter = song.reciter_id ?? currentQuranReciterId();
    const chapter = song.chapter_id ?? 1;
    const r = await fetch(`${API}/api/quran/chapter_audio/${reciter}/${chapter}`);
    if (!r.ok)
        throw new Error('quran audio');
    const data = (await r.json());
    if (!data.url)
        throw new Error('quran audio');
    const nowReciter = song.reciter_id ?? currentQuranReciterId();
    if (nowReciter !== reciter)
        throw new Error('quran audio');
    song.stream_url = data.url;
    return data.url;
}
async function playSong(song, idx, _ctx, keepQueue = false) {
    if (startingId === song.id && !audio.error) {
        audio.play().catch(playError);
        return;
    }
    currentSong = song;
    if (keepQueue) {
        queueIdx = idx;
    }
    else {
        const base = currentList.length ? currentList : queue.slice();
        if (shuffleOn && base.length > 1) {
            preShuffleQueue = base.slice();
            queue = [song, ...shuffleArr(base.filter((s) => s.id !== song.id))];
            queueIdx = 0;
        }
        else {
            queue = base;
            queueIdx = idx;
        }
    }
    if (song.kind !== 'quran')
        recordRecent(song);
    updatePlayer();
    pushDiscord(true);
    botLastRefresh = 0;
    reportEvent(discIsHidden(song.id) ? 'hidden' : 'start', song);
    $$('.track-row').forEach((r) => r.classList.toggle('playing', r.dataset.id === song.id));
    startingId = song.id;
    setBuffering(true);
    try {
        if (song.kind === 'quran') {
            const src = await ensureQuranSrc(song);
            if (currentSong?.id !== song.id)
                return;
            audio.src = src;
        }
        else {
            audio.src = songSrc(song);
        }
        audio.load();
        audio.play().catch(playError);
    }
    catch {
        startingId = null;
        setBuffering(false);
        toast('Could not load Quran audio');
        return;
    }
    if (song.kind !== 'quran') {
        getJSON(`${API}/api/library/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(song),
        });
    }
}
function updatePlayer() {
    if (!currentSong)
        return;
    $('#player-title').textContent = currentSong.title;
    $('#player-artist').textContent = currentSong.channel;
    const th = $('#player-thumb');
    const ph = $('#player-thumb-ph');
    if (currentSong.thumbnail) {
        th.src = currentSong.thumbnail;
        th.style.display = 'block';
        ph.style.display = 'none';
    }
    else {
        th.removeAttribute('src');
        th.style.display = 'none';
        ph.style.display = '';
        const icon = ph.querySelector('i');
        if (icon)
            icon.className = currentSong.kind === 'quran' ? 'fa-solid fa-book-quran' : 'fa-solid fa-music';
    }
    $('#fav-btn i').className = currentSong.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
    $('#yt-btn').classList.toggle('hidden', currentSong.kind === 'quran' || !!currentSong.local);
    const dlBtn = $('#dl-btn');
    const canDownload = currentSong.kind !== 'quran' && !currentSong.local;
    dlBtn.classList.toggle('hidden', !canDownload);
    if (canDownload)
        dlBtnUi(dlBtn, currentSong.id);
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
$('#yt-btn').addEventListener('click', () => {
    if (!currentSong || currentSong.kind === 'quran' || currentSong.local)
        return;
    seeOnYouTube(currentSong);
});
$('#dl-btn').addEventListener('click', () => {
    if (!currentSong || currentSong.kind === 'quran' || currentSong.local)
        return;
    void dlAction(currentSong);
});
$('#fav-btn').addEventListener('click', () => {
    if (!currentSong)
        return;
    if (currentSong.kind === 'quran') {
        toast('Quran cannot be liked');
        return;
    }
    void toggleFav(currentSong);
});
$('#play-btn').addEventListener('click', () => {
    if (audio.paused && audio.src) {
        audio.play().catch(playError);
    }
    else if (!audio.paused) {
        audio.pause();
    }
});
$('#stop-btn').addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    resetPlayer();
});
$('#prev-btn').addEventListener('click', () => {
    if (!queue.length)
        return;
    if (queueIdx > 0) {
        playSong(queue[queueIdx - 1], queueIdx - 1, 'search', true);
    }
    else {
        queueIdx = queue.length - 1;
        playSong(queue[queueIdx], queueIdx, 'search', true);
    }
});
$('#next-btn').addEventListener('click', nextTrack);
$('#shuffle-btn').addEventListener('click', () => {
    setShuffle(!shuffleOn);
    toast(shuffleOn ? 'Shuffle on' : 'Shuffle off');
});
function setShuffle(on) {
    shuffleOn = on;
    store('ns_shuffle', on);
    const btn = $('#shuffle-btn');
    btn.classList.toggle('active', on);
    btn.title = on ? 'Shuffle: on' : 'Shuffle: off';
    const cur = currentSong;
    if (!cur || !queue.length)
        return;
    if (on) {
        preShuffleQueue = queue.slice();
        queue = [...queue.slice(0, queueIdx + 1), ...shuffleArr(queue.slice(queueIdx + 1))];
    }
    else if (preShuffleQueue.length) {
        queue = preShuffleQueue;
        const i = queue.findIndex((s) => s.id === cur.id);
        if (i >= 0)
            queueIdx = i;
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
    if (!queue.length)
        return;
    if (queueIdx < queue.length - 1) {
        playSong(queue[queueIdx + 1], queueIdx + 1, 'search', true);
    }
    else {
        resetPlayer();
    }
}
audio.addEventListener('ended', () => {
    if (loopMode === 'one' && currentSong) {
        const cur = currentSong;
        audio.currentTime = 0;
        audio.play().catch(() => playSong(cur, queueIdx, 'search', true));
    }
    else if (queueIdx < queue.length - 1) {
        playSong(queue[queueIdx + 1], queueIdx + 1, 'search', true);
    }
    else {
        resetPlayer();
    }
});
audio.addEventListener('play', () => {
    syncIcons();
    dcLastRefresh = 0;
    pushDiscord(true);
    botLastRefresh = 0;
    reportEvent('resume');
});
audio.addEventListener('loadedmetadata', () => {
    if (!audio.paused) {
        dcLastRefresh = 0;
        pushDiscord(true);
    }
});
audio.addEventListener('pause', () => {
    startingId = null;
    setBuffering(false);
    if (discordEnabled)
        dcPause();
    reportEvent('pause');
});
audio.addEventListener('playing', () => {
    startingId = null;
    setBuffering(false);
});
audio.addEventListener('waiting', () => setBuffering(true));
audio.addEventListener('error', () => {
    startingId = null;
    setBuffering(false);
    if (audio.src)
        toast(currentSong?.kind === 'quran' ? 'Could not load Quran audio' : 'Could not load nasheed');
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
    $('#yt-btn').classList.add('hidden');
    seek.setValue(0);
    $('#time-pos').textContent = '0:00';
    $('#time-dur').textContent = '0:00';
    $$('.track-row').forEach((r) => r.classList.remove('playing'));
    audio.removeAttribute('src');
    syncQuranTranslation();
    dcLastRefresh = 0;
    if (discordEnabled)
        dcClear();
    reportEvent('stop');
    if ('mediaSession' in navigator)
        navigator.mediaSession.metadata = null;
}
// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented)
        return;
    if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT')
        return;
    if (e.code === 'Space') {
        e.preventDefault();
        $('#play-btn').click();
    }
    else if (e.code === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        $('#next-btn').click();
    }
    else if (e.code === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        $('#prev-btn').click();
    }
    else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (audio.duration)
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    }
    else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
    }
    else if (e.code === 'ArrowUp') {
        e.preventDefault();
        audio.volume = Math.min(1, audio.volume + 0.05);
        vol.setValue(audio.volume * 100);
        updateVolIcon();
    }
    else if (e.code === 'ArrowDown') {
        e.preventDefault();
        audio.volume = Math.max(0, audio.volume - 0.05);
        vol.setValue(audio.volume * 100);
        updateVolIcon();
    }
    else if (e.key === 'l' || e.key === 'L') {
        $('#loop-btn').click();
    }
    else if (e.key === 'm' || e.key === 'M') {
        $('#vol-btn').click();
    }
    else if (e.key === '/' || e.key === 's') {
        e.preventDefault();
        const v = $('nav .nav-item.active')?.dataset.view;
        if (v !== 'search') {
            $$('.nav-item').forEach((b) => b.classList.remove('active'));
            $('[data-view="search"]').classList.add('active');
            $$('.view').forEach((el) => el.classList.remove('active'));
            $('#search-view').classList.add('active');
        }
        $('#search-input').focus();
    }
});
// --- PROGRESS ---
seek.onInput = (p) => {
    progressDrag = true;
    if (audio.duration)
        audio.currentTime = (p / 100) * audio.duration;
};
seek.onChange = () => {
    progressDrag = false;
    dcLastRefresh = 0;
    pushDiscord(true);
    botLastRefresh = 0;
    reportEvent('progress');
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
    if (!audio.duration || progressDrag)
        return;
    const p = (audio.currentTime / audio.duration) * 100;
    seek.setValue(p);
    $('#time-pos').textContent = fmt(audio.currentTime);
    $('#time-dur').textContent = fmt(audio.duration);
    highlightTransAyah(true);
    pushDiscord();
    pushBot();
}, 250);
// --- VOLUME ---
const savedVol = load('ns_vol', 70);
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
    if (audio.muted || audio.volume === 0)
        i.className = 'fa-solid fa-volume-xmark';
    else if (audio.volume < 0.3)
        i.className = 'fa-solid fa-volume-off';
    else if (audio.volume < 0.7)
        i.className = 'fa-solid fa-volume-low';
    else
        i.className = 'fa-solid fa-volume-high';
}
// --- LIBRARY ---
function applyLibSort(src) {
    const s = src.slice();
    if (sortMode === 'title')
        s.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortMode === 'channel')
        s.sort((a, b) => a.channel.localeCompare(b.channel));
    return s;
}
function syncSortUI() {
    $('#lib-sort-label').textContent = SORT_LABELS[sortMode];
    $$('.lib-sort-opt').forEach((o) => o.classList.toggle('active', o.dataset.sort === sortMode));
}
async function loadLib(mode) {
    const lib = await getJSON(`${API}/api/library`);
    let songs = [];
    let title = 'Your Library';
    let isPlaylist = false;
    if (mode === 'all' || mode === 'library') {
        songs = [...(lib.songs || [])].reverse();
        title = 'Your Library';
    }
    else if (mode === 'favorites') {
        songs = (lib.songs || []).filter((s) => s.favorite).reverse();
        title = 'Liked Nasheeds';
    }
    else if (mode === 'downloads') {
        songs = (lib.songs || []).filter((s) => s.downloaded).reverse();
        title = 'Downloads';
    }
    else if (mode === 'local') {
        songs = (lib.songs || []).filter((s) => s.local).reverse();
        title = 'Your Nasheeds';
    }
    else if (mode === 'recent') {
        const stored = load('ns_recent', []);
        songs = stored.map((r) => {
            const inLib = (lib.songs || []).find((s) => s.id === r.id);
            return { ...r, favorite: inLib ? inLib.favorite : false };
        });
        title = 'Recently Played';
    }
    else if (mode && mode.startsWith('playlist:')) {
        const n = mode.slice('playlist:'.length);
        const pl = (lib.playlists || []).find((p) => p.name === n);
        songs = pl ? pl.songs : [];
        title = n;
        currentPlaylistName = n;
        isPlaylist = true;
    }
    if (!isPlaylist)
        currentPlaylistName = null;
    currentLibMode = mode;
    currentLibSource = songs;
    $('#lib-del').classList.toggle('hidden', !isPlaylist);
    $('#lib-rename').classList.toggle('hidden', !isPlaylist);
    $('#local-add').classList.toggle('hidden', mode !== 'local');
    $('#lib-title').textContent = title;
    $('#lib-subtitle').textContent = `${songs.length} nasheed${songs.length !== 1 ? 's' : ''}`;
    $('#lib-actions').classList.toggle('hidden', !songs.length);
    const emptyCopy = {
        downloads: ['No downloads yet', 'Hit the download button on any nasheed to save it for offline listening'],
        local: ['No local nasheeds yet', 'Add your own mp3 or mp4 files with the + button above'],
    };
    const [emptyTitle, emptySub] = emptyCopy[mode ?? ''] ?? ['Nothing here yet', 'Search and save nasheeds to see them here'];
    const et = $('#lib-empty').querySelector('.empty-title');
    if (et)
        et.textContent = emptyTitle;
    const es = $('#lib-empty').querySelector('.empty-sub');
    if (es)
        es.textContent = emptySub;
    if (!songs.length) {
        $('#lib-list').style.display = 'none';
        $('#lib-empty').style.display = '';
    }
    else {
        renderList('lib-list', applyLibSort(songs), 'library');
        $('#lib-empty').style.display = 'none';
        $('#lib-list').style.display = '';
    }
}
async function addLocalFiles(files) {
    let added = 0;
    for (const f of files) {
        const fd = new FormData();
        fd.append('file', f, f.name);
        let fail = '';
        try {
            const resp = await fetch(`${API}/api/local`, { method: 'POST', body: fd });
            if (resp.ok) {
                const r = (await resp.json());
                if (r.ok) {
                    added++;
                    continue;
                }
                fail = r.error || 'upload rejected';
            }
            else if (resp.status === 404) {
                fail = 'backend is out of date, restart the app';
            }
            else {
                try {
                    const body = (await resp.json());
                    fail = body.error || '';
                }
                catch { }
                if (!fail)
                    fail = `server error (HTTP ${resp.status})`;
            }
        }
        catch {
            fail = "can't reach the backend";
        }
        toast(`Could not add ${f.name}: ${fail}`);
    }
    if (added) {
        toast(added === 1 ? 'Added to Your Nasheeds' : `Added ${added} nasheeds to Your Nasheeds`);
        loadLib('local');
    }
}
$('#local-add').addEventListener('click', () => $('#local-file').click());
$('#local-file').addEventListener('change', () => {
    const input = $('#local-file');
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length)
        void addLocalFiles(files);
});
async function removeFromList(song) {
    if (currentPlaylistName && currentLibMode && currentLibMode.startsWith('playlist:')) {
        const plName = currentPlaylistName;
        const ok = await confirmDialog('Remove from playlist', `Remove "${song.title}" from ${plName}?`);
        if (!ok)
            return;
        await getJSON(`${API}/api/playlists/${encodeURIComponent(plName)}/remove/${encodeURIComponent(song.id)}`, { method: 'POST' });
        toast('Removed from ' + plName);
        loadLib('playlist:' + plName);
    }
    else {
        const ok = await confirmDialog('Remove from library', `Remove "${song.title}" from Your Library?`);
        if (!ok)
            return;
        await getJSON(`${API}/api/library/remove/${encodeURIComponent(song.id)}`, { method: 'POST' });
        toast('Removed from Your Library');
        loadLib(currentLibMode ?? 'library');
    }
}
async function toggleFav(song) {
    if (song.kind === 'quran') {
        toast('Quran cannot be liked');
        return;
    }
    await getJSON(`${API}/api/library/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
    });
    const d = await getJSON(`${API}/api/library/fav/${encodeURIComponent(song.id)}`, { method: 'POST' });
    $$(`.track-row[data-id="${CSS.escape(song.id)}"] .fav-act i`).forEach((i) => {
        i.className = d.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
    });
    if (currentSong && currentSong.id === song.id) {
        currentSong.favorite = d.favorite;
        $('#fav-btn i').className = d.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
    }
    toast(d.favorite ? 'Added to Liked Nasheeds' : 'Removed from Liked Nasheeds');
}
async function addToPl(song) {
    await getJSON(`${API}/api/library/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
    });
    const name = await showPlaylistPicker();
    if (!name)
        return;
    await getJSON(`${API}/api/playlists/${encodeURIComponent(name)}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
    });
    loadPlaylists();
    toast('Added to ' + name);
}
function seeOnYouTube(song) {
    fetch(`${API}/api/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${encodeURIComponent(song.id)}` }),
    }).then((r) => {
        if (!r.ok)
            toast('Could not open YouTube');
    }).catch(() => toast('Could not open YouTube'));
}
// --- PLAYLISTS ---
async function deletePlaylist(name) {
    const d = await getJSON(`${API}/api/playlists/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    return !!d.ok;
}
function activateLibraryNav() {
    $$('.nav-item').forEach((n) => n.classList.remove('active'));
    $$('.nav-item').find((n) => n.dataset.view === 'library')?.classList.add('active');
    $$('.view').forEach((v) => v.classList.remove('active'));
    $('#library-view').classList.add('active');
}
function gotoLibrary() {
    activateLibraryNav();
    loadLib('library');
}
async function loadPlaylists() {
    const pls = await getJSON(`${API}/api/playlists`);
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
            if (!ok)
                return;
            if (!(await deletePlaylist(pl.name))) {
                toast('Could not delete playlist');
                return;
            }
            loadPlaylists();
            toast('Deleted playlist: ' + pl.name);
            if (currentPlaylistName === pl.name && $('#library-view').classList.contains('active'))
                gotoLibrary();
        });
        row.append(b, del);
        nav.appendChild(row);
    });
}
$('#lib-del').addEventListener('click', async () => {
    const name = currentPlaylistName;
    if (!name)
        return;
    const ok = await confirmDialog('Delete playlist', `Delete "${name}"? It will be removed from your playlists.`);
    if (!ok)
        return;
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
    if (!oldName)
        return;
    const newName = await promptText('Rename playlist', 'Playlist name', 'Rename', oldName);
    if (!newName || newName === oldName)
        return;
    const d = await getJSON(`${API}/api/playlists/rename`, {
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
    if (!currentList.length)
        return;
    const idx = shuffleOn ? Math.floor(Math.random() * currentList.length) : 0;
    playSong(currentList[idx], idx, 'library');
});
$('#shuffle-play-btn').addEventListener('click', () => {
    if (!currentList.length)
        return;
    if (!shuffleOn)
        setShuffle(true);
    const idx = Math.floor(Math.random() * currentList.length);
    playSong(currentList[idx], idx, 'library');
});
$('#lib-sort-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#lib-sort-menu').classList.toggle('hidden');
});
$$('.lib-sort-opt').forEach((b) => b.addEventListener('click', () => {
    sortMode = b.dataset.sort || 'added';
    store('ns_sort', sortMode);
    syncSortUI();
    $('#lib-sort-menu').classList.add('hidden');
    if (currentLibSource.length && $('#library-view').classList.contains('active')) {
        renderList('lib-list', applyLibSort(currentLibSource), 'library');
    }
}));
document.addEventListener('click', (e) => {
    if (!e.target.closest('#lib-sort'))
        $('#lib-sort-menu').classList.add('hidden');
});
$('#add-pl-btn').addEventListener('click', async () => {
    const name = await promptText('New playlist', 'Playlist name', 'Create');
    if (!name)
        return;
    await getJSON(`${API}/api/playlists/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    loadPlaylists();
    toast('Created playlist: ' + name);
});
// --- DISCORD PRESENCE ---
let discordEnabled = load('ns_discord', false);
let dcLastRefresh = 0;
function discHiddenIds() {
    return load('ns_discord_hidden', []);
}
function discIsHidden(id) {
    return discHiddenIds().includes(id);
}
function discSetHidden(id, hidden) {
    const set = discHiddenIds().filter((x) => x !== id);
    if (hidden)
        set.push(id);
    store('ns_discord_hidden', set);
}
function syncDiscBtns(id) {
    const hidden = discIsHidden(id);
    $$(`.track-row[data-id="${CSS.escape(id)}"] .disc-act`).forEach((b) => {
        const icon = b.querySelector('i');
        if (icon)
            icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        b.classList.toggle('disc-hide', hidden);
        b.title = hidden ? 'Hidden from Discord' : 'Shown in Discord';
    });
}
function discToggleSong(song) {
    const hidden = !discIsHidden(song.id);
    discSetHidden(song.id, hidden);
    syncDiscBtns(song.id);
    toast(hidden ? 'Hidden from Discord' : 'Shown in Discord');
    if (currentSong && currentSong.id === song.id) {
        pushDiscord(true);
        reportEvent(hidden ? 'hidden' : 'resume');
    }
}
function setDiscordStatus(state) {
    const el = $('#set-discord-status');
    if (!el)
        return;
    el.classList.remove('ok', 'warn', 'err');
    if (state === 'connected') {
        el.textContent = 'Connected';
        el.classList.add('ok');
    }
    else if (state === 'connecting') {
        el.textContent = 'Connecting...';
        el.classList.add('warn');
    }
    else if (state === 'not-running') {
        el.textContent = 'Discord not running';
        el.classList.add('warn');
    }
    else if (state === 'error') {
        el.textContent = 'Status unavailable';
        el.classList.add('err');
    }
    else {
        el.textContent = 'Off';
    }
}
function dcActivity(paused = false) {
    if (!currentSong || discIsHidden(currentSong.id))
        return null;
    const channel = currentSong.channel || '';
    const a = {
        details: currentSong.title,
        state: paused ? (channel ? 'Paused - ' + channel : 'Paused') : (channel || 'Quran'),
    };
    if (!paused) {
        const start = Date.now() - Math.round(audio.currentTime * 1000);
        const dur = Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : (currentSong.duration || 0);
        a.timestamps = dur ? { start, end: start + Math.round(dur * 1000) } : { start };
    }
    return a;
}
function dcPause() {
    if (!discordEnabled)
        return;
    dcLastRefresh = Date.now();
    dcPost({ enabled: true, activity: dcActivity(true) });
}
function dcPost(body) {
    void getJSON(`${API}/api/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).catch(() => undefined);
}
function pushDiscord(force = false) {
    const now = Date.now();
    if (!discordEnabled || now - dcLastRefresh < (force ? 0 : 30000))
        return;
    dcLastRefresh = now;
    dcPost({ enabled: true, activity: dcActivity(audio.paused) });
}
function dcClear() {
    if (!discordEnabled)
        return;
    dcPost({ enabled: true, activity: null });
}
function pollDiscordStatus() {
    if (!discordEnabled)
        return;
    void getJSON(`${API}/api/discord/status?alive=1`)
        .then((d) => {
        if (!discordEnabled)
            return;
        if (d.state === 'connected')
            setDiscordStatus('connected');
        else if (d.state === 'connecting')
            setDiscordStatus('connecting');
        else if (d.state === 'off') {
            setDiscordStatus('connecting');
            pushDiscord(true);
        }
        else
            setDiscordStatus('not-running');
    })
        .catch(() => {
        if (discordEnabled)
            setDiscordStatus('error');
    });
}
function syncDiscordUI() {
    $('#set-discord').checked = discordEnabled;
    if (discordEnabled) {
        dcPost({ enabled: true, activity: dcActivity() });
        dcLastRefresh = Date.now();
        pollDiscordStatus();
    }
    else {
        setDiscordStatus('off');
    }
}
$('#set-discord').addEventListener('change', (e) => {
    discordEnabled = e.target.checked;
    store('ns_discord', discordEnabled);
    dcLastRefresh = 0;
    if (discordEnabled) {
        pollDiscordStatus();
        dcPost({ enabled: true, activity: dcActivity(audio.paused), remember: true });
    }
    else {
        dcPost({ enabled: false, activity: null, remember: true });
        setDiscordStatus('off');
    }
});
async function initDiscord() {
    let remote = null;
    try {
        const d = await getJSON(`${API}/api/discord/status`);
        if (typeof d.enabled === 'boolean')
            remote = d.enabled;
    }
    catch { }
    if (remote !== null) {
        discordEnabled = remote;
        store('ns_discord', discordEnabled);
    }
    else if (discordEnabled) {
        dcPost({ enabled: true, activity: null, remember: true });
    }
    syncDiscordUI();
}
setInterval(pollDiscordStatus, 2000);
window.addEventListener('pagehide', () => {
    if (!discordEnabled || !navigator.sendBeacon)
        return;
    const body = new Blob([JSON.stringify({ enabled: false, activity: null })], { type: 'application/json' });
    navigator.sendBeacon(`${API}/api/discord`, body);
});
// --- DISCORD BOT SYNC ---
let botEnabled = false;
let botLinked = false;
let botLastRefresh = 0;
function setBotStatus(text, cls = '') {
    const el = $('#set-bot-status');
    el.classList.remove('ok', 'warn', 'err');
    el.textContent = text;
    if (cls)
        el.classList.add(cls);
}
function botNote(msg) {
    $('#bot-note').textContent = msg;
}
function botPost(body, path = '/api/bot') {
    return getJSON(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
function syncBotUI(info) {
    botEnabled = !!info.enabled;
    botLinked = !!info.linked;
    $('#set-bot').checked = botEnabled;
    if (info.url)
        $('#bot-url').value = info.url;
    $('#bot-unlink').disabled = !botLinked;
    if (botLinked) {
        const name = info.user?.name ? ' as ' + info.user.name : '';
        if (botEnabled)
            setBotStatus('Linked' + name, 'ok');
        else
            setBotStatus('Paused' + name, 'warn');
    }
    else {
        setBotStatus('Not linked', '');
    }
}
async function loadBot() {
    try {
        const info = await getJSON(`${API}/api/bot`);
        syncBotUI(info);
        if (botLinked && botEnabled && info.last && info.last.ok === false) {
            botNote('Last sync failed: ' + (info.last.error || 'bot unreachable'));
        }
    }
    catch {
        setBotStatus('Status unavailable', 'err');
    }
}
function reportEvent(event, song) {
    if (!botEnabled || !botLinked)
        return;
    const target = song || currentSong;
    const starting = event === 'start';
    const body = {
        event,
        position: starting ? 0 : Math.round(audio.currentTime || 0),
        duration: starting
            ? (target?.duration || 0)
            : (Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : 0),
        songId: target ? target.id : '',
    };
    if (starting && target) {
        body.song = {
            id: target.id,
            title: target.title,
            channel: target.channel,
            duration: target.duration || 0,
            duration_string: target.duration_string || '',
            kind: target.kind === 'quran' ? 'quran' : 'nasheed',
            local: !!target.local,
        };
    }
    void botPost(body, '/api/report').catch(() => undefined);
}
function pushBot(force = false) {
    const now = Date.now();
    if (!botEnabled || !botLinked)
        return;
    if (now - botLastRefresh < (force ? 0 : 30000))
        return;
    botLastRefresh = now;
    reportEvent(audio.paused ? 'pause' : 'progress');
}
$('#set-bot').addEventListener('change', (e) => {
    botEnabled = e.target.checked;
    void botPost({ enabled: botEnabled }).catch(() => undefined);
    if (botEnabled && botLinked && currentSong) {
        botLastRefresh = 0;
        reportEvent(discIsHidden(currentSong.id) ? 'hidden' : 'start', currentSong);
    }
    void loadBot();
});
$('#bot-url').addEventListener('change', (e) => {
    const url = e.target.value.trim();
    void botPost({ url }).catch(() => undefined);
});
$('#bot-link').addEventListener('click', () => {
    const code = $('#bot-code').value.trim();
    const url = $('#bot-url').value.trim();
    if (!code) {
        botNote('Run su!track link in Discord and paste the code here.');
        return;
    }
    botNote('Linking...');
    void botPost({ code, url }, '/api/bot/link')
        .then((d) => {
        if (!d.ok) {
            botNote(String(d.error || 'That code did not work'));
            return;
        }
        $('#bot-code').value = '';
        const name = d.user?.name;
        botNote('Linked' + (name ? ' as ' + name : '') + '. Play something and try su!track');
        toast('Discord bot linked');
        void loadBot();
    })
        .catch(() => botNote('Could not reach the app backend'));
});
$('#bot-unlink').addEventListener('click', () => {
    void botPost({}, '/api/bot/unlink')
        .then(() => {
        botNote('Unlinked. Run su!track link for a fresh code.');
        toast('Discord bot unlinked');
        void loadBot();
    })
        .catch(() => botNote('Could not reach the app backend'));
});
$('#bot-test').addEventListener('click', () => {
    const url = $('#bot-url').value.trim();
    botNote('Testing...');
    void botPost({ url })
        .then(() => getJSON(`${API}/api/bot/test`, { method: 'POST' }))
        .then((d) => {
        if (d.ok)
            botNote('Bot reachable, running v' + (d.version || 'unknown'));
        else
            botNote(String(d.error || 'No response from the bot'));
    })
        .catch(() => botNote('No response from the bot'));
});
window.addEventListener('pagehide', () => {
    if (!botEnabled || !botLinked || !navigator.sendBeacon)
        return;
    const body = new Blob([JSON.stringify({ event: 'stop' })], { type: 'application/json' });
    navigator.sendBeacon(`${API}/api/report`, body);
});
// --- SETTINGS ---
let appVersion = '';
let updateBusy = false;
let updatePoll = null;
let latestTag = '';
let includePrerelease = load('ns_prerelease', false);
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
        const d = await getJSON(`${API}/api/version`);
        appVersion = d.version || '';
        $('#set-version').textContent = appVersion ? 'v' + appVersion : 'unknown';
    }
    catch {
        $('#set-version').textContent = 'unknown';
    }
    applyPrereleaseChannel();
}
async function loadSidebarVersion() {
    const ver = $('#sidebar-ver');
    try {
        const d = await getJSON(`${API}/api/version`);
        if (d.version)
            ver.textContent = 'v' + d.version;
    }
    catch {
        ver.textContent = '';
    }
}
$('#set-check').addEventListener('click', () => {
    void loadReleases(true);
});
function fmtMB(n) {
    if (!n || n <= 0)
        return '';
    return (n / 1048576).toFixed(1) + ' MB';
}
function setUpdateBusy(busy) {
    updateBusy = busy;
    $('#set-check').classList.toggle('disabled', busy);
    $('#set-update').disabled = busy;
}
function semverParts(tag) {
    const m = tag.replace(/^v/i, '').match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?/);
    const nums = (m ? m[1] : '0').split('.').map((n) => parseInt(n, 10) || 0);
    const pre = m && m[2] ? m[2].split('.') : [];
    return { nums, pre };
}
function cmpSemver(a, b) {
    const pa = semverParts(a);
    const pb = semverParts(b);
    const len = Math.max(pa.nums.length, pb.nums.length);
    for (let i = 0; i < len; i++) {
        const x = pa.nums[i] || 0;
        const y = pb.nums[i] || 0;
        if (x !== y)
            return x < y ? -1 : 1;
    }
    if (pa.pre.length === 0 && pb.pre.length === 0)
        return 0;
    if (pa.pre.length === 0)
        return 1;
    if (pb.pre.length === 0)
        return -1;
    const plen = Math.max(pa.pre.length, pb.pre.length);
    for (let i = 0; i < plen; i++) {
        const sa = pa.pre[i];
        const sb = pb.pre[i];
        if (sa === undefined)
            return -1;
        if (sb === undefined)
            return 1;
        const na = /^\d+$/.test(sa) ? parseInt(sa, 10) : null;
        const nb = /^\d+$/.test(sb) ? parseInt(sb, 10) : null;
        if (na !== null && nb !== null) {
            if (na !== nb)
                return na < nb ? -1 : 1;
        }
        else if (na !== null) {
            return -1;
        }
        else if (nb !== null) {
            return 1;
        }
        else if (sa !== sb) {
            return sa < sb ? -1 : 1;
        }
    }
    return 0;
}
async function loadReleases(refresh) {
    const note = $('#set-check-note');
    note.textContent = 'Checking GitHub...';
    if (refresh)
        $('#set-update').setAttribute('disabled', '');
    try {
        const d = await getJSON(`${API}/api/updates${refresh ? '?refresh=1' : ''}`);
        const rels = d.releases || [];
        const cur = d.current || '';
        const installable = rels.find((r) => r.asset && (includePrerelease || !r.prerelease));
        $('#set-latest').textContent = rels[0] ? rels[0].tag : 'unknown';
        if (!installable) {
            latestTag = '';
            note.textContent = 'No installer available for this platform yet.';
            $('#set-update').setAttribute('disabled', '');
            return;
        }
        latestTag = installable.tag;
        if (cmpSemver(installable.tag, cur) <= 0) {
            note.textContent = 'You are on the newest release.';
            $('#set-update').setAttribute('disabled', '');
        }
        else {
            note.textContent = (d.error ? 'Showing cached results. ' : '') + 'Version ' + esc(installable.tag) + ' is available.';
            $('#set-update').removeAttribute('disabled');
        }
    }
    catch {
        note.textContent = 'Could not reach GitHub right now.';
    }
}
function applyPrereleaseChannel() {
    $('#set-prerelease').checked = includePrerelease;
    void loadReleases(false);
}
$('#set-prerelease').addEventListener('change', (e) => {
    includePrerelease = e.target.checked;
    store('ns_prerelease', includePrerelease);
    latestTag = '';
    applyPrereleaseChannel();
});
function startUpdatePoll() {
    if (updatePoll !== null)
        return;
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
    let s;
    try {
        s = await getJSON(`${API}/api/update/status`);
    }
    catch {
        return;
    }
    const wrap = $('#set-progress-wrap');
    const fill = $('#set-progress-fill');
    const text = $('#set-progress-text');
    const note = $('#set-check-note');
    const runBtn = $('#set-run');
    if (s.state === 'downloading') {
        wrap.hidden = false;
        runBtn.hidden = true;
        const pct = s.total ? Math.round((s.downloaded / s.total) * 100) : 0;
        fill.style.width = pct + '%';
        text.textContent = 'Downloading ' + s.asset + '  ' + (fmtMB(s.downloaded) + (s.total ? ' / ' + fmtMB(s.total) : '')) + (s.total ? ' (' + pct + '%)' : '');
        note.textContent = 'Downloading ' + s.tag + '...';
        setUpdateBusy(true);
        return;
    }
    stopUpdatePoll();
    setUpdateBusy(false);
    if (s.state === 'installed') {
        wrap.hidden = true;
        runBtn.hidden = true;
        note.innerHTML = 'Updated to <b>' + esc(s.tag) + '</b>. Restart Quran to use it.';
    }
    else if (s.state === 'downloaded') {
        wrap.hidden = true;
        runBtn.hidden = false;
        note.innerHTML = 'Downloaded <b>' + esc(s.tag) + '</b> to <code>' + esc(s.path) + '</code>. Run it to use the new version.';
    }
    else if (s.state === 'launched') {
        wrap.hidden = true;
        runBtn.hidden = true;
        note.innerHTML = 'Opened the <b>' + esc(s.tag) + '</b> installer. Follow its steps, then reopen Quran.';
    }
    else if (s.state === 'error') {
        wrap.hidden = true;
        runBtn.hidden = true;
        note.textContent = 'Update failed: ' + (s.error || 'unknown error');
    }
}
$('#set-update').addEventListener('click', async () => {
    if (updateBusy)
        return;
    const tag = latestTag;
    const note = $('#set-check-note');
    if (!tag) {
        note.textContent = 'Check for updates first.';
        return;
    }
    const cur = appVersion;
    if (cmpSemver(tag, cur) <= 0) {
        note.textContent = 'You already have ' + tag + ' installed.';
        return;
    }
    setUpdateBusy(true);
    note.textContent = 'Starting update to ' + tag + '...';
    try {
        const r = await fetch(`${API}/api/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag }),
        });
        const d = (await r.json());
        if (!r.ok || !d.ok) {
            note.textContent = d.error || 'Could not start the update.';
            setUpdateBusy(false);
            return;
        }
        startUpdatePoll();
    }
    catch {
        note.textContent = 'Could not reach the updater.';
        setUpdateBusy(false);
    }
});
$('#set-run').addEventListener('click', async () => {
    const r = await fetch(`${API}/api/update/run`, { method: 'POST' });
    const d = (await r.json());
    if (!d.ok)
        toast(d.error || 'Could not start it');
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
}
catch { }
loopMode = load('ns_loop', 'off');
$('#loop-btn').classList.toggle('active', loopMode !== 'off');
$('#loop-btn').title = loopMode === 'one' ? 'Loop: one' : 'Loop: off';
shuffleOn = load('ns_shuffle', false);
$('#shuffle-btn').classList.toggle('active', shuffleOn);
$('#shuffle-btn').title = shuffleOn ? 'Shuffle: on' : 'Shuffle: off';
sortMode = load('ns_sort', 'added');
syncSortUI();
updateVolIcon();
renderRecentQ();
syncSearchUI();
loadPlaylists();
void initDownloads();
void loadQuranReciters();
syncSettingsVol();
void initDiscord();
void loadBot();
void loadSidebarVersion();
