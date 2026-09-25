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
    return d.innerHTML;
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
$$('.nav-item').forEach((btn) => btn.addEventListener('click', () => {
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
            currentSong.stream_url = undefined;
            currentSong.id = `quran:${id}:${currentSong.chapter_id}`;
            updatePlayer();
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
function makeRow(song, idx, ctx) {
    const r = document.createElement('div');
    r.className = 'track-row';
    r.dataset.id = song.id;
    if (currentSong && currentSong.id === song.id)
        r.classList.add('playing');
    const isQuran = ctx === 'quran' || song.kind === 'quran';
    const canRemove = ctx !== 'search' && !isQuran;
    const heart = song.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
    const sub = isQuran
        ? `<span class="track-ar">${esc(song.arabic || '')}</span><span class="track-ayahs">${song.verses_count ? `${song.verses_count} ayahs` : ''}</span>`
        : esc(song.channel);
    if (isQuran)
        r.classList.add('quran-row');
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
      <button class="track-act pl-act" title="Add to playlist"><i class="fa-solid fa-plus"></i></button>`}
    </div>`;
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
    }
    if (canRemove) {
        r.querySelector('.rem-act').addEventListener('click', (e) => { e.stopPropagation(); removeFromList(song); });
    }
    return r;
}
// --- PLAYBACK ---
const warmed = new Set();
function warm(id) {
    if (warmed.has(id))
        return;
    warmed.add(id);
    fetch(`${API}/api/warm/${id}`).then((r) => {
        if (!r.ok)
            warmed.delete(id);
    }).catch(() => warmed.delete(id));
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
    return `${API}/api/proxy/${song.id}`;
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
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSong.title,
            artist: currentSong.channel,
            album: currentSong.kind === 'quran' ? 'Quran' : 'Quran & Nasheeds',
            artwork: currentSong.thumbnail ? [{ src: currentSong.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
        });
    }
}
// --- CONTROLS ---
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
audio.addEventListener('play', () => syncIcons());
audio.addEventListener('pause', () => {
    startingId = null;
    setBuffering(false);
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
    seek.setValue(0);
    $('#time-pos').textContent = '0:00';
    $('#time-dur').textContent = '0:00';
    $$('.track-row').forEach((r) => r.classList.remove('playing'));
    audio.removeAttribute('src');
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
}, 250);
// --- VOLUME ---
const savedVol = load('ns_vol', 70);
vol.setValue(savedVol);
audio.volume = savedVol / 100;
vol.onInput = (p) => {
    audio.volume = p / 100;
    store('ns_vol', Math.round(p));
    updateVolIcon();
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
    $('#lib-title').textContent = title;
    $('#lib-subtitle').textContent = `${songs.length} nasheed${songs.length !== 1 ? 's' : ''}`;
    $('#lib-actions').classList.toggle('hidden', !songs.length);
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
async function removeFromList(song) {
    if (currentPlaylistName && currentLibMode && currentLibMode.startsWith('playlist:')) {
        const plName = currentPlaylistName;
        const ok = await confirmDialog('Remove from playlist', `Remove "${song.title}" from ${plName}?`);
        if (!ok)
            return;
        await getJSON(`${API}/api/playlists/${encodeURIComponent(plName)}/remove/${song.id}`, { method: 'POST' });
        toast('Removed from ' + plName);
        loadLib('playlist:' + plName);
    }
    else {
        const ok = await confirmDialog('Remove from library', `Remove "${song.title}" from Your Library?`);
        if (!ok)
            return;
        await getJSON(`${API}/api/library/remove/${song.id}`, { method: 'POST' });
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
    const d = await getJSON(`${API}/api/library/fav/${song.id}`, { method: 'POST' });
    $$(`.track-row[data-id="${song.id}"] .fav-act i`).forEach((i) => {
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
void loadQuranReciters();
