const API_URL = '/api/messages';
const FALLBACK_URL = './fallback-messages.json';

const dom = {
  trailCanvas: document.querySelector('#trailCanvas'),
  fireworkCanvas: document.querySelector('#fireworkCanvas'),
  branches: document.querySelector('#branches'),
  lights: document.querySelector('#lights'),
  wishTags: document.querySelector('#wishTags'),
  messageList: document.querySelector('#messageList'),
  wishCount: document.querySelector('#wishCount'),
  syncStatus: document.querySelector('#syncStatus'),
  wishForm: document.querySelector('#wishForm'),
  nameInput: document.querySelector('#nameInput'),
  textInput: document.querySelector('#textInput'),
  websiteInput: document.querySelector('#websiteInput'),
  submitBtn: document.querySelector('#submitBtn'),
  refreshBtn: document.querySelector('#refreshBtn'),
  shuffleBtn: document.querySelector('#shuffleBtn'),
  launchBtn: document.querySelector('#launchBtn'),
  finaleBtn: document.querySelector('#finaleBtn'),
  dialog: document.querySelector('#messageDialog'),
  dialogName: document.querySelector('#dialogName'),
  dialogText: document.querySelector('#dialogText'),
  dialogTime: document.querySelector('#dialogTime'),
  dialogFirework: document.querySelector('#dialogFirework'),
  closeDialog: document.querySelector('#closeDialog'),
  emptyTpl: document.querySelector('#emptyTpl')
};

const tagColors = ['#ffd776', '#ffb36a', '#ff8ecb', '#9ce8ff', '#a2ffd1', '#d7b2ff'];
const lightColors = ['#ffd776', '#6fffd2', '#7de7ff', '#ff81d8', '#ff756f', '#f7ff8c'];
const fireworkPalettes = [
  ['#ffea86', '#ff9d4f', '#ff3864', '#ffffff'],
  ['#80f7ff', '#44a6ff', '#9c6bff', '#ffffff'],
  ['#9cffb7', '#28ff98', '#f9ff78', '#ffffff'],
  ['#ff9eed', '#ff5bbd', '#ffd5fa', '#ffffff'],
  ['#ffe7aa', '#ff5b5b', '#7de7ff', '#ffffff']
];

let messages = [];
let layoutSeed = Date.now() % 233280;
let lastSubmitAt = 0;
let finaleTimer = null;
let activeDialogMessage = null;

function setStatus(text, type = 'normal') {
  dom.syncStatus.textContent = text;
  dom.syncStatus.style.color = type === 'error' ? 'var(--red)' : type === 'ok' ? 'var(--green)' : 'var(--muted)';
}

function cleanText(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function randomSeeded() {
  layoutSeed = (layoutSeed * 9301 + 49297) % 233280;
  return layoutSeed / 233280;
}

function normalizeMessages(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.messages) ? raw.messages : [];
  return list.map((item, index) => ({
    id: cleanText(item.id, 80) || `wish-${index}`,
    name: cleanText(item.name, 16) || '匿名同学',
    text: cleanText(item.text, 90),
    createdAt: item.createdAt || item.time || ''
  })).filter(item => item.text).slice(-280);
}

async function loadMessages({ silent = false } = {}) {
  if (!silent) setStatus('正在同步 GitHub 留言库…');
  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    messages = normalizeMessages(data.messages || data);
    setStatus('已同步 GitHub 留言库', 'ok');
  } catch (error) {
    try {
      const fallback = await fetch(FALLBACK_URL, { cache: 'no-store' });
      const data = await fallback.json();
      messages = normalizeMessages(data.messages || data);
      setStatus('API 未配置，当前显示本地示例留言', 'error');
    } catch (fallbackError) {
      messages = [];
      setStatus('留言加载失败，请检查 Cloudflare 环境变量', 'error');
    }
  }
  render();
}

function buildBranches() {
  dom.branches.innerHTML = '';
  const count = 13;
  for (let i = 0; i < count; i += 1) {
    const ratio = i / (count - 1);
    const branch = document.createElement('i');
    branch.className = 'branch';
    branch.style.setProperty('--bt', `${7 + ratio * 72}%`);
    branch.style.setProperty('--bw', `${16 + ratio * 83}%`);
    branch.style.setProperty('--bh', `${10.5 - ratio * 2.2}%`);
    branch.style.zIndex = String(i + 1);
    dom.branches.appendChild(branch);
  }
}

function treeWidthAt(topPercent) {
  const ratio = Math.max(0, Math.min(1, (topPercent - 8) / 82));
  return 5 + ratio * 47;
}

function buildLights() {
  dom.lights.innerHTML = '';
  const count = window.innerWidth < 520 ? 58 : 92;
  for (let i = 0; i < count; i += 1) {
    const top = 9 + Math.random() * 78;
    const spread = treeWidthAt(top) * 0.92;
    const phase = i * 0.73;
    const left = 50 + Math.sin(phase) * spread * (0.45 + Math.random() * 0.52);
    const light = document.createElement('i');
    light.className = 'light';
    light.style.left = `${left}%`;
    light.style.top = `${top}%`;
    light.style.setProperty('--c', lightColors[i % lightColors.length]);
    light.style.setProperty('--d', `${1.1 + Math.random() * 2.4}s`);
    light.style.animationDelay = `${Math.random() * -3}s`;
    dom.lights.appendChild(light);
  }
}

function buildTagLayout(items) {
  layoutSeed = layoutSeed || 1;
  const output = [];
  const count = Math.max(items.length, 1);
  const rows = Math.max(7, Math.ceil(Math.sqrt(count * 1.75)));
  const buckets = Array.from({ length: rows }, () => []);
  items.forEach((item, index) => {
    const row = Math.min(rows - 1, Math.floor(Math.sqrt(index / Math.max(count - 1, 1)) * rows));
    buckets[row].push(item);
  });

  buckets.forEach((bucket, row) => {
    if (!bucket.length) return;
    const r = row / Math.max(rows - 1, 1);
    const top = 12 + r * 75 + (randomSeeded() - 0.5) * 3;
    const spread = treeWidthAt(top) * 0.92;
    bucket.forEach((item, col) => {
      const base = bucket.length === 1 ? 0 : (col / (bucket.length - 1)) * 2 - 1;
      const wobble = (randomSeeded() - 0.5) * 0.34;
      const left = 50 + (base + wobble) * spread;
      output.push({
        item,
        left: Math.max(9, Math.min(91, left)),
        top: Math.max(8, Math.min(90, top)),
        rot: ((randomSeeded() - 0.5) * 12).toFixed(2),
        dot: tagColors[output.length % tagColors.length],
        sway: `${2.8 + randomSeeded() * 2.4}s`
      });
    });
  });
  return output;
}

function renderTree() {
  dom.wishTags.innerHTML = '';
  const layout = buildTagLayout(messages);
  layout.forEach((pos, index) => {
    const button = document.createElement('button');
    button.className = 'wish-tag';
    button.type = 'button';
    button.title = `${pos.item.name}：${pos.item.text}`;
    button.style.left = `${pos.left}%`;
    button.style.top = `${pos.top}%`;
    button.style.setProperty('--rot', `${pos.rot}deg`);
    button.style.setProperty('--dot', pos.dot);
    button.style.setProperty('--sway', pos.sway);
    button.style.animationDelay = `${Math.min(index * 0.025, 1.8)}s, ${Math.random() * -4}s`;
    button.innerHTML = `<span class="tag-name">${escapeHTML(pos.item.name)}</span><span>${escapeHTML(pos.item.text)}</span>`;
    button.addEventListener('click', () => openMessage(pos.item));
    dom.wishTags.appendChild(button);
  });
}

function renderList() {
  dom.messageList.innerHTML = '';
  if (!messages.length) {
    dom.messageList.appendChild(dom.emptyTpl.content.cloneNode(true));
    return;
  }
  [...messages].reverse().forEach((item) => {
    const card = document.createElement('article');
    card.className = 'message-card';
    card.tabIndex = 0;
    card.innerHTML = `
      <strong>${escapeHTML(item.name)}</strong>
      <p>${escapeHTML(item.text)}</p>
      <time>${escapeHTML(formatTime(item.createdAt))}</time>
    `;
    card.addEventListener('click', () => openMessage(item));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') openMessage(item);
    });
    dom.messageList.appendChild(card);
  });
}

function render() {
  dom.wishCount.textContent = String(messages.length);
  renderTree();
  renderList();
}

function openMessage(item) {
  activeDialogMessage = item;
  dom.dialogName.textContent = item.name;
  dom.dialogText.textContent = item.text;
  dom.dialogTime.textContent = formatTime(item.createdAt);
  if (typeof dom.dialog.showModal === 'function') dom.dialog.showModal();
  else alert(`${item.name}\n${item.text}`);
}

async function submitWish(event) {
  event.preventDefault();
  const now = Date.now();
  if (now - lastSubmitAt < 4500) {
    setStatus('提交太快啦，等几秒再试', 'error');
    return;
  }
  lastSubmitAt = now;
  const payload = {
    name: cleanText(dom.nameInput.value, 16) || '匿名同学',
    text: cleanText(dom.textInput.value, 90),
    website: dom.websiteInput.value
  };
  if (!payload.text || payload.text.length < 2) {
    setStatus('留言至少写 2 个字', 'error');
    return;
  }
  dom.submitBtn.disabled = true;
  dom.submitBtn.textContent = '正在挂上去…';
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `提交失败 ${response.status}`);
    messages = normalizeMessages(data.messages || []);
    dom.wishForm.reset();
    setStatus('留言已写入 GitHub，已挂到树上', 'ok');
    render();
    fireworks.finale(5);
  } catch (error) {
    setStatus(error.message || '提交失败，请检查 API 配置', 'error');
  } finally {
    dom.submitBtn.disabled = false;
    dom.submitBtn.textContent = '挂到圣诞树上';
  }
}

class FireworksEngine {
  constructor(trailCanvas, mainCanvas) {
    this.trailCanvas = trailCanvas;
    this.mainCanvas = mainCanvas;
    this.tctx = trailCanvas.getContext('2d');
    this.ctx = mainCanvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.rockets = [];
    this.particles = [];
    this.smoke = [];
    this.last = performance.now();
    this.autoTimer = 0;
    this.audio = null;
    this.lowPower = matchMedia('(max-width: 520px)').matches || navigator.hardwareConcurrency <= 4;
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.55 : 2);
    this.dpr = dpr;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    for (const canvas of [this.trailCanvas, this.mainCanvas]) {
      canvas.width = Math.floor(this.width * dpr);
      canvas.height = Math.floor(this.height * dpr);
      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  ensureAudio() {
    if (this.audio) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.audio = new AudioContext();
  }

  beep(type = 'launch') {
    if (!this.audio || this.audio.state === 'suspended') return;
    const now = this.audio.currentTime;
    const osc = this.audio.createOscillator();
    const gain = this.audio.createGain();
    osc.connect(gain);
    gain.connect(this.audio.destination);
    if (type === 'launch') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.34);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  }

  launch(options = {}) {
    const fromX = options.fromX ?? (this.width * (0.12 + Math.random() * 0.76));
    const targetX = options.x ?? (this.width * (0.12 + Math.random() * 0.76));
    const targetY = options.y ?? (this.height * (0.13 + Math.random() * 0.38));
    const distance = Math.max(240, this.height - targetY);
    const frames = 58 + Math.random() * 28;
    const gravity = 0.09 + Math.random() * 0.025;
    const vy = -(distance / frames + gravity * frames * 0.5);
    const vx = (targetX - fromX) / frames;
    const palette = options.palette || fireworkPalettes[Math.floor(Math.random() * fireworkPalettes.length)];
    this.rockets.push({
      x: fromX,
      y: this.height + 18,
      px: fromX,
      py: this.height + 18,
      vx,
      vy,
      gravity,
      targetY,
      color: palette[0],
      palette,
      age: 0,
      type: options.type || this.randomType()
    });
    this.beep('launch');
  }

  randomType() {
    const types = ['peony', 'chrysanthemum', 'willow', 'ring', 'palm', 'crackle'];
    return types[Math.floor(Math.random() * types.length)];
  }

  finale(count = 9) {
    for (let i = 0; i < count; i += 1) {
      setTimeout(() => this.launch({
        fromX: this.width * (0.15 + Math.random() * 0.7),
        x: this.width * (0.1 + Math.random() * 0.8),
        y: this.height * (0.1 + Math.random() * 0.46)
      }), i * 180 + Math.random() * 140);
    }
  }

  explode(rocket) {
    this.beep('boom');
    const baseCount = this.lowPower ? 72 : 128;
    const count = rocket.type === 'crackle' ? baseCount + 42 : baseCount;
    const ring = rocket.type === 'ring';
    const willow = rocket.type === 'willow';
    const palm = rocket.type === 'palm';
    const chrys = rocket.type === 'chrysanthemum';

    for (let i = 0; i < count; i += 1) {
      const angle = ring ? (Math.PI * 2 * i) / count : Math.random() * Math.PI * 2;
      const radiusBias = chrys ? Math.sqrt(Math.random()) : Math.random();
      const speed = ring ? 3.9 + Math.random() * 0.7 : (palm ? 2.1 + Math.random() * 4.6 : 1.4 + radiusBias * 5.6);
      const color = rocket.palette[i % rocket.palette.length];
      this.particles.push({
        x: rocket.x,
        y: rocket.y,
        px: rocket.x,
        py: rocket.y,
        vx: Math.cos(angle) * speed * (willow ? 0.74 : 1),
        vy: Math.sin(angle) * speed * (willow ? 0.58 : 1) - (palm ? Math.random() * 1.8 : 0),
        gravity: willow ? 0.078 : 0.045 + Math.random() * 0.025,
        drag: willow ? 0.986 : 0.972 + Math.random() * 0.012,
        life: willow ? 118 + Math.random() * 45 : 58 + Math.random() * 52,
        maxLife: 0,
        size: willow ? 1.6 + Math.random() * 1.3 : 1.1 + Math.random() * 1.8,
        color,
        glitter: rocket.type === 'crackle' || Math.random() < 0.18
      });
      const p = this.particles[this.particles.length - 1];
      p.maxLife = p.life;
    }

    for (let i = 0; i < 10; i += 1) {
      this.smoke.push({ x: rocket.x, y: rocket.y, r: 8 + Math.random() * 18, life: 34 + Math.random() * 20, vx: (Math.random() - 0.5) * 0.8, vy: -Math.random() * 0.5 });
    }
  }

  update(dt) {
    const step = Math.min(dt / 16.67, 2.2);
    for (let i = this.rockets.length - 1; i >= 0; i -= 1) {
      const r = this.rockets[i];
      r.px = r.x; r.py = r.y;
      r.x += r.vx * step;
      r.y += r.vy * step;
      r.vy += r.gravity * step;
      r.age += step;
      if (r.vy >= -0.25 || r.y <= r.targetY || r.age > 125) {
        this.explode(r);
        this.rockets.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.px = p.x; p.py = p.y;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vx *= Math.pow(p.drag, step);
      p.vy = p.vy * Math.pow(p.drag, step) + p.gravity * step;
      p.life -= step;
      if (p.glitter && Math.random() < 0.025 && this.particles.length < (this.lowPower ? 420 : 900)) {
        this.particles.push({
          x: p.x, y: p.y, px: p.x, py: p.y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          gravity: 0.035, drag: 0.95,
          life: 14 + Math.random() * 14,
          maxLife: 28, size: 0.8, color: '#ffffff', glitter: false
        });
      }
      if (p.life <= 0 || p.y > this.height + 60) this.particles.splice(i, 1);
    }

    for (let i = this.smoke.length - 1; i >= 0; i -= 1) {
      const s = this.smoke[i];
      s.x += s.vx * step; s.y += s.vy * step; s.r += 0.08 * step; s.life -= step;
      if (s.life <= 0) this.smoke.splice(i, 1);
    }
  }

  render() {
    const tctx = this.tctx;
    const ctx = this.ctx;
    tctx.globalCompositeOperation = 'source-over';
    tctx.fillStyle = 'rgba(2, 4, 13, 0.18)';
    tctx.fillRect(0, 0, this.width, this.height);
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.globalCompositeOperation = 'screen';
    for (const s of this.smoke) {
      const a = Math.max(0, s.life / 54) * 0.09;
      ctx.beginPath();
      ctx.fillStyle = `rgba(190, 205, 225, ${a})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    tctx.globalCompositeOperation = 'lighter';
    ctx.globalCompositeOperation = 'lighter';

    for (const r of this.rockets) {
      const grad = tctx.createLinearGradient(r.px, r.py, r.x, r.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.42, r.color);
      grad.addColorStop(1, '#ffffff');
      tctx.strokeStyle = grad;
      tctx.lineWidth = 2.2;
      tctx.beginPath();
      tctx.moveTo(r.px, r.py);
      tctx.lineTo(r.x, r.y);
      tctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const p of this.particles) {
      const life = Math.max(0, p.life / p.maxLife);
      tctx.strokeStyle = hexToRgba(p.color, life * 0.66);
      tctx.lineWidth = p.size;
      tctx.beginPath();
      tctx.moveTo(p.px, p.py);
      tctx.lineTo(p.x, p.y);
      tctx.stroke();

      ctx.fillStyle = hexToRgba(p.color, Math.min(1, life * 1.35));
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10 * life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.72 + life * 0.65), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  loop(now) {
    const dt = now - this.last;
    this.last = now;
    this.update(dt);
    this.render();
    this.autoTimer -= dt;
    if (this.autoTimer <= 0) {
      this.autoTimer = 980 + Math.random() * 1700;
      if (document.visibilityState === 'visible') this.launch();
    }
    requestAnimationFrame(this.loop);
  }
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const fireworks = new FireworksEngine(dom.trailCanvas, dom.fireworkCanvas);

function clientPointToFirework(event) {
  const touch = event.touches?.[0] || event.changedTouches?.[0] || event;
  const x = touch.clientX ?? window.innerWidth * 0.5;
  const y = touch.clientY ?? window.innerHeight * 0.32;
  return { x, y: Math.max(70, Math.min(window.innerHeight * 0.62, y)) };
}

function initEvents() {
  dom.wishForm.addEventListener('submit', submitWish);
  dom.refreshBtn.addEventListener('click', () => loadMessages());
  dom.shuffleBtn.addEventListener('click', () => { layoutSeed = Date.now() % 233280; renderTree(); fireworks.launch(); });
  dom.launchBtn.addEventListener('click', () => { fireworks.ensureAudio(); fireworks.launch(); });
  dom.finaleBtn.addEventListener('click', () => {
    fireworks.ensureAudio();
    if (finaleTimer) {
      clearInterval(finaleTimer);
      finaleTimer = null;
      dom.finaleBtn.textContent = '连发模式';
      return;
    }
    dom.finaleBtn.textContent = '停止连发';
    fireworks.finale(8);
    finaleTimer = setInterval(() => fireworks.finale(6), 2500);
  });
  dom.dialogFirework.addEventListener('click', () => {
    fireworks.ensureAudio();
    fireworks.finale(activeDialogMessage ? 6 : 4);
  });
  dom.closeDialog.addEventListener('click', () => dom.dialog.close());
  dom.dialog.addEventListener('click', (event) => {
    const rect = dom.dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) dom.dialog.close();
  });
  window.addEventListener('pointerdown', (event) => {
    const interactive = event.target.closest('button, input, textarea, form, dialog, .message-card');
    if (interactive) return;
    fireworks.ensureAudio();
    const pos = clientPointToFirework(event);
    fireworks.launch(pos);
  }, { passive: true });
}

buildBranches();
buildLights();
initEvents();
loadMessages();
setTimeout(() => fireworks.finale(5), 700);
