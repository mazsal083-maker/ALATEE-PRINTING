'use strict';

/* ── CONFIG ──────────────────────────────────────────── */
const WA_NUMBER    = '6281234567890';
const API_PRIMARY  = '/api/pelanggan';
const API_FALLBACK = '/api/pelanggan2';

/* ── STATE ───────────────────────────────────────────── */
let chatHistory      = [];
let attachedFile     = null;
let isStreaming      = false;
let callActive       = false;
let callTimerInt     = null;
let callSeconds      = 0;
let muteActive       = false;
let speakerActive    = false;
let callAutoEndTimer = null;

/* ================================================================
   INJECT STYLES — jalan sebelum apapun
================================================================ */
(function injectBaseStyles() {
  const s = document.createElement('style');
  s.textContent = `
    /* Reveal scroll animation */
    .reveal{opacity:0;transform:translateY(20px);
      transition:opacity .5s ease,transform .5s ease}
    .reveal.revealed{opacity:1;transform:none}
    .reveal-delay-1{transition-delay:.1s}
    .reveal-delay-2{transition-delay:.2s}
    .reveal-delay-3{transition-delay:.3s}

    /* Streaming cursor bar */
    .cursor-bar{
      display:inline-block;width:2px;height:14px;
      background:var(--accent);vertical-align:middle;
      margin-left:2px;border-radius:1px;
      animation:cbar .7s step-end infinite}
    @keyframes cbar{0%,100%{opacity:1}50%{opacity:0}}
    .streaming-bubble{border-color:var(--accent)!important}

    /* Loading screen — spinner bundar */
    #loading-screen{
      position:fixed;inset:0;z-index:9999;
      background:var(--bg,#fff);
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:20px;
      transition:opacity .5s ease,visibility .5s ease}
    #loading-screen.hidden{opacity:0;visibility:hidden;pointer-events:none}
    .ld-spinner{
      width:64px;height:64px;animation:ld-spin 1.1s linear infinite}
    @keyframes ld-spin{to{transform:rotate(360deg)}}
    .ld-spinner circle{
      fill:none;stroke:var(--accent,#1A7FE0);
      stroke-width:5;stroke-linecap:round;
      stroke-dasharray:150 100;
      animation:ld-dash 1.1s ease-in-out infinite}
    @keyframes ld-dash{
      0%{stroke-dasharray:1 150;stroke-dashoffset:0}
      50%{stroke-dasharray:90 150;stroke-dashoffset:-35}
      100%{stroke-dasharray:90 150;stroke-dashoffset:-124}}
    .ld-brand{
      font-family:'Syne',sans-serif;font-size:19px;
      font-weight:800;color:var(--text-primary,#07254D);letter-spacing:-.3px}
    .ld-typing-text{
      font-size:13px;color:var(--text-secondary,#666);
      min-height:18px;letter-spacing:.2px}

    /* Chat page layout — PENTING: gunakan display:none/flex bukan class */
    #chat-page{
      position:fixed;inset:0;z-index:200;
      background:var(--bg);
      flex-direction:column}
    /* display diatur lewat JS (display:none -> display:flex) */
    .chat-messages{
      flex:1;overflow-y:auto;
      padding:72px 14px 80px;
      display:flex;flex-direction:column;gap:10px}
    .chat-header{
      position:fixed;top:0;left:0;right:0;z-index:201;
      height:62px;background:var(--surface);
      border-bottom:1px solid var(--border);
      display:flex;align-items:center;gap:10px;
      padding:0 14px;box-shadow:var(--shadow-sm)}
    .chat-back-btn{
      width:36px;height:36px;border-radius:50%;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;
      color:var(--text-secondary);transition:all .2s;cursor:pointer}
    .chat-back-btn:hover{background:var(--accent-light);color:var(--accent)}
    .chat-back-btn svg{width:20px;height:20px}
    .chat-header-avatar{
      width:40px;height:40px;border-radius:50%;overflow:hidden;
      border:2px solid var(--accent-light);flex-shrink:0;
      background:var(--surface);
      display:flex;align-items:center;justify-content:center}
    .chat-header-avatar img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-touch-callout:none}
    .chat-header-avatar-fallback{
      font-family:'Syne',sans-serif;font-size:12px;font-weight:800;color:#fff}
    .chat-header-info{flex:1;min-width:0}
    .chat-header-name{font-weight:700;font-size:15px;color:var(--text-primary)}
    .chat-header-status{
      font-size:11px;color:var(--text-secondary);
      display:flex;align-items:center;gap:4px}
    .chat-status-dot{
      width:7px;height:7px;border-radius:50%;background:#1fba59;
      flex-shrink:0;animation:sdpulse 2s ease-in-out infinite}
    @keyframes sdpulse{
      0%,100%{box-shadow:0 0 0 0 rgba(31,186,89,.4)}
      50%{box-shadow:0 0 0 5px rgba(31,186,89,0)}}
    .chat-hdr-btn{
      width:38px;height:38px;border-radius:50%;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;
      color:var(--text-secondary);border:1px solid var(--border);
      transition:all .2s;cursor:pointer}
    .chat-hdr-btn:hover{
      border-color:var(--accent);color:var(--accent);background:var(--accent-light)}
    .chat-hdr-btn svg{width:18px;height:18px}

    /* Layanan icon SVG styling */
    .layanan-icon svg{width:28px;height:28px;stroke:var(--accent)}
    .keunggulan-icon svg{width:26px;height:26px;stroke:var(--accent)}
    .galeri-emoji svg{stroke:rgba(255,255,255,.9);filter:drop-shadow(0 1px 3px rgba(0,0,0,.3))}
    .map-pin svg{stroke:var(--accent)}

    /* Call overlay double ripple */
    .call-avatar{position:relative}
    .call-avatar::after{
      content:'';position:absolute;inset:-8px;border-radius:50%;
      border:2px solid rgba(255,255,255,.18);
      animation:ripple2 2s ease-in-out infinite .6s}
    @keyframes ripple2{
      0%,100%{transform:scale(1);opacity:.6}
      50%{transform:scale(1.2);opacity:0}}

    /* Hero typing cursor */
    #typingText{
      border-right:2px solid var(--accent);
      padding-right:1px;
      animation:typecur .75s step-end infinite}
    @keyframes typecur{
      0%,100%{border-color:var(--accent)}
      50%{border-color:transparent}}
  `;
  document.head.appendChild(s);
})();

/* ================================================================
   LOADING SCREEN — build markup + typing
================================================================ */
(function buildLoading() {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;
  ls.innerHTML = `
    <svg class="ld-spinner" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="20"/>
    </svg>
    <div class="ld-brand">Alatee Printing</div>
    <div class="ld-typing-text" id="ldTyping"></div>
  `;
})();

const LD_WORDS = ['Memuat halaman...','Menyiapkan layanan...','Hampir selesai...'];
let ldIdx = 0, ldCh = 0, ldDel = false;
function runLdTyping() {
  const el = document.getElementById('ldTyping');
  if (!el) return;
  const w = LD_WORDS[ldIdx];
  if (!ldDel) {
    el.textContent = w.slice(0, ++ldCh);
    if (ldCh === w.length) { ldDel = true; setTimeout(runLdTyping, 900); }
    else setTimeout(runLdTyping, 50);
  } else {
    el.textContent = w.slice(0, --ldCh);
    if (ldCh === 0) {
      ldDel = false;
      ldIdx = (ldIdx + 1) % LD_WORDS.length;
      setTimeout(runLdTyping, 200);
    } else setTimeout(runLdTyping, 28);
  }
}
runLdTyping();

/* ================================================================
   WINDOW LOAD
================================================================ */
/* ── Tutup loading secepat mungkin setelah DOM siap ── */
function dismissLoading() {
  const ls = document.getElementById('loading-screen');
  if (!ls || ls.style.display === 'none') return;
  ls.classList.add('hidden');
  setTimeout(() => { ls.style.display = 'none'; }, 500);
  initCountUp();
  initReveal();
  initHeroTyping();
  fixNavLogo();
  initGaleri();
  preloadVoices();
  setTimeout(initGaleriSlider, 300);
}

// Tutup loading segera setelah DOM siap (tidak nunggu gambar)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(dismissLoading, 600));
} else {
  setTimeout(dismissLoading, 600); // DOM sudah siap
}
// Fallback: kalau 3 detik masih muncul, paksa tutup
setTimeout(dismissLoading, 3000);

/* ================================================================
   GALERI IMAGE HANDLER
================================================================ */
function initGaleri() {
  const galeriImgs = document.querySelectorAll('.galeri-item img');
  galeriImgs.forEach(img => {
    const item = img.closest('.galeri-item');
    const emoji = item ? item.querySelector('.galeri-emoji') : null;

    const showImg = () => {
      img.style.display = 'block';
      if (emoji) emoji.style.display = 'none';
    };
    const showEmoji = () => {
      img.style.display = 'none';
      if (emoji) emoji.style.display = '';
    };

    if (img.complete) {
      img.naturalWidth > 0 ? showImg() : showEmoji();
    } else {
      img.addEventListener('load', showImg);
      img.addEventListener('error', showEmoji);
    }
  });
}

/* ================================================================
   NAV LOGO FIX
================================================================ */
function fixNavLogo() {
  const img  = document.getElementById('nav-logo-img');
  const text = document.getElementById('nav-logo-text');
  if (!img) return;
  if (img.complete && img.naturalWidth > 0) {
    img.style.display = 'block';
    if (text) text.style.display = 'none';
  }
  img.onerror = () => {
    img.style.display = 'none';
    if (text) text.style.display = 'flex';
  };
}

/* ================================================================
   THEME TOGGLE
================================================================ */
const THEME_KEY = 'alatee_theme';
(function() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
});

/* ================================================================
   HAMBURGER
================================================================ */
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('navMobile')?.classList.toggle('open');
});
function closeMobileNav() {
  document.getElementById('navMobile')?.classList.remove('open');
}

/* ================================================================
   HERO TYPING
================================================================ */
const HERO_WORDS = ['Kebutuhan','Impian','Kualitas','Identitas','Bisnis'];
let hIdx = 0, hCh = 0, hDel = false;
function initHeroTyping() {
  const el = document.getElementById('typingText');
  if (!el) return;
  function tick() {
    const w = HERO_WORDS[hIdx];
    if (!hDel) {
      el.textContent = w.slice(0, ++hCh);
      if (hCh === w.length) { hDel = true; setTimeout(tick, 1600); }
      else setTimeout(tick, 85);
    } else {
      el.textContent = w.slice(0, --hCh);
      if (hCh === 0) {
        hDel = false;
        hIdx = (hIdx + 1) % HERO_WORDS.length;
        setTimeout(tick, 280);
      } else setTimeout(tick, 42);
    }
  }
  tick();
}

/* ================================================================
   COUNT-UP  (24 Jam: loop terus)
================================================================ */
function initCountUp() {
  document.querySelectorAll('.count-up').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    const is24   = suffix.includes('Jam');
    if (is24) {
      let cur = 0;
      function loop24() {
        cur = 0;
        const step = () => {
          el.textContent = (++cur) + suffix;
          if (cur < target) setTimeout(step, 100);
          else setTimeout(loop24, 2000);
        };
        step();
      }
      loop24();
    } else {
      let t0 = null;
      const D = 1800;
      (function step(ts) {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / D, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(e * target) + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target + suffix;
      })(performance.now());
    }
  });
}

/* ================================================================
   SCROLL REVEAL + NAV ACTIVE
================================================================ */
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

window.addEventListener('scroll', () => {
  const sy = window.scrollY + 90;
  document.querySelectorAll('section[id]').forEach(sec => {
    const link = document.querySelector(`.nav-links a[href="#${sec.id}"]`);
    if (!link) return;
    if (sec.offsetTop <= sy && sec.offsetTop + sec.offsetHeight > sy) {
      document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
    }
  });
}, { passive: true });

/* ================================================================
   CHAT PAGE  — display:none <-> display:flex
================================================================ */
function openChat() {
  const chatPage = document.getElementById('chat-page');
  const mainPage = document.getElementById('main-page');
  const nav      = document.querySelector('.nav');
  if (!chatPage) { console.error('chat-page not found!'); return; }

  mainPage.style.display = 'none';
  chatPage.style.display = 'flex';
  if (nav) nav.style.display = 'none';
  document.getElementById('navMobile')?.classList.remove('open');
  window.scrollTo(0, 0);
  history.pushState({ chat: true }, '');

  // Welcome message sekali saja
  const msgs = document.getElementById('chatMessages');
  if (msgs && msgs.children.length === 0) {
    setTimeout(() => {
      appendMessage('assistant',
        'Halo kak! Selamat datang di Alatee Printing. Saya Ayla, siap bantu kaka seputar layanan cetak kami. Ada yang bisa Ayla bantu hari ini?');
    }, 350);
  }
}

function closeChat() {
  const chatPage = document.getElementById('chat-page');
  const mainPage = document.getElementById('main-page');
  const nav      = document.querySelector('.nav');
  chatPage.style.display = 'none';
  mainPage.style.display = 'block';
  if (nav) nav.style.display = '';
}

window.addEventListener('popstate', () => {
  const cp = document.getElementById('chat-page');
  if (cp && cp.style.display === 'flex') closeChat();
});

/* ================================================================
   FILE ATTACH
================================================================ */
function handleFileAttach(input) {
  const file = input.files[0];
  if (!file) return;
  attachedFile = file;
  document.getElementById('filePreviewName').textContent = file.name;
  document.getElementById('filePreview').classList.add('show');
}

function removeFile() {
  attachedFile = null;
  document.getElementById('filePreview').classList.remove('show');
  const fi = document.getElementById('fileInput');
  if (fi) fi.value = '';
}

/* ================================================================
   SEND MESSAGE
================================================================ */
function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  if (isStreaming) return;
  const inputEl = document.getElementById('chatInput');
  const text    = inputEl.innerText.trim();
  if (!text && !attachedFile) return;

  inputEl.innerText = '';
  const file = attachedFile;
  removeFile();

  const display = file
    ? (text ? `${text}\n[File: ${file.name}]` : `[Lampiran: ${file.name}]`)
    : text;
  appendMessage('user', display);
  chatHistory.push({ role: 'user', content: text || `[File: ${file?.name}]` });

  const typingId = showTyping();
  isStreaming = true;
  setSendBtn(true);

  try {
    let imageBase64 = null, imageMimeType = null;
    if (file && file.type.startsWith('image/')) {
      imageBase64   = await fileToBase64(file);
      imageMimeType = file.type;
    }
    const result = await callAI(chatHistory, imageBase64, imageMimeType, typingId);
    if (result) chatHistory.push({ role: 'assistant', content: result });
  } catch (err) {
    removeTyping(typingId);
    appendMessage('assistant',
      'Waduh, koneksi sedang gangguan kak. Silakan hubungi kami langsung di  WhatsApp  ya kak!');
  } finally {
    isStreaming = false;
    setSendBtn(false);
  }
 }

/* ================================================================
   AI CALL — Gemini → Groq → WA fallback
================================================================ */
async function callAI(messages, imageBase64, imageMimeType, typingId) {
  // 1. Coba Gemini dulu
  try {
    const result = await streamEndpoint(API_PRIMARY, messages, imageBase64, imageMimeType, typingId);
    if (result !== null && result !== '') return result;
    console.warn('Gemini return kosong, coba Groq');
    showToast('Beralih ke server cadangan...');
  } catch (e1) {
    console.warn('Gemini gagal:', e1.message, '-> coba Groq');
    showToast('Beralih ke server cadangan...');
  }

  // 2. Coba Groq fallback
  try {
    const result = await streamEndpoint(API_FALLBACK, messages, null, null, typingId);
    if (result !== null && result !== '') return result;
    throw new Error('Groq return kosong');
  } catch (e2) {
    console.warn('Groq gagal:', e2.message);
    removeTyping(typingId);
    appendMessage('assistant',
      'Maaf kak, koneksi sedang bermasalah. Silakan hubungi kami via WhatsApp ya kak! 😊');
    return null;
  }
}

async function streamEndpoint(endpoint, messages, imageBase64, imageMimeType, typingId) {
  const body = { messages, stream: true };
  if (imageBase64) { body.imageBase64 = imageBase64; body.imageMimeType = imageMimeType; }

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
  } catch (fetchErr) {
    throw new Error('Fetch gagal ke ' + endpoint + ': ' + fetchErr.message);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch(e) {}
    console.error('HTTP ' + res.status + ' dari ' + endpoint + ':', detail);
    throw new Error('HTTP ' + res.status + ' dari ' + endpoint);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', fullText = '', msgEl = null, removed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data: ')) continue;

        let d;
        try { d = JSON.parse(t.slice(6)); } catch(e) { continue; }

        // Backend kirim error tapi masih ada fullText
        if (d.error && d.done) {
          console.error('Stream error dari backend:', d.error);
          if (!removed) { removeTyping(typingId); removed = true; }
          if (msgEl) finalizeStreamBubble(msgEl, fullText);
          return fullText || null;
        }

        // Ada teks
        if (d.text) {
          if (!removed) {
            removeTyping(typingId);
            removed = true;
            msgEl = createStreamBubble();
          }
          fullText += d.text;
          updateStreamBubble(msgEl, fullText);
        }

        // Signal selesai
        if (d.done) {
          if (!removed) { removeTyping(typingId); removed = true; }
          if (msgEl) {
            finalizeStreamBubble(msgEl, fullText);
          } else if (fullText) {
            msgEl = appendMessage('assistant', fullText);
          }
          return fullText || null;
        }
      }
    }
  } finally {
    if (!removed) { removeTyping(typingId); removed = true; }
  }

  // Stream habis tanpa done signal
  if (msgEl) finalizeStreamBubble(msgEl, fullText);
  else if (fullText) appendMessage('assistant', fullText);
  return fullText || null;
}

/* ================================================================
   CHAT UI HELPERS
================================================================ */
function nowStr() {
  return new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}

function appendMessage(role, text) {
  const msgs   = document.getElementById('chatMessages');
  const isUser = role === 'user';
  const wrap   = document.createElement('div');
  wrap.className = 'msg-wrap' + (isUser ? ' user' : '');

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar-sm';
  if (isUser) {
    avatar.innerHTML = `<div class="msg-avatar-sm-icon user-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>`;
  } else {
    avatar.innerHTML = `<img src="profil.jpg" alt="Ayla" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="msg-avatar-sm-icon" style="display:none">AP</div>`;
  }

  const col = document.createElement('div');
  col.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = renderText(text);

  if (!isUser) addCopyBtn(bubble, text);

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = nowStr();

  col.appendChild(bubble);
  col.appendChild(time);
  wrap.appendChild(avatar);
  wrap.appendChild(col);
  msgs.appendChild(wrap);
  scrollBottom();
  return bubble;
}

function renderText(raw) {
  let s = String(raw)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
  // Bold **text**
  s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  // Linkify
  s = s.replace(/(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" style="color:var(--accent);text-decoration:underline">$1</a>');
  // Newline
  s = s.replace(/\n/g,'<br>');
  return s;
}

function addCopyBtn(bubble, text) {
  const actions = document.createElement('div');
  actions.className = 'msg-actions';
  const icon = document.createElement('div');
  icon.className = 'msg-action-icon';
  icon.title = 'Salin';
  icon.style.cursor = 'pointer';
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" width="13" height="13">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
  icon.onclick = () => {
    navigator.clipboard.writeText(text).then(() => showToast('Pesan disalin'));
  };
  actions.appendChild(icon);
  bubble.appendChild(actions);
}

function createStreamBubble() {
  const msgs = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar-sm';
  avatar.innerHTML = `<img src="profil.jpg" alt="Ayla" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="msg-avatar-sm-icon" style="display:none">AP</div>`;

  const col = document.createElement('div');
  col.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble streaming-bubble';
  bubble.innerHTML = '<span class="cursor-bar"></span>';

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = nowStr();

  col.appendChild(bubble);
  col.appendChild(time);
  wrap.appendChild(avatar);
  wrap.appendChild(col);
  msgs.appendChild(wrap);
  scrollBottom();
  return bubble;
}

function updateStreamBubble(bubble, text) {
  if (!bubble) return;
  bubble.innerHTML = renderText(text) + '<span class="cursor-bar"></span>';
  scrollBottom();
}

function finalizeStreamBubble(bubble, text) {
  if (!bubble) return;
  bubble.querySelector('.cursor-bar')?.remove();
  bubble.classList.remove('streaming-bubble');
  bubble.innerHTML = renderText(text);
  addCopyBtn(bubble, text);
}

function showTyping() {
  const msgs = document.getElementById('chatMessages');
  const id   = 'typ-' + Date.now();
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  wrap.id = id;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar-sm';
  avatar.innerHTML = `<img src="profil.jpg" alt="Ayla" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="msg-avatar-sm-icon" style="display:none">AP</div>`;

  const bubble = document.createElement('div');
  bubble.className = 'typing-bubble';
  bubble.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  scrollBottom();
  return id;
}

function removeTyping(id) { document.getElementById(id)?.remove(); }
function scrollBottom() {
  const m = document.getElementById('chatMessages');
  if (m) m.scrollTop = m.scrollHeight;
}
function setSendBtn(disabled) {
  const b = document.getElementById('sendBtn');
  if (b) b.disabled = disabled;
}

/* ================================================================
   CALL OVERLAY — WA Style
================================================================ */
/* ================================================================
   VOICE CALL — dua arah: user bicara → AI jawab pakai TTS
================================================================ */
let recognition     = null;
let callListening   = false;
let callSilenceTimer = null;

async function startCall() {
  if (callActive) return;

  // Cek browser support
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('Browser kamu tidak mendukung fitur suara 😢', 3000);
    return;
  }

  const overlay = document.getElementById('call-overlay');
  const status  = document.getElementById('callStatus');
  const timer   = document.getElementById('callTimer');
  if (!overlay) return;

  overlay.classList.add('active');
  callActive    = true;
  muteActive    = false;
  speakerActive = false;
  callSeconds   = 0;
  timer.textContent = '';

  // Fix avatar
  const avatarImg = overlay.querySelector('.call-avatar img');
  if (avatarImg) {
    avatarImg.style.display = 'block';
    avatarImg.onerror = () => {
      avatarImg.style.display = 'none';
      const fb = overlay.querySelector('.call-avatar-icon');
      if (fb) fb.style.display = 'flex';
    };
  }

  // Phase 1: Menghubungi
  status.textContent = 'Menghubungi...';
  await sleep(1500);
  if (!callActive) return;

  // Phase 2: Berdering
  status.textContent = 'Berdering...';
  playRing();
  await sleep(2000);
  if (!callActive) return;

  // Phase 3: Terhubung
  stopRing();
  status.textContent = 'Terhubung';

  callTimerInt = setInterval(() => {
    callSeconds++;
    timer.textContent = fmtTime(callSeconds);
  }, 1000);

  // Sapa pembuka
  await speakTTSAsync('Halo kak! Selamat datang di Alatee Printing, saya Ayla. Ada yang bisa saya bantu kak?');
  if (!callActive) return;

  // Mulai dengarkan user
  startListening();
}

function startListening() {
  if (!callActive || muteActive) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  const status = document.getElementById('callStatus');

  recognition = new SR();
  recognition.lang = 'id-ID';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    callListening = true;
    if (status) status.textContent = '🎤 Mendengarkan...';
  };

  recognition.onresult = async (e) => {
    callListening = false;
    clearTimeout(callSilenceTimer);
    const text = e.results[0][0].transcript.trim();
    if (!text || !callActive) return;

    if (status) status.textContent = 'Memproses...';

    // Kirim ke AI, dapatkan respons teks
    const aiReply = await getCallAIReply(text);
    if (!callActive) return;

    // Bacakan jawaban AI
    await speakTTSAsync(aiReply);
    if (!callActive) return;

    // Dengarkan lagi
    startListening();
  };

  recognition.onerror = (e) => {
    callListening = false;
    if (!callActive) return;
    if (e.error === 'no-speech') {
      // Tidak ada suara 5 detik → tanya lagi
      callSilenceTimer = setTimeout(() => {
        if (callActive && !callListening) {
          speakTTSAsync('Masih ada kak? Silakan bicara ya 😊').then(() => {
            if (callActive) startListening();
          });
        }
      }, 1000);
    } else {
      if (callActive) startListening(); // coba lagi
    }
  };

  recognition.onend = () => {
    callListening = false;
  };

  try { recognition.start(); } catch(e) {}
}

async function getCallAIReply(userText) {
  try {
    // Tambah ke history percakapan call sementara
    const callMessages = [
      ...chatHistory,
      { role: 'user', content: userText }
    ];

    const res = await fetch(API_PRIMARY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: callMessages, stream: false }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error('primary failed');
    const data = await res.json();
    return data.text || 'Maaf kak, ada gangguan kecil. Silakan ulangi ya 😊';
  } catch {
    try {
      const res2 = await fetch(API_FALLBACK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: userText }], stream: false }),
        signal: AbortSignal.timeout(10000)
      });
      const d = await res2.json();
      return d.text || d.message || 'Maaf kak, coba hubungi via WhatsApp ya 😊';
    } catch {
      return 'Maaf kak, koneksi bermasalah. Silakan hubungi via WhatsApp ya 😊';
    }
  }
}

// TTS yang return Promise (resolve setelah selesai bicara)
function speakTTSAsync(text) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || muteActive) { resolve(); return; }
    stopTTS();

    function doSpeak() {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang   = 'id-ID';
      utter.rate   = 1.0;
      utter.pitch  = 1.1;
      utter.volume = 1.0;
      const voices = speechSynthesis.getVoices();
      const v =
        voices.find(v => v.lang.startsWith('id') && /female|wanita/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith('id')) ||
        voices.find(v => /female|woman/i.test(v.name));
      if (v) utter.voice = v;
      utter.onend   = resolve;
      utter.onerror = resolve;
      speechSynthesis.speak(utter);
    }

    if (speechSynthesis.getVoices().length > 0) doSpeak();
    else speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
  });
}

function endCall(auto = false) {
  callActive = false;
  callListening = false;
  stopRing();
  stopTTS();
  clearInterval(callTimerInt);
  clearTimeout(callAutoEndTimer);
  clearTimeout(callSilenceTimer);
  callTimerInt = null;

  try { recognition?.stop(); recognition?.abort(); } catch(e) {}
  recognition = null;

  const status = document.getElementById('callStatus');
  if (status) status.textContent = auto ? 'Panggilan Berakhir' : 'Panggilan Diakhiri';

  setTimeout(() => {
    document.getElementById('call-overlay')?.classList.remove('active');
    const t = document.getElementById('callTimer');
    if (t) t.textContent = '';
    document.getElementById('muteBtn')?.classList.remove('active');
    document.getElementById('speakerBtn')?.classList.remove('active');
    muteActive = speakerActive = false;
  }, 900);
}

function toggleMute() {
  muteActive = !muteActive;
  document.getElementById('muteBtn')?.classList.toggle('active', muteActive);
  showToast(muteActive ? 'Mikrofon dimatikan' : 'Mikrofon aktif');
  if (muteActive) {
    stopTTS();
    try { recognition?.stop(); } catch(e) {}
  } else if (callActive) {
    startListening();
  }
}

function toggleSpeaker() {
  speakerActive = !speakerActive;
  document.getElementById('speakerBtn')?.classList.toggle('active', speakerActive);
  showToast(speakerActive ? 'Speaker aktif' : 'Speaker dimatikan');
}

function fmtTime(s) {
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}

/* ── Ring tone (AudioContext double beep) ── */
let ringCtx = null, ringInt = null;

function playRing() {
  try {
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    function beep() {
      if (!ringCtx) return;
      [0, 0.25].forEach(off => {
        const osc  = ringCtx.createOscillator();
        const gain = ringCtx.createGain();
        osc.connect(gain); gain.connect(ringCtx.destination);
        osc.type = 'sine'; osc.frequency.value = 455;
        const t = ringCtx.currentTime + off;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
      });
    }
    beep();
    ringInt = setInterval(beep, 2000);
  } catch(e) {}
}

function stopRing() {
  clearInterval(ringInt); ringInt = null;
  try { ringCtx?.close(); } catch(e) {}
  ringCtx = null;
}

/* ================================================================
   TTS — Web Speech API  (benar-benar berbicara)
================================================================ */
let ttsReady = false;

function preloadVoices() {
  if (!('speechSynthesis' in window)) return;
  const load = () => { ttsReady = speechSynthesis.getVoices().length > 0; };
  load();
  if (!ttsReady) speechSynthesis.addEventListener('voiceschanged', load, { once: true });
}

function speakTTS(text) {
  if (!('speechSynthesis' in window)) return;
  if (muteActive) return;
  stopTTS();

  function doSpeak() {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang   = 'id-ID';
    utter.rate   = 1.0;
    utter.pitch  = 1.1;
    utter.volume = 1.0;
    const voices = speechSynthesis.getVoices();
    const v =
      voices.find(v => v.lang.startsWith('id') && /female|wanita/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('id')) ||
      voices.find(v => /female|woman/i.test(v.name));
    if (v) utter.voice = v;
    utter.onerror = e => console.warn('TTS:', e.error);
    speechSynthesis.speak(utter);
  }

  // Kalau voices belum siap, tunggu
  if (speechSynthesis.getVoices().length > 0) {
    doSpeak();
  } else {
    speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
  }
}

function stopTTS() {
  try { speechSynthesis.cancel(); } catch(e) {}
}

/* ================================================================
   UTILITIES
================================================================ */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ================================================================
   TOAST
================================================================ */
function showToast(msg, dur = 2400) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.classList.add('fade-out');
    setTimeout(() => t.remove(), 350);
  }, dur);
}

/* ================================================================
   PROTEKSI GAMBAR — no klik kanan, no tekan lama, no drag
================================================================ */
(function protectImages() {
  function applyProtection(img) {
    img.setAttribute('draggable', 'false');
    img.style.userSelect = 'none';
    img.style.webkitUserSelect = 'none';
    img.style.webkitTouchCallout = 'none';
    img.addEventListener('contextmenu', e => e.preventDefault());
    img.addEventListener('dragstart',   e => e.preventDefault());
    img.addEventListener('selectstart', e => e.preventDefault());
    img.addEventListener('mousedown',   e => { if (e.button === 2) e.preventDefault(); });
  }

  // Apply ke semua gambar yang sudah ada
  document.querySelectorAll('img').forEach(applyProtection);

  // Apply ke gambar yang ditambah dinamis (chat, dll)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'IMG') applyProtection(node);
      node.querySelectorAll?.('img').forEach(applyProtection);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

/* ================================================================
   GALERI SLIDER — auto-geser + swipe/drag + dots
================================================================ */
function initGaleriSlider() {
  const slider = document.getElementById('galeriSlider');
  const dotsEl = document.getElementById('galeriDots');
  if (!slider) return;

  const slides = slider.querySelectorAll('.galeri-slide');
  const total  = slides.length;
  let current  = 0;
  let autoTimer = null;

  // Buat dots
  slides.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'galeri-dot' + (i === 0 ? ' active' : '');
    d.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(d);
  });

  function getSlideWidth() {
    return slides[0] ? slides[0].offsetWidth + 14 : 0; // 14 = margin-right
  }

  function goTo(idx) {
    current = (idx + total) % total;
    slider.style.transform = `translateX(-${current * getSlideWidth()}px)`;
    dotsEl.querySelectorAll('.galeri-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function next() { goTo(current + 1); }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(next, 3200);
  }
  function stopAuto() {
    if (autoTimer) clearInterval(autoTimer);
  }

  // Touch / drag swipe
  let startX = 0, isDrag = false, startTranslate = 0;

  function onPointerDown(e) {
    isDrag = true;
    startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    startTranslate = current * getSlideWidth();
    slider.classList.add('dragging');
    stopAuto();
  }
  function onPointerMove(e) {
    if (!isDrag) return;
    const x   = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const diff = startX - x;
    slider.style.transform = `translateX(-${startTranslate + diff}px)`;
  }
  function onPointerUp(e) {
    if (!isDrag) return;
    isDrag = false;
    slider.classList.remove('dragging');
    const x    = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
    const diff = startX - x;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goTo(current + 1) : goTo(current - 1);
    } else {
      goTo(current); // snap balik
    }
    startAuto();
  }

  slider.addEventListener('mousedown',  onPointerDown);
  slider.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('mousemove',  onPointerMove);
  window.addEventListener('touchmove',  onPointerMove, { passive: true });
  window.addEventListener('mouseup',    onPointerUp);
  window.addEventListener('touchend',   onPointerUp);

  // Pause saat hover
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);

  goTo(0);
  startAuto();
}

// Jalankan setelah page load
window.addEventListener('load', () => { setTimeout(initGaleriSlider, 500); });
