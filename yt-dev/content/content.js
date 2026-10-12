// yt-dev: main content script for www.youtube.com
(() => {
  'use strict';
  if (window.__ytDevLoaded) return;
  window.__ytDevLoaded = true;

  const D = window.YD_DEFAULTS;
  const ACCENTS = window.YD_ACCENTS;
  const USER = 'devz@aqshai';
  let cfg = { ...D };

  /* ---------------- helpers ---------------- */
  const h = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  };

  const save = (patch) => chrome.storage.sync.set(patch);
  const flip = (k) => {
    save({ [k]: !cfg[k] });
    toast(`${k} = ${!cfg[k] ? 'on' : 'off'}`);
  };

  let toastEl = null;
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = h('div', { id: 'yd-toast' });
      document.body.append(toastEl);
    }
    toastEl.textContent = '$ ' + msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2200);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = h('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${mm}:${p(ss)}`;
  };
  const parseTime = (str) => str.split(':').reduce((a, p) => a * 60 + Number(p), 0);

  /* ---------------- video helpers ---------------- */
  const video = () =>
    document.querySelector('#movie_player video.html5-main-video') || document.querySelector('video');
  const isAd = () => !!document.querySelector('#movie_player.ad-showing');

  function videoId() {
    const u = new URL(location.href);
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/);
    return m ? m[1] : null;
  }
  const videoTitle = () =>
    document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/, '').trim();

  function tsLink() {
    const v = video();
    const id = videoId();
    if (!v || !id) return null;
    return { id, t: Math.floor(v.currentTime), url: `https://youtu.be/${id}?t=${Math.floor(v.currentTime)}` };
  }

  function copyTimestamp() {
    const l = tsLink();
    if (!l) return toast('open a video first');
    copy(l.url);
    toast(`copied link @ ${fmt(l.t)}`);
  }
  function copyMarkdown() {
    const l = tsLink();
    if (!l) return toast('open a video first');
    copy(`[${videoTitle()} @ ${fmt(l.t)}](${l.url})`);
    toast(`copied markdown link @ ${fmt(l.t)}`);
  }

  function seek(secs) {
    const v = video();
    if (!v) return toast('no video here');
    v.currentTime = Math.max(0, Math.min(secs, v.duration || secs));
    toast(`goto ${fmt(secs)}`);
  }

  function setSpeed(rate) {
    const v = video();
    if (!v) return toast('no video here');
    rate = Math.round(Math.max(0.25, Math.min(4, rate)) * 100) / 100;
    v.playbackRate = rate;
    toast(`speed ${rate}x`);
  }
  const stepSpeed = (d) => {
    const v = video();
    if (v) setSpeed(v.playbackRate + d);
  };

  function frame(download) {
    const v = video();
    if (!v || !v.videoWidth) return toast('no video frame available');
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      c.toBlob(async (blob) => {
        if (!blob) return toast('frame blocked by browser');
        if (download) {
          const a = h('a');
          a.href = URL.createObjectURL(blob);
          a.download = `yt-${videoId() || 'frame'}-${Math.floor(v.currentTime)}s.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast('saved frame png');
        } else {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast('frame copied as png');
          } catch (_) {
            toast('clipboard blocked. try "save frame"');
          }
        }
      }, 'image/png');
    } catch (err) {
      toast('frame blocked: ' + String(err.message || err).slice(0, 50));
    }
  }

  async function pip() {
    const v = video();
    if (!v) return toast('no video here');
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (err) {
      toast('pip failed: ' + String(err.message || err).slice(0, 50));
    }
  }

  /* ---------------- A-B loop ---------------- */
  let loop = { a: null, b: null };
  function cycleLoop() {
    const v = video();
    if (!v) return toast('no video here');
    if (loop.a == null) {
      loop.a = v.currentTime;
      toast(`loop A @ ${fmt(loop.a)}`);
    } else if (loop.b == null) {
      let b = v.currentTime;
      if (b <= loop.a) [loop.a, b] = [b, loop.a];
      loop.b = b;
      toast(`loop ${fmt(loop.a)} to ${fmt(loop.b)}`);
    } else {
      loop = { a: null, b: null };
      toast('loop cleared');
    }
  }

  document.addEventListener(
    'timeupdate',
    (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || loop.a == null || loop.b == null) return;
      if (v.currentTime >= loop.b) v.currentTime = loop.a;
    },
    true
  );

  /* ---------------- remember playback speed ---------------- */
  let lastLoad = 0;
  let applied = false;
  const onLoad = () => {
    lastLoad = Date.now();
    applied = false;
  };
  document.addEventListener('loadstart', (e) => e.target instanceof HTMLVideoElement && onLoad(), true);
  document.addEventListener('yt-navigate-finish', () => {
    onLoad();
    loop = { a: null, b: null };
  });
  const tryApply = (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || isAd() || !cfg.rememberSpeed || applied) return;
    applied = true;
    if (Math.abs(v.playbackRate - cfg.speed) > 0.001) v.playbackRate = cfg.speed;
  };
  ['loadedmetadata', 'playing'].forEach((t) => document.addEventListener(t, tryApply, true));
  document.addEventListener(
    'ratechange',
    (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || isAd() || !cfg.rememberSpeed) return;
      if (Date.now() - lastLoad < 1500) return; // YouTube resets rate on load; ignore that
      if (Math.abs(v.playbackRate - cfg.speed) > 0.001) save({ speed: v.playbackRate });
    },
    true
  );

  /* ---------------- status bar ---------------- */
  const segCtx = h('span', { class: 'yd-seg yd-cur', text: '1:yt' });
  const segLoop = h('span', { class: 'yd-seg yd-hot' });
  const segSpeed = h('span', { class: 'yd-seg yd-hot' });
  const segTime = h('span', { class: 'yd-seg' });
  const segClock = h('span', { class: 'yd-seg' });
  const bar = h(
    'div',
    { id: 'yd-bar' },
    h('span', { class: 'yd-seg yd-sess', text: USER }),
    h('span', { class: 'yd-seg', text: '0:yt' }),
    segCtx,
    h('span', { class: 'yd-fill' }),
    segLoop,
    segSpeed,
    segTime,
    h('span', { class: 'yd-seg', text: '^k palette' }),
    segClock,
    h('span', { class: 'yd-seg yd-caret', text: '\u258d' })
  );

  function ctxName() {
    const p = location.pathname;
    const q = new URLSearchParams(location.search);
    if (p === '/watch') return 'watch/' + videoTitle();
    if (p === '/') return 'home';
    if (p === '/results') return 'search/' + (q.get('search_query') || '');
    if (p.startsWith('/shorts')) return 'shorts';
    if (p.startsWith('/feed/subscriptions')) return 'subs';
    if (p.startsWith('/feed/history')) return 'history';
    if (p.startsWith('/playlist')) return 'playlist';
    if (p.startsWith('/@')) return p.slice(1).split('/')[0];
    return p.slice(1) || 'yt';
  }

  let lastVid = null;
  function tickBar() {
    segCtx.textContent = `1:${ctxName()}*`;
    const id = videoId();
    if (id !== lastVid) {
      lastVid = id;
      loop = { a: null, b: null };
    }
    const v = id ? video() : null;
    if (v && isFinite(v.duration) && v.duration > 0) {
      const rate = v.playbackRate || 1;
      const eta = (v.duration - v.currentTime) / rate;
      segTime.textContent = `${fmt(v.currentTime)}/${fmt(v.duration)} eta ${fmt(eta)}`;
      segSpeed.textContent = rate !== 1 ? `${rate}x` : '';
    } else {
      segTime.textContent = '';
      segSpeed.textContent = '';
    }
    segLoop.textContent =
      loop.a == null ? '' : loop.b == null ? `A ${fmt(loop.a)} -` : `A ${fmt(loop.a)} B ${fmt(loop.b)}`;
    segClock.textContent = new Date().toTimeString().slice(0, 8);
  }

  /* ---------------- command palette ---------------- */
  const pal = { el: null, input: null, list: null, items: [], shown: [], sel: 0 };

  function commands() {
    const out = [];
    const add = (kind, label, run, hint = '') => out.push({ kind, label, run, hint });

    add('video', 'copy link at current time', copyTimestamp, 'alt+t');
    add('video', 'copy markdown link at current time', copyMarkdown, 'alt+m');
    add('video', 'copy video title', () => (copy(videoTitle()), toast('copied title')));
    add('video', 'copy video id', () => {
      const id = videoId();
      id ? (copy(id), toast('copied ' + id)) : toast('open a video first');
    });
    add('video', 'loop A-B (set A, set B, clear)', cycleLoop, 'alt+l');
    add('video', 'toggle loop whole video', () => {
      const v = video();
      if (v) {
        v.loop = !v.loop;
        toast('loop video = ' + (v.loop ? 'on' : 'off'));
      }
    });
    add('video', 'save frame as png', () => frame(true));
    add('video', 'copy frame as png', () => frame(false));
    add('video', 'picture in picture', pip);

    [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].forEach((r) => add('speed', `${r}x`, () => setSpeed(r)));
    add('speed', 'faster +0.25', () => stepSpeed(0.25), 'alt+.');
    add('speed', 'slower -0.25', () => stepSpeed(-0.25), 'alt+,');

    [
      ['hideShorts', 'hide shorts', ''],
      ['hideFeed', 'hide home feed (focus mode)', 'alt+f'],
      ['hideComments', 'hide comments', ''],
      ['hideRelated', 'hide watch sidebar', ''],
      ['hideAmbient', 'hide ambient glow', ''],
      ['dimThumbs', 'dim thumbnails until hover', ''],
      ['rememberSpeed', 'remember playback speed', ''],
      ['monoFont', 'monospace font', ''],
      ['terminalLogo', 'terminal logo', ''],
      ['statusBar', 'status bar', ''],
      ['scanlines', 'crt scanlines', ''],
      ['theme', 'terminal theme', '']
    ].forEach(([k, label, hint]) => add('toggle', label, () => flip(k), hint));

    Object.entries(ACCENTS).forEach(([n, c]) => add('accent', n, () => save({ accent: c }), c));

    [
      ['home', '/'],
      ['subscriptions', '/feed/subscriptions'],
      ['history', '/feed/history'],
      ['watch later', '/playlist?list=WL'],
      ['liked videos', '/playlist?list=LL'],
      ['playlists', '/feed/playlists']
    ].forEach(([n, p]) => add('go', n, () => location.assign(p)));
    return out;
  }

  function dynamicItems(q) {
    const seekItems = [];
    const searchItems = [];
    const m = q.match(/^(?:g|go|goto|seek)?\s*((?:\d+:){1,2}\d+|\d+)\s*s?$/i);
    if (m && video()) {
      const secs = parseTime(m[1]);
      seekItems.push({ kind: 'seek', label: 'goto ' + fmt(secs), hint: '', run: () => seek(secs) });
    }
    if (q) {
      searchItems.push({
        kind: 'search',
        label: q,
        hint: 'youtube',
        run: () => location.assign('/results?search_query=' + encodeURIComponent(q))
      });
    }
    return { seekItems, searchItems };
  }

  function fuzzy(q, s) {
    q = q.toLowerCase();
    s = s.toLowerCase();
    let i = 0;
    let score = 0;
    let last = -2;
    for (let j = 0; j < s.length && i < q.length; j++) {
      if (s[j] === q[i]) {
        score += last === j - 1 ? 3 : 1;
        if (j === 0 || ' :-_/;'.includes(s[j - 1])) score += 2;
        last = j;
        i++;
      }
    }
    return i === q.length ? score : -1;
  }

  function mark() {
    [...pal.list.children].forEach((r, i) => r.classList.toggle('sel', i === pal.sel));
  }
  function runItem(it) {
    closePalette();
    setTimeout(() => it.run(), 0);
  }

  function renderPalette() {
    const q = pal.input.value.trim();
    const res = pal.items.map((i) => ({ i, s: q ? fuzzy(q, i.kind + ' ' + i.label) : 0 })).filter((x) => x.s >= 0);
    if (q) res.sort((a, b) => b.s - a.s);
    const { seekItems, searchItems } = dynamicItems(q);
    pal.shown = [...seekItems, ...res.slice(0, 9).map((x) => x.i), ...searchItems];
    pal.sel = Math.min(pal.sel, Math.max(pal.shown.length - 1, 0));
    const rows = pal.shown.map((it, idx) => {
      const row = h(
        'div',
        { class: 'yd-row' + (idx === pal.sel ? ' sel' : '') },
        h('span', { class: 'yd-k', text: it.kind }),
        h('span', { class: 'yd-l', text: it.label }),
        h('span', { class: 'yd-hint', text: it.hint || '' })
      );
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        runItem(it);
      });
      row.addEventListener('mousemove', () => {
        pal.sel = idx;
        mark();
      });
      return row;
    });
    if (!rows.length) rows.push(h('div', { class: 'yd-empty', text: 'type a command, a time like 1:23, or a search' }));
    pal.list.replaceChildren(...rows);
  }

  function buildPalette() {
    pal.input = h('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'command' });
    pal.list = h('div', { role: 'listbox' });
    pal.el = h(
      'div',
      { id: 'yd-pal' },
      h('div', { class: 'yd-box' }, h('div', { class: 'yd-in' }, h('span', { class: 'yd-ps', text: '>' }), pal.input), pal.list)
    );
    pal.el.addEventListener('mousedown', (e) => {
      if (e.target === pal.el) closePalette();
    });
    pal.input.addEventListener('input', () => {
      pal.sel = 0;
      renderPalette();
    });
    pal.input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keep YouTube hotkeys from firing while typing
      const n = Math.max(pal.shown.length, 1);
      if (e.key === 'Escape') closePalette();
      else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
        e.preventDefault();
        pal.sel = (pal.sel + 1) % n;
        mark();
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        pal.sel = (pal.sel - 1 + n) % n;
        mark();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const it = pal.shown[pal.sel];
        if (it) runItem(it);
      }
    });
    ['keyup', 'keypress'].forEach((t) => pal.input.addEventListener(t, (e) => e.stopPropagation()));
    document.body.append(pal.el);
  }

  function openPalette() {
    if (!pal.el) buildPalette();
    pal.items = commands();
    pal.input.value = '';
    pal.sel = 0;
    renderPalette();
    pal.el.classList.add('on');
    pal.input.focus();
  }
  function closePalette() {
    if (pal.el) pal.el.classList.remove('on');
  }
  const paletteOpen = () => pal.el && pal.el.classList.contains('on');

  /* ---------------- hotkeys ---------------- */
  window.addEventListener(
    'keydown',
    (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.code;
      if (mod && !e.shiftKey && !e.altKey && k === 'KeyK') {
        e.preventDefault();
        e.stopPropagation();
        paletteOpen() ? closePalette() : openPalette();
        return;
      }
      if (!e.altKey || mod || e.shiftKey) return;
      const act = {
        KeyT: copyTimestamp,
        KeyM: copyMarkdown,
        KeyL: cycleLoop,
        KeyF: () => flip('hideFeed'),
        Comma: () => stepSpeed(-0.25),
        Period: () => stepSpeed(0.25)
      }[k];
      if (act) {
        e.preventDefault();
        e.stopPropagation();
        act();
      }
    },
    true
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) cfg[k] = v.newValue;
    window.ydApply(cfg);
  });

  /* ---------------- boot ---------------- */
  chrome.storage.sync.get(D, (stored) => {
    cfg = { ...D, ...stored };
    document.body.append(bar);
    window.ydApply(cfg);
    tickBar();
    setInterval(tickBar, 500);
    toast('yt-dev loaded. ctrl+k for commands');
  });
})();
