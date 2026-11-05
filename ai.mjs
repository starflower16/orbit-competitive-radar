const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^\[?::1\]?$/i,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i
];

function assertSafeBaseUrl(value) {
  let target;
  try {
    target = new URL(String(value || '').trim());
  } catch (_) {
    throw new Error('Base URL 不是有效 URL');
  }
  if (target.protocol !== 'https:') throw new Error('Base URL 必须使用 HTTPS');
  if (target.username || target.password) throw new Error('Base URL 不允许包含账号密码');
  if (target.search || target.hash) throw new Error('Base URL 不允许包含查询参数或锚点');
  if (PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(target.hostname))) throw new Error('Base URL 不允许指向内网地址');
  return target;
}

function buildEndpoint(baseUrl) {
  const target = assertSafeBaseUrl(baseUrl);
  const path = target.pathname.replace(/\/+$/, '');
  target.pathname = /\/chat\/completions$/i.test(path) ? path : path + '/chat/completions';
  return target;
}

function readContent(payload) {
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent.map(item => typeof item === 'string' ? item : item?.text || item?.content || '').filter(Boolean).join('\n');
  }
  if (typeof payload?.output_text === 'string') return payload.output_text;
  if (typeof payload?.content === 'string') return payload.content;
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  const { baseUrl = '', model = '', apiKey = '', messages = [], jsonOnly = false } = body;
  if (!String(baseUrl).trim() || !String(model).trim() || !String(apiKey).trim()) {
    res.status(400).json({ error: '缺少 Base URL、模型或 API Key' });
    return;
  }
  if (!Array.isArray(messages) || !messages.length) {
    res.status(400).json({ error: 'messages 不能为空' });
    return;
  }

  let endpoint;
  try {
    endpoint = buildEndpoint(baseUrl);
  } catch (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        Authorization: 'Bearer ' + String(apiKey).trim()
      },
      body: JSON.stringify({
        model: String(model).trim(),
        messages,
        temperature: jsonOnly ? 0.1 : 0.3,
        stream: false
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(60000)
    });
    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch (_) { payload = {}; }
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || raw.slice(0, 500) || '上游模型请求失败';
      res.status(response.status).json({ error: detail });
      return;
    }
    const content = readContent(payload).trim();
    if (!content) {
      res.status(422).json({ error: '模型返回成功，但没有可读取的文本内容' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ content, model: payload.model || String(model).trim(), usage: payload.usage || null });
  } catch (error) {
    const message = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? '模型接口响应超时，请稍后重试'
      : error?.cause?.code === 'ENOTFOUND'
        ? '无法解析模型接口域名'
        : '无法连接模型接口，请检查 Base URL、网络或服务商状态';
    res.status(502).json({ error: message });
  }
}
