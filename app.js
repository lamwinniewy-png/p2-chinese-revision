/* 二年級中文科評估溫習樂園 — vanilla JS, iPad-friendly, 粵語朗讀 */
'use strict';

/* ---------------- helpers ---------------- */
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const $ = s => document.querySelector(s);
const LET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* blanks → visual boxes */
const fmt = t => String(t).replace(/＿+/g, '<span class="blank"></span>').replace(/□/g, '<span class="box"></span>').replace(/（　）/g, '（<span class="blank sm"></span>）');
/* text for speech */
const spoken = t => String(t).replace(/<[^>]+>/g, '').replace(/＿+|□|（　）/g, '，空格，').replace(/「：「」」/g, '冒號同引號').replace(/[《》]/g, '').replace(/\s+/g, ' ').trim();

const ALL = { };
LESSONS.forEach(l => { l.kind = 'lesson'; ALL[l.id] = l; });
GRAMMAR.forEach(g => { g.kind = 'grammar'; ALL[g.id] = g; });
READING.forEach(r => { r.kind = 'reading'; r.col = 'c-peach'; r.m = 'kitty'; ALL[r.id] = r; });

/* auto questions: 筆畫, 詞義, 聽寫 */
function strokeQs(l) {
  return Object.entries(l.strokes).filter(([c]) => l.write.some(w => w.includes(c))).map(([c, n]) => {
    const w = shuffle([n - 2, n - 1, n + 1, n + 2].filter(x => x > 0)).slice(0, 3);
    return { ...M(`「<span class="bigc">${c}</span>」字共有多少畫？`, n + ' 畫', w.map(x => x + ' 畫'), `「${c}」字共 ${n} 畫。`, '一筆一筆慢慢數，可以用手指在空中寫寫看。'), tag: '筆畫' };
  });
}
function meaningQs(l) {
  const ks = Object.keys(l.meaning);
  return ks.map(k => ({ ...M(`「${k}」的意思是：`, l.meaning[k], shuffle(ks.filter(x => x !== k)).slice(0, 3).map(x => l.meaning[x])), tag: '詞義' }));
}
function words(l) { return [...l.read.map(w => [w, '認讀']), ...l.write.map(w => [w, '書寫']), ...l.extra.map(w => [w, '課後活動'])]; }
function listenQ(l) {
  const ws = words(l).map(w => w[0]);
  const w = pick(ws);
  const pool = shuffle(ws.filter(x => x !== w));
  const same = pool.filter(x => x.length === w.length);
  const wrong = [...same, ...pool.filter(x => x.length !== w.length)].slice(0, 3);
  return { type: 'mc', listen: w, text: '聽一聽，選出你聽到的詞語。', answer: w, wrong, explain: `答案是「${w}」。`, hint: '再按 🔈 聽多一次。', tag: '聽詞語', topic: l.id };
}
function sentenceWith(l, w) {
  for (const p of l.text) for (const s of p) { const parts = s.split(/(?<=[。！？])/); for (const x of parts) if (x.includes(w)) return x.trim(); }
  return '';
}
function bank(id) {
  const t = ALL[id];
  let qs = t.qs.map(q => ({ ...q }));
  if (t.kind === 'lesson') qs = qs.concat(strokeQs(t), meaningQs(t));
  return qs.map(q => ({ ...q, topic: id }));
}

/* ---------------- state ---------------- */
const STORE = 'p2chi-v1';
let _saved = {}; try { _saved = JSON.parse(window['local' + 'Storage'].getItem(STORE) || '{}'); } catch (e) { }
const S = Object.assign({ stars: 0, best: {}, mistakes: [], sound: true, slow: false, cards: {} }, _saved);
const save = () => { try { window['local' + 'Storage'].setItem(STORE, JSON.stringify(S)); } catch (e) { } };
const STICKERS = ['🎀', '🍓', '🐰', '🧁', '🌈', '🐱', '🍰', '🌸', '🐶', '🍭', '🦄', '🐸', '🍩', '💖', '🎈', '🐻', '🍒', '⭐', '🐹', '🍦', '🦋', '🌷', '🐼', '👑'];
const stickerAt = i => (i + 1) * 5;

/* ---------------- sound & speech ---------------- */
let AC;
function tone(seq) { if (!S.sound) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); let t = AC.currentTime; for (const [f, d] of seq) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d); t += d * .7; } } catch (e) { } }
const sGood = () => tone([[784, .12], [988, .12], [1319, .25]]);
const sBad = () => tone([[330, .18], [262, .25]]);
const sTap = () => tone([[660, .05]]);
let VOICE = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    const norm = v => v.lang.replace('_', '-').toLowerCase();
    VOICE = vs.find(v => norm(v) === 'zh-hk') || vs.find(v => /yue|cantonese|粵|廣東/i.test(v.name + v.lang)) || null;
  } catch (e) { }
}
function say(text, onend) {
  try {
    if (!('speechSynthesis' in window)) { onend && onend(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken(text));
    u.lang = 'zh-HK'; if (!VOICE) pickVoice(); if (VOICE) u.voice = VOICE;
    u.rate = S.slow ? .62 : .85;
    if (onend) { u.onend = onend; u.onerror = onend; }
    speechSynthesis.speak(u);
  } catch (e) { onend && onend(); }
}
function stopSay() { try { speechSynthesis.cancel(); } catch (e) { } }

function confetti() { const fx = $('#fx'); const cols = ['#FF8FB8', '#FFC21A', '#8B6FE0', '#38B98A', '#3C9BE0', '#FF5C93']; for (let i = 0; i < 28; i++) { const c = document.createElement('i'); c.className = 'conf'; c.style.left = R(0, 100) + 'vw'; c.style.background = pick(cols); c.style.animationDelay = (Math.random() * .3) + 's'; if (Math.random() < .4) c.style.borderRadius = '50%'; fx.appendChild(c); setTimeout(() => c.remove(), 1900); } }
function popText(t) { const p = document.createElement('div'); p.className = 'pop'; p.textContent = t; $('#fx').appendChild(p); setTimeout(() => p.remove(), 1000); }
function updStars(bump) { $('#starCount').textContent = S.stars; if (bump) { const p = $('#starPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }

/* ================= SCREENS ================= */
const app = $('#app');
function view(html) { stopSay(); app.innerHTML = html; window.scrollTo({ top: 0 }); }
function starsOf(id) { const b = S.best[id]; if (b == null) return '☆☆☆'; return b >= 9 ? '★★★' : b >= 7 ? '★★☆' : b >= 4 ? '★☆☆' : '☆☆☆'; }
function daysLeft() { const exam = new Date(2026, 10, 12); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((exam - now) / 864e5); }
const badge = (t, cls = 'pic') => `<span class="${cls} emo-badge">${t.emo}</span>`;

function home() {
  const d = daysLeft();
  view(`
  <section class="hero">
    <div class="mascots"><span class="bob">${MASCOT.bunny}</span><span class="bob2">${MASCOT.kitty}</span><span class="bob3">${MASCOT.puppy}</span></div>
    <div>
      <h1>二年級中文科評估溫習樂園</h1>
      <p>中書及中作：二上第一冊 第 1、4、8、12、14 課 · 中練：練習 2、3、5、10、19</p>
      ${d >= 0 ? `<div class="countdown">距離 11 月 12 日（星期四）中文科評估還有 <b>${d}</b> 天</div>` : '<div class="countdown">評估加油！</div>'}
      <div class="voice-note" id="vnote"></div>
    </div>
  </section>
  <div class="section-title">${BOW}課文（中書・中作）</div>
  <div class="grid">
    ${LESSONS.map(t => `<button class="topic-card ${t.col}" data-topic="${t.id}"><div><span class="tag">第 ${t.no} 課</span><h3>${t.title}</h3><p>${t.unit}</p></div><div class="stars">${starsOf(t.id)}</div>${badge(t)}</button>`).join('')}
  </div>
  <div class="section-title">${BOW}語文知識（中練）</div>
  <div class="grid">
    ${GRAMMAR.map(t => `<button class="topic-card ${t.col}" data-topic="${t.id}"><div><span class="tag">${t.no}</span><h3>${t.title}</h3><p>${t.sub}</p></div><div class="stars">${starsOf(t.id)}</div>${badge(t)}</button>`).join('')}
  </div>
  <div class="section-title">${BOW}閱讀理解</div>
  <div class="grid">
    ${READING.map(t => `<button class="topic-card c-peach" data-topic="${t.id}"><div><span class="tag">${t.src}</span><h3>${t.title}</h3><p>先聽文章，再答問題</p></div><div class="stars">${starsOf(t.id)}</div><span class="pic">${MASCOT.kitty}</span></button>`).join('')}
  </div>
  <div class="section-title">${BOW}挑戰區</div>
  <div class="special">
    <button class="topic-card c-butter" id="mockBtn"><div><span class="tag">25 題</span><h3>模擬評估</h3><p>所有課文和練習混合</p></div><div class="stars">${S.best.mock != null ? '最佳：' + S.best.mock + ' / 25' : ''}</div><span class="pic">${MASCOT.bunny}</span></button>
    <button class="topic-card c-sky" id="listenBtn"><div><span class="tag">10 題</span><h3>聽詞語挑戰</h3><p>聽粵語讀音，選出正確詞語</p></div><div class="stars">${S.best.listen != null ? '最佳：' + S.best.listen + ' / 10' : ''}</div><span class="pic">${MASCOT.puppy}</span></button>
    <button class="topic-card c-lav" id="mistakeBtn"><div><span class="tag">${S.mistakes.length} 題</span><h3>錯題本</h3><p>再做一次之前錯的題目</p></div><span class="pic">${MASCOT.frog}</span></button>
  </div>`);
  app.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => { sTap(); topic(b.dataset.topic); });
  $('#mockBtn').onclick = () => startQuiz('mock');
  $('#listenBtn').onclick = () => startQuiz('listen');
  $('#mistakeBtn').onclick = () => S.mistakes.length ? startQuiz('mistakes') : (popText('錯題本是空的！'), sGood());
  setTimeout(voiceNote, 600);
}
function voiceNote() {
  const n = $('#vnote'); if (!n) return;
  if (!('speechSynthesis' in window)) { n.textContent = '這個瀏覽器不支援朗讀功能。'; return; }
  pickVoice();
  if (!VOICE && speechSynthesis.getVoices().length) n.innerHTML = '提示：找不到粵語語音。iPad 可到「設定 › 輔助使用 › 朗讀內容 › 聲音 › 中文（香港）」下載。';
}

function topic(id, mode) {
  const t = ALL[id];
  if (t.kind === 'reading') return readingPage(t);
  mode = mode || (t.kind === 'lesson' ? 'text' : 'learn');
  const modes = t.kind === 'lesson'
    ? [['text', '📖 課文朗讀', 'c-sky'], ['cards', '🃏 字詞卡', 'c-mint'], ['learn', '💡 學習重點', 'c-butter'], ['quiz', '✏️ 練習 10 題', 'c-pink']]
    : [['learn', '💡 學習重點', 'c-butter'], ['quiz', '✏️ 練習 10 題', 'c-pink']];
  view(`
  <button class="back" id="bk">← 返回主頁</button>
  <div class="topic-head"><div class="badge ${t.col}"><span class="emo-big">${t.emo}</span></div><div><p>${t.kind === 'lesson' ? `第 ${t.no} 課 · ${t.unit}` : '中練 ' + t.no}</p><h2>${t.title}</h2></div></div>
  <div class="mode-row" style="grid-template-columns:repeat(${modes.length},1fr)">
    ${modes.map(([k, l, c]) => `<button class="mode-btn ${c} ${mode === k ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}
  </div>
  <div id="tbody"></div>`);
  $('#bk').onclick = home;
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { sTap(); b.dataset.m === 'quiz' ? startQuiz(id) : topic(id, b.dataset.m); });
  const body = $('#tbody');
  if (mode === 'text') textMode(t, body);
  else if (mode === 'cards') cardMode(t, body);
  else learnMode(t, body);
}

function learnMode(t, body) {
  body.innerHTML = t.learn.map((c, i) => `<div class="learn-card"><h4><span class="n">${i + 1}</span>${c[0]}<button class="speak" data-i="${i}">🔈 讀出來</button></h4>${c[1]}</div>`).join('') +
    `<div style="text-align:center;margin-top:10px"><button class="pill next" id="goQ" style="margin:0 auto">我明白了，開始練習 →</button></div>`;
  body.querySelectorAll('.speak').forEach(b => b.onclick = () => { const c = t.learn[+b.dataset.i]; const tmp = document.createElement('div'); tmp.innerHTML = c[1]; say(c[0] + '。' + tmp.textContent.replace(/✓/g, '').replace(/→/g, '，變成，')); });
  $('#goQ').onclick = () => startQuiz(t.id);
}

/* ---- 課文朗讀 with highlight ---- */
function textMode(t, body) {
  const allW = words(t).map(w => w[0]).sort((a, b) => b.length - a.length);
  const mark = s => { let out = esc(s); const re = new RegExp('(' + allW.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g'); return out.replace(re, '<u>$1</u>'); };
  let k = 0; const segs = [];
  const html = t.text.map(p => `<p class="${t.poem ? 'pline' : 'ppara'}">${p.map(s => { segs.push(s); return `<span class="seg" data-k="${k++}">${mark(s)}</span>`; }).join(t.poem ? '<br>' : '')}</p>`).join('');
  body.innerHTML = `<div class="reader">
    <div class="reader-bar"><button class="pill next" id="playAll">▶ 朗讀全文</button><button class="pill" id="stopAll">■ 停止</button><button class="pill" id="slowBtn">${S.slow ? '🐢 慢速' : '🐇 正常速度'}</button></div>
    <p class="reader-tip">點一下句子，聽粵語讀音。<u>有底線</u>的是本課字詞。</p>
    <div class="ptext ${t.poem ? 'poem' : ''}"><h3>${t.title}${t.author ? `<small>${t.author}</small>` : ''}</h3>${html}</div>
  </div>
  <div style="text-align:center;margin-top:14px"><button class="pill next" id="goC" style="margin:0 auto">下一步：字詞卡 →</button></div>`;
  let playing = false;
  const hl = i => body.querySelectorAll('.seg').forEach(e => e.classList.toggle('on', +e.dataset.k === i));
  const playFrom = i => { if (!playing || i >= segs.length) { playing = false; hl(-1); return; } hl(i); const el = body.querySelector(`.seg[data-k="${i}"]`); el && el.scrollIntoView({ behavior: 'smooth', block: 'center' }); say(segs[i], () => setTimeout(() => playFrom(i + 1), 250)); };
  body.querySelectorAll('.seg').forEach(e => e.onclick = () => { playing = false; const i = +e.dataset.k; hl(i); say(segs[i], () => { if (!playing) hl(-1); }); });
  $('#playAll').onclick = () => { playing = true; playFrom(0); };
  $('#stopAll').onclick = () => { playing = false; stopSay(); hl(-1); };
  $('#slowBtn').onclick = () => { S.slow = !S.slow; save(); $('#slowBtn').textContent = S.slow ? '🐢 慢速' : '🐇 正常速度'; };
  $('#goC').onclick = () => topic(t.id, 'cards');
}

/* ---- 字詞卡 ---- */
function cardMode(t, body) {
  const ws = words(t); let i = 0, flipped = false;
  const known = S.cards[t.id] = S.cards[t.id] || [];
  const draw = () => {
    const [w, tag] = ws[i];
    const ex = sentenceWith(t, w);
    const st = [...w].filter(c => t.strokes[c]).map(c => `${c}：${t.strokes[c]} 畫`).join('　');
    body.innerHTML = `<div class="cards">
      <div class="card-top"><span class="chip tagc ${tag === '書寫' ? 'c-pink' : tag === '認讀' ? 'c-sky' : 'c-mint'}">${tag}</span><span class="cnt">${i + 1} / ${ws.length}　已記熟 ${known.length}</span></div>
      <button class="flash ${flipped ? 'flip' : ''}" id="flash" aria-label="翻轉字詞卡">
        <div class="face front"><div class="fw">${w}</div><div class="ftip">點一下翻轉</div></div>
        <div class="face back"><div class="fw sm">${w}</div>
          ${t.meaning[w] ? `<div class="fm"><b>意思：</b>${t.meaning[w]}</div>` : ''}
          ${ex ? `<div class="fm"><b>課文句子：</b>${esc(ex).replace(w, `<span class="hl">${w}</span>`)}</div>` : ''}
          ${st ? `<div class="fm"><b>筆畫：</b>${st}</div>` : ''}
          ${tag === '書寫' ? '<div class="fm wtip">✍️ 這是「書寫」字詞，要懂得默寫！</div>' : ''}
        </div>
      </button>
      <div class="card-ctrl">
        <button class="pill" id="prev">◀ 上一個</button>
        <button class="pill c-sky" id="hear">🔈 聽讀音</button>
        <button class="pill ${known.includes(w) ? 'c-mint' : ''}" id="know">${known.includes(w) ? '✓ 已記熟' : '我記熟了'}</button>
        <button class="pill next" id="nxt">下一個 ▶</button>
      </div>
      <div class="word-strip">${ws.map(([x], k) => `<button class="wchip ${k === i ? 'on' : ''} ${known.includes(x) ? 'ok' : ''}" data-k="${k}">${x}</button>`).join('')}</div>
    </div>
    <div style="text-align:center;margin-top:14px"><button class="pill next" id="goQ" style="margin:0 auto">開始練習 →</button></div>`;
    $('#flash').onclick = () => { flipped = !flipped; $('#flash').classList.toggle('flip', flipped); sTap(); if (flipped) say(w + (ex ? '。' + ex : '')); };
    $('#hear').onclick = () => say(w);
    $('#prev').onclick = () => { i = (i - 1 + ws.length) % ws.length; flipped = false; draw(); say(ws[i][0]); };
    $('#nxt').onclick = () => { i = (i + 1) % ws.length; flipped = false; draw(); say(ws[i][0]); };
    $('#know').onclick = () => { const k = known.indexOf(w); if (k >= 0) known.splice(k, 1); else { known.push(w); sGood(); popText('記熟了！'); } save(); draw(); };
    body.querySelectorAll('.wchip').forEach(b => b.onclick = () => { i = +b.dataset.k; flipped = false; draw(); say(ws[i][0]); });
    $('#goQ').onclick = () => startQuiz(t.id);
  };
  draw();
}

/* ---- 閱讀理解 ---- */
function readingPage(t) {
  view(`<button class="back" id="bk">← 返回主頁</button>
  <div class="topic-head"><div class="badge c-peach">${MASCOT.kitty}</div><div><p>${t.src}</p><h2>${t.title}</h2></div></div>
  <div class="reader">
    <div class="reader-bar"><button class="pill next" id="playAll">▶ 朗讀全文</button><button class="pill" id="stopAll">■ 停止</button></div>
    <p class="reader-tip">先仔細閱讀文章（也可以點句子聽讀音），然後按「開始答題」。答題時可以再看文章。</p>
    <div class="ptext">${t.text.map((s, k) => `<p class="ppara"><span class="seg" data-k="${k}">${esc(s)}</span></p>`).join('')}</div>
  </div>
  <div style="text-align:center;margin-top:14px"><button class="pill next" id="goQ" style="margin:0 auto">開始答題（${t.qs.length} 題）→</button></div>`);
  $('#bk').onclick = home;
  let playing = false; const segs = t.text;
  const hl = i => app.querySelectorAll('.seg').forEach(e => e.classList.toggle('on', +e.dataset.k === i));
  const playFrom = i => { if (!playing || i >= segs.length) { playing = false; hl(-1); return; } hl(i); say(segs[i], () => setTimeout(() => playFrom(i + 1), 250)); };
  app.querySelectorAll('.seg').forEach(e => e.onclick = () => { playing = false; const i = +e.dataset.k; hl(i); say(segs[i], () => { if (!playing) hl(-1); }); });
  $('#playAll').onclick = () => { playing = true; playFrom(0); };
  $('#stopAll').onclick = () => { playing = false; stopSay(); hl(-1); };
  $('#goQ').onclick = () => startQuiz(t.id);
}

/* ================= QUIZ ENGINE ================= */
let Q = null;
function prep(q) { // shuffle options at display time
  q = { ...q };
  if (q.type === 'mc') q.choices = shuffle([q.answer, ...q.wrong.filter(x => x !== q.answer)].slice(0, 4));
  if (q.type === 'multi') q.choices = shuffle([...q.answers, ...q.wrong]);
  if (q.type === 'order') { let s; let g = 0; do { s = shuffle(q.tiles.map((x, i) => ({ x, i }))); } while (g++ < 10 && s.map(o => o.x).join('') === q.answer); q.pool = s; }
  return q;
}
const keyOf = q => (q.listen ? 'L:' + q.listen : q.text + '|' + (q.answer || ''));
function buildSet(mode) {
  const qs = []; const seen = new Set();
  const push = q => { if (!q) return false; const k = keyOf(q); if (seen.has(k)) return false; seen.add(k); qs.push(q); return true; };
  if (mode === 'mock') {
    LESSONS.forEach(l => { const b = shuffle(bank(l.id)); const base = b.filter(q => !q.tag); base.slice(0, 2).forEach(push); push(b.find(q => q.tag === '筆畫' && !seen.has(keyOf(q)))); });
    GRAMMAR.forEach(g => shuffle(bank(g.id)).slice(0, 1).forEach(push));
    READING.slice(0, 2).forEach(r => shuffle(bank(r.id)).slice(0, 1).forEach(push));
    shuffle(MIXED).slice(0, 3).forEach(q => push({ ...q, topic: 'mixed' }));
    let g = 0; while (qs.length < 25 && g++ < 50) push(shuffle(bank(pick(LESSONS).id))[0]);
    return shuffle(qs).slice(0, 25).map(prep);
  }
  if (mode === 'listen') { let g = 0; while (qs.length < 10 && g++ < 200) push(listenQ(pick(LESSONS))); return qs.map(prep); }
  if (mode === 'mistakes') return shuffle(S.mistakes).slice(0, 10).map(q => prep({ ...q, fromMist: 1 }));
  const t = ALL[mode];
  if (t.kind === 'reading') return bank(mode).map(prep);
  const b = shuffle(bank(mode));
  // lessons: 7 from textbook/中作, up to 2 auto (筆畫/詞義), 1 聽詞語
  if (t.kind === 'lesson') {
    b.filter(q => !q.tag).slice(0, 7).forEach(push);
    b.filter(q => q.tag).slice(0, 2).forEach(push);
    push(listenQ(t));
    for (const q of b) { if (qs.length >= 10) break; push(q); }
    return shuffle(qs).map(prep);
  }
  b.slice(0, 10).forEach(push);
  return qs.map(prep);
}
const topicTitle = id => id === 'mixed' ? '綜合（已有知識）' : ALL[id] ? ALL[id].title : '';
function title(mode) { return mode === 'mock' ? '模擬評估' : mode === 'listen' ? '聽詞語挑戰' : mode === 'mistakes' ? '錯題本' : ALL[mode].title; }

function startQuiz(mode) {
  sTap();
  Q = { mode, qs: buildSet(mode), i: 0, score: 0, tries: 0, log: [], exam: mode === 'mock' };
  if (!Q.qs.length) return home();
  showQ();
}

function showQ() {
  const q = Q.qs[Q.i]; Q.tries = 0; Q.done = false; Q.sel = new Set(); Q.built = [];
  const rd = ALL[q.topic] && ALL[q.topic].kind === 'reading' ? ALL[q.topic] : null;
  let area = '';
  if (q.type === 'mc') area = `${q.listen ? `<div class="qvis"><button class="big-ear" id="ear">🔈<small>再聽一次</small></button></div>` : ''}<div class="choices ${q.choices.some(c => c.length > 14) ? 'long' : ''}">${q.choices.map((c, i) => `<button class="choice" data-c="${i}"><span class="lt">${LET[i]}</span><span>${c}</span></button>`).join('')}</div>`;
  if (q.type === 'multi') area = `<p class="multi-tip">可以選多於一個答案，選好後按「確定」。</p><div class="choices multi ${q.choices.some(c => c.length > 10) ? 'long' : ''}">${q.choices.map((c, i) => `<button class="choice" data-c="${i}"><span class="lt">${LET[i]}</span><span>${c}</span></button>`).join('')}</div><div class="qbar"><button class="pill next" id="okMulti">確定</button></div>`;
  if (q.type === 'order') area = `<p class="multi-tip">按次序點選詞語卡，組成通順的句子。點上面的卡可以放回去。</p><div class="build" id="build"></div><div class="tiles" id="tiles"></div><div class="qbar"><button class="pill" id="clr">↺ 重新排</button><button class="pill next" id="okOrder">確定</button></div>`;
  view(`
  <div class="quiz-top"><button class="back" id="qx">✕ ${title(Q.mode)}</button><div class="progress"><i style="width:${(Q.i / Q.qs.length) * 100}%"></i></div><div class="qcount">${Q.i + 1}/${Q.qs.length}</div></div>
  <div class="qcard">
    <span class="qtag">${topicTitle(q.topic)}${q.tag ? ' · ' + q.tag : ''}</span>
    ${rd ? `<details class="passage"><summary>📄 看文章《${rd.title}》</summary>${rd.text.map(s => `<p>${esc(s)}</p>`).join('')}</details>` : ''}
    <div class="qhead"><div class="qtext">${fmt(q.text)}</div><button class="speak" id="spk">🔈</button></div>
    ${area}
    <div id="fb"></div>
    <div class="qbar">${!Q.exam ? '<button class="pill" id="hintBtn">💡 提示</button>' : ''}<button class="pill next" id="nextBtn" style="display:none">下一題 →</button></div>
  </div>`);
  $('#qx').onclick = home;
  $('#spk').onclick = () => q.listen ? say(q.listen) : say(q.text + (q.choices ? '。' + q.choices.map((c, i) => LET[i] + '，' + c).join('。') : ''));
  if (q.listen) { $('#ear').onclick = () => say(q.listen); setTimeout(() => say(q.listen), 350); }
  if ($('#hintBtn')) $('#hintBtn').onclick = () => { $('#fb').innerHTML = `<div class="feedback hint">${MASCOT.bunny}<div>提示：${q.hint || (q.type === 'order' ? '先找出誰（人物），再找做甚麼。' : '把每個答案放進句子裏讀一讀，看看哪個最通順。')}</div></div>`; };
  $('#nextBtn').onclick = next;
  if (q.type === 'mc') app.querySelectorAll('.choice').forEach(b => b.onclick = () => answer(q.choices[+b.dataset.c] === q.answer, b, q.choices[+b.dataset.c]));
  if (q.type === 'multi') {
    app.querySelectorAll('.choice').forEach(b => b.onclick = () => { if (Q.done) return; sTap(); const i = +b.dataset.c; Q.sel.has(i) ? Q.sel.delete(i) : Q.sel.add(i); b.classList.toggle('sel'); });
    $('#okMulti').onclick = () => { if (Q.done || !Q.sel.size) return; const picked = [...Q.sel].map(i => q.choices[i]); const ok = picked.length === q.answers.length && picked.every(p => q.answers.includes(p)); answer(ok, null, picked.join('、')); };
  }
  if (q.type === 'order') {
    const drawT = () => {
      $('#build').innerHTML = Q.built.length ? Q.built.map((o, k) => `<button class="tile in" data-b="${k}">${o.x}</button>`).join('') : '<span class="ph">點下面的詞語卡……</span>';
      $('#tiles').innerHTML = q.pool.map((o, k) => Q.built.includes(o) ? `<span class="tile ghost">${o.x}</span>` : `<button class="tile" data-p="${k}">${o.x}</button>`).join('');
      app.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { if (Q.done) return; sTap(); Q.built.push(q.pool[+b.dataset.p]); drawT(); });
      app.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { if (Q.done) return; Q.built.splice(+b.dataset.b, 1); drawT(); });
    };
    drawT();
    $('#clr').onclick = () => { if (Q.done) return; Q.built = []; drawT(); };
    $('#okOrder').onclick = () => { if (Q.done) return; if (Q.built.length < q.tiles.length) { popText('還有詞語卡未用！'); return; } const s = Q.built.map(o => o.x).join(''); answer(s === q.answer, null, s); };
  }
}

function correctText(q) { return q.type === 'multi' ? q.answers.join('、') : q.answer; }

function answer(ok, btn, given) {
  if (Q.done) return;
  const q = Q.qs[Q.i]; Q.tries++;
  const fb = $('#fb');
  setTimeout(() => { const f = $('#fb'); if (f && f.firstChild) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 50);
  if (ok) {
    Q.done = true; const first = Q.tries === 1;
    if (first) { Q.score++; S.stars++; updStars(true); }
    if (btn) btn.classList.add('right');
    if (q.type === 'mc') app.querySelectorAll('.choice').forEach(c => { if (c !== btn) c.classList.add('dim'); });
    if (q.type === 'multi') app.querySelectorAll('.choice').forEach(c => c.classList.add(q.answers.includes(q.choices[+c.dataset.c]) ? 'right' : 'dim'));
    if (q.type === 'order') $('#build').classList.add('right');
    sGood(); if (first) confetti();
    popText(pick(['好叻呀！', '答對了！', '你真棒！', '太厲害了！', '做得好！']));
    fb.innerHTML = Q.exam ? '' : `<div class="feedback good">${MASCOT.kitty}<div>${first ? '答對了！＋1 ★' : '答對了！下次一次就做對吧！'}<div class="exp">${q.explain || ''}</div></div></div>`;
    if (!Q.exam && q.type === 'order') say(q.answer);
    Q.log.push({ q, ok: first });
    if (q.fromMist && first) S.mistakes = S.mistakes.filter(m => keyOf(m) !== keyOf(q));
    checkSticker(); save();
    if (Q.exam) setTimeout(next, 900); else $('#nextBtn').style.display = '';
  } else {
    sBad();
    if (btn) { btn.classList.add('wrong'); }
    if (q.type === 'order') { const b = $('#build'); b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); }
    if (Q.exam || Q.tries >= 2) {
      Q.done = true;
      if (!q.fromMist && !S.mistakes.some(m => keyOf(m) === keyOf(q))) { const { fromMist, choices, pool, ...clean } = q; S.mistakes.push(clean); if (S.mistakes.length > 80) S.mistakes.shift(); }
      save();
      Q.log.push({ q, ok: false, given });
      if (Q.exam) { setTimeout(next, 700); return; }
      if (q.type === 'mc') app.querySelectorAll('.choice').forEach(c => { if (q.choices[+c.dataset.c] === q.answer) c.classList.add('right'); else if (c !== btn) c.classList.add('dim'); });
      if (q.type === 'multi') app.querySelectorAll('.choice').forEach(c => { c.classList.remove('sel'); c.classList.add(q.answers.includes(q.choices[+c.dataset.c]) ? 'right' : 'dim'); });
      fb.innerHTML = `<div class="feedback bad">${MASCOT.puppy}<div>正確答案是 <span class="hl">${correctText(q)}</span>。已放入錯題本，之後再試吧！<div class="exp">${q.explain || ''}</div></div></div>`;
      say('正確答案係，' + correctText(q));
      $('#nextBtn').style.display = '';
    } else {
      fb.innerHTML = `<div class="feedback hint">${MASCOT.bunny}<div>差一點點！再試一次。<div class="exp">提示：${q.hint || (q.type === 'order' ? '先找出誰（人物），再找做甚麼。' : '把答案放進句子裏讀一讀，看看通不通順。')}</div></div></div>`;
      if (btn) btn.disabled = true;
      if (q.type === 'multi') { Q.sel.clear(); app.querySelectorAll('.choice').forEach(c => c.classList.remove('sel')); }
      if (q.type === 'order') setTimeout(() => { Q.built = []; const c = $('#clr'); c && c.onclick(); const b = $('#build'); b && b.classList.remove('wrong'); }, 700);
    }
  }
}
function next() { Q.i++; if (Q.i >= Q.qs.length) result(); else showQ(); }
function checkSticker() { const n = STICKERS.findIndex((_, i) => S.stars === stickerAt(i)); if (n >= 0) setTimeout(() => { popText('獲得新貼紙 ' + STICKERS[n]); tone([[523, .1], [659, .1], [784, .1], [1047, .3]]); }, 900); }

function result() {
  const total = Q.qs.length, sc = Q.score;
  if (ALL[Q.mode]) S.best[Q.mode] = Math.max(S.best[Q.mode] || 0, Math.round(sc / total * 10));
  if (Q.mode === 'mock') S.best.mock = Math.max(S.best.mock || 0, sc);
  if (Q.mode === 'listen') S.best.listen = Math.max(S.best.listen || 0, sc);
  save();
  const ratio = sc / total; const st = ratio >= .9 ? '★★★' : ratio >= .7 ? '★★☆' : ratio >= .4 ? '★☆☆' : '☆☆☆';
  const wrong = Q.log.filter(l => !l.ok);
  let breakdown = '';
  if (Q.mode === 'mock') { const by = {}; Q.log.forEach(l => { const t = topicTitle(l.q.topic); by[t] = by[t] || [0, 0]; by[t][1]++; if (l.ok) by[t][0]++; }); breakdown = `<div class="topic-break">${Object.entries(by).map(([t, [a, b]]) => `<div>${a === b ? '🌟' : '💪'} ${t}：${a}/${b}</div>`).join('')}</div>`; }
  view(`<div class="result">
    <div style="display:flex;justify-content:center"><span class="bob" style="width:130px">${ratio >= .7 ? MASCOT.kitty : MASCOT.puppy}</span></div>
    <h2>${ratio >= .9 ? '超級厲害！' : ratio >= .7 ? '做得很好！' : ratio >= .4 ? '有進步！繼續加油！' : '慢慢來，再試一次！'}</h2>
    <div class="score">${sc} / ${total}</div><div class="bigstars">${st}</div>
    ${breakdown}
    ${wrong.length ? `<div class="review"><h3>溫習一下做錯的題目：</h3>${wrong.map(l => `<div class="item">${l.q.listen ? '聽詞語' : fmt(l.q.text)}<br>正確答案：<b>${correctText(l.q)}</b>　${l.q.explain ? '— ' + l.q.explain : ''}</div>`).join('')}</div>` : ''}
    <div class="btns"><button class="pill next" id="again">再做一次</button><button class="pill" id="hm">返回主頁</button>${ALL[Q.mode] ? '<button class="pill" id="lrn">📖 返回課文／重點</button>' : ''}</div>
  </div>`);
  if (ratio >= .7) { confetti(); setTimeout(confetti, 500); sGood(); }
  $('#again').onclick = () => startQuiz(Q.mode);
  $('#hm').onclick = home;
  if ($('#lrn')) $('#lrn').onclick = () => topic(Q.mode);
}

function stickers() {
  view(`<button class="back" id="bk">← 返回主頁</button>
  <div class="topic-head"><div class="badge c-pink">${MASCOT.kitty}</div><div><p>每答對 5 題（一次答對）可得一張貼紙</p><h2>我的貼紙簿</h2></div></div>
  <p style="font-weight:700">你已經有 <span class="hl">${S.stars}</span> 粒星星 ★</p>
  <div class="sticker-grid">${STICKERS.map((s, i) => S.stars >= stickerAt(i) ? `<div class="sticker">${s}</div>` : `<div class="sticker lock">🔒<small>${stickerAt(i)} ★</small></div>`).join('')}</div>
  <div style="text-align:center;margin-top:20px"><button class="pill" id="rst">重設進度</button></div>`);
  $('#bk').onclick = home;
  let armed = false; $('#rst').onclick = () => { if (!armed) { armed = true; $('#rst').textContent = '再按一次確認清除所有進度'; return; } S.stars = 0; S.best = {}; S.mistakes = []; S.cards = {}; save(); updStars(); stickers(); };
}

/* ---------------- boot ---------------- */
$('#homeBtn').onclick = home;
$('#stickerBtn').onclick = stickers;
const sb = $('#soundBtn'); const setSB = () => sb.textContent = S.sound ? '🔊' : '🔇'; setSB();
sb.onclick = () => { S.sound = !S.sound; save(); setSB(); };
updStars();
if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { pickVoice(); voiceNote(); }; }
home();

window.__zh = { ALL, bank, buildSet, prep, listenQ, preview: (id, i) => { const b = bank(id); Q = { mode: id, qs: [prep(b[i])], i: 0, score: 0, log: [], exam: false }; showQ(); } };
