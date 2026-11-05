# Orbit 公网发布与面试官分享指南

## 推荐方案：Vercel

当前项目包含静态前端、`/api/reviews` 与 `/api/ai` Serverless API，Vercel 可以同时托管，适合直接发给面试官访问。

### 方式 A：连接 GitHub

1. 将项目推送到 GitHub 仓库。
2. 登录 Vercel，选择 **Add New Project**。
3. 导入仓库。
4. Framework Preset 选择 **Other**。
5. Build Command 留空。
6. Output Directory 留空或填写 `.`。
7. 点击 Deploy。

### 方式 B：命令行

```bash
npm i -g vercel
vercel
vercel --prod
```

部署后获得 `https://your-project.vercel.app` 地址。

## 环境变量

项目不要求配置环境变量也可以部署和展示。以下变量仅用于可选能力：

| 变量 | 用途 | 是否必需 |
| --- | --- | --- |
| `REVIEW_ENDPOINT_ALLOWLIST` | 追加接受的企业评价 API 域名，逗号分隔 | 否 |

AI Lab 使用访客自己的 API Key，由 `/api/ai` 动态转发，不要求部署者提供 Key。不要将访问 Token、API Key 或 `.env` 文件提交到 GitHub。

## 应用商店评价说明

- App Store 使用 Apple 公开 RSS 评价接口。
- 华为、小米、vivo、OPPO 需要企业开放平台授权。
- 企业 Endpoint 必须为 HTTPS，且域名位于默认官方白名单或 `REVIEW_ENDPOINT_ALLOWLIST` 中。
- Access Token 只保存在访客浏览器的 `sessionStorage`，不会写入项目数据或仓库。
- 无权限或接口失败时显示错误，不生成模拟评价。

## 发送给面试官时提供什么

建议在邮件、简历或作品集中提供：

1. 公网体验地址
2. GitHub 仓库地址
3. 30 秒体验路径
4. 一段项目背景与个人职责说明
5. 2–3 张关键页面截图
6. PRD 链接

### 30 秒体验路径

1. 打开「近郊旅游助手」Mock 演示项目，说明演示数据边界。
2. 打开项目设置，新建一个项目并选择产品类型。
3. 在用户反馈页上传问卷 CSV，查看反馈总览、导入历史与撤销导入。
4. 在竞品监控页添加竞品，填写核心占位、痛点、机会点和用户反馈。
5. 查看竞品动作、竞品用户反馈与四列差异化占位表；演示编辑或删除入口。
6. 在 AI Lab 配置自己的 API Key，通过 `/api/ai` 生成文案对比或分析上传文件，并回看历史结果。
7. 回到项目总览生成洞察，并导出 Markdown 报告。

## 简历推荐写法

> Orbit 产品调研工作台｜独立开发  
> 使用原生 HTML/CSS/JavaScript 构建多项目工作区、用户反馈清洗、应用商店评价接入、竞品分类与 BYOK AI 分析闭环；通过标准化数据层支持企业 API 替换；完成 Vercel 公网部署。  
> 在线体验：https://your-project.vercel.app

## 隐私与安全

- 上传的反馈、竞品和趋势数据保存在访客自己的浏览器 localStorage 中。
- AI Key 和评价 Token 只保存在当前浏览器会话。
- 不在项目数据中保存 Token。
- 企业评价请求由服务端代理，并执行 HTTPS、域名白名单和禁止重定向校验。
- AI 请求由 `/api/ai` 代理，服务端不保存访客 Key，只限制 HTTPS、拒绝账号密码和明显内网地址。
- 项目作者不需要接触访客的 API Key 或企业评价 Token。

## 备选部署平台

### Netlify

可以部署静态前端，但需要把 `/api/reviews` 与 `/api/ai` 的 Node Handler 迁移为 Netlify Function。没有函数时，评价同步和 AI Lab 不可用。

### GitHub Pages

适合纯静态展示。不要输入真实企业 Token；评价同步与 AI 服务端代理不可用，CSV 导入、竞品档案和浏览器内规则分析仍可演示。

### 静态文件服务

必须至少配置 API 反向代理，才能正式演示 App Store / 企业评价同步。

## 上线前检查

- [ ] 除明确标注的 Mock 演示项目外，无其他模拟业务数据
- [ ] 项目可新建、保存、切换和删除
- [ ] 项目间数据隔离
- [ ] 工作区可导出、导入，备份不含敏感凭证
- [ ] CSV 导入、导入历史和撤销导入正常
- [ ] 竞品用户反馈与差异化表格正常
- [ ] App Store 评价接口可用
- [ ] 企业评价接口错误提示清楚
- [ ] AI API 配置只显示在访客浏览器会话
- [ ] 无 Key 时 AI 请求明确报错，不生成假结果
- [ ] AI 历史记录可回看
- [ ] 移动端无整页横向滚动
- [ ] README 截图已更新
- [ ] 公网链接在无痕模式可访问
