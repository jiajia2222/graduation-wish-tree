const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const recentSubmissions = new Map();
const BLOCK_WORDS = ['<script', '</script', 'javascript:', 'onerror=', 'onload='];

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = buildCorsHeaders(env, origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (request.method === 'GET') {
      const payload = await readMessages(env);
      return json({ messages: payload.messages, updatedAt: payload.updatedAt, source: 'github' }, 200, corsHeaders);
    }

    if (request.method === 'POST') {
      if (!isOriginAllowed(env, origin)) {
        return json({ error: '当前域名不允许提交留言，请检查 ALLOWED_ORIGIN。' }, 403, corsHeaders);
      }

      const rate = checkRateLimit(request, env);
      if (!rate.ok) {
        return json({ error: `提交太频繁，请 ${rate.wait} 秒后再试。` }, 429, corsHeaders);
      }

      const body = await request.json().catch(() => null);
      const message = validateMessage(body);
      if (!message.ok) {
        return json({ error: message.error }, 400, corsHeaders);
      }

      const saved = await appendMessage(env, message.data);
      return json({ ok: true, messages: saved.messages, updatedAt: saved.updatedAt }, 201, corsHeaders);
    }

    return json({ error: 'Method Not Allowed' }, 405, corsHeaders);
  } catch (error) {
    const message = error?.message || '服务器错误';
    return json({ error: message }, 500, corsHeaders);
  }
}

function buildCorsHeaders(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || origin || '*';
  return {
    ...JSON_HEADERS,
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
}

function isOriginAllowed(env, origin) {
  if (!env.ALLOWED_ORIGIN || !origin) return true;
  return env.ALLOWED_ORIGIN === origin;
}

function requiredEnv(env) {
  const missing = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'].filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`缺少 Cloudflare 环境变量：${missing.join(', ')}`);
  }
  return {
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH || 'main',
    path: env.GITHUB_FILE_PATH || 'data/messages.json',
    committerName: env.COMMITTER_NAME || 'Graduation Wish Bot',
    committerEmail: env.COMMITTER_EMAIL || 'wish-bot@example.com',
    maxMessages: Math.max(20, Math.min(Number(env.MAX_MESSAGES || 260), 1000))
  };
}

function githubHeaders(config) {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${config.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'graduation-wish-tree-cloudflare-pages'
  };
}

function githubContentUrl(config) {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(config.branch)}`;
}

async function getFile(config) {
  const response = await fetch(githubContentUrl(config), {
    method: 'GET',
    headers: githubHeaders(config)
  });

  if (response.status === 404) {
    return { sha: null, messages: [], updatedAt: new Date().toISOString() };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub 读取失败：${response.status} ${safeErrorText(text)}`);
  }

  const data = await response.json();
  const jsonText = base64ToUtf8(data.content || '');
  const parsed = JSON.parse(jsonText || '{"messages":[]}');
  return {
    sha: data.sha,
    messages: normalizeMessages(parsed.messages || parsed),
    updatedAt: parsed.updatedAt || new Date().toISOString()
  };
}

async function readMessages(env) {
  const config = requiredEnv(env);
  const file = await getFile(config);
  return {
    updatedAt: file.updatedAt,
    messages: file.messages.slice(-config.maxMessages)
  };
}

async function appendMessage(env, message) {
  const config = requiredEnv(env);
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const file = await getFile(config);
    const now = new Date().toISOString();
    const newMessage = {
      id: `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
      name: message.name,
      text: message.text,
      createdAt: now
    };
    const messages = [...file.messages, newMessage].slice(-config.maxMessages);
    const payload = {
      updatedAt: now,
      messages
    };

    const response = await fetch(githubContentUrl(config).replace(/\?ref=.*/, ''), {
      method: 'PUT',
      headers: {
        ...githubHeaders(config),
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        message: `Add graduation wish from ${message.name}`,
        content: utf8ToBase64(JSON.stringify(payload, null, 2) + '\n'),
        sha: file.sha || undefined,
        branch: config.branch,
        committer: {
          name: config.committerName,
          email: config.committerEmail
        }
      })
    });

    if (response.ok) return payload;

    const text = await response.text();
    lastError = new Error(`GitHub 写入失败：${response.status} ${safeErrorText(text)}`);
    if (response.status !== 409 && response.status !== 422) break;
    await sleep(350 + attempt * 420);
  }

  throw lastError || new Error('GitHub 写入失败');
}

function validateMessage(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: '请求内容不正确。' };
  }
  if (body.website) {
    return { ok: false, error: '提交被拦截。' };
  }

  const name = clean(body.name || '匿名同学', 16) || '匿名同学';
  const text = clean(body.text, 90);

  if (!text) return { ok: false, error: '留言不能为空。' };
  if (text.length < 2) return { ok: false, error: '留言太短啦。' };
  if (BLOCK_WORDS.some((word) => `${name} ${text}`.toLowerCase().includes(word))) {
    return { ok: false, error: '留言包含不安全内容。' };
  }

  return { ok: true, data: { name, text } };
}

function normalizeMessages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, index) => ({
      id: clean(item.id || `wish-${index}`, 80),
      name: clean(item.name || '匿名同学', 16) || '匿名同学',
      text: clean(item.text || '', 90),
      createdAt: clean(item.createdAt || item.time || '', 40)
    }))
    .filter((item) => item.text);
}

function clean(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function checkRateLimit(request, env) {
  const seconds = Math.max(5, Math.min(Number(env.RATE_LIMIT_SECONDS || 15), 120));
  const windowMs = seconds * 1000;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const now = Date.now();
  const last = recentSubmissions.get(ip) || 0;

  if (recentSubmissions.size > 2000) {
    for (const [key, value] of recentSubmissions) {
      if (now - value > windowMs * 4) recentSubmissions.delete(key);
    }
  }

  if (now - last < windowMs) {
    return { ok: false, wait: Math.ceil((windowMs - (now - last)) / 1000) };
  }

  recentSubmissions.set(ip, now);
  return { ok: true, wait: 0 };
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const binary = atob(String(base64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function safeErrorText(text) {
  return String(text || '').slice(0, 240).replace(/\s+/g, ' ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}
