window.ORBIT_DATA = {
  industries: [
    { id: 'entertainment', label: '泛娱乐' },
    { id: 'commerce', label: '电商消费' },
    { id: 'tools', label: '工具效率' },
    { id: 'wellness', label: '健康学习' }
  ],
  platforms: [
    { id: 'all', name: '全部平台', short: '全部', color: '#3857f5', type: 'all' },
    { id: 'tiktok', name: 'TikTok', short: 'TikTok', color: '#111318', type: 'global' },
    { id: 'x', name: 'X / Twitter', short: 'X', color: '#15171c', type: 'global' },
    { id: 'xiaohongshu', name: '小红书', short: '小红书', color: '#ff2442', type: 'domestic' },
    { id: 'weibo', name: '微博', short: '微博', color: '#ff8a00', type: 'domestic' },
    { id: 'appstore', name: '应用商店', short: 'App Store', color: '#1677ff', type: 'global' },
    { id: 'ecommerce', name: '电商平台', short: '电商', color: '#f08a24', type: 'domestic' },
    { id: 'other', name: '其他来源', short: '其他', color: '#64748b', type: 'global' }
  ],
  competitorCategories: ['泛娱乐', '电商消费', '工具效率', '健康学习'],
  competitorCategoryMeta: [
    {
      id: 'entertainment',
      label: '泛娱乐',
      color: '#7c5cfc',
      soft: '#f2efff',
      tracks: ['社交', '短视频', '游戏', '直播', '音乐', '内容社区']
    },
    {
      id: 'commerce',
      label: '电商消费',
      color: '#f06a45',
      soft: '#fff1eb',
      tracks: ['美妆穿搭', '电商购物', '消费品牌', '本地生活', '二手交易', '跨境电商']
    },
    {
      id: 'tools',
      label: '工具效率',
      color: '#3867f4',
      soft: '#edf2ff',
      tracks: ['AI工具', '效率办公', '开发者工具', '协作', '文件管理', '系统工具']
    },
    {
      id: 'wellness',
      label: '健康学习',
      color: '#1b9b72',
      soft: '#eaf8f2',
      tracks: ['健康管理', '运动健身', '在线学习', '知识付费', '心理服务', '习惯养成']
    }
  ],
  competitorNeeds: [
    { id: 'kill-time', label: '杀时间', english: 'Kill Time', examples: '娱乐、游戏、短视频', metric: '留存时长 · DAU', color: '#f59e0b', soft: '#fff7e8' },
    { id: 'save-time', label: '省时间', english: 'Save Time', examples: '效率工具、外卖、打车', metric: '转化率 · 任务效率', color: '#3867f4', soft: '#edf2ff' },
    { id: 'spend-money', label: '花钱', english: 'Spend Money', examples: '电商、美妆、穿搭', metric: '客单价 · 复购率', color: '#e44f86', soft: '#fff0f6' },
    { id: 'improve', label: '赚钱 / 变好', english: 'Make Money / Improve', examples: '教育、理财、健身', metric: '完课率 · 续费率', color: '#1b9b72', soft: '#eaf8f2' }
  ],
  competitorMarkets: ['国内', '北美', '欧洲', '东南亚'],
  reviewStores: [
    { id: 'appstore', name: 'App Store', region: '海外', color: '#1677ff', soft: '#edf4ff', mode: 'public', placeholder: 'App Store App ID', hint: '公开评价接口' },
    { id: 'huawei', name: '华为应用市场', region: '国内', color: '#d9363e', soft: '#fff0f1', mode: 'enterprise', placeholder: 'AppGallery App ID', hint: '企业 API 授权' },
    { id: 'xiaomi', name: '小米应用商店', region: '国内', color: '#ff6a00', soft: '#fff4eb', mode: 'enterprise', placeholder: '应用包名 / App ID', hint: '企业 API 授权' },
    { id: 'vivo', name: 'vivo 应用商店', region: '国内', color: '#415fff', soft: '#eff2ff', mode: 'enterprise', placeholder: '应用包名 / App ID', hint: '企业 API 授权' },
    { id: 'oppo', name: 'OPPO 软件商店', region: '国内', color: '#1c9b60', soft: '#ecf9f2', mode: 'enterprise', placeholder: '应用包名 / App ID', hint: '企业 API 授权' }
  ],
  feedbackThemes: [
    '功能诉求', '使用体验', '价格与付费', '内容与质量', '性能与稳定性', '客户服务', '其他'
  ],
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4.1-mini'
};