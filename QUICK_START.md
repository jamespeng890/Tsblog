# 快速入门指南 🚀

## 第一步：克隆和安装

```bash
# 克隆项目
git clone <your-repo-url>
cd myapp

# 安装依赖
npm install
```

## 第二步：配置环境

1. 复制环境变量示例文件：
```bash
cp .env.example .env.local
```

2. 编辑 `.env.local` 并设置管理员凭证：
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!
```

## 第三步：设置 Cloudflare D1 数据库

1. 确保已安装 Wrangler CLI：
```bash
npm install -g wrangler
```

2. 创建 D1 数据库：
```bash
wrangler d1 create blog-db
```

3. 获取数据库 ID 并更新 `wrangler.toml`：
```toml
[[d1_databases]]
binding = "DB"
database_name = "blog-db"
database_id = "your-database-id"
```

4. 初始化数据库表：
```bash
wrangler d1 execute blog-db --file schema.sql
```

## 第四步：本地开发

启动开发服务器：
```bash
npm run dev
```

访问：
- 📄 博客主页: `http://localhost:8787/`
- 🔐 登录页面: `http://localhost:8787/blog-login.html`
- 🎯 管理面板: `http://localhost:8787/blog-admin.html`

## 第五步：测试流程

### 1. 用户注册和登录
1. 访问 `/blog-login.html`
2. 点击"立即注册"
3. 填写用户名、邮箱和密码
4. 注册成功后会自动填充用户名
5. 点击"登录"

### 2. 管理员登录
1. 访问 `/blog-login.html`
2. 勾选"管理员登录"
3. 输入用户名：`admin`
4. 输入密码：`YourSecurePassword123!`（根据 .env.local 中的设置）
5. 点击"登录"进入管理面板

### 3. 发布文章
1. 以管理员身份登录
2. 进入管理面板 → 文章管理
3. 点击"新建文章"
4. 输入标题和 Markdown 内容，例如：

```markdown
---
title: 我的第一篇文章
date: 2024-01-15
author: 管理员
description: 这是我的第一篇博客文章
---

# 欢迎

这是文章的内容。

## 标题 2

更多内容...
```

5. 勾选"发布文章"
6. 点击"发布"

### 4. 查看文章
1. 访问博客主页 `/`
2. 查看发布的文章卡片
3. 点击文章查看完整内容
4. 在评论区提交评论

### 5. 管理评论
1. 以管理员身份登录
2. 进入管理面板 → 评论管理
3. 查看待审核的评论
4. 点击"批准"或"拒绝"

## 第六步：部署到 Cloudflare Pages

### 方式 1：使用 Wrangler CLI

```bash
# 构建项目
npm run build

# 部署
npm run deploy
```

### 方式 2：连接 GitHub 仓库

1. 推送代码到 GitHub
2. 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
3. 连接 GitHub 仓库
4. 设置构建配置：
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 在环境变量中设置：
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `ADMIN_USERNAME_PROD`（如果生产环境使用不同凭证）
6. 部署

## 项目结构详解

```
myapp/
│
├── src/                    # TypeScript 源代码
│   ├── api/
│   │   └── handlers.ts    # 所有 API 路由处理函数
│   │       ├── handleLogin()          # 用户/管理员登录
│   │       ├── handleRegister()       # 用户注册
│   │       ├── handleCreatePost()     # 创建文章
│   │       ├── handleGetPosts()       # 获取文章列表
│   │       ├── handleGetPost()        # 获取单篇文章
│   │       ├── handleCreateComment()  # 提交评论
│   │       ├── handleGetComments()    # 获取文章评论
│   │       └── handleApproveComment() # 审核评论
│   │
│   ├── utils/
│   │   ├── auth.ts        # 认证相关（JWT、密码处理）
│   │   │   ├── generateToken()        # 生成 JWT
│   │   │   ├── verifyToken()          # 验证 JWT
│   │   │   ├── hashPassword()         # 密码加密
│   │   │   ├── verifyPassword()       # 密码验证
│   │   │   └── parseAuthContext()     # 解析请求认证信息
│   │   │
│   │   └── markdown.ts    # Markdown 处理
│   │       ├── parseMarkdown()        # 解析 Markdown 文件
│   │       ├── markdownToHtml()       # 转换为 HTML
│   │       ├── generateSlug()         # 生成 URL Slug
│   │       └── generateHtmlPage()     # 生成完整 HTML 页面
│   │
│   └── index.ts           # 主应用入口（路由分发）
│
├── public/                 # 静态文件和 HTML 页面
│   ├── index.html         # 博客主页（文章列表、文章详情、评论）
│   ├── blog-login.html    # 登录和注册页面
│   └── blog-admin.html    # 管理员面板（文章、评论、用户管理）
│
├── schema.sql             # 数据库表定义
├── wrangler.toml          # Cloudflare Pages 配置
├── package.json           # 项目依赖和脚本
├── tsconfig.json          # TypeScript 编译配置
├── .env.example           # 环境变量示例
├── .gitignore             # Git 忽略文件
└── README.md              # 项目文档
```

## 常见问题解决

### Q: 数据库连接错误
**A**: 检查 `wrangler.toml` 中的数据库配置是否正确，确保数据库已创建。

### Q: 管理员登录失败
**A**: 确保 `.env.local` 中的 `ADMIN_PASSWORD` 与您输入的密码一致。

### Q: 文章不显示
**A**: 
1. 确保文章已发布（勾选"发布文章"）
2. 检查数据库中是否存在数据
3. 刷新页面

### Q: 评论无法提交
**A**: 检查浏览器控制台是否有错误信息，确保 API 端点正确。

### Q: 页面样式不正常
**A**: 清除浏览器缓存（Ctrl+Shift+Delete），并重新加载页面。

## 下一步

- 📊 添加文章分类和标签
- 🔍 实现文章搜索功能
- 📧 添加邮件通知（新评论通知管理员）
- 🎨 自定义主题
- 📱 改进移动端体验
- 🔐 增强安全性（更好的密码加密）

---

**祝您开发愉快！** ✨
