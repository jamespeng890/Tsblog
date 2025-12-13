# Semi-Static Blog Platform 📝

这是一个使用 TypeScript、Cloudflare Pages 和 D1 SQL 数据库构建的半静态博客平台。具有 Apple 设计风格，支持 Markdown 编写、管理员管理界面和评论系统。

## 🌟 特性

- **Markdown 支持**: 使用 Markdown 格式编写文章，自动转换为 HTML
- **D1 数据库**: 使用 Cloudflare D1 存储用户账号和评论
- **双层认证**:
  - 普通用户: 账户密码存储在 D1 数据库
  - 管理员: 使用环境变量直接认证
- **评论管理**: 管理员可以审核和管理用户评论
- **Apple 设计风格**: 清洁、现代的用户界面
- **响应式设计**: 完全支持移动设备

## 📁 项目结构

```
myapp/
├── src/
│   ├── api/
│   │   └── handlers.ts        # API 处理函数
│   ├── utils/
│   │   ├── auth.ts            # 认证工具
│   │   └── markdown.ts        # Markdown 转换工具
│   └── index.ts               # 主应用入口
├── public/
│   ├── index.html             # 博客主页
│   ├── blog-login.html        # 登录页面
│   └── blog-admin.html        # 管理员面板
├── schema.sql                 # 数据库 Schema
├── wrangler.toml              # Cloudflare Pages 配置
├── package.json               # 项目依赖
└── tsconfig.json              # TypeScript 配置
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 创建 D1 数据库
wrangler d1 create blog-db

# 初始化表结构
wrangler d1 execute blog-db --file schema.sql
```

### 3. 配置环境变量

创建 `.env.local` 文件（用于本地开发）或在 Cloudflare Pages 设置中配置：

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
```

### 4. 本地开发

```bash
npm run dev
```

访问 `http://localhost:8787`

### 5. 部署到 Cloudflare Pages

```bash
npm run build
npm run deploy
```

## 📖 使用指南

### 用户功能

1. **创建账户**: 访问 `/blog-login.html`，点击"注册"创建新账户
2. **登录**: 使用用户名和密码登录
3. **浏览文章**: 在主页浏览所有发布的文章
4. **阅读文章**: 点击文章卡片查看完整内容
5. **评论**: 在文章底部提交评论（需要审核）

### 管理员功能

1. **登录**: 访问 `/blog-login.html`，勾选"管理员登录"并输入环境变量中的凭证
2. **发布文章**:
   - 进入管理面板 → 文章管理
   - 点击"新建文章"
   - 使用 Markdown 格式编写内容
   - 勾选"发布文章"并提交
3. **管理评论**:
   - 进入管理面板 → 评论管理
   - 查看待审核的评论
   - 点击"批准"或"拒绝"
4. **查看统计**:
   - 在仪表盘查看文章数量、评论数、用户数和浏览次数

## 🎨 Apple 设计风格

项目采用了 Apple 的设计语言：

- **排版**: 使用系统字体栈（-apple-system, BlinkMacSystemFont）
- **颜色**: 简洁的配色方案，主要使用紫色渐变
- **空间**: 充分的内边距和外边距
- **动画**: 流畅的过渡和 hover 效果
- **圆角**: 12px 的温和圆角

## 📝 Markdown 文章格式

文章使用以下 Markdown 格式：

```markdown
---
title: 文章标题
date: 2024-01-15
author: 作者名称
tags: [标签1, 标签2]
description: 文章描述
slug: article-slug
---

# 文章内容

这里开始写文章...
```

## 🔐 安全性

- JWT 用于用户认证
- 管理员凭证通过环境变量保护
- 所有敏感信息不在前端暴露
- SQL 注入防护（使用参数化查询）
- CORS 正确配置

## 🔌 API 端点

| 端点 | 方法 | 描述 |
|-----|------|------|
| `/api/login` | POST | 用户/管理员登录 |
| `/api/register` | POST | 注册新用户 |
| `/api/posts` | GET | 获取所有发布文章 |
| `/api/posts` | POST | 创建新文章（需认证） |
| `/api/posts/:slug` | GET | 获取单篇文章 |
| `/api/comments` | POST | 提交新评论 |
| `/api/comments/:postId` | GET | 获取文章评论 |
| `/api/comments/pending` | GET | 获取待审核评论（仅管理员） |
| `/api/comments/:id/approve` | PATCH | 审核评论（仅管理员） |

## 🛠 开发工具链

- **TypeScript**: 类型安全的 JavaScript
- **Cloudflare Pages**: 无服务器部署平台
- **Cloudflare D1**: SQLite 数据库服务
- **Marked**: Markdown 解析库
- **jsonwebtoken**: JWT 认证

## 📱 浏览器兼容性

- Chrome/Edge (最新版)
- Firefox (最新版)
- Safari (最新版)
- iOS Safari 12+
- Android Chrome 最新版

## 🤝 贡献

欢迎提交问题和拉取请求！

## 📄 许可证

MIT

---

**祝您使用愉快！如有问题，请提交 Issue。** 🎉
