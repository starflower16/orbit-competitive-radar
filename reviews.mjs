const STORE_NAMES = {
  appstore: 'App Store',
  huawei: '华为应用市场',
  xiaomi: '小米应用商店',
  vivo: 'vivo 应用商店',
  oppo: 'OPPO 软件商店'
};

const DEFAULT_OFFICIAL_HOSTS = [
  'developer.huawei.com',
  'appgallery.huawei.com',
  'dev.mi.com',
  'open.mi.com',
  'dev.vivo.com.cn',
  'open.vivo.com.cn',
  'open.oppomobile.com',
  'developer.oppomobile.com'
];

const textKeys = ['content', 'reviewContent', 'comment', 'feedback', 'text', 'body', 'review'];

function textValue(value, depth = 0) {
  if (depth > 3 || value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(item => textValue(item, depth + 1)).filter(Boolean).join(' ').trim();
  if (typeof value === 'object') {
    for (const key of ['label', 'value', 'text', 'content', 'name']) {
      const result = textValue(value[key], depth + 1);
      if (result) return result;
    }
  }
  return '';
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = textValue(source?.[key]);
    if (value) return value;
  }
  return '';
}

function numericValue(value) {
  const number = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && String(value).length <= 13
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 40) : date.toISOString().slice(0, 10);
}

function looksLikeReview(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && textKeys.some(key => textValue(value[key])));
}

function findReviewArray(payload) {
  const preferred = [
    payload?.reviews,
    payload?.comments,
    payload?.records,
    payload?.list,
    payload?.data?.reviews,
    payload?.data?.comments,
    payload?.data?.records,
    payload?.data?.list,
    payload?.result?.reviews,
    payload?.result?.records,
    payload?.result?.list
  ];
  for (const candidate of preferred) {
    if (Array.isArray(candidate) && candidate.some(looksLikeReview)) return candidate;
  }
  const queue = [payload];
  const visited = new Set();
  let scanned = 0;
  while (queue.length && scanned < 120) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    scanned++;
    if (Array.isArray(current)) {
      if (current.some(looksLikeReview)) return current;
      current.slice(0, 20).forEach(item => queue.push(item));
    } else {
      Object.values(current).slice(0, 30).forEach(item => {
        if (item && typeof item === 'object') queue.push(item);
      });
    }
  }
  return [];
}

function normalizeReview(raw, storeName) {
  const author = firstValue(raw, ['author', 'userName', 'nickname', 'userNickname']) ||
    textValue(raw?.author?.name) || textValue(raw?.user?.nickname) || textValue(raw?.user?.name);
  const text = firstValue(raw, textKeys) || textValue(raw?.content?.text);
  if (!text) return null;
  return {
    id: firstValue(raw, ['id', 'reviewId', 'commentId']),
    text: text.slice(0, 4000),
    source: storeName,
    rating: numericValue(firstValue(raw, ['rating', 'score', 'stars', 'star'])),
    date: isoDate(firstValue(raw, ['date', 'updated', 'createdAt', 'createTime', 'publishTime', 'time'])),
    author: author.slice(0, 120),
    url: firstValue(raw, ['url', 'link', 'reviewUrl'])
  };
}

function appStoreReviews(payload) {
  const feed = payload?.feed || {};
  const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
  return entries.map(entry => normalizeReview({
    id: textValue(entry?.id),
    text: textValue(entry?.content) || textValue(entry?.title),
    author: textValue(entry?.author?.name),
    rating: textValue(entry?.['im:rating']),
    date: textValue(entry?.updated),
    url: textValue(entry?.link?.attributes?.href)
  }, STORE_NAMES.appstore)).filter(Boolean);
}

async function fetchAppStore(appId, region) {
  if (!/^\d+$/.test(appId)) throw Object.assign(new Error('App Store App ID 必须为数字'), { status: 400 });
  const safeRegion = /^[a-z]{2}$/i.test(region) ? region.toLowerCase() : 'cn';
  const endpoint = 'https://itunes.apple.com/' + safeRegion + '/rss/customerreviews/page=1/id=' + appId + '/sortby=mostrecent/json';
  const response = await fetch(endpoint, {
    headers: { accept: 'application/json', 'user-agent': 'Orbit-Research/1.0' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw Object.assign(new Error('App Store 评价接口请求失败（' + response.status + '）'), { status: 502 });
  const payload = await response.json();
  return appStoreReviews(payload);
}

function getAllowedHosts() {
  const extras = String(process.env.REVIEW_ENDPOINT_ALLOWLIST || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_OFFICIAL_HOSTS, ...extras]);
}

async function fetchEnterprise(store, appId, region, endpoint, token) {
  let target;
  try { target = new URL(endpoint); } catch (_) {
    throw Object.assign(new Error('Endpoint 不是有效 URL'), { status: 400 });
  }
  if (target.protocol !== 'https:') throw Object.assign(new Error('Endpoint 必须使用 HTTPS'), { status: 400 });
  if (target.username || target.password) throw Object.assign(new Error('Endpoint 不允许包含账号密码'), { status: 400 });
  const allowedHosts = getAllowedHosts();
  if (!allowedHosts.has(target.hostname.toLowerCase())) {
    throw Object.assign(new Error('Endpoint 域名未列入官方接口白名单'), { status: 403 });
  }
  if (!target.searchParams.has('appId')) target.searchParams.set('appId', appId);
  if (!target.searchParams.has('region')) target.searchParams.set('region', region || 'cn');
  const response = await fetch(target, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: 'Bearer ' + token,
      'x-access-token': token,
      'user-agent': 'Orbit-Research/1.0'
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'error'
  });
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? '企业接口鉴权失败，请检查 Token 与应用权限'
      : '企业评价接口请求失败（' + response.status + '）';
    throw Object.assign(new Error(message), { status: response.status === 401 || response.status === 403 ? 403 : 502 });
  }
  const payload = await response.json();
  const list = findReviewArray(payload);
  return list.map(item => normalizeReview(item, STORE_NAMES[store] || store)).filter(Boolean).slice(0, 500);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { store = 'appstore', appId = '', region = 'cn', endpoint = '', token = '' } = req.body || {};
  if (!STORE_NAMES[store]) {
    res.status(400).json({ error: '不支持的评价来源' });
    return;
  }
  try {
    let reviews;
    if (store === 'appstore') reviews = await fetchAppStore(String(appId).trim(), String(region));
    else reviews = await fetchEnterprise(store, String(appId).trim(), String(region), String(endpoint).trim(), String(token));
    if (!reviews.length) {
      res.status(422).json({ error: '接口调用成功，但响应中没有识别到评价字段。请确认企业接口版本与字段映射。' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ source: STORE_NAMES[store], adapters: store === 'appstore' ? 'app-store-rss' : 'enterprise-review-adapter', fetchedAt: new Date().toISOString(), reviews });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    const networkMessage = error.name === 'TimeoutError'
      ? '评价接口响应超时，请稍后重试'
      : error.message === 'fetch failed'
        ? '无法连接评价接口，请检查部署环境网络或企业网关'
        : error.message;
    res.status(error.status || 502).json({ error: networkMessage || '评价接口请求失败' });
  }
}
