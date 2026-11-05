/* Orbit V3 — real-data product research workspace */
(() => {
  'use strict';
  const DATA = window.ORBIT_DATA;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (name, cls = '') => '<svg class="' + cls + '"><use href="#i-' + name + '"/></svg>';
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatNumber = value => new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const uid = prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const localDateString = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const pageNames = { overview: '项目总览', trends: '趋势雷达', feedback: '用户反馈', competitors: '竞品监控', ailab: 'AI Lab' };
  const STORAGE_KEY = 'orbit-v3-workspace';
  const LEGACY_STORAGE_KEY = 'orbit-v2-workspace';
  const SESSION_KEY = 'orbit-v3-ai-key';
  const REVIEW_TOKEN_PREFIX = 'orbit-v3-review-token-';

  try {
    if (new URLSearchParams(location.search).get('reset') === '1') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      history.replaceState(null, '', location.pathname + location.hash);
    }
  } catch (_) { /* storage unavailable */ }

  const platformById = id => DATA.platforms.find(item => item.id === id) || DATA.platforms[0];
  const industryAliases = {
    general: 'tools', beauty: 'commerce', gaming: 'entertainment', app: 'tools', ecommerce: 'commerce', saas: 'tools',
    '通用产品': 'tools', '美妆日消': 'commerce', '游戏': 'entertainment', '电商': 'commerce', 'saas / 工具': 'tools'
  };
  function normalizeIndustryId(value) {
    const raw = String(value || '').trim();
    const matched = (DATA.competitorCategoryMeta || []).find(item => item.id === raw || item.label === raw);
    if (matched) return matched.id;
    return industryAliases[raw.toLowerCase()] || industryAliases[raw] || (DATA.industries[0]?.id || 'entertainment');
  }
  const industryById = id => {
    const normalized = normalizeIndustryId(id);
    return DATA.industries.find(item => item.id === normalized) || DATA.industries[0];
  };
  const reviewStoreById = id => (DATA.reviewStores || []).find(item => item.id === id) || (DATA.reviewStores || [])[0];
  const platformLetters = { tiktok: 'T', x: 'X', xiaohongshu: '小', weibo: '微', appstore: 'A', ecommerce: 'E', other: 'O' };

  function defaultReviewConfig() {
    return { connections: {}, updatedAt: null };
  }

  function normalizeReviewConfig(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      connections: source.connections && typeof source.connections === 'object' ? source.connections : {},
      updatedAt: source.updatedAt || null
    };
  }

  function newProjectRecord(name = '新调研项目', industry = DATA.industries[0]?.id || 'entertainment', demo = false) {
    const now = new Date().toISOString();
    return {
      id: uid('project'),
      project: { name, industry, demo: Boolean(demo) },
      feedback: [],
      feedbackHistory: [],
      competitors: [],
      trends: [],
      insight: null,
      feedbackAISummary: '',
      aiHistory: [],
      reviewConfig: defaultReviewConfig(),
      createdAt: now,
      updatedAt: now
    };
  }

  function createDemoProjectRecords() {
    const presets = window.ORBIT_DEMO_DATA?.projects || [];
    return presets.map((preset, index) => {
      const record = newProjectRecord(preset.name, preset.industry, true);
      record.id = preset.id || record.id;
      record.competitors = (preset.competitors || []).map(normalizeCompetitor).filter(Boolean);
      record.trends = (preset.trends || []).map(normalizeTrend).filter(Boolean);
      record.createdAt = new Date(Date.now() - index * 86400000).toISOString();
      record.updatedAt = new Date().toISOString();
      return record;
    });
  }

  function ensureDemoProjects(projects, dismissedIds = []) {
    let activatedId = null;
    const dismissed = new Set(dismissedIds);
    createDemoProjectRecords().forEach(record => {
      if (dismissed.has(record.id)) return;
      const existing = projects.find(item => item.id === record.id);
      if (existing) {
        if (existing.project.demo && !existing.trends.length && record.trends.length) {
          existing.trends = record.trends;
          existing.updatedAt = new Date().toISOString();
        }
        return;
      }
      projects.push(record);
      activatedId ||= record.id;
    });
    return activatedId;
  }

  function normalizeProjectRecord(project) {
    const raw = project && typeof project === 'object' ? project : {};
    const profile = raw.project && typeof raw.project === 'object' ? raw.project : raw;
    return {
      id: String(raw.id || uid('project')),
      project: {
        name: String(profile.name || '新调研项目').trim() || '新调研项目',
        industry: normalizeIndustryId(profile.industry),
        demo: Boolean(profile.demo)
      },
      feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
      feedbackHistory: Array.isArray(raw.feedbackHistory) ? raw.feedbackHistory : [],
      competitors: Array.isArray(raw.competitors) ? raw.competitors.map(normalizeCompetitor).filter(Boolean) : [],
      trends: Array.isArray(raw.trends) ? raw.trends : [],
      insight: raw.insight && typeof raw.insight === 'object' ? raw.insight : null,
      feedbackAISummary: typeof raw.feedbackAISummary === 'string' ? raw.feedbackAISummary : '',
      aiHistory: Array.isArray(raw.aiHistory) ? raw.aiHistory : [],
      reviewConfig: normalizeReviewConfig(raw.reviewConfig),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString()
    };
  }

  function loadWorkspace() {
    const read = key => {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
    };
    const current = read(STORAGE_KEY);
    const legacy = read(LEGACY_STORAGE_KEY);
    const source = current?.projects ? current : current?.project ? current : legacy;
    if (!source || typeof source !== 'object') return null;
    const rawProjects = Array.isArray(source.projects) && source.projects.length ? source.projects : [source];
    const projects = rawProjects.map(normalizeProjectRecord);
    const demoDismissedIds = Array.isArray(source.demoDismissedIds) ? source.demoDismissedIds.map(String) : [];
    const seededDemoId = ensureDemoProjects(projects, demoDismissedIds);
    return {
      projects,
      activeProjectId: seededDemoId || (projects.some(item => item.id === source.activeProjectId) ? source.activeProjectId : projects[0].id),
      aiConfig: source.aiConfig && typeof source.aiConfig === 'object' ? source.aiConfig : {},
      demoDismissedIds
    };
  }

  const saved = loadWorkspace();
  const fallbackProjects = createDemoProjectRecords();
  const initialProjects = saved?.projects?.length ? saved.projects : (fallbackProjects.length ? fallbackProjects : [newProjectRecord()]);
  const initialProject = initialProjects.find(item => item.id === saved?.activeProjectId) || initialProjects[0];
  const state = {
    projects: initialProjects,
    activeProjectId: initialProject.id,
    project: { ...initialProject.project },
    feedback: initialProject.feedback,
    feedbackHistory: initialProject.feedbackHistory,
    competitors: initialProject.competitors,
    trends: initialProject.trends,
    insight: initialProject.insight,
    feedbackAISummary: initialProject.feedbackAISummary,
    aiHistory: initialProject.aiHistory,
    reviewConfig: initialProject.reviewConfig,
    reviewStore: DATA.reviewStores?.[0]?.id || 'appstore',
    ai: {
      baseUrl: saved?.aiConfig?.baseUrl || DATA.aiBaseUrl,
      model: saved?.aiConfig?.model || DATA.aiModel,
      key: (() => { try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; } })()
    },
    platform: 'all',
    category: '全部',
    aiMode: 'copy',
    aiFile: null,
    aiResultText: '',
    commandSelected: 0,
    commands: [],
    demoDismissedIds: saved?.demoDismissedIds || [],
    pendingConfirm: null
  };

  function syncActiveProject() {
    const index = state.projects.findIndex(item => item.id === state.activeProjectId);
    if (index < 0) return;
    state.projects[index] = {
      ...state.projects[index],
      project: { ...state.project },
      feedback: state.feedback,
      feedbackHistory: state.feedbackHistory,
      competitors: state.competitors,
      trends: state.trends,
      insight: state.insight,
      feedbackAISummary: state.feedbackAISummary,
      aiHistory: state.aiHistory,
      reviewConfig: state.reviewConfig,
      updatedAt: new Date().toISOString()
    };
  }

  function persistWorkspace() {
    try {
      syncActiveProject();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 4,
        activeProjectId: state.activeProjectId,
        projects: state.projects,
        demoDismissedIds: state.demoDismissedIds,
        aiConfig: { baseUrl: state.ai.baseUrl, model: state.ai.model }
      }));
    } catch (_) { showToast('本地存储不可用，本次数据仅在当前页面保留', 'error'); }
  }

  function activateProject(record) {
    state.activeProjectId = record.id;
    state.project = { ...record.project };
    state.feedback = record.feedback || [];
    state.feedbackHistory = record.feedbackHistory || [];
    state.competitors = record.competitors || [];
    state.trends = record.trends || [];
    state.insight = record.insight || null;
    state.feedbackAISummary = record.feedbackAISummary || '';
    state.aiHistory = record.aiHistory || [];
    state.reviewConfig = normalizeReviewConfig(record.reviewConfig);
    state.category = '全部';
    state.platform = 'all';
    state.aiFile = null;
    state.aiResultText = '';
  }

  function renderCurrentProject() {
    renderProject();
    renderOverview();
    renderTrends();
    renderFeedback();
    renderCompetitors();
    renderAIConfig();
    updateStatus();
  }

  function switchProject(id, render = true) {
    if (!id || id === state.activeProjectId) return;
    syncActiveProject();
    const target = state.projects.find(item => item.id === id);
    if (!target) return;
    activateProject(target);
    persistWorkspace();
    if (render) renderCurrentProject();
  }

  function reviewTokenKey(storeId) {
    return REVIEW_TOKEN_PREFIX + state.activeProjectId + ':' + storeId;
  }

  function getReviewToken(storeId) {
    try { return sessionStorage.getItem(reviewTokenKey(storeId)) || ''; } catch (_) { return ''; }
  }

  function setReviewToken(storeId, token) {
    try {
      if (token) sessionStorage.setItem(reviewTokenKey(storeId), token);
      else sessionStorage.removeItem(reviewTokenKey(storeId));
    } catch (_) { /* storage unavailable */ }
  }

  const aiConfigured = () => Boolean(state.ai.baseUrl && state.ai.model && state.ai.key);

  function showToast(message, type = 'success') {
    const root = $('#toast-root');
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type === 'error' ? 'error' : '');
    toast.innerHTML = '<span class="toast-icon">' + icon(type === 'error' ? 'close' : 'check') + '</span><span>' + escapeHTML(message) + '</span>';
    root.appendChild(toast);
    setTimeout(() => { toast.classList.add('is-leaving'); setTimeout(() => toast.remove(), 240); }, 3200);
  }

  const modalReturnFocus = new Map();
  const modalFocusableSelector = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

  function visibleFocusable(modal) {
    return $$(modalFocusableSelector, modal).filter(element => {
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
    });
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (!modal.classList.contains('is-open')) modalReturnFocus.set(id, document.activeElement);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      if (!modal.classList.contains('is-open')) return;
      const preferred = modal.querySelector('[autofocus], input:not([type="hidden"]), textarea, button');
      (preferred || visibleFocusable(modal)[0] || modal).focus?.({ preventScroll: true });
    }, 40);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const wasOpen = modal.classList.contains('is-open');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!$$('.modal-backdrop.is-open').length) document.body.style.overflow = '';
    if (id === 'confirm-modal') state.pendingConfirm = null;
    if (wasOpen) {
      const returnTarget = modalReturnFocus.get(id);
      modalReturnFocus.delete(id);
      if (returnTarget?.isConnected && typeof returnTarget.focus === 'function') setTimeout(() => returnTarget.focus({ preventScroll: true }), 20);
    }
  }

  function openConfirm({ title = '确认操作', message = '', label = '确认', onConfirm = null }) {
    state.pendingConfirm = typeof onConfirm === 'function' ? onConfirm : null;
    $('#confirm-modal-title').textContent = title;
    $('#confirm-modal-message').textContent = message;
    $('#confirm-modal-submit').textContent = label;
    openModal('confirm-modal');
    setTimeout(() => $('#confirm-modal .modal-actions .btn-secondary')?.focus({ preventScroll: true }), 60);
  }

  function closeTopModal() {
    const open = $$('.modal-backdrop.is-open');
    if (open.length) closeModal(open[open.length - 1].id);
    else $('#sidebar').classList.remove('is-mobile-open');
  }

  function trapModalFocus(event) {
    const open = $$('.modal-backdrop.is-open');
    if (!open.length) return;
    const modal = open[open.length - 1];
    const focusable = visibleFocusable(modal);
    if (!focusable.length) { event.preventDefault(); modal.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeAll() {
    $$('.modal-backdrop.is-open').forEach(modal => closeModal(modal.id));
    $('#sidebar').classList.remove('is-mobile-open');
  }

  function navigate(page) {
    if (!pageNames[page]) page = 'overview';
    if (location.hash !== '#' + page) location.hash = page;
    else applyRoute(page);
  }

  function applyRoute(page) {
    if (!pageNames[page]) page = 'overview';
    $$('.page').forEach(section => section.classList.toggle('is-active', section.dataset.page === page));
    $$('.nav-item[data-nav]').forEach(item => item.classList.toggle('is-active', item.dataset.nav === page));
    $('#breadcrumb-current').textContent = pageNames[page];
    document.title = pageNames[page] + ' · Orbit';
    $('#sidebar').classList.remove('is-mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'trends') renderTrends();
  }

  function setButtonLoading(button, loading, label = '处理中') {
    if (!button) return;
    if (loading) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.classList.add('loading');
      button.innerHTML = icon('refresh') + label;
    } else {
      button.disabled = false;
      if (button.dataset.original) button.innerHTML = button.dataset.original;
      button.classList.remove('loading');
    }
  }

  function relativeTime(value) {
    if (!value) return '刚刚';
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return String(value);
    const diff = Date.now() - time;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return Math.floor(diff / 86400000) + ' 天前';
  }

  function emptyState(iconName, title, copy = '', action = '') {
    return '<div class="empty-state-large"><span class="empty-icon">' + icon(iconName) + '</span><strong>' + escapeHTML(title) + '</strong>' + (copy ? '<p>' + escapeHTML(copy) + '</p>' : '') + action + '</div>';
  }

  function renderProject() {
    const name = state.project.name || '新调研项目';
    const industry = industryById(state.project.industry);
    $('#sidebar-project-name').textContent = name;
    $('#sidebar-industry').textContent = industry.label + (state.project.demo ? ' · Mock' : '');
    $('#top-project-name').textContent = name;
    $('#project-avatar').textContent = name.slice(0, 1).toUpperCase();
  }

  function activeDataSourceCount() {
    let count = 0;
    if (state.feedback.length) count++;
    if (state.trends.length) count++;
    if (state.competitors.length) count++;
    if (Object.values(state.reviewConfig?.connections || {}).some(item => item.connectedAt)) count++;
    if (aiConfigured()) count++;
    return count;
  }

  function updateStatus() {
    $('#nav-feedback-count').textContent = state.feedback.length;
    $('#nav-competitor-count').textContent = state.competitors.length;
    const activeSources = activeDataSourceCount();
    $('#source-count').textContent = activeSources;
    $('#source-count').title = '当前项目已接入 ' + activeSources + ' 类数据源';
    $('#sidebar-ai-title').textContent = aiConfigured() ? 'AI 已连接' : 'AI 尚未连接';
    $('#sidebar-ai-copy').textContent = aiConfigured() ? state.ai.model : '配置 API 后启用';
    $('#sidebar-ai-dot').classList.toggle('is-offline', !aiConfigured());
    $('#top-ai-status').classList.toggle('is-connected', aiConfigured());
    $('#top-ai-status b').textContent = aiConfigured() ? 'AI 已连接' : 'AI 未连接';
    const pill = $('#ai-status-pill');
    if (pill) {
      pill.classList.toggle('is-connected', aiConfigured());
      pill.innerHTML = '<i></i>' + (aiConfigured() ? '已连接 · ' + escapeHTML(state.ai.model) : '未连接');
    }
    const configStatus = $('#ai-connect-status');
    if (configStatus) configStatus.textContent = aiConfigured() ? '已保存连接配置，可测试后使用' : '尚未连接 AI 服务';
  }

  /* ===== CSV and feedback analysis ===== */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const input = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(field.trim()); field = ''; }
      else if (char === '\n') { row.push(field.trim()); field = ''; if (row.some(cell => cell)) rows.push(row); row = []; }
      else if (char !== '\r') field += char;
    }
    row.push(field.trim());
    if (row.some(cell => cell)) rows.push(row);
    return rows;
  }

  const normalizeHeader = value => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

  function rowsFromSurveyCSV(text) {
    const parsed = parseCSV(text);
    if (!parsed.length) return [];
    const headers = parsed[0].map(normalizeHeader);
    const aliases = {
      text: ['feedback', 'text', 'comment', 'content', 'answer', 'review', '反馈', '反馈内容', '内容', '回答', '评论', '用户反馈'],
      question: ['question', 'surveyquestion', 'prompt', '问题', '问卷问题', '题目'],
      source: ['source', 'channel', 'platform', '来源', '渠道', '平台'],
      rating: ['rating', 'score', 'stars', '评分', '星级'],
      date: ['date', 'time', 'createdat', '日期', '时间'],
      segment: ['segment', 'user', 'group', 'audience', '用户类型', '人群', '分组']
    };
    const indexes = {};
    Object.entries(aliases).forEach(([key, names]) => { indexes[key] = headers.findIndex(header => names.includes(header)); });
    const hasHeaders = indexes.text >= 0 || indexes.question >= 0;
    const start = hasHeaders ? 1 : 0;
    const result = [];
    for (let i = start; i < parsed.length && result.length < 5000; i++) {
      const cells = parsed[i];
      const textValue = cells[hasHeaders ? Math.max(indexes.text, 0) : 0] || '';
      if (!textValue.trim()) continue;
      const read = key => hasHeaders && indexes[key] >= 0 ? cells[indexes[key]] || '' : '';
      const ratingValue = Number(read('rating'));
      result.push({
        id: i,
        text: textValue.trim(),
        question: read('question').trim() || '未标注问题',
        source: read('source').trim() || 'CSV 导入',
        segment: read('segment').trim(),
        rating: Number.isFinite(ratingValue) && ratingValue > 0 ? clamp(ratingValue, 1, 5) : null,
        date: read('date').trim() || localDateString(),
        importedAt: new Date().toISOString()
      });
    }
    return result;
  }

  const positiveWords = ['喜欢', '很好', '不错', '满意', '方便', '流畅', '清晰', '好用', '提升', '推荐', '惊喜', '优秀', '稳定', '值得', '快', '省时', '好', 'love', 'great', 'good', 'easy', 'fast', 'helpful', 'excellent'];
  const negativeWords = ['不喜欢', '复杂', '难用', '不足', '太贵', '卡顿', '闪退', '崩溃', '慢', '错误', '问题', '失望', '麻烦', '缺少', '不能', '无法', '广告', '重复', '退款', '希望增加', '希望支持', 'bug', 'slow', 'confusing', 'expensive', 'bad', 'hard'];
  const themeRules = [
    { name: '功能诉求', words: ['希望', '增加', '支持', '功能', '需要', '建议', '缺少', '不能', '无法', '自动', '添加'] },
    { name: '使用体验', words: ['复杂', '难用', '方便', '流畅', '交互', '步骤', '直观', '容易', '界面', '体验'] },
    { name: '价格与付费', words: ['价格', '太贵', '付费', '订阅', '免费', '套餐', '性价比', '退款', '会员', '收费'] },
    { name: '内容与质量', words: ['内容', '质量', '准确', '丰富', '重复', '无聊', '好看', '清晰', '推荐', '信息'] },
    { name: '性能与稳定性', words: ['慢', '卡顿', '闪退', '崩溃', '加载', 'bug', '稳定', '延迟', '错误', '掉线'] },
    { name: '客户服务', words: ['客服', '售后', '响应', '解决', '反馈', '退款', '服务'] }
  ];

  function classifySentiment(item) {
    if (item.rating) return item.rating >= 4 ? 'positive' : item.rating <= 2 ? 'negative' : 'neutral';
    const text = String(item.text || '').toLowerCase();
    const positive = positiveWords.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
    const negative = negativeWords.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
    return positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral';
  }

  function themeForFeedback(text) {
    const lower = String(text || '').toLowerCase();
    let best = { name: '其他', score: 0 };
    themeRules.forEach(rule => {
      const score = rule.words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
      if (score > best.score) best = { name: rule.name, score };
    });
    return best.name;
  }

  function analyzeFeedback(items) {
    const enriched = items.map(item => ({ ...item, sentiment: classifySentiment(item), theme: themeForFeedback(item.text) }));
    const counts = { positive: 0, neutral: 0, negative: 0 };
    const themes = {};
    const sources = {};
    const questions = {};
    enriched.forEach(item => {
      counts[item.sentiment]++;
      themes[item.theme] = (themes[item.theme] || 0) + 1;
      if (item.source) sources[item.source] = (sources[item.source] || 0) + 1;
      if (item.question) {
        if (!questions[item.question]) questions[item.question] = { count: 0, themes: {}, positive: 0, neutral: 0, negative: 0 };
        const entry = questions[item.question];
        entry.count++;
        entry.themes[item.theme] = (entry.themes[item.theme] || 0) + 1;
        entry[item.sentiment]++;
      }
    });
    const total = enriched.length || 1;
    const positiveShare = Math.round(counts.positive / total * 100);
    const negativeShare = Math.round(counts.negative / total * 100);
    const dates = enriched.map(item => item.date).filter(Boolean).sort();
    const rated = enriched.filter(item => item.rating);
    return {
      items: enriched,
      counts,
      total: enriched.length,
      positiveShare,
      negativeShare,
      neutralShare: 100 - positiveShare - negativeShare,
      themes: Object.entries(themes).sort((a, b) => b[1] - a[1]),
      sources: Object.entries(sources).sort((a, b) => b[1] - a[1]),
      questions: Object.entries(questions).sort((a, b) => b[1].count - a[1].count),
      topTheme: Object.entries(themes).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
      averageRating: rated.length ? (rated.reduce((sum, item) => sum + item.rating, 0) / rated.length).toFixed(1) : '—',
      dateRange: dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : dates[0] + ' 至 ' + dates[dates.length - 1]) : '—'
    };
  }

  function localFeedbackSummary(analysis) {
    if (!analysis.total) return '';
    return '共 ' + analysis.total + ' 条反馈，来自 ' + analysis.sources.length + ' 个来源。正面反馈 ' + analysis.positiveShare + '%，负面反馈 ' + analysis.negativeShare + '%。当前最集中的主题是「' + analysis.topTheme + '」。';
  }

  function recordFeedbackImport(fileName, count, source = '文件导入', feedbackIds = []) {
    state.feedbackHistory.unshift({
      id: uid('import'),
      fileName: String(fileName || '未命名数据').slice(0, 180),
      count: Number(count) || 0,
      source,
      feedbackIds: Array.isArray(feedbackIds) ? feedbackIds.map(String) : [],
      importedAt: new Date().toISOString()
    });
    state.feedbackHistory = state.feedbackHistory.slice(0, 50);
  }

  function renderFeedbackHistory() {
    const list = $('#feedback-history-list');
    const counter = $('#feedback-history-count');
    if (!list || !counter) return;
    counter.textContent = state.feedbackHistory.length + ' 条';
    list.innerHTML = state.feedbackHistory.length ? state.feedbackHistory.slice(0, 6).map(item =>
      '<div class="feedback-history-item"><span class="history-file-icon">' + icon('file') + '</span><div class="history-copy"><strong title="' + escapeHTML(item.fileName) + '">' + escapeHTML(item.fileName) + '</strong><small>' + escapeHTML(item.source || '文件导入') + ' · ' + relativeTime(item.importedAt) + '</small></div><div class="history-actions"><span class="history-count">' + formatNumber(item.count) + ' 条</span><button class="history-delete" data-action="delete-feedback-import" data-id="' + escapeHTML(item.id) + '" aria-label="撤销 ' + escapeHTML(item.fileName) + ' 导入" title="撤销本次导入"><svg><use href="#i-trash"/></svg></button></div></div>'
    ).join('') : '<div class="history-empty"><span>' + icon('clock') + '</span><p>暂无导入记录</p></div>';
  }

  function deleteFeedbackImport(importId) {
    const entry = state.feedbackHistory.find(item => item.id === importId);
    if (!entry) return;
    const ids = new Set(entry.feedbackIds || []);
    openConfirm({
      title: '撤销本次导入',
      message: ids.size
        ? '将删除「' + entry.fileName + '」对应的 ' + ids.size + ' 条反馈，此操作不可恢复。'
        : '这条历史记录缺少反馈 ID，将仅移除导入记录，不删除现有反馈。',
      label: '确认撤销',
      onConfirm: () => {
        if (ids.size) state.feedback = state.feedback.filter(item => !ids.has(item.id));
        state.feedbackHistory = state.feedbackHistory.filter(item => item.id !== importId);
        state.feedbackAISummary = '';
        persistWorkspace();
        renderFeedback();
        renderOverview();
        showToast(ids.size ? '已撤销本次导入' : '已移除导入记录');
      }
    });
  }

  function reviewConnection(storeId) {
    return state.reviewConfig?.connections?.[storeId] || null;
  }

  function renderReviewSources() {
    const strip = $('#review-store-strip');
    if (!strip) return;
    const stores = DATA.reviewStores || [];
    const connected = stores.filter(store => reviewConnection(store.id)?.connectedAt).length;
    strip.innerHTML = stores.map(store => {
      const linked = Boolean(reviewConnection(store.id)?.connectedAt);
      return '<button type="button" class="review-store-chip ' + (linked ? 'is-connected' : '') + '" data-review-store="' + escapeHTML(store.id) + '" style="--store-color:' + store.color + ';--store-bg:' + store.soft + '"><span class="review-store-mark">' + escapeHTML(store.name.slice(0, 1)) + '</span><span><strong>' + escapeHTML(store.name) + '</strong><small>' + (linked ? '已连接' : store.mode === 'public' ? '公开接口' : '企业授权') + '</small></span><i></i></button>';
    }).join('');
    const status = $('#review-api-status');
    if (status) status.textContent = connected ? connected + ' 个评价源已连接' : '等待连接评价源';
    const count = $('#review-connected-count');
    if (count) count.textContent = connected + ' / ' + stores.length;
  }

  function renderReviewStoreOptions() {
    const root = $('#review-store-options');
    if (!root) return;
    root.innerHTML = (DATA.reviewStores || []).map(store =>
      '<button type="button" class="review-store-option ' + (state.reviewStore === store.id ? 'active' : '') + '" data-review-store="' + escapeHTML(store.id) + '" style="--store-color:' + store.color + ';--store-bg:' + store.soft + '"><span class="review-store-mark">' + escapeHTML(store.name.slice(0, 1)) + '</span><span><strong>' + escapeHTML(store.name) + '</strong><small>' + escapeHTML(store.hint || '') + '</small></span></button>'
    ).join('');
  }

  function selectReviewStore(storeId) {
    const store = reviewStoreById(storeId);
    if (!store) return;
    state.reviewStore = store.id;
    const config = reviewConnection(store.id) || {};
    renderReviewStoreOptions();
    $('#review-app-id').value = config.appId || '';
    $('#review-region').value = config.region || 'cn';
    $('#review-endpoint').value = config.endpoint || '';
    $('#review-access-token').value = getReviewToken(store.id);
    $('#review-region-field').hidden = store.mode !== 'public';
    $('#review-enterprise-fields').hidden = store.mode !== 'enterprise';
    $('#review-source-note').innerHTML = store.mode === 'public'
      ? icon('check') + '<span>App Store 使用公开评价接口，无需 API Key。</span>'
      : icon('settings') + '<span>需企业开放平台授权。Endpoint 仅允许官方域名，Token 仅保存在当前会话。</span>';
    const status = $('#review-sync-status');
    if (status) status.textContent = config.connectedAt ? '已连接 · ' + relativeTime(config.connectedAt) : '等待配置';
  }

  function openReviewSourceModal(storeId = state.reviewStore) {
    selectReviewStore(storeId);
    openModal('review-source-modal');
  }

  async function syncStoreReviews() {
    const store = reviewStoreById(state.reviewStore);
    if (!store) return;
    const appId = $('#review-app-id').value.trim();
    const region = $('#review-region').value || 'cn';
    const endpoint = $('#review-endpoint').value.trim();
    const token = $('#review-access-token').value.trim();
    if (!appId) { showToast('请输入 App ID 或应用包名', 'error'); return; }
    if (store.mode === 'enterprise' && !endpoint) { showToast('请输入企业评价 API Endpoint', 'error'); return; }
    if (store.mode === 'enterprise' && !token) { showToast('请输入企业评价接口 Access Token', 'error'); return; }

    const button = $('#sync-store-reviews');
    const status = $('#review-sync-status');
    setButtonLoading(button, true, '同步中');
    if (status) status.textContent = '正在请求评价接口…';
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ store: store.id, appId, region, endpoint, token })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '评价接口请求失败（' + response.status + '）');
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (!reviews.length) throw new Error('接口未返回可清洗的评价数据');
      const existing = new Set(state.feedback.map(item => [item.source, item.text, item.date].join('\u0000')));
      const incoming = reviews.map(review => ({
        id: uid('feedback'),
        text: String(review.text || '').trim(),
        question: store.name + ' 用户评价',
        source: store.name,
        segment: String(review.author || ''),
        rating: Number(review.rating) || null,
        date: String(review.date || localDateString()),
        importedAt: new Date().toISOString()
      })).filter(review => review.text && !existing.has([review.source, review.text, review.date].join('\u0000')));
      if (!incoming.length) throw new Error('本次返回的评价已全部存在');
      state.feedback = [...incoming, ...state.feedback];
      state.feedbackAISummary = '';
      state.reviewConfig.connections[store.id] = {
        appId,
        region,
        endpoint: store.mode === 'enterprise' ? endpoint : '',
        mode: store.mode,
        connectedAt: new Date().toISOString()
      };
      state.reviewConfig.updatedAt = new Date().toISOString();
      setReviewToken(store.id, token);
      recordFeedbackImport(store.name + ' · 实时同步', incoming.length, store.name, incoming.map(item => item.id));
      persistWorkspace();
      renderFeedback();
      renderOverview();
      if (status) status.textContent = '同步完成 · ' + incoming.length + ' 条';
      showToast('已同步 ' + incoming.length + ' 条评价');
    } catch (error) {
      if (status) status.textContent = '同步失败：' + error.message;
      showToast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderFeedback() {
    const analysis = analyzeFeedback(state.feedback);
    $('#sentiment-total').textContent = analysis.total + ' 条';
    $('#positive-share').textContent = analysis.positiveShare + '%';
    $('#feedback-analysis-badge').textContent = !analysis.total ? '尚未导入' : state.feedbackAISummary ? 'AI 摘要' : '本地分析';
    $('#feedback-overview-meta').innerHTML = analysis.total ? '<span>' + icon('database') + '数据量 <b>' + analysis.total + ' 条</b></span><span>' + icon('link') + '数据来源 <b>' + analysis.sources.length + ' 个</b></span><span>' + icon('clock') + '时间范围 <b>' + escapeHTML(analysis.dateRange) + '</b></span>' : '';
    $('#feedback-summary-text').textContent = analysis.total ? (state.feedbackAISummary || localFeedbackSummary(analysis)) : '导入问卷或用户反馈后生成总览。';
    $('#feedback-overview-stats').innerHTML = analysis.total ? [
      ['正面反馈', analysis.positiveShare + '%'],
      ['负面反馈', analysis.negativeShare + '%'],
      ['高频主题', analysis.topTheme],
      ['平均评分', analysis.averageRating]
    ].map(([label, value]) => '<div><span>' + label + '</span><strong>' + escapeHTML(value) + '</strong></div>').join('') : '';
    const donut = $('#sentiment-donut');
    if (analysis.total) {
      donut.classList.remove('empty-donut');
      donut.style.background = 'conic-gradient(#2ab07e 0 ' + analysis.positiveShare + '%, #f2a63a ' + analysis.positiveShare + '% ' + (analysis.positiveShare + analysis.neutralShare) + '%, #e25858 ' + (analysis.positiveShare + analysis.neutralShare) + '% 100%)';
    } else {
      donut.classList.add('empty-donut');
      donut.style.background = '';
    }
    $('#sentiment-legend').innerHTML = analysis.total ? [
      ['正面', analysis.counts.positive, '#2ab07e'],
      ['中性', analysis.counts.neutral, '#f2a63a'],
      ['负面', analysis.counts.negative, '#e25858']
    ].map(([label, value, color]) => '<div class="sentiment-legend-item"><i style="background:' + color + '"></i><span>' + label + '反馈</span><strong>' + value + ' 条</strong></div>').join('') : '<div class="mini-empty">暂无数据</div>';
    $('#theme-bars').innerHTML = analysis.themes.length ? analysis.themes.slice(0, 6).map(([name, count]) => {
      const percent = Math.round(count / analysis.total * 100);
      return '<div class="theme-bar"><div class="theme-bar-head"><span>' + escapeHTML(name) + '</span><strong>' + count + ' 次 · ' + percent + '%</strong></div><div class="theme-track"><i style="width:' + Math.max(7, percent) + '%"></i></div></div>';
    }).join('') : emptyState('radar', '暂无主题');
    $('#survey-source-count').textContent = analysis.sources.length + ' 个';
    $('#source-breakdown').innerHTML = analysis.sources.length ? analysis.sources.map(([name, count]) => '<div class="source-break-row"><span><i></i>' + escapeHTML(name) + '</span><div><i style="width:' + Math.round(count / analysis.total * 100) + '%"></i></div><strong>' + count + '</strong></div>').join('') : emptyState('database', '暂无来源');
    $('#survey-question-summary').innerHTML = analysis.questions.length ? analysis.questions.slice(0, 6).map(([question, info]) => {
      const topTheme = Object.entries(info.themes).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      return '<div class="question-summary-item"><div><strong>' + escapeHTML(question) + '</strong><span>' + info.count + ' 条</span></div><p>主要主题：' + escapeHTML(topTheme) + '</p><div class="question-sentiment"><i class="pos" style="width:' + Math.round(info.positive / info.count * 100) + '%"></i><i class="neu" style="width:' + Math.round(info.neutral / info.count * 100) + '%"></i><i class="neg" style="width:' + Math.round(Math.max(0, info.negative) / info.count * 100) + '%"></i></div></div>';
    }).join('') : emptyState('message', '暂无问卷问题');
    $('#feedback-table-state').textContent = analysis.total ? '已分析' : '待导入';
    $('#feedback-table-body').innerHTML = analysis.total ? analysis.items.slice(0, 10).map(item => {
      const label = item.sentiment === 'positive' ? '正面' : item.sentiment === 'negative' ? '负面' : '中性';
      return '<tr><td title="' + escapeHTML(item.text) + '">' + escapeHTML(item.text) + '</td><td>' + escapeHTML(item.question) + '</td><td>' + escapeHTML(item.source) + '</td><td><span class="feedback-sentiment ' + item.sentiment + '">' + label + '</span></td><td><span class="topic-chip">' + escapeHTML(item.theme) + '</span></td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="table-empty">暂无反馈数据</div></td></tr>';
    const quotes = analysis.items.filter(item => item.text.length > 10).sort((a, b) => (b.sentiment === 'negative') - (a.sentiment === 'negative') || b.text.length - a.text.length).slice(0, 3);
    $('#quote-list').innerHTML = quotes.length ? quotes.map(item => '<div class="quote-list-item"><p>' + escapeHTML(item.text) + '</p><div class="quote-list-meta"><span>' + escapeHTML(item.source) + '</span><i></i><span>' + escapeHTML(item.theme) + '</span></div></div>').join('') : emptyState('message', '暂无原声');
    renderReviewSources();
    renderFeedbackHistory();
    updateStatus();
  }

  function renderOverview() {
    const analysis = analyzeFeedback(state.feedback);
    const kpis = [
      ['用户反馈', state.feedback.length, '条', 'message', 'blue'],
      ['竞品', state.competitors.length, '个', 'target', 'coral'],
      ['趋势信号', state.trends.length, '条', 'radar', 'violet'],
      ['正面反馈', state.feedback.length ? analysis.positiveShare + '%' : '—', '', 'heart', 'lime']
    ];
    $('#overview-kpis').innerHTML = kpis.map(([label, value, suffix, iconName, tone]) => '<article class="card overview-kpi"><span class="overview-kpi-icon ' + tone + '">' + icon(iconName) + '</span><div><span>' + label + '</span><strong>' + value + (suffix ? '<small>' + suffix + '</small>' : '') + '</strong></div></article>').join('');

    const needCounts = {};
    const categoryCounts = {};
    state.competitors.forEach(item => {
      if (item.need) needCounts[item.need] = (needCounts[item.need] || 0) + 1;
      if (item.category) categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    const topNeeds = Object.entries(needCounts).sort((a, b) => b[1] - a[1]);
    const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const competitorFeedbackTotal = state.competitors.reduce((sum, item) => sum + (item.userFeedback?.length || 0), 0);
    const competitorActionTotal = state.competitors.reduce((sum, item) => sum + splitEntries(item.signal).length, 0);
    const priorities = state.insight?.feature_priorities;
    if (Array.isArray(priorities) && priorities.length) {
      $('#feature-priority-content').innerHTML = '<div class="priority-list">' + priorities.slice(0, 5).map(item => '<div class="priority-item"><span class="priority-level ' + String(item.priority || 'P1').toLowerCase() + '">' + escapeHTML(item.priority || 'P1') + '</span><div><strong>' + escapeHTML(item.title || '') + '</strong><p>' + escapeHTML(item.evidence || '') + '</p><div class="priority-meta"><span>' + escapeHTML(item.impact || '待评估') + '</span>' + (item.confidence ? '<span>置信度 ' + Number(item.confidence) + '%</span>' : '') + '</div></div></div>').join('') + '</div>';
    } else if (!state.feedback.length) {
      $('#feature-priority-content').innerHTML = '<div class="overview-summary"><div class="overview-summary-stats"><div><span>本产品反馈</span><strong>0</strong><small>尚未导入</small></div><div><span>竞品反馈</span><strong>' + competitorFeedbackTotal + '</strong><small>可作为研究参照</small></div><div><span>竞品样本</span><strong>' + state.competitors.length + '</strong><small>' + topCategories.length + ' 个品类</small></div></div><div class="overview-summary-note"><strong>迭代优先级尚未生成</strong><p>导入本产品反馈后，结合竞品动作与用户评价生成 P0 / P1 / P2 优先级。</p></div><div class="overview-summary-actions"><button class="btn btn-secondary" data-action="go-feedback">导入反馈</button><button class="btn btn-ghost" data-action="go-competitors">查看竞品反馈<svg><use href="#i-chevron-right"/></svg></button></div></div>';
    } else if (!aiConfigured()) {
      $('#feature-priority-content').innerHTML = emptyState('sparkles', '反馈已就绪', '连接 AI 后生成优先级。', '<button class="btn btn-secondary empty-action" data-action="go-ai">配置 AI</button>');
    } else {
      $('#feature-priority-content').innerHTML = emptyState('zap', '可以生成洞察', '已有 ' + state.feedback.length + ' 条反馈。', '<button class="btn btn-primary empty-action" data-action="generate-overview">生成分析</button>');
    }

    const moves = state.insight?.competitor_moves;
    const differentiation = state.insight?.differentiation;
    if (Array.isArray(moves) && moves.length) {
      $('#competitor-brief-content').innerHTML = '<div class="competitor-brief-list">' + moves.slice(0, 4).map(item => '<div class="competitor-brief-item"><div><strong>' + escapeHTML(item.competitor || '竞品') + '</strong><span class="threat-tag ' + (item.threat === '高' ? 'high' : item.threat === '低' ? 'low' : 'medium') + '">' + escapeHTML(item.threat || '中') + ' 威胁</span></div><p>' + escapeHTML(item.move || '') + '</p><small>' + escapeHTML(item.angle || '') + '</small></div>').join('') + '</div>' + (differentiation ? '<div class="differentiation-callout"><span>差异化机会</span><p>' + escapeHTML(differentiation) + '</p></div>' : '');
    } else if (!state.competitors.length) {
      $('#competitor-brief-content').innerHTML = emptyState('target', '暂无竞品资料', '添加竞品后生成。', '<button class="btn btn-secondary empty-action" data-action="add-competitor">添加竞品</button>');
    } else if (!aiConfigured()) {
      const needSummary = topNeeds.slice(0, 3).map(([name, count]) => '<span>' + escapeHTML(name) + ' · ' + count + '</span>').join('');
      const categorySummary = topCategories.slice(0, 4).map(([name, count]) => '<span>' + escapeHTML(name) + ' · ' + count + '</span>').join('');
      $('#competitor-brief-content').innerHTML = '<div class="overview-summary"><div class="overview-summary-stats"><div><span>竞品样本</span><strong>' + state.competitors.length + '</strong><small>个竞品</small></div><div><span>动作记录</span><strong>' + competitorActionTotal + '</strong><small>条</small></div><div><span>用户反馈</span><strong>' + competitorFeedbackTotal + '</strong><small>条</small></div></div><div class="overview-signal-groups"><div><span>核心诉求分布</span><div class="overview-signal-tags">' + needSummary + '</div></div><div><span>品类分布</span><div class="overview-signal-tags">' + categorySummary + '</div></div></div><div class="overview-summary-actions"><button class="btn btn-secondary" data-action="go-competitors">查看竞品档案</button><button class="btn btn-ghost" data-action="go-ai">配置 AI<svg><use href="#i-chevron-right"/></svg></button></div></div>';
    } else {
      $('#competitor-brief-content').innerHTML = emptyState('zap', '可以生成洞察', '已有 ' + state.competitors.length + ' 个竞品档案。', '<button class="btn btn-primary empty-action" data-action="generate-overview">生成分析</button>');
    }

    const steps = [
      ['项目设置', state.project.name + ' · ' + industryById(state.project.industry).label, true, 'project-settings'],
      ['用户反馈', state.feedback.length ? state.feedback.length + ' 条 · ' + analysis.sources.length + ' 个来源' : '待导入', state.feedback.length > 0, 'go-feedback'],
      ['竞品资料', state.competitors.length ? state.competitors.length + ' 个竞品' : '待添加', state.competitors.length > 0, 'add-competitor'],
      ['趋势信号', state.trends.length ? state.trends.length + ' 条信号' : '待导入或同步', state.trends.length > 0, 'go-trends'],
      ['AI 接入', aiConfigured() ? state.ai.model : '待配置', aiConfigured(), 'go-ai']
    ];
    $('#readiness-list').innerHTML = steps.map(([label, value, done, action]) => '<button class="readiness-item" data-action="' + action + '"><span class="readiness-check ' + (done ? 'done' : '') + '">' + icon(done ? 'check' : 'plus') + '</span><span><strong>' + label + '</strong><small>' + escapeHTML(value) + '</small></span><svg><use href="#i-chevron-right"/></svg></button>').join('');

    const records = [
      ...state.feedback.map(item => ({ type: '反馈', title: item.question || item.text, source: item.source, date: item.importedAt || item.date })),
      ...state.competitors.map(item => ({ type: '竞品', title: item.name + ' · ' + (item.signal || item.category), source: item.source, date: item.createdAt })),
      ...state.trends.map(item => ({ type: '趋势', title: item.title, source: platformById(item.platform).name, date: item.importedAt || item.date }))
    ].filter(item => item.title).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);
    $('#recent-data-count').textContent = records.length + ' 条';
    $('#recent-data-list').innerHTML = records.length ? '<div class="recent-list">' + records.map(item => '<div class="recent-item"><span>' + item.type + '</span><div><strong>' + escapeHTML(item.title) + '</strong><small>' + escapeHTML(item.source || '本地记录') + ' · ' + relativeTime(item.date) + '</small></div></div>').join('') + '</div>' : emptyState('clock', '暂无调研记录');
    updateStatus();
  }

  function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleFeedbackFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { showToast('请上传 CSV 文件', 'error'); return; }
    const reader = new FileReader();
    reader.onload = event => {
      const rows = rowsFromSurveyCSV(event.target.result);
      if (!rows.length) { showToast('未识别到有效反馈内容', 'error'); return; }
      const incoming = rows.map(row => ({ ...row, id: uid('feedback') }));
      state.feedback = [...incoming, ...state.feedback];
      state.feedbackAISummary = '';
      recordFeedbackImport(file.name, incoming.length, 'CSV 文件', incoming.map(item => item.id));
      persistWorkspace();
      renderFeedback();
      renderOverview();
      showToast('已导入 ' + rows.length + ' 条反馈');
    };
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.readAsText(file, 'utf-8');
  }

  /* ===== Trend signals ===== */
  function normalizePlatform(value) {
    const raw = String(value || '').toLowerCase().trim();
    const aliases = { tiktok: 'tiktok', x: 'x', twitter: 'x', xiaohongshu: 'xiaohongshu', '小红书': 'xiaohongshu', weibo: 'weibo', '微博': 'weibo', appstore: 'appstore', 'app store': 'appstore', '应用商店': 'appstore', ecommerce: 'ecommerce', '电商': 'ecommerce', '电商平台': 'ecommerce', other: 'other', '其他': 'other' };
    return aliases[raw] || 'other';
  }

  function normalizeTrendKeywords(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(/[|,，、;；\n]+/);
    const seen = new Set();
    return source.map(entry => {
      const rawName = typeof entry === 'object'
        ? entry?.name || entry?.keyword || entry?.word || entry?.text || entry?.label
        : entry;
      const name = String(rawName || '').trim().replace(/^#+/, '');
      if (!name || name.length > 30) return null;
      const key = name.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const rawWeight = Number(typeof entry === 'object' ? entry?.weight ?? entry?.value ?? entry?.score : null);
      return { name, weight: Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : null };
    }).filter(Boolean);
  }

  function normalizeTrend(item, index = 0) {
    const title = item.title || item.topic || item.name || item.content || item.headline || '';
    if (!String(title).trim()) return null;
    const mentions = Number(String(item.mentions ?? item.volume ?? item.count ?? item.score ?? item.heat ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    const deltaRaw = item.delta ?? item.growth ?? item.change ?? null;
    const sentimentRaw = item.sentiment ?? item.sentimentScore ?? null;
    return {
      id: item.id || uid('trend'),
      title: String(title).trim(),
      description: String(item.description || item.summary || item.text || '').trim(),
      platform: normalizePlatform(item.platform || item.source || 'other'),
      mentions: Math.max(0, mentions),
      delta: deltaRaw === null || deltaRaw === '' ? null : Number(String(deltaRaw).replace(/[^0-9.-]/g, '')),
      sentiment: sentimentRaw === null || sentimentRaw === '' ? null : clamp(Number(String(sentimentRaw).replace(/[^0-9.-]/g, '')), 0, 100),
      category: String(item.category || item.type || '未分类').trim(),
      date: String(item.date || item.created_at || item.publishedAt || localDateString()),
      url: String(item.url || item.link || '').trim(),
      source: String(item.sourceName || item.dataSource || item.source || '文件导入').trim(),
      keywords: normalizeTrendKeywords(item.keywords || item.keyword || item.hashtags || item.topics),
      importedAt: new Date().toISOString()
    };
  }

  function trendsFromCSV(text) {
    const parsed = parseCSV(text);
    if (parsed.length < 2) return [];
    const headers = parsed[0].map(normalizeHeader);
    const aliases = {
      title: ['title', 'topic', 'name', 'content', 'headline', '标题', '话题', '内容'],
      description: ['description', 'summary', 'text', '描述', '摘要'],
      platform: ['platform', 'source', '平台', '来源'],
      mentions: ['mentions', 'volume', 'count', 'score', 'heat', '声量', '提及', '热度'],
      delta: ['delta', 'growth', 'change', '增长', '增幅'],
      sentiment: ['sentiment', 'sentimentscore', '情感', '情感值'],
      category: ['category', 'type', '分类', '类型'],
      date: ['date', 'createdat', 'publishedat', '日期', '时间'],
      url: ['url', 'link', '链接'],
      keywords: ['keywords', 'keyword', 'hashtags', 'topics', '关键词', '热词'],
      sourceName: ['sourcename', 'datasource', '数据源']
    };
    const indexes = {};
    Object.entries(aliases).forEach(([key, names]) => { indexes[key] = headers.findIndex(header => names.includes(header)); });
    return parsed.slice(1).map((cells, rowIndex) => {
      const item = {};
      Object.entries(indexes).forEach(([key, idx]) => { if (idx >= 0) item[key] = cells[idx]; });
      return normalizeTrend({ ...item, id: 'csv-trend-' + Date.now() + '-' + rowIndex }, rowIndex);
    }).filter(Boolean);
  }

  function trendsFromJSON(text) {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : parsed.trends || parsed.data || parsed.items || [];
    return Array.isArray(list) ? list.map(normalizeTrend).filter(Boolean) : [];
  }

  function loadTrendFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const items = /\.json$/i.test(file.name) || file.type === 'application/json' ? trendsFromJSON(event.target.result) : trendsFromCSV(event.target.result);
        if (!items.length) throw new Error('empty');
        const existing = new Set(state.trends.map(item => item.id));
        state.trends = [...items.filter(item => !existing.has(item.id)), ...state.trends];
        persistWorkspace();
        renderTrends();
        renderOverview();
        showToast('已导入 ' + items.length + ' 条趋势信号');
      } catch (_) { showToast('未识别到有效趋势数据', 'error'); }
    };
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.readAsText(file, 'utf-8');
  }

  function renderTrendChart(signals) {
    const container = $('#trend-chart');
    if (!signals.length) { container.innerHTML = emptyState('radar', '暂无趋势数据', '导入 CSV / JSON 后生成图表。'); return; }
    const sorted = signals.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const values = sorted.map(item => Math.max(0, item.mentions || 0));
    const width = 840, height = 225, pad = { top: 22, right: 20, bottom: 34, left: 44 };
    const max = Math.max(...values, 1) * 1.12;
    const points = values.map((value, index) => [pad.left + (values.length === 1 ? 0 : index / (values.length - 1) * (width - pad.left - pad.right)), pad.top + (height - pad.top - pad.bottom) * (1 - value / max)]);
    const path = points.map((point, index) => (index ? 'L' : 'M') + point[0].toFixed(1) + ',' + point[1].toFixed(1)).join(' ');
    const area = path + ' L ' + (points[points.length - 1]?.[0] || pad.left) + ',' + (height - pad.bottom) + ' L ' + pad.left + ',' + (height - pad.bottom) + ' Z';
    const grid = [0, .25, .5, .75, 1].map(ratio => {
      const y = pad.top + ratio * (height - pad.top - pad.bottom);
      return '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (width - pad.right) + '" y2="' + y + '" stroke="#eef0f3"/><text x="' + (pad.left - 8) + '" y="' + (y + 3) + '" text-anchor="end" fill="#a0a7b2" font-size="8">' + formatNumber(Math.round(max * (1 - ratio))) + '</text>';
    }).join('');
    const indexes = [...new Set([0, Math.floor((sorted.length - 1) / 2), sorted.length - 1])];
    const labels = indexes.map(index => '<text x="' + points[index][0] + '" y="' + (height - 10) + '" text-anchor="middle" fill="#a0a7b2" font-size="8">' + escapeHTML(String(sorted[index].date).slice(5)) + '</text>').join('');
    const dots = points.map((point, index) => '<circle cx="' + point[0] + '" cy="' + point[1] + '" r="3.2" fill="#fff" stroke="#3d5cf5" stroke-width="1.8"><title>' + escapeHTML(sorted[index].title) + ' · ' + formatNumber(values[index]) + '</title></circle>').join('');
    container.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none"><defs><linearGradient id="trend-area-v2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d5cf5" stop-opacity=".15"/><stop offset="1" stop-color="#3d5cf5" stop-opacity="0"/></linearGradient></defs>' + grid + '<path d="' + area + '" fill="url(#trend-area-v2)"/><path d="' + path + '" fill="none" stroke="#3d5cf5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' + dots + labels + '</svg>';
  }

  function trendKeywordStats(signals) {
    const stats = new Map();
    signals.forEach(signal => {
      const keywords = signal.keywords?.length ? signal.keywords : [{ name: signal.title, weight: null }];
      const fallbackWeight = Math.max(Number(signal.mentions) || 0, 1) / Math.max(keywords.length, 1);
      keywords.forEach(keyword => {
        const name = String(keyword?.name || '').trim();
        if (!name) return;
        const explicitWeight = Number(keyword?.weight);
        const weight = Number.isFinite(explicitWeight) && explicitWeight > 0 ? explicitWeight : fallbackWeight;
        const key = name.toLowerCase();
        const current = stats.get(key) || { name, weight: 0, signals: 0, platforms: new Set() };
        current.weight += weight;
        current.signals += 1;
        current.platforms.add(signal.platform);
        stats.set(key, current);
      });
    });
    const sorted = [...stats.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'zh-CN'));
    const total = sorted.reduce((sum, item) => sum + item.weight, 0) || 1;
    return sorted.map((item, index) => ({ ...item, rank: index + 1, share: item.weight / total * 100 }));
  }

  function renderTrendWordCloud(signals) {
    const cloud = $('#trend-word-cloud');
    const ranking = $('#trend-keyword-ranking');
    const count = $('#trend-keyword-count');
    if (!cloud || !ranking || !count) return;
    const stats = trendKeywordStats(signals);
    count.textContent = stats.length + ' 个关键词';
    if (!stats.length) {
      cloud.innerHTML = emptyState('radar', '暂无关键词', '导入含关键词字段的趋势数据后生成词云。');
      ranking.innerHTML = '<div class="keyword-ranking-empty">暂无关键词占比</div>';
      return;
    }
    const visible = stats.slice(0, 18);
    const maxWeight = Math.max(...visible.map(item => item.weight), 1);
    const palette = ['#3657f4', '#0f8a68', '#d05d3d', '#7356dc', '#a77612', '#c94e82', '#2e758f', '#536579'];
    cloud.innerHTML = visible.map((item, index) => {
      const ratio = Math.sqrt(item.weight / maxWeight);
      const size = Math.round(15 + ratio * 25);
      const weight = ratio > .68 ? 720 : ratio > .4 ? 650 : 560;
      const share = item.share.toFixed(1);
      return '<span class="keyword-cloud-word" style="--word-size:' + size + 'px;--word-color:' + palette[index % palette.length] + ';--word-weight:' + weight + '" title="' + escapeHTML(item.name) + ' · 提及权重 ' + formatNumber(Math.round(item.weight)) + ' · 占比 ' + share + '%" aria-label="' + escapeHTML(item.name) + '，占比 ' + share + '%">' + escapeHTML(item.name) + '<small>' + share + '%</small></span>';
    }).join('');
    cloud.setAttribute('aria-label', '趋势关键词词云，共 ' + stats.length + ' 个关键词');
    ranking.innerHTML = stats.slice(0, 8).map(item => {
      const share = item.share.toFixed(1);
      return '<div class="keyword-rank-row"><span class="keyword-rank-index">' + String(item.rank).padStart(2, '0') + '</span><div class="keyword-rank-main"><div class="keyword-rank-meta"><strong>' + escapeHTML(item.name) + '</strong><span>' + share + '%</span></div><div class="keyword-rank-bar"><i style="width:' + Math.max(4, Math.min(100, item.share)) + '%"></i></div><small>' + item.signals + ' 条信号 · ' + item.platforms.size + ' 个平台</small></div></div>';
    }).join('');
  }

  function renderTrends() {
    $('#trend-platform-tabs').innerHTML = DATA.platforms.map(platform => '<button class="platform-tab ' + (state.platform === platform.id ? 'active' : '') + '" data-platform="' + platform.id + '" style="--tab-color:' + platform.color + '"><i></i>' + platform.name + '</button>').join('');
    const filtered = state.platform === 'all' ? state.trends : state.trends.filter(item => item.platform === state.platform);
    $('#trend-signal-count').textContent = filtered.length;
    $('#trend-source-count').textContent = new Set(state.trends.map(item => item.platform)).size;
    $('#trend-stat-count').textContent = filtered.length;
    $('#trend-stat-mentions').textContent = formatNumber(filtered.reduce((sum, item) => sum + (item.mentions || 0), 0));
    $('#trend-stat-platforms').textContent = new Set(filtered.map(item => item.platform)).size;
    $('#trend-data-status').classList.toggle('offline', !state.trends.length);
    const trendStatusText = state.trends.length ? (state.project.demo ? 'Mock 演示数据' : '已载入真实数据') : '能力已接入 · 暂无数据';
    $('#trend-data-status').innerHTML = '<i></i>' + trendStatusText;
    const activeSources = activeDataSourceCount();
    const sourceStatus = $('#trend-source-status');
    if (sourceStatus) {
      sourceStatus.textContent = state.trends.length ? '已载入' : activeSources ? '已连接' : '待接入';
      sourceStatus.classList.toggle('is-empty', !state.trends.length && !activeSources);
    }
    const sourceTitle = $('#trend-source-title');
    if (sourceTitle) sourceTitle.textContent = state.trends.length || activeSources ? '已连接数据源' : '等待接入数据源';
    const sourceDetail = $('#trend-source-detail');
    if (sourceDetail) sourceDetail.textContent = state.trends.length
      ? state.trends.length + ' 条信号 · ' + new Set(state.trends.map(item => item.platform)).size + ' 个平台'
      : activeSources
        ? activeSources + ' 类数据源已接入 · 等待导入趋势'
        : '导入反馈、添加竞品或配置 API 后启用';
    renderTrendChart(filtered);
    renderTrendWordCloud(filtered);
    $('#trend-feed').innerHTML = filtered.length ? filtered.slice(0, 30).map(item => {
      const platform = platformById(item.platform);
      return '<div class="trend-signal-row"><span class="signal-platform" style="background:' + platform.color + '">' + platformLetters[item.platform] + '</span><div class="signal-main"><strong>' + escapeHTML(item.title) + '</strong>' + (item.description ? '<p>' + escapeHTML(item.description) + '</p>' : '') + '<div><span>' + escapeHTML(platform.name) + '</span><span>' + escapeHTML(item.category) + '</span><span>' + escapeHTML(item.source) + '</span></div></div><div class="signal-value"><strong>' + formatNumber(item.mentions) + '</strong><small>提及</small></div>' + (item.delta !== null && Number.isFinite(item.delta) ? '<span class="trend-delta">' + icon('trending') + (item.delta >= 0 ? '+' : '') + item.delta + '%</span>' : '<span class="trend-delta neutral">—</span>') + (item.url ? '<a class="signal-open" href="' + escapeHTML(item.url) + '" target="_blank" rel="noopener" aria-label="打开来源">' + icon('external') + '</a>' : '<span></span>') + '</div>';
    }).join('') : emptyState('radar', '暂无趋势信号', state.platform === 'all' ? '导入趋势文件开始。' : '当前平台暂无数据。');
    updateStatus();
  }

    /* ===== Competitor records ===== */
  function splitEntries(value) {
    if (Array.isArray(value)) return value.flatMap(splitEntries);
    return String(value || '').split(/\r?\n|[;；]+/).map(item => item.trim()).filter(Boolean);
  }

  function toList(value) {
    if (Array.isArray(value)) return [...new Set(value.flatMap(toList).filter(Boolean))];
    return [...new Set(String(value || '').split(/[|,，/;；、\n]+/).map(item => item.trim()).filter(Boolean))];
  }

  function categoryMeta(value) {
    const label = String(value || '').trim();
    return (DATA.competitorCategoryMeta || []).find(item => item.label === label) || {
      id: 'custom', label: label || '未分类', color: '#64748b', soft: '#f4f6f9', tracks: []
    };
  }

  function categoryTag(value, extra = '') {
    const meta = categoryMeta(value);
    return '<span class="category-tag ' + extra + '" style="--tag-color:' + meta.color + ';--tag-bg:' + meta.soft + '">' + escapeHTML(meta.label) + '</span>';
  }

  function trackTag(value, category) {
    const meta = categoryMeta(category);
    return '<span class="meta-tag track-tag" style="--tag-color:' + meta.color + ';--tag-bg:' + meta.soft + '">' + escapeHTML(value) + '</span>';
  }

  function needMeta(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!raw) return null;
    const aliases = {
      killtime: '杀时间', '杀时间': '杀时间', 消磨时间: '杀时间',
      savetime: '省时间', '省时间': '省时间', 节省时间: '省时间',
      spendmoney: '花钱', '花钱': '花钱', 消费: '花钱',
      makemoneyimprove: '赚钱 / 变好', makemoney: '赚钱 / 变好', improve: '赚钱 / 变好', '赚钱 / 变好': '赚钱 / 变好', '变好': '赚钱 / 变好'
    };
    const label = aliases[raw] || aliases[raw.replace(/[\/]/g, '')] || raw;
    return (DATA.competitorNeeds || []).find(item => item.label === label || String(item.english || '').toLowerCase().replace(/[\s_-]+/g, '').replace(/[\/]/g, '') === raw.replace(/[\/]/g, '')) || null;
  }

  function needTag(value) {
    if (!value) return '';
    const meta = needMeta(value);
    return '<span class="meta-tag need-tag" style="--tag-color:' + (meta?.color || '#64748b') + ';--tag-bg:' + (meta?.soft || '#f4f6f9') + '">' + escapeHTML(meta?.label || value) + '</span>';
  }

  function marketTag(value) {
    if (!value) return '';
    return '<span class="meta-tag market-tag">' + escapeHTML(value) + '</span>';
  }

  function normalizeBroadCategory(value) {
    const raw = String(value || '').trim();
    const meta = (DATA.competitorCategoryMeta || []).find(item => item.label === raw);
    if (meta) return meta.label;
    const aliases = {
      '游戏': '泛娱乐', '短视频': '泛娱乐', '社交': '泛娱乐',
      '美妆日消': '电商消费', '电商': '电商消费', '消费': '电商消费',
      'app': '工具效率', 'saas': '工具效率', 'saas / 工具': '工具效率', '工具': '工具效率',
      '健康': '健康学习', '学习': '健康学习'
    };
    return aliases[raw.toLowerCase()] || raw || (DATA.competitorCategories || [])[0] || '工具效率';
  }

  function normalizeNeed(value) {
    return needMeta(value)?.label || String(value || '').trim();
  }

  function normalizeMarket(value) {
    const raw = String(value || '').trim();
    return (DATA.competitorMarkets || []).find(item => raw.includes(item)) || raw;
  }

  function normalizeCompetitor(item) {
    const name = String(item.name || item.product || item.competitor || item.brand || '').trim();
    if (!name) return null;
    return {
      id: item.id || uid('competitor'),
      name,
      category: normalizeBroadCategory(item.category || item.sector || item.type),
      tracks: toList(item.tracks || item.track || item.subcategory || item.segment).slice(0, 10),
      need: normalizeNeed(item.need || item.coreNeed || item.jobToBeDone || ''),
      market: normalizeMarket(item.market || item.region || ''),
      website: String(item.website || item.url || '').trim(),
      price: String(item.price || item.pricing || '').trim(),
      description: String(item.description || item.positioning || item.summary || '').trim(),
      signal: String(item.signal || item.move || item.action || '').trim(),
      killer: String(item.killer || item.corePlacement || item.edge || '').trim(),
      painPoint: String(item.painPoint || item.pain || item.weakness || '').trim(),
      opportunity: String(item.opportunity || item.differentiation || item.angle || item.note || '').trim(),
      differentiation: String(item.opportunity || item.differentiation || item.angle || item.note || '').trim(),
      userFeedback: splitEntries(item.userFeedback || item.feedback || item.reviews || []),
      source: String(item.source || item.dataSource || '手动录入').trim(),
      monitor: item.monitor !== false && String(item.monitor).toLowerCase() !== 'false',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
    };
  }

  function sortCompetitorsForView(items) {
    const order = new Map((DATA.competitorCategories || []).map((label, index) => [label, index]));
    return [...items].sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) || a.name.localeCompare(b.name, 'zh-CN'));
  }

  function competitorCard(item) {
    const meta = categoryMeta(item.category);
    const tags = categoryTag(item.category) + item.tracks.map(track => trackTag(track, item.category)).join('') + needTag(item.need) + marketTag(item.market);
    return '<article class="competitor-card v2-competitor-card" data-competitor-id="' + item.id + '" style="--brand:' + meta.color + '">' +
      '<div class="competitor-card-head"><span class="competitor-logo">' + escapeHTML(item.name.slice(0, 1).toUpperCase()) + '</span><div class="competitor-name"><h3>' + escapeHTML(item.name) + '</h3><p>' + (item.website ? escapeHTML(item.website) : '竞品档案') + '</p></div><div class="competitor-card-tools"><button class="card-edit-button" data-action="edit-competitor" data-id="' + item.id + '" aria-label="编辑 ' + escapeHTML(item.name) + '"><svg><use href="#i-edit"/></svg>编辑</button><button type="button" class="monitor-switch ' + (item.monitor ? 'on' : '') + '" data-monitor-id="' + item.id + '" aria-label="' + escapeHTML(item.name) + ' 监控开关" aria-pressed="' + (item.monitor ? 'true' : 'false') + '"><span class="sr-only">' + (item.monitor ? '已开启监控' : '已暂停监控') + '</span></button></div></div>' +
      '<div class="competitor-tag-row">' + tags + '</div>' +
      '<p class="competitor-desc">' + escapeHTML(item.description || '定位待补充') + '</p>' +
      '<div class="competitor-fields"><div><span>核心诉求</span><strong>' + escapeHTML(item.need || '待补充') + '</strong></div><div><span>主攻市场</span><strong>' + escapeHTML(item.market || '待补充') + '</strong></div><div><span>核心占位</span><strong title="' + escapeHTML(item.killer || '') + '">' + escapeHTML(item.killer || '待补充') + '</strong></div><div><span>用户反馈</span><strong>' + (item.userFeedback.length ? item.userFeedback.length + ' 条记录' : '待补充') + '</strong></div></div>' +
      (item.signal ? '<div class="competitor-signal"><i class="signal-pulse"></i><span>' + escapeHTML(splitEntries(item.signal)[0]) + '</span></div>' : '<div class="competitor-signal muted"><i class="signal-pulse neutral"></i><span>暂无竞品动作记录</span></div>') +
      '<div class="competitor-card-footer"><span class="competitor-price">' + (item.monitor ? '持续监控' : '仅保存') + '</span><button class="text-link" data-action="open-competitor" data-id="' + item.id + '">查看详情 <svg><use href="#i-chevron-right"/></svg></button></div></article>';
  }

  function renderCompetitorFormFields(item = null) {
    const categories = DATA.competitorCategoryMeta || [];
    const selectedCategory = normalizeBroadCategory(item?.category || categories[0]?.label || '');
    const selectedNeed = normalizeNeed(item?.need || DATA.competitorNeeds?.[0]?.label || '');
    const selectedMarket = normalizeMarket(item?.market || DATA.competitorMarkets?.[0] || '');
    $('#competitor-category-options').innerHTML = categories.map(meta =>
      '<label class="choice-card category-choice" style="--choice-color:' + meta.color + ';--choice-bg:' + meta.soft + '">' +
        '<input type="radio" name="category" value="' + escapeHTML(meta.label) + '" ' + (meta.label === selectedCategory ? 'checked' : '') + ' required />' +
        '<span><i></i>' + escapeHTML(meta.label) + '</span></label>'
    ).join('');
    $('#competitor-need-options').innerHTML = (DATA.competitorNeeds || []).map(meta =>
      '<label class="choice-card need-choice" style="--choice-color:' + meta.color + ';--choice-bg:' + meta.soft + '">' +
        '<input type="radio" name="need" value="' + escapeHTML(meta.label) + '" ' + (meta.label === selectedNeed ? 'checked' : '') + ' required />' +
        '<span title="典型场景：' + escapeHTML(meta.examples || '') + '；核心指标：' + escapeHTML(meta.metric || '') + '"><b>' + escapeHTML(meta.label) + '</b><small>' + escapeHTML(meta.english || '') + '</small><em>' + escapeHTML(meta.metric || '') + '</em></span></label>'
    ).join('');
    $('#competitor-market-options').innerHTML = (DATA.competitorMarkets || []).map(market =>
      '<label class="choice-card market-choice">' +
        '<input type="radio" name="market" value="' + escapeHTML(market) + '" ' + (market === selectedMarket ? 'checked' : '') + ' required />' +
        '<span>' + escapeHTML(market) + '</span></label>'
    ).join('');
    renderCompetitorTrackOptions(selectedCategory, item?.tracks || []);
  }

  function renderCompetitorTrackOptions(category, selected = []) {
    const container = $('#competitor-track-options');
    if (!container) return;
    const meta = categoryMeta(category);
    const selectedSet = new Set(toList(selected));
    container.innerHTML = meta.tracks.length ? meta.tracks.map(track =>
      '<label class="track-choice" style="--choice-color:' + meta.color + ';--choice-bg:' + meta.soft + '">' +
        '<input type="checkbox" name="tracks" value="' + escapeHTML(track) + '" ' + (selectedSet.has(track) ? 'checked' : '') + ' />' +
        '<span>' + escapeHTML(track) + '</span></label>'
    ).join('') : '<span class="track-empty">选择大类后展示细分赛道</span>';
  }

  function groupedActionMarkup(items) {
    const groups = sortCompetitorsForView(items).map(item => {
      const entries = splitEntries(item.signal);
      if (!entries.length) return '';
      const meta = categoryMeta(item.category);
      return '<section class="competitor-insight-group" style="--group-color:' + meta.color + ';--group-bg:' + meta.soft + '">' +
        '<div class="insight-group-head"><span class="competitor-mini" style="background:' + meta.color + '">' + escapeHTML(item.name.slice(0, 1)) + '</span><div><strong>' + escapeHTML(item.name) + '</strong><div class="insight-group-tags">' + categoryTag(item.category) + item.tracks.slice(0, 2).map(track => trackTag(track, item.category)).join('') + '</div></div><span class="insight-group-count">' + entries.length + ' 条</span></div>' +
        '<div class="insight-group-body">' + entries.map((entry, index) => '<div class="insight-group-item"><span>' + String(index + 1).padStart(2, '0') + '</span><p>' + escapeHTML(entry) + '</p></div>').join('') + '</div></section>';
    }).filter(Boolean);
    return groups.length ? '<div class="competitor-insight-groups">' + groups.join('') + '</div>' : emptyState('trending', '暂无竞品动作');
  }

  function groupedDifferentiationMarkup(items) {
    if (!items.length) return emptyState('target', '暂无差异化占位');
    const rows = sortCompetitorsForView(items).map(item => {
      const meta = categoryMeta(item.category);
      const aiAngle = state.insight?.competitor_moves?.find(move => move.competitor === item.name)?.angle;
      const opportunity = item.opportunity || aiAngle || '待补充';
      return '<tr style="--group-color:' + meta.color + ';--group-bg:' + meta.soft + '">' +
        '<td><div class="diff-competitor"><span class="competitor-mini" style="background:' + meta.color + '">' + escapeHTML(item.name.slice(0, 1)) + '</span><div><strong>' + escapeHTML(item.name) + '</strong><div class="diff-tags">' + categoryTag(item.category) + needTag(item.need) + marketTag(item.market) + '</div></div></div></td>' +
        '<td><p>' + escapeHTML(item.killer || item.description || '待补充') + '</p></td>' +
        '<td><p>' + escapeHTML(item.painPoint || '待补充') + '</p></td>' +
        '<td><p class="opportunity-copy">' + escapeHTML(opportunity) + '</p></td></tr>';
    }).join('');
    return '<div class="diff-table-wrap"><table class="diff-table"><thead><tr><th>竞品名称</th><th>核心占位（杀手锏）</th><th>痛点</th><th>机会点</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="diff-scroll-hint">左右滑动查看</div>';
  }

  function renderCompetitorFeedback(items) {
    const groups = sortCompetitorsForView(items).filter(item => item.userFeedback.length);
    const total = groups.reduce((sum, item) => sum + item.userFeedback.length, 0);
    const counter = $('#competitor-feedback-count');
    if (counter) counter.textContent = total + ' 条';
    const root = $('#competitor-feedback-list');
    if (!root) return;
    root.innerHTML = groups.length ? '<div class="competitor-insight-groups feedback-groups">' + groups.map(item => {
      const meta = categoryMeta(item.category);
      const enriched = item.userFeedback.map(entry => ({ text: entry, sentiment: classifySentiment({ text: entry }), theme: themeForFeedback(entry) }));
      const counts = enriched.reduce((acc, entry) => { acc[entry.sentiment] = (acc[entry.sentiment] || 0) + 1; return acc; }, { positive: 0, neutral: 0, negative: 0 });
      const themes = enriched.reduce((acc, entry) => { acc[entry.theme] = (acc[entry.theme] || 0) + 1; return acc; }, {});
      const topTheme = Object.entries(themes).sort((a, b) => b[1] - a[1])[0]?.[0] || '其他';
      return '<section class="competitor-insight-group" style="--group-color:' + meta.color + ';--group-bg:' + meta.soft + '">' +
        '<div class="insight-group-head"><span class="competitor-mini" style="background:' + meta.color + '">' + escapeHTML(item.name.slice(0, 1)) + '</span><div><strong>' + escapeHTML(item.name) + '</strong><div class="insight-group-tags">' + categoryTag(item.category) + needTag(item.need) + '</div></div><span class="insight-group-count">' + enriched.length + ' 条</span></div>' +
        '<div class="competitor-feedback-summary"><span class="summary-chip positive">正面 ' + counts.positive + '</span><span class="summary-chip neutral">中性 ' + counts.neutral + '</span><span class="summary-chip negative">负面 ' + counts.negative + '</span><span class="summary-chip theme">主要主题 · ' + escapeHTML(topTheme) + '</span></div>' +
        '<div class="insight-group-body">' + enriched.map((entry, index) => '<div class="competitor-feedback-item"><span>' + String(index + 1).padStart(2, '0') + '</span><div><p>' + escapeHTML(entry.text) + '</p><small>' + (entry.sentiment === 'positive' ? '正面' : entry.sentiment === 'negative' ? '负面' : '中性') + ' · ' + escapeHTML(entry.theme) + '</small></div></div>').join('') + '</div></section>';
    }).join('') + '</div>' : emptyState('message', '暂无竞品用户反馈', '在添加竞品时录入用户反馈。');
  }

  function renderCompetitors() {
    const categories = ['全部', ...new Set([...(DATA.competitorCategories || []), ...state.competitors.map(item => item.category)])];
    $('#category-tabs').innerHTML = categories.map(category => {
      const meta = category === '全部' ? null : categoryMeta(category);
      return '<button class="category-tab ' + (state.category === category ? 'active' : '') + '" data-category="' + escapeHTML(category) + '" style="--tab-color:' + (meta?.color || '#475569') + ';--tab-bg:' + (meta?.soft || '#f1f5f9') + '"><i></i>' + escapeHTML(category) + '</button>';
    }).join('');
    const filtered = sortCompetitorsForView(state.category === '全部' ? state.competitors : state.competitors.filter(item => item.category === state.category));
    $('#competitor-grid').innerHTML = filtered.length ? filtered.map(competitorCard).join('') : '<div class="card empty-state" style="grid-column:1/-1">' + emptyState('target', '暂无竞品资料', '', '<button class="btn btn-primary empty-action" data-action="add-competitor">添加竞品</button>') + '</div>';
    const monitored = state.competitors.filter(item => item.monitor).length;
    const sources = new Set(state.competitors.map(item => item.source)).size;
    const actionCount = state.competitors.reduce((sum, item) => sum + splitEntries(item.signal).length, 0);
    const differentiationCount = state.competitors.filter(item => item.killer || item.painPoint || item.opportunity || splitEntries(item.differentiation).length).length;
    const feedbackCount = state.competitors.reduce((sum, item) => sum + item.userFeedback.length, 0);
    const demoBadge = state.project.demo ? '<em class="mock-pill">MOCK 演示</em>' : '';
    $('#competitor-summary').innerHTML = '<div class="competitor-summary-main"><span class="summary-icon">' + icon('target') + '</span><div><span>竞品总数' + demoBadge + '</span><strong>' + state.competitors.length + '</strong><small>' + monitored + ' 个监控中</small></div></div><div class="summary-metric"><span>数据来源</span><strong>' + sources + '</strong><small>个来源</small></div><div class="summary-metric"><span>竞品动作</span><strong>' + actionCount + '</strong><small>条记录</small></div><div class="summary-metric"><span>差异化占位</span><strong>' + differentiationCount + '</strong><small>个竞品</small></div>';
    $('#competitor-signal-count').textContent = filtered.reduce((sum, item) => sum + splitEntries(item.signal).length, 0) + ' 条';
    $('#competitor-stream-list').innerHTML = groupedActionMarkup(filtered);
    renderCompetitorFeedback(filtered);
    $('#differentiation-space').innerHTML = groupedDifferentiationMarkup(filtered);
    $('#differentiation-count').textContent = filtered.filter(item => item.killer || item.painPoint || item.opportunity || splitEntries(item.differentiation).length).length + ' 个竞品';
    updateStatus();
  }

  function openCompetitorForm(id = '') {
    const item = state.competitors.find(entry => entry.id === id) || null;
    const form = $('#competitor-form');
    form.reset();
    renderCompetitorFormFields(item);
    $('#competitor-id').value = item?.id || '';
    $('#competitor-name').value = item?.name || '';
    $('#competitor-website').value = item?.website || '';
    $('#competitor-price').value = item?.price || '';
    $('#competitor-description').value = item?.description || '';
    $('#competitor-killer').value = item?.killer || '';
    $('#competitor-pain-point').value = item?.painPoint || '';
    $('#competitor-opportunity').value = item?.opportunity || '';
    $('#competitor-signal').value = item?.signal || '';
    $('#competitor-user-feedback').value = item?.userFeedback?.join('\n') || '';
    $('#competitor-source').value = item?.source || '';
    $('#competitor-monitor').value = item ? String(item.monitor) : 'true';
    $('#competitor-modal-title').textContent = item ? '编辑竞品' : '添加竞品';
    $('#competitor-submit').textContent = item ? '保存修改' : '保存竞品';
    const extra = form.querySelector('.competitor-extra-fields');
    if (extra) extra.open = Boolean(item);
    closeModal('detail-modal');
    openModal('competitor-modal');
    setTimeout(() => $('#competitor-name').focus(), 80);
  }

  function addCompetitor(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const editingId = String(form.get('id') || '');
    const editing = state.competitors.find(item => item.id === editingId) || null;
    const name = String(form.get('name') || '').trim();
    const tracks = form.getAll('tracks');
    if (!tracks.length) {
      showToast('请至少选择一个细分赛道', 'error');
      return;
    }
    if (state.competitors.some(item => item.id !== editingId && item.name.toLowerCase() === name.toLowerCase())) {
      showToast('该竞品已存在', 'error');
      return;
    }
    const payload = {
      name,
      category: form.get('category'),
      tracks,
      need: form.get('need'),
      market: form.get('market'),
      website: form.get('website'),
      price: form.get('price'),
      description: form.get('description'),
      signal: form.get('signal'),
      killer: form.get('killer'),
      painPoint: form.get('painPoint'),
      opportunity: form.get('opportunity'),
      userFeedback: form.get('userFeedback'),
      source: form.get('source'),
      monitor: form.get('monitor')
    };
    const item = normalizeCompetitor(editing ? { ...editing, ...payload, id: editing.id, createdAt: editing.createdAt, updatedAt: new Date().toISOString() } : payload);
    if (!item) return;
    if (editing) {
      const index = state.competitors.findIndex(entry => entry.id === editing.id);
      state.competitors[index] = item;
      persistWorkspace();
      renderCompetitors();
      renderOverview();
      closeModal('competitor-modal');
      showToast(item.name + ' 已更新');
      return;
    }
    state.competitors.unshift(item);
    persistWorkspace();
    renderCompetitors();
    renderOverview();
    closeModal('competitor-modal');
    showToast(item.name + ' 已保存');
  }

  function openCompetitorDetail(id) {
    const item = state.competitors.find(entry => entry.id === id);
    if (!item) return;
    const meta = categoryMeta(item.category);
    const actions = splitEntries(item.signal);
    const feedback = item.userFeedback || [];
    const opportunity = item.opportunity || state.insight?.competitor_moves?.find(move => move.competitor === item.name)?.angle || '';
    $('#detail-modal-content').innerHTML = '<div class="detail-hero"><h2 id="detail-modal-title">' + escapeHTML(item.name) + '</h2><p>' + escapeHTML(item.description || '暂无定位说明') + '</p><div class="competitor-tag-row">' + categoryTag(item.category) + item.tracks.map(track => trackTag(track, item.category)).join('') + needTag(item.need) + marketTag(item.market) + '</div></div>' +
      '<div class="detail-stat-row"><div class="detail-stat"><span>核心诉求</span><strong>' + escapeHTML(item.need || '待补充') + '</strong></div><div class="detail-stat"><span>主攻市场</span><strong>' + escapeHTML(item.market || '待补充') + '</strong></div><div class="detail-stat"><span>用户反馈</span><strong>' + feedback.length + ' 条</strong></div><div class="detail-stat"><span>数据来源</span><strong>' + escapeHTML(item.source || '手动录入') + '</strong></div></div>' +
      '<div class="detail-comparison-grid"><div><span>核心占位（杀手锏）</span><p>' + escapeHTML(item.killer || '待补充') + '</p></div><div><span>痛点</span><p>' + escapeHTML(item.painPoint || '待补充') + '</p></div><div><span>机会点</span><p>' + escapeHTML(opportunity || '待补充') + '</p></div></div>' +
      '<h4 class="detail-section-title">竞品动作</h4><div class="detail-entry-list" style="--group-color:' + meta.color + '">' + (actions.length ? actions.map(entry => '<div><i></i><p>' + escapeHTML(entry) + '</p></div>').join('') : '<p class="detail-empty">暂无动作记录</p>') + '</div>' +
      '<h4 class="detail-section-title">用户反馈</h4><div class="detail-entry-list" style="--group-color:' + meta.color + '">' + (feedback.length ? feedback.map(entry => '<div><i></i><p>' + escapeHTML(entry) + '</p></div>').join('') : '<p class="detail-empty">暂无用户反馈</p>') + '</div>' +
      '<div class="modal-actions"><button class="btn btn-danger-ghost modal-danger-left" data-action="delete-competitor" data-id="' + item.id + '"><svg><use href="#i-trash"/></svg>删除竞品</button><button class="btn btn-secondary" data-close-modal="detail-modal">关闭</button><button class="btn btn-secondary" data-action="edit-competitor" data-id="' + item.id + '">编辑竞品</button><button class="btn btn-primary" data-action="toggle-competitor" data-id="' + item.id + '">' + (item.monitor ? '暂停监控' : '开始监控') + '</button></div>';
    openModal('detail-modal');
  }

  function deleteCompetitor(id) {
    const item = state.competitors.find(entry => entry.id === id);
    if (!item) return;
    openConfirm({
      title: '删除竞品',
      message: '将删除「' + item.name + '」及其动作记录、用户反馈和差异化信息。此操作不可恢复。',
      label: '确认删除',
      onConfirm: () => {
        state.competitors = state.competitors.filter(entry => entry.id !== id);
        closeModal('detail-modal');
        persistWorkspace();
        renderCompetitors();
        renderOverview();
        showToast('已删除 ' + item.name);
      }
    });
  }

  /* ===== AI integration ===== */
  function renderAIConfig() {
    $('#ai-base-url').value = state.ai.baseUrl || '';
    $('#ai-model').value = state.ai.model || '';
    $('#ai-api-key').value = state.ai.key || '';
    updateStatus();
    renderAIHistory();
  }

  function saveAIConfig() {
    state.ai.baseUrl = $('#ai-base-url').value.trim().replace(/\/+$/, '');
    state.ai.model = $('#ai-model').value.trim();
    state.ai.key = $('#ai-api-key').value.trim();
    try {
      if (state.ai.key) sessionStorage.setItem(SESSION_KEY, state.ai.key);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (_) { /* storage unavailable */ }
    persistWorkspace();
    updateStatus();
    renderOverview();
    const ready = Boolean(state.ai.baseUrl && state.ai.model && state.ai.key);
    showToast(ready ? 'AI 配置已保存' : '请补全 Base URL、模型和 API Key', ready ? 'success' : 'error');
  }

  function extractJSON(text) {
    const content = String(text || '').trim();
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI 未返回 JSON');
    return JSON.parse(content.slice(start, end + 1));
  }

  async function callAI(messages, jsonOnly = false) {
    if (!aiConfigured()) throw new Error('请先在 AI Lab 配置 API');
    let response;
    try {
      response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          baseUrl: state.ai.baseUrl,
          model: state.ai.model,
          apiKey: state.ai.key,
          messages,
          jsonOnly
        })
      });
    } catch (_) {
      throw new Error('无法连接 AI 代理，请确认应用通过本地服务或 Vercel 运行');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'AI 请求失败（' + response.status + '）');
    const content = data.content || '';
    if (!content) throw new Error('AI 未返回内容');
    return jsonOnly ? extractJSON(content) : String(content).trim();
  }

  async function testAIConnection() {
    saveAIConfig();
    if (!aiConfigured()) return;
    const button = $('#test-ai-connection');
    setButtonLoading(button, true, '测试中');
    $('#ai-connect-status').textContent = '正在连接…';
    try {
      const result = await callAI([{ role: 'user', content: '只回复：OK' }]);
      $('#ai-connect-status').textContent = '连接成功：' + result.slice(0, 80);
      showToast('AI 连接成功');
    } catch (error) {
      $('#ai-connect-status').textContent = '连接失败：' + error.message;
      showToast(error.message, 'error');
    } finally { setButtonLoading(button, false); }
  }

  function renderAIHistory() {
    $('#ai-history-count').textContent = state.aiHistory.length + ' 条';
    const labels = { copy: 'COPY', file: 'FILE', overview: 'OVERVIEW', feedback: 'FEEDBACK' };
    $('#ai-history').innerHTML = state.aiHistory.length ? state.aiHistory.slice(0, 8).map(item => '<button type="button" class="ai-history-item" data-action="open-ai-history" data-id="' + escapeHTML(item.id) + '"><span class="ai-history-type">' + (labels[item.mode] || 'RUN') + '</span><div><strong>' + escapeHTML(item.title) + '</strong><small>' + relativeTime(item.at) + ' · ' + escapeHTML(item.model) + '</small></div><svg><use href="#i-chevron-right"/></svg></button>').join('') : emptyState('clock', '暂无运行记录');
  }

  function addAIHistory(mode, title, output, data = null) {
    state.aiHistory.unshift({ id: uid('run'), mode, title, output: String(output).slice(0, 4000), data: data || null, model: state.ai.model, at: new Date().toISOString() });
    state.aiHistory = state.aiHistory.slice(0, 30);
    persistWorkspace();
    renderAIHistory();
  }

  function openAIHistory(id) {
    const item = state.aiHistory.find(entry => entry.id === id);
    if (!item) return;
    const labels = { copy: 'AI 文案对比结果', file: item.title, overview: '项目总览 AI 洞察', feedback: '反馈 AI 总览' };
    $('#ai-result-title').textContent = labels[item.mode] || '历史分析结果';
    if (item.mode === 'copy' && item.data) $('#ai-result').innerHTML = renderAIResultCopy(item.data);
    else if (item.mode === 'file' && item.data) $('#ai-result').innerHTML = renderAIResultFile(item.data);
    else $('#ai-result').innerHTML = '<pre class="ai-history-output">' + escapeHTML(item.output || '') + '</pre>';
    state.aiResultText = item.output || '';
    $('#ai-run-status').textContent = '已载入历史记录 · ' + relativeTime(item.at);
    navigate('ailab');
  }

  function renderAIResultCopy(data) {
    const scores = data.scores || {};
    const scoreLine = version => Object.entries(scores[version] || {}).map(([key, value]) => '<span>' + escapeHTML(key) + ' <b>' + escapeHTML(value) + '</b></span>').join('');
    return '<div class="ab-result-grid"><article class="ab-result-card"><div class="ab-result-head"><span>VARIANT A</span><strong>版本 A</strong></div><p>' + escapeHTML(data.variant_a || '未返回') + '</p><div class="ab-scores">' + scoreLine('a') + '</div></article><article class="ab-result-card winner"><div class="ab-result-head"><span>VARIANT B</span><strong>推荐 · ' + escapeHTML(data.winner || 'B') + '</strong></div><p>' + escapeHTML(data.variant_b || '未返回') + '</p><div class="ab-scores">' + scoreLine('b') + '</div></article></div><div class="ai-reason"><strong>AI Judge</strong><p>' + escapeHTML(data.rationale || '未返回评分理由') + '</p></div>';
  }

  function renderAIResultFile(data) {
    return '<div class="file-analysis-result"><h3>' + escapeHTML(data.summary || '文件分析完成') + '</h3><div class="file-analysis-grid"><div><span>关键发现</span><ul>' + (data.findings || []).map(item => '<li>' + escapeHTML(item) + '</li>').join('') + '</ul></div><div><span>产品机会</span><ul>' + (data.opportunities || []).map(item => '<li>' + escapeHTML(item) + '</li>').join('') + '</ul></div></div><div class="risk-box"><span>风险与待验证</span><p>' + escapeHTML((data.risks || []).join('；') || '暂无') + '</p></div></div>';
  }

  async function runAI() {
    if (!aiConfigured()) { showToast('请先保存 AI 配置', 'error'); navigate('ailab'); return; }
    if (state.aiMode === 'file' && !state.aiFile) { showToast('请先上传文件', 'error'); return; }
    const prompt = $('#ai-prompt').value.trim();
    if (state.aiMode === 'copy' && !prompt) { showToast('请输入文案任务', 'error'); return; }
    const button = $('#run-ai');
    setButtonLoading(button, true, 'AI 分析中');
    $('#ai-run-status').textContent = '正在调用模型…';
    try {
      if (state.aiMode === 'copy') {
        const data = await callAI([
          { role: 'system', content: '你是增长文案策略师。只输出 JSON：{"variant_a":"","variant_b":"","winner":"A或B","rationale":"","scores":{"a":{"钩子":0,"清晰":0,"转化":0},"b":{"钩子":0,"清晰":0,"转化":0}}}。两版文案必须明显不同，分数为 0-100。' },
          { role: 'user', content: '项目：' + state.project.name + '；类型：' + industryById(state.project.industry).label + '；任务：' + prompt }
        ], true);
        $('#ai-result-title').textContent = 'AI 文案对比结果';
        $('#ai-result').innerHTML = renderAIResultCopy(data);
        state.aiResultText = '版本 A：' + (data.variant_a || '') + '\n\n版本 B：' + (data.variant_b || '') + '\n\n推荐：' + (data.winner || '') + '\n理由：' + (data.rationale || '');
        addAIHistory('copy', prompt.slice(0, 48), state.aiResultText, data);
      } else {
        const data = await callAI([
          { role: 'system', content: '你是资深产品研究员。只输出 JSON：{"summary":"","findings":[""],"opportunities":[""],"risks":[""]}。必须基于文件内容，不要编造。' },
          { role: 'user', content: '项目：' + state.project.name + '；类型：' + industryById(state.project.industry).label + '。补充要求：' + (prompt || '无') + '\n\n文件内容：\n' + state.aiFile.content.slice(0, 60000) }
        ], true);
        $('#ai-result-title').textContent = state.aiFile.name;
        $('#ai-result').innerHTML = renderAIResultFile(data);
        state.aiResultText = JSON.stringify(data, null, 2);
        addAIHistory('file', state.aiFile.name, state.aiResultText, data);
      }
      $('#ai-run-status').textContent = '分析完成 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      showToast('AI 分析完成');
    } catch (error) {
      $('#ai-run-status').textContent = error.message;
      showToast(error.message, 'error');
    } finally { setButtonLoading(button, false); }
  }

  async function generateOverviewInsight(triggerButton = null) {
    if (!state.feedback.length || !state.competitors.length) { showToast('请先准备用户反馈和竞品资料', 'error'); return; }
    if (!aiConfigured()) { showToast('请先在 AI Lab 配置 AI API', 'error'); navigate('ailab'); return; }
    const button = triggerButton || $('[data-action="generate-overview"]');
    setButtonLoading(button, true, '分析中');
    try {
      const feedback = state.feedback.slice(0, 120).map(item => ({ text: item.text.slice(0, 280), question: item.question, source: item.source, rating: item.rating }));
      const competitors = state.competitors.slice(0, 40).map(item => ({ name: item.name, category: item.category, tracks: item.tracks, need: item.need, market: item.market, description: item.description, price: item.price, signal: item.signal, killer: item.killer, painPoint: item.painPoint, opportunity: item.opportunity, userFeedback: item.userFeedback.slice(0, 20), source: item.source }));
      const data = await callAI([
        { role: 'system', content: '你是资深产品策略与竞品研究员。只输出 JSON：{"feature_priorities":[{"priority":"P0/P1/P2","title":"","evidence":"","impact":"","confidence":0}],"competitor_moves":[{"competitor":"","move":"","angle":"","threat":"高/中/低"}],"differentiation":"","summary":""}。必须基于输入数据，不得编造。最多 5 条功能优先级、4 条竞品动作。' },
        { role: 'user', content: '项目：' + state.project.name + '；产品类型：' + industryById(state.project.industry).label + '\n用户反馈：' + JSON.stringify(feedback) + '\n竞品资料：' + JSON.stringify(competitors) }
      ], true);
      state.insight = { ...data, generatedAt: new Date().toISOString(), model: state.ai.model };
      persistWorkspace();
      renderOverview();
      renderCompetitors();
      addAIHistory('overview', '项目总览 AI 洞察', JSON.stringify(data, null, 2), data);
      showToast('AI 洞察已生成');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setButtonLoading(button, false); }
  }

  async function summarizeFeedbackAI() {
    if (!state.feedback.length) { showToast('请先导入反馈', 'error'); return; }
    if (!aiConfigured()) { showToast('请先在 AI Lab 配置 API', 'error'); navigate('ailab'); return; }
    const button = $('[data-action="ai-summarize-feedback"]');
    setButtonLoading(button, true, '总结中');
    try {
      const items = state.feedback.slice(0, 200).map(item => ({ text: item.text.slice(0, 350), question: item.question, source: item.source, rating: item.rating }));
      state.feedbackAISummary = await callAI([
        { role: 'system', content: '你是资深用户研究员。用中文写一段 80-140 字的问卷反馈总览，必须包含数据量、主要来源、核心诉求和主要问题。不要标题，不要编造数据。' },
        { role: 'user', content: '项目：' + state.project.name + '；类型：' + industryById(state.project.industry).label + '；反馈：' + JSON.stringify(items) }
      ]);
      persistWorkspace();
      renderFeedback();
      renderOverview();
      showToast('反馈总览已更新');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setButtonLoading(button, false); }
  }

  /* ===== Project, sources, export, commands ===== */
  function fillProjectForm(projectId) {
    const record = state.projects.find(item => item.id === projectId);
    const isNew = projectId === '__new__' || !record;
    $('#project-name-input').value = isNew ? '新调研项目' : record.project.name;
    $('#project-industry-select').value = isNew ? (DATA.industries[0]?.id || 'entertainment') : normalizeIndustryId(record.project.industry);
  }

  function populateProjectForm(selectedId = state.activeProjectId) {
    const industrySelect = $('#project-industry-select');
    industrySelect.innerHTML = DATA.industries.map(item => '<option value="' + item.id + '">' + escapeHTML(item.label) + '</option>').join('');
    const select = $('#project-select');
    select.innerHTML = state.projects.map(item => '<option value="' + item.id + '">' + escapeHTML(item.project.name) + (item.project.demo ? '（演示）' : '') + '</option>').join('') + '<option value="__new__">＋ 新建项目</option>';
    select.value = state.projects.some(item => item.id === selectedId) ? selectedId : state.activeProjectId;
    fillProjectForm(select.value);
  }

  function openProjectSettings() { populateProjectForm(state.activeProjectId); openModal('project-modal'); }

  function saveProject(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const selectedId = String(form.get('projectId') || state.activeProjectId);
    const name = String(form.get('name') || '').trim() || '新调研项目';
    const industry = normalizeIndustryId(form.get('industry'));
    if (selectedId === '__new__') {
      syncActiveProject();
      const record = newProjectRecord(name, industry);
      state.projects.push(record);
      activateProject(record);
      persistWorkspace();
      renderCurrentProject();
      showToast('已创建并切换到 ' + name);
    } else {
      const target = state.projects.find(item => item.id === selectedId);
      if (!target) return;
      target.project = { ...target.project, name, industry };
      if (target.id === state.activeProjectId) {
        state.project = { ...state.project, name, industry };
        persistWorkspace();
        renderCurrentProject();
      } else {
        syncActiveProject();
        activateProject(target);
        persistWorkspace();
        renderCurrentProject();
      }
      showToast('已保存并切换到 ' + name);
    }
    populateProjectForm(state.activeProjectId);
    closeModal('project-modal');
  }

  function sanitizeWorkspaceValue(value) {
    if (Array.isArray(value)) return value.map(sanitizeWorkspaceValue);
    if (!value || typeof value !== 'object') return value;
    const sensitive = /^(api[-_]?key|token|access[-_]?token|authorization|secret|password|key)$/i;
    return Object.fromEntries(Object.entries(value)
      .filter(([name]) => !sensitive.test(name))
      .map(([name, item]) => [name, sanitizeWorkspaceValue(item)]));
  }

  function exportWorkspace() {
    syncActiveProject();
    const projects = state.projects.map(project => sanitizeWorkspaceValue(JSON.parse(JSON.stringify(project))));
    const payload = {
      version: 4,
      exportedAt: new Date().toISOString(),
      activeProjectId: state.activeProjectId,
      projects,
      demoDismissedIds: state.demoDismissedIds
    };
    const stamp = localDateString().replace(/-/g, '');
    downloadFile('orbit-workspace-' + stamp + '.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    showToast('工作区已导出');
  }

  function parseWorkspacePayload(payload) {
    const raw = payload && typeof payload === 'object' ? payload : {};
    const rawProjects = Array.isArray(raw.projects)
      ? raw.projects
      : Array.isArray(raw)
        ? raw
        : raw.project
          ? [raw]
          : [];
    if (!rawProjects.length) throw new Error('文件中没有可导入的项目');
    const used = new Set();
    const projects = rawProjects.map(item => {
      const record = normalizeProjectRecord(item);
      if (used.has(record.id)) record.id = uid('project');
      used.add(record.id);
      return record;
    });
    return {
      projects,
      activeProjectId: String(raw.activeProjectId || projects[0].id),
      demoDismissedIds: Array.isArray(raw.demoDismissedIds) ? raw.demoDismissedIds.map(String) : []
    };
  }

  function importWorkspaceFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('工作区文件不能超过 5 MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      let imported;
      try {
        imported = parseWorkspacePayload(JSON.parse(String(event.target.result || '')));
      } catch (error) {
        showToast('导入失败：' + error.message, 'error');
        return;
      }
      openConfirm({
        title: '导入工作区',
        message: '将使用文件中的 ' + imported.projects.length + ' 个项目替换当前工作区。API Key 与评价 Token 不会从文件中恢复。',
        label: '确认导入',
        onConfirm: () => {
          state.projects = imported.projects;
          state.demoDismissedIds = imported.demoDismissedIds;
          const target = state.projects.find(item => item.id === imported.activeProjectId) || state.projects[0];
          activateProject(target);
          persistWorkspace();
          renderCurrentProject();
          closeModal('project-modal');
          showToast('已导入 ' + state.projects.length + ' 个项目');
        }
      });
    };
    reader.onerror = () => showToast('无法读取工作区文件', 'error');
    reader.readAsText(file, 'utf-8');
  }

  function deleteCurrentProject() {
    const selectedId = $('#project-select')?.value || state.activeProjectId;
    if (selectedId === '__new__') {
      showToast('请先保存或选择一个已有项目', 'error');
      return;
    }
    const target = state.projects.find(item => item.id === selectedId);
    if (!target) return;
    openConfirm({
      title: '删除项目',
      message: '将删除「' + target.project.name + '」及其反馈、竞品、趋势和 AI 历史。此操作不可恢复。',
      label: '确认删除',
      onConfirm: () => {
        syncActiveProject();
        state.projects = state.projects.filter(item => item.id !== selectedId);
        if (target.project.demo) state.demoDismissedIds = Array.from(new Set([...state.demoDismissedIds, selectedId]));
        if (!state.projects.length) state.projects.push(newProjectRecord());
        if (selectedId === state.activeProjectId) activateProject(state.projects[0]);
        persistWorkspace();
        populateProjectForm(state.activeProjectId);
        renderCurrentProject();
        closeModal('project-modal');
        showToast('项目已删除');
      }
    });
  }

  function openConnections() {
    const feedbackSources = new Set(state.feedback.map(item => item.source)).size;
    const trendPlatforms = new Set(state.trends.map(item => platformById(item.platform).name)).size;
    const rows = [
      ['用户反馈 CSV', '文件导入', state.feedback.length ? state.feedback.length + ' 条 · ' + feedbackSources + ' 个来源' : '可用，尚未导入', state.feedback.length > 0],
      ['趋势数据 CSV / JSON', '文件导入', state.trends.length ? state.trends.length + ' 条 · ' + trendPlatforms + ' 个平台' : '可用，尚未导入', state.trends.length > 0],
      ['竞品档案', '手动录入', state.competitors.length ? state.competitors.length + ' 个竞品' : '尚未录入', state.competitors.length > 0],
      ['应用商店评价', '公开 / 企业 API', (() => { const count = Object.values(state.reviewConfig.connections || {}).filter(item => item.connectedAt).length; return count ? count + ' 个评价源已连接' : '等待配置'; })(), Object.values(state.reviewConfig.connections || {}).some(item => item.connectedAt)],
      ['AI 模型 API', 'BYOK', aiConfigured() ? state.ai.model : '未配置', aiConfigured()]
    ];
    const enterprise = ['App Store RSS|公开评价接口', '华为 / 小米 / vivo / OPPO|需企业开放平台授权', 'TikTok Research API|需企业权限', 'X API|需开发者权限', '小红书 / 微博数据服务|需服务商授权'];
    $('#detail-modal-content').innerHTML = '<div class="detail-hero"><h2 id="detail-modal-title">数据源接入配置</h2><p>除明确标注为 Mock 的「近郊旅游助手」演示项目外，不内置模拟业务数据；相同字段结构可直接替换为企业 API 返回值。</p></div><div class="connection-list">' + rows.map(([name, type, status, ready]) => '<div class="connection-row"><span class="connection-icon">' + icon('database') + '</span><div><strong>' + name + '</strong><small>' + type + '</small></div><span class="connection-status ' + (ready ? 'ready' : '') + '">' + status + '</span></div>').join('') + '</div><h4 class="detail-section-title">预留企业接口</h4><div class="enterprise-grid">' + enterprise.map(item => { const [name, desc] = item.split('|'); return '<div><strong>' + name + '</strong><span>' + desc + '</span></div>'; }).join('') + '</div><div class="modal-actions"><button class="btn btn-primary" data-close-modal="detail-modal">完成</button></div>';
    openModal('detail-modal');
  }

  function openMethod() {
    $('#detail-modal-content').innerHTML = '<div class="detail-hero"><h2 id="detail-modal-title">分析说明</h2><p>本地规则负责字段清洗、情感判断和主题分类；AI 负责摘要、功能优先级与竞品判断。</p></div><h4 class="detail-section-title">处理流程</h4><div class="detail-quote">CSV / JSON → 字段标准化 → 数值清洗 → 情感判断 → 主题分类 → 数据汇总 → AI 分析。</div><div class="modal-actions"><button class="btn btn-primary" data-close-modal="detail-modal">关闭</button></div>';
    openModal('detail-modal');
  }

  function exportReport() {
    const analysis = analyzeFeedback(state.feedback);
    const lines = [
      '# ' + state.project.name + ' · 调研报告', '',
      '产品类型：' + industryById(state.project.industry).label,
      '生成时间：' + new Date().toLocaleString('zh-CN'), '',
      '## 数据概览', '',
      '- 用户反馈：' + state.feedback.length + ' 条',
      '- 数据来源：' + (analysis.sources.map(([name, count]) => name + '（' + count + '）').join('、') || '暂无'),
      '- 竞品：' + state.competitors.length + ' 个',
      '- 趋势信号：' + state.trends.length + ' 条', '',
      '## 反馈总览', '',
      state.feedbackAISummary || localFeedbackSummary(analysis) || '暂无反馈数据。', '',
      '## 功能诉求与迭代优先级', '',
      state.insight?.feature_priorities?.length ? state.insight.feature_priorities.map(item => '- **' + item.priority + '** ' + item.title + '：' + item.evidence).join('\n') : '尚未生成 AI 洞察。', '',
      '## 竞品动作与差异化占位', '',
      state.insight?.competitor_moves?.length ? state.insight.competitor_moves.map(item => '- **' + item.competitor + '**：' + item.move + '；切入点：' + item.angle).join('\n') : state.competitors.map(item => '- **' + item.name + '**：' + (item.signal || '暂无动作记录')).join('\n') || '暂无竞品资料。', '',
      '## 竞品用户反馈与差异化占位', '',
      state.competitors.map(item => '- **' + item.name + '**｜核心占位：' + (item.killer || '待补充') + '｜痛点：' + (item.painPoint || '待补充') + '｜机会点：' + (item.opportunity || '待补充')).join('\n') || '暂无竞品资料。', '',
      '---', '', '由 Orbit 生成。所有结论基于当前工作区导入数据。'
    ];
    downloadFile('orbit-research-report.md', lines.join('\n'), 'text/markdown;charset=utf-8');
    showToast('调研报告已导出');
  }

  function downloadTemplate() {
    downloadFile('orbit-feedback-template.csv', 'feedback,question,source,rating,date,segment\n', 'text/csv;charset=utf-8');
    showToast('CSV 模板已下载');
  }

  function exportCompetitors() {
    const header = ['name', 'category', 'tracks', 'need', 'market', 'website', 'price', 'description', 'signal', 'killer', 'painPoint', 'opportunity', 'userFeedback', 'source', 'monitor'];
    const lines = state.competitors.map(item => header.map(key => '"' + String(item[key] ?? '').replace(/"/g, '""') + '"').join(','));
    downloadFile('orbit-competitors.csv', [header.join(','), ...lines].join('\n'), 'text/csv;charset=utf-8');
    showToast('竞品数据已导出');
  }

  function buildCommands() {
    const pages = Object.entries(pageNames).map(([id, title]) => ({ type: 'page', id, title, subtitle: '页面', icon: id === 'overview' ? 'grid' : id === 'trends' ? 'radar' : id === 'feedback' ? 'message' : id === 'competitors' ? 'target' : 'sparkles' }));
    const competitors = state.competitors.map(item => ({ type: 'competitor', id: item.id, title: item.name, subtitle: '竞品 · ' + item.category, icon: 'target' }));
    const actions = [
      ['project-settings', '项目设置', '产品类型与项目名称', 'settings'],
      ['go-feedback', '导入用户反馈', 'CSV 问卷反馈', 'upload'],
      ['go-ai', '配置 AI API', 'Base URL、模型与 Key', 'sparkles'],
      ['add-competitor', '添加竞品', '手动建立竞品档案', 'plus'],
      ['export-report', '导出调研报告', 'Markdown', 'download'],
      ['connections', '查看数据源配置', '导入与 API 状态', 'database']
    ].map(([id, title, subtitle, iconName]) => ({ type: 'action', id, title, subtitle, icon: iconName }));
    return [...pages, ...competitors, ...actions];
  }

  function renderCommands(query = '') {
    const normalized = query.toLowerCase().trim();
    const all = buildCommands();
    state.commands = (normalized ? all.filter(item => (item.title + ' ' + item.subtitle).toLowerCase().includes(normalized)) : all).slice(0, 12);
    state.commandSelected = clamp(state.commandSelected, 0, Math.max(0, state.commands.length - 1));
    $('#command-results').innerHTML = state.commands.length ? state.commands.map((item, index) => '<button class="command-item ' + (index === state.commandSelected ? 'is-selected' : '') + '" data-command-index="' + index + '"><span class="command-item-icon">' + icon(item.icon) + '</span><div><strong>' + escapeHTML(item.title) + '</strong><small>' + escapeHTML(item.subtitle) + '</small></div><span>' + (item.type === 'page' ? '页面' : item.type === 'competitor' ? '竞品' : '操作') + '</span></button>').join('') : '<div class="command-empty">没有匹配结果</div>';
  }

  function openCommand() {
    $('#command-input').value = '';
    state.commandSelected = 0;
    renderCommands();
    openModal('command-modal');
    setTimeout(() => $('#command-input').focus(), 50);
  }

  function executeCommand(index) {
    const item = state.commands[index];
    if (!item) return;
    closeModal('command-modal');
    if (item.type === 'page') navigate(item.id);
    else if (item.type === 'competitor') { navigate('competitors'); setTimeout(() => openCompetitorDetail(item.id), 80); }
    else handleAction(item.id);
  }

  function copyText(text, label = '内容') {
    if (!text) { showToast('暂无可复制内容', 'error'); return; }
    const done = () => showToast(label + '已复制');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } catch (_) { showToast('复制失败', 'error'); }
    area.remove();
  }

  function updateAIModeUI() {
    $$('[data-ai-mode]').forEach(button => button.classList.toggle('active', button.dataset.aiMode === state.aiMode));
    $('#ai-file-area').classList.toggle('is-visible', state.aiMode === 'file');
    $('#ai-prompt').placeholder = state.aiMode === 'file' ? '可选：说明希望 AI 重点关注的问题。' : '描述文案任务、目标用户和渠道。';
  }

  function handleAIUpload(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) { showToast('文件不能超过 1 MB', 'error'); return; }
    if (!/\.(txt|md|csv|json|log)$/i.test(file.name)) { showToast('支持 TXT、MD、CSV、JSON、LOG', 'error'); return; }
    const reader = new FileReader();
    reader.onload = event => {
      state.aiFile = { name: file.name, size: file.size, content: String(event.target.result || '') };
      $('#ai-file-selected').innerHTML = '<span class="file-icon">' + icon('file') + '</span><div><strong>' + escapeHTML(file.name) + '</strong><small>' + (file.size / 1024).toFixed(1) + ' KB</small></div><button id="remove-ai-file" aria-label="移除">' + icon('close') + '</button>';
      $('#ai-file-selected').classList.add('is-visible');
      showToast('文件已读取');
    };
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.readAsText(file, 'utf-8');
  }

  function handleAction(action, triggerButton = null) {
    switch (action) {
      case 'go-feedback': navigate('feedback'); break;
      case 'go-trends': navigate('trends'); break;
      case 'go-ai': navigate('ailab'); break;
      case 'go-competitors': navigate('competitors'); break;
      case 'open-ai-history': openAIHistory(triggerButton.dataset.id); break;
      case 'delete-feedback-import': deleteFeedbackImport(triggerButton.dataset.id); break;
      case 'delete-competitor': deleteCompetitor(triggerButton.dataset.id); break;
      case 'delete-project': deleteCurrentProject(); break;
      case 'export-workspace': exportWorkspace(); break;
      case 'import-workspace': $('#workspace-import-input').click(); break;
      case 'generate-overview': generateOverviewInsight(triggerButton); break;
      case 'ai-summarize-feedback': summarizeFeedbackAI(); break;
      case 'add-competitor': openCompetitorForm(); break;
      case 'edit-competitor': openCompetitorForm(triggerButton.dataset.id); break;
      case 'project-settings': openProjectSettings(); break;
      case 'connections': openConnections(); break;
      case 'settings-help': openConnections(); break;
      case 'export-report': exportReport(); break;
      case 'download-template': downloadTemplate(); break;
      case 'trigger-upload': $('#feedback-file-input').click(); break;
      case 'configure-reviews': openReviewSourceModal(); break;
      case 'view-method': openMethod(); break;
      case 'copy-ai-result': copyText(state.aiResultText, '分析结果'); break;
      default: break;
    }
  }

  /* ===== Events and startup ===== */
  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target;
      const close = target.closest('[data-close-modal]');
      if (close) { closeModal(close.dataset.closeModal); return; }

      const actionEl = target.closest('[data-action]');
      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === 'open-competitor') openCompetitorDetail(actionEl.dataset.id);
        else if (action === 'edit-competitor') openCompetitorForm(actionEl.dataset.id);
        else if (action === 'toggle-competitor') {
          const item = state.competitors.find(entry => entry.id === actionEl.dataset.id);
          if (item) {
            item.monitor = !item.monitor;
            persistWorkspace();
            renderCompetitors();
            renderOverview();
            closeModal('detail-modal');
            showToast(item.name + (item.monitor ? ' 已开始监控' : ' 已暂停监控'));
          }
        } else handleAction(action, actionEl);
        return;
      }

      const platformButton = target.closest('[data-platform]');
      if (platformButton) {
        state.platform = platformButton.dataset.platform;
        renderTrends();
        return;
      }

      const categoryButton = target.closest('[data-category]');
      if (categoryButton) {
        state.category = categoryButton.dataset.category;
        renderCompetitors();
        return;
      }

      const reviewStoreButton = target.closest('[data-review-store]');
      if (reviewStoreButton) {
        if (reviewStoreButton.closest('#review-store-strip')) openReviewSourceModal(reviewStoreButton.dataset.reviewStore);
        else selectReviewStore(reviewStoreButton.dataset.reviewStore);
        return;
      }

      const monitorButton = target.closest('[data-monitor-id]');
      if (monitorButton) {
        event.stopPropagation();
        const item = state.competitors.find(entry => entry.id === monitorButton.dataset.monitorId);
        if (item) {
          item.monitor = !item.monitor;
          persistWorkspace();
          renderCompetitors();
          renderOverview();
          showToast(item.name + (item.monitor ? ' 已开始监控' : ' 已暂停监控'));
        }
        return;
      }

      const modeButton = target.closest('[data-ai-mode]');
      if (modeButton) {
        state.aiMode = modeButton.dataset.aiMode;
        updateAIModeUI();
        return;
      }

      const commandItem = target.closest('[data-command-index]');
      if (commandItem) { executeCommand(Number(commandItem.dataset.commandIndex)); return; }

      if (target.closest('#remove-ai-file')) {
        state.aiFile = null;
        $('#ai-file-selected').classList.remove('is-visible');
        $('#ai-file-selected').innerHTML = '';
        return;
      }

      if (target.classList.contains('modal-backdrop')) { closeModal(target.id); return; }
      if (!target.closest('#sidebar')) $('#sidebar').classList.remove('is-mobile-open');
    });

    $('#global-search').addEventListener('click', openCommand);
    $('#project-switcher').addEventListener('click', openProjectSettings);
    $('#mobile-menu').addEventListener('click', event => { event.stopPropagation(); $('#sidebar').classList.toggle('is-mobile-open'); });
    $('#sidebar-collapse').addEventListener('click', () => $('.app-shell').classList.toggle('sidebar-collapsed'));
    $('#project-form').addEventListener('submit', saveProject);
    $('#project-select').addEventListener('change', event => fillProjectForm(event.target.value));
    $('#competitor-form').addEventListener('submit', addCompetitor);
    $('#competitor-form').addEventListener('change', event => {
      if (event.target.name === 'category') renderCompetitorTrackOptions(event.target.value, []);
    });

    $('#feedback-file-button').addEventListener('click', () => $('#feedback-file-input').click());
    $('#feedback-file-input').addEventListener('change', event => { handleFeedbackFile(event.target.files[0]); event.target.value = ''; });
    const dropzone = $('#feedback-dropzone');
    ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
    ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
    dropzone.addEventListener('drop', event => handleFeedbackFile(event.dataTransfer.files[0]));
    $('#sync-store-reviews').addEventListener('click', syncStoreReviews);
    $('#workspace-import-input').addEventListener('change', event => {
      importWorkspaceFile(event.target.files[0]);
      event.target.value = '';
    });
    $('#confirm-modal-submit').addEventListener('click', () => {
      const pending = state.pendingConfirm;
      closeModal('confirm-modal');
      if (pending) Promise.resolve().then(pending).catch(error => showToast(error.message || '操作失败', 'error'));
    });

    $('#trend-import-btn').addEventListener('click', () => $('#trend-file-input').click());
    $('#trend-file-input').addEventListener('change', event => { loadTrendFile(event.target.files[0]); event.target.value = ''; });

    $('#save-ai-config').addEventListener('click', saveAIConfig);
    $('#test-ai-connection').addEventListener('click', testAIConnection);
    $('#toggle-key-visibility').addEventListener('click', event => {
      const input = $('#ai-api-key');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      event.currentTarget.setAttribute('aria-pressed', String(show));
      event.currentTarget.setAttribute('aria-label', show ? '隐藏 Key' : '显示 Key');
      event.currentTarget.innerHTML = '<svg><use href="#i-' + (show ? 'eye-off' : 'eye') + '"/></svg>';
    });
    $('#ai-file-button').addEventListener('click', () => $('#ai-file-input').click());
    $('#ai-file-input').addEventListener('change', event => { handleAIUpload(event.target.files[0]); event.target.value = ''; });
    const aiDropzone = $('#ai-file-dropzone');
    ['dragenter', 'dragover'].forEach(type => aiDropzone.addEventListener(type, event => { event.preventDefault(); aiDropzone.classList.add('is-dragging'); }));
    ['dragleave', 'drop'].forEach(type => aiDropzone.addEventListener(type, event => { event.preventDefault(); aiDropzone.classList.remove('is-dragging'); }));
    aiDropzone.addEventListener('drop', event => handleAIUpload(event.dataTransfer.files[0]));
    $('#run-ai').addEventListener('click', runAI);

    $('#command-input').addEventListener('input', event => { state.commandSelected = 0; renderCommands(event.target.value); });
    $('#command-input').addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); state.commandSelected = Math.min(state.commands.length - 1, state.commandSelected + 1); renderCommands(event.target.value); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); state.commandSelected = Math.max(0, state.commandSelected - 1); renderCommands(event.target.value); }
      else if (event.key === 'Enter') { event.preventDefault(); executeCommand(state.commandSelected); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeTopModal(); }
    });

    window.addEventListener('hashchange', () => applyRoute(location.hash.replace('#', '') || 'overview'));
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommand(); }
      else if (event.key === 'Escape') closeTopModal();
      else if (event.key === 'Tab') trapModalFocus(event);
    });
  }

  function init() {
    renderProject();
    populateProjectForm();
    renderOverview();
    renderTrends();
    renderFeedback();
    renderCompetitors();
    renderAIConfig();
    updateAIModeUI();
    bindEvents();
    applyRoute(location.hash.replace('#', '') || 'overview');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
