# Orbit · 产品调研工作台

Orbit 是一个面向产品经理、用户研究与竞品分析场景的桌面端 Web 作品。它把多项目工作区、用户反馈、趋势数据、竞品档案和 BYOK AI 分析整合到一条可演示的研究流程中。

项目内置一个独立的「近郊旅游助手」Mock 演示工作区，用于展示完整竞品调研流程；新建项目仍保持空白，不会混入演示业务数据。

![Orbit 项目总览](orbit-v3-preview.png)

## 演示项目：近郊旅游助手

- 覆盖马蜂窝、携程、飞猪、高德地图、小红书、两步路 6 个竞品。
- 包含分类、核心诉求、主攻市场、竞品动作、用户反馈、核心占位、痛点与机会点。
- 共 18 条竞品动作和 18 条竞品用户反馈，可在竞品页按大类筛选。
- 演示项目还包含 18 条明确标注为 Mock 的趋势信号，用于展示趋势图和关键词词云；不包含本产品用户反馈或 AI 生成结论。
- 所有演示数据来源均明确标注 `Mock`，便于面试时说明数据边界。

![近郊旅游助手竞品演示](orbit-demo-competitors.png)

## 核心能力

- **多项目工作区**：项目设置中创建、切换和删除多个「我的项目」；每个项目独立保存反馈、竞品、趋势、AI 记录和评价接口配置。
- **工作区备份**：一键导出全部项目为 JSON，并可导入恢复；备份自动移除 API Key、评价 Token 与 Authorization 等敏感字段。
- **项目总览**：用 AI 将反馈与竞品数据汇总为「功能诉求与迭代优先级」「竞品动作与差异化占位」。
- **趋势雷达**：导入趋势 CSV / JSON，展示跨平台声量、关键词词云、关键词占比排行、信号列表与数据源状态；词云随平台筛选联动，空数据、Mock 演示数据与真实导入数据明确区分。
- **用户反馈**：导入问卷 / 反馈 CSV，自动完成字段清洗、情感判断、主题分类与问卷总览；保留每次导入的文件历史，并支持撤销单次导入。
- **应用商店评价**：App Store 使用公开评价接口；华为、小米、vivo、OPPO 通过企业授权适配层接入。无授权时保持空状态，不生成替代数据。
- **竞品监控**：手动添加竞品，按大类和细分赛道分类；已添加竞品可从卡片直接编辑或删除；记录竞品动作、用户反馈、核心占位、痛点与机会点。
- **差异化占位**：以「竞品名称 / 核心占位 / 痛点 / 机会点」四列表格对比，并跟随当前分类筛选。
- **AI Lab**：自行配置 OpenAI-compatible API，通过 `/api/ai` 代理完成文案对比和文件上传分析；运行记录可回看。文案分值为模型预判，不代表真实流量实验。

![趋势雷达与关键词词云](orbit-trends-preview.png)

## 分类与标签

### 所属大类

- 泛娱乐
- 电商消费
- 工具效率
- 健康学习

### 核心诉求

| 诉求 | 典型产品 | 核心指标 |
| --- | --- | --- |
| 杀时间 Kill Time | 娱乐、游戏、短视频 | 留存时长、DAU |
| 省时间 Save Time | 效率工具、外卖、打车 | 转化率、任务完成效率 |
| 花钱 Spend Money | 电商、美妆、穿搭 | 客单价、复购率 |
| 赚钱 / 变好 Make Money / Improve | 教育、理财、健身 | 完课率、续费率 |

### 主攻市场

国内、北美、欧洲、东南亚。

## 数据原则

- 「近郊旅游助手」是唯一预置 Mock 项目；其他新建项目默认空白。
- 演示项目包含明确标注为 Mock 的竞品数据与趋势演示数据，不包含本产品用户反馈或 AI 结论。
- 用户导入和真实接口返回的数据才会进入本产品分析链路。
- 企业 API 未授权、接口不可达或字段无法识别时，界面显示错误或空状态，不生成模拟内容。
- AI 结论只在用户配置 API 后生成，并基于当前项目数据；无 Key 或请求失败时不生成模板替代结果。
- AI 请求经服务端 `/api/ai` 转发，Key 仅随请求使用，不写入服务端存储、localStorage 或工作区备份。
- 评价 Access Token 只保存在当前浏览器会话。

## 数据格式

### 用户反馈 CSV

```csv
feedback,question,source,rating,date,segment
```

### 趋势数据 CSV / JSON

常用字段：`title`、`description`、`platform`、`mentions`、`delta`、`sentiment`、`category`、`date`、`url`、`source`、`keywords`。

`keywords` 支持数组或逗号、分号、竖线分隔的字符串；JSON 中也可为关键词提供 `{ "name": "周末短途", "weight": 3200 }` 形式的权重。

### 竞品数据字段

竞品通过界面手动添加。标准化字段包括：

```json
{
  "name": "产品名称",
  "category": "电商消费",
  "tracks": ["美妆穿搭"],
  "need": "花钱",
  "market": "国内",
  "killer": "核心占位",
  "painPoint": "用户痛点",
  "opportunity": "机会点",
  "signal": "竞品动作",
  "userFeedback": ["用户反馈 1", "用户反馈 2"],
  "source": "官网 / 商店 / 访谈"
}
```

## 应用商店评价接口

### App Store

使用 Apple 公开 RSS 评价接口，输入数字 App ID 与地区即可同步，无需 API Key。

### 国内应用商店

华为、小米、vivo、OPPO 通常需要企业开放平台权限。界面支持填写：

- App ID / 应用包名
- 企业评价 API Endpoint
- Access Token

服务端会完成 HTTPS 校验、域名白名单校验、字段清洗和统一结构输出。默认官方域名白名单见 `api/reviews.mjs`；如需追加企业网关，可配置环境变量 `REVIEW_ENDPOINT_ALLOWLIST`（逗号分隔）。

统一输出结构：

```json
{
  "reviews": [
    {
      "text": "评价内容",
      "source": "评价来源",
      "rating": 5,
      "date": "2026-11-01",
      "author": "用户昵称",
      "url": "评价链接"
    }
  ]
}
```

## AI API 接入

在 AI Lab 中填写 HTTPS Base URL、模型名称和 API Key。接口需兼容 OpenAI `/chat/completions`，前端统一请求 `/api/ai`，以规避浏览器跨域限制。Key 仅保存在 `sessionStorage`，代理不落盘。

文件分析支持 `.txt`、`.md`、`.csv`、`.json`、`.log`，单文件不超过 1 MB。

## 本地运行

需要 Node.js 18+。

```bash
node server.mjs
```

访问 [http://localhost:4173](http://localhost:4173)。项目没有第三方前端依赖。

## 部署到公网

推荐使用 Vercel，前端、`/api/reviews` 与 `/api/ai` Serverless Function 可一起部署：

```bash
npm i -g vercel
vercel --prod
```

更完整的发布、分享和安全说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 主要文件

- `index.html`：页面结构
- `assets/app.js`：数据清洗、交互、项目隔离与 AI 调用
- `assets/styles.css`：视觉系统
- `assets/data.js`：分类、平台与评价源预设，不含业务数据
- `assets/demo-data.js`：近郊旅游助手 Mock 演示项目数据
- `server.mjs`：本地静态服务器与 API 代理
- `api/reviews.mjs`：App Store / 企业评价接口适配器
- `api/ai.mjs`：BYOK OpenAI-compatible 服务端代理
- `docs/PRD.md`：产品需求文档
- `docs/DEPLOYMENT.md`：部署与分享指南

## 简历描述

> 独立设计并开发 Orbit 产品调研工作台，使用原生 HTML/CSS/JavaScript 构建多项目工作区、问卷反馈清洗、应用商店评价接入、竞品分类与 BYOK AI 分析闭环；通过标准化数据层支持企业 API 替换，并完成公网部署。
