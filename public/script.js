const API_URL = '/api/messages';
const FALLBACK_URL = './fallback-messages.json';
const treeMessages = document.querySelector('#treeMessages');
const messageList = document.querySelector('#messageList');
const wishCount = document.querySelector('#wishCount');
const syncStatus = document.querySelector('#syncStatus');
const wishForm = document.querySelector('#wishForm');
const nameInput = document.querySelector('#nameInput');
const textInput = document.querySelector('#textInput');
const websiteInput = document.querySelector('#websiteInput');
const submitBtn = document.querySelector('#submitBtn');
const refreshBtn = document.querySelector('#refreshBtn');
const shuffleBtn = document.querySelector('#shuffleBtn');
const boomBtn = document.querySelector('#boomBtn');
const dialog = document.querySelector('#messageDialog');
const dialogName = document.querySelector('#dialogName');
const dialogText = document.querySelector('#dialogText');
const dialogTime = document.querySelector('#dialogTime');
const closeDialog = document.querySelector('#closeDialog');
const emptyTpl = document.querySelector('#emptyTpl');

const bubbleColors = ['#ffd36a', '#ff77b7', '#6fd6ff', '#8cffc2', '#b79cff', '#ff9a76'];
let messages = [];
let layoutSeed = Date.now();
let lastSubmitAt = 0;

function setStatus(text, type = 'normal') {
  syncStatus.textContent = text;
  syncStatus.style.color = type === 'error' ? 'var(--danger)' : type === 'ok' ? 'var(--green)' : 'var(--muted)';
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function seededRandom() {
  layoutSeed = (layoutSeed * 9301 + 49297) % 233280;
  return layoutSeed / 233280;
}

function normalizeMessages(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.messages) ? raw.messages : [];
  return list
    .map((item, index) => ({
      id: cleanText(item.id, 80) || `wish-${index}`,
      name: cleanText(item.name, 16) || '匿名同学',
      text: cleanText(item.text, 80),
      createdAt: item.createdAt || item.time || ''
    }))
    .filter(item => item.text)
    .slice(-260);
}

async function loadMessages({ silent = false } = {}) {
  if (!silent) setStatus('正在同步 GitHub 留言库…');
  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`, {
      headers: { 'Accept': 'application/json' },
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

function buildLayout(items) {
  const count = Math.max(items.length, 1);
  const levels = Math.max(6, Math.ceil(Math.sqrt(count * 2.3)));
  const buckets = Array.from({ length: levels }, (_, level) => ({ level, items: [] }));
  let cursor = 0;

  for (let level = 0; level < levels; level += 1) {
    const cap = Math.max(1, Math.round(1 + level * 1.45));
    for (let j = 0; j < cap && cursor < items.length; j += 1) {
      buckets[level].items.push(items[cursor]);
      cursor += 1;
    }
  }
  while (cursor < items.length) {
    buckets[levels - 1].items.push(items[cursor]);
    cursor += 1;
  }

  const positions = [];
  buckets.forEach((bucket) => {
    const row = bucket.items.length;
    if (!row) return;
    const ratio = bucket.level / Math.max(levels - 1, 1);
    const top = 7 + ratio * 78 + (seededRandom() - 0.5) * 1.2;
    const spread = 5 + ratio * 42;
    bucket.items.forEach((item, index) => {
      const xRatio = row === 1 ? 0 : (index / (row - 1)) * 2 - 1;
      const left = 50 + xRatio * spread + (seededRandom() - 0.5) * 2.4;
      positions.push({
        item,
        left: Math.max(7, Math.min(93, left)),
        top: Math.max(4, Math.min(90, top)),
        rot: ((seededRandom() - 0.5) * 10).toFixed(2),
        color: bubbleColors[positions.length % bubbleColors.length]
      });
    });
  });
  return positions;
}

function renderTree() {
  treeMessages.innerHTML = '';
  const positions = buildLayout(messages);
  positions.forEach((pos, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wish-bubble';
    button.style.left = `${pos.left}%`;
    button.style.top = `${pos.top}%`;
    button.style.setProperty('--rot', `${pos.rot}deg`);
    button.style.setProperty('--dot', pos.color);
    button.title = `${pos.item.name}：${pos.item.text}`;
    button.innerHTML = `<span>${escapeHTML(pos.item.name)}：${escapeHTML(pos.item.text)}</span>`;
    button.addEventListener('click', () => openMessage(pos.item));
    button.style.animationDelay = `${index * 0.02}s`;
    treeMessages.appendChild(button);
  });
}

function renderList() {
  messageList.innerHTML = '';
  if (!messages.length) {
    messageList.appendChild(emptyTpl.content.cloneNode(true));
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
      if (event.key === 'Enter') openMessage(item);
    });
    messageList.appendChild(card);
  });
}

function render() {
  wishCount.textContent = String(messages.length);
  renderTree();
  renderList();
}

function openMessage(item) {
  dialogName.textContent = item.name;
  dialogText.textContent = item.text;
  dialogTime.textContent = formatTime(item.createdAt) || '来自毕业留言圣诞树';
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
  burst(window.innerWidth / 2, window.innerHeight * 0.36, 34);
}

closeDialog.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  const inDialog = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inDialog) dialog.close();
});

wishForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = cleanText(nameInput.value, 16) || '匿名同学';
  const text = cleanText(textInput.value, 80);
  const honeypot = cleanText(websiteInput.value, 80);
  const now = Date.now();

  if (honeypot) return;
  if (!text) {
    setStatus('留言不能为空', 'error');
    textInput.focus();
    return;
  }
  if (now - lastSubmitAt < 8000) {
    setStatus('别太快，8 秒后再提交下一条', 'error');
    return;
  }

  lastSubmitAt = now;
  submitBtn.disabled = true;
  submitBtn.textContent = '正在写入 GitHub…';
  setStatus('正在写入 GitHub 仓库…');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, text, website: honeypot })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `提交失败 ${response.status}`);
    messages = normalizeMessages(data.messages);
    nameInput.value = '';
    textInput.value = '';
    setStatus('已保存到 GitHub，所有人都能看到', 'ok');
    render();
    const newest = messages[messages.length - 1];
    if (newest) openMessage(newest);
    burst(window.innerWidth / 2, 120, 70);
  } catch (error) {
    setStatus(error.message || '提交失败，请检查 Cloudflare / GitHub 配置', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '挂到圣诞树上';
  }
});

refreshBtn.addEventListener('click', () => loadMessages());
shuffleBtn.addEventListener('click', () => {
  layoutSeed = Date.now();
  renderTree();
});
boomBtn.addEventListener('click', () => {
  for (let i = 0; i < 5; i += 1) {
    setTimeout(() => {
      burst(Math.random() * window.innerWidth, 80 + Math.random() * window.innerHeight * 0.48, 46);
    }, i * 180);
  }
});

const canvas = document.querySelector('#fireworks');
const ctx = canvas.getContext('2d');
let dpr = 1;
let particles = [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function burst(x, y, amount = 44) {
  if (reduceMotion) return;
  const mobile = window.innerWidth < 640;
  const total = mobile ? Math.min(amount, 36) : amount;
  for (let i = 0; i < total; i += 1) {
    const angle = Math.PI * 2 * (i / total) + Math.random() * 0.2;
    const speed = 1.4 + Math.random() * (mobile ? 2.6 : 4.2);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 54 + Math.random() * 26,
      age: 0,
      size: 1.5 + Math.random() * 2.7,
      color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)]
    });
  }
}

function animateFireworks() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.age < p.life);
  particles.forEach((p) => {
    p.age += 1;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.035;
    p.vx *= 0.992;
    const alpha = 1 - p.age / p.life;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(animateFireworks);
}

window.addEventListener('resize', resizeCanvas, { passive: true });
resizeCanvas();
animateFireworks();
setTimeout(() => burst(window.innerWidth * 0.32, window.innerHeight * 0.22, 48), 700);
setTimeout(() => burst(window.innerWidth * 0.72, window.innerHeight * 0.18, 42), 1200);
loadMessages();
