# 毕业留言圣诞树 · GitHub 存储版

这是一个适合部署到 **Cloudflare Pages** 的毕业留言项目：

- 每一句留言都会显示在圣诞树上
- 烟花背景、飘雪、液态玻璃卡片
- 手机端优化：按钮变大、树尺寸自适应、留言卡片单列展示
- 留言保存到 GitHub 仓库的 `data/messages.json`
- 前端不会暴露 GitHub Token，写入操作由 Cloudflare Pages Functions 完成

## 项目结构

```text
.
├─ public/
│  ├─ index.html              # 前端页面
│  ├─ style.css               # 页面样式 / 手机端优化
│  ├─ script.js               # 留言渲染 / 烟花 / 提交逻辑
│  └─ fallback-messages.json  # API 未配置时显示的示例留言
├─ functions/
│  └─ api/
│     └─ messages.js          # Cloudflare Pages API，负责读写 GitHub
├─ data/
│  └─ messages.json           # GitHub 里的留言数据库
├─ package.json
├─ wrangler.toml
├─ .gitignore
└─ .nojekyll
```

## 第一步：上传到 GitHub

1. GitHub 新建仓库，例如：`graduation-wish-tree`。
2. 把本项目所有文件上传到仓库根目录。
3. 确保 `data/messages.json` 也上传了。

## 第二步：创建 GitHub Token

建议用 **Fine-grained personal access token**：

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens。
2. Repository access 选择你这个留言仓库。
3. Repository permissions 里把 **Contents** 设置成 **Read and write**。
4. 生成后复制 Token，只复制一次，别放进前端代码。

## 第三步：部署到 Cloudflare Pages

1. Cloudflare → Workers & Pages → Create application → Pages。
2. 连接 GitHub，选择这个仓库。
3. 构建设置：
   - Framework preset：`None`
   - Build command：留空
   - Build output directory：`public`
4. 部署。

## 第四步：设置 Cloudflare 环境变量

进入 Cloudflare Pages 项目：`Settings` → `Variables and Secrets`，添加这些变量。

| 变量名 | 类型 | 示例 | 说明 |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | Secret | `github_pat_xxx` | GitHub Token，必须设为 Secret |
| `GITHUB_OWNER` | Variable | `hllojiajia` | 你的 GitHub 用户名或组织名 |
| `GITHUB_REPO` | Variable | `graduation-wish-tree` | 仓库名 |
| `GITHUB_BRANCH` | Variable | `main` | 分支名 |
| `GITHUB_FILE_PATH` | Variable | `data/messages.json` | 留言 JSON 文件路径 |
| `ALLOWED_ORIGIN` | Variable，可选 | `https://wish.example.com` | 限制只有你的域名能提交留言 |
| `RATE_LIMIT_SECONDS` | Variable，可选 | `15` | 同一个 IP 几秒内只能提交一次 |
| `MAX_MESSAGES` | Variable，可选 | `260` | 最多保留多少条留言 |
| `COMMITTER_NAME` | Variable，可选 | `Graduation Wish Bot` | GitHub 提交人名称 |
| `COMMITTER_EMAIL` | Variable，可选 | `wish-bot@example.com` | GitHub 提交人邮箱 |

保存环境变量后，重新部署一次项目。

## 第五步：绑定自己的域名到 Cloudflare

1. 进入 Cloudflare → Workers & Pages。
2. 打开你的 Pages 项目。
3. 进入 `Custom domains`。
4. 点击 `Set up a domain`。
5. 输入你的域名，例如：`wish.nadev.xyz`。
6. 如果你的域名已经托管在 Cloudflare，确认后通常会自动添加 DNS 记录。
7. 如果域名不在 Cloudflare，需要在 DNS 服务商那里添加 CNAME：
   - Name：`wish`
   - Target：你的 Pages 地址，例如 `graduation-wish-tree.pages.dev`

## 修改标题 / 文案

打开 `public/index.html`，改这些文字：

```html
<title>毕业留言圣诞树</title>
<h1>把毕业留言挂在圣诞树上</h1>
<p class="subtitle">每一句祝福都会保存到 GitHub...</p>
```

## 修改初始留言

打开 `data/messages.json` 和 `public/fallback-messages.json`，按下面格式改：

```json
{
  "updatedAt": "2026-07-01T00:00:00.000Z",
  "messages": [
    {
      "id": "seed-01",
      "name": "小明",
      "text": "毕业快乐，未来可期！",
      "createdAt": "2026-06-01T08:00:00.000Z"
    }
  ]
}
```

## 本地测试，可选

```bash
npm install
```

新建 `.dev.vars`：

```env
GITHUB_TOKEN="你的 GitHub Token"
GITHUB_OWNER="你的 GitHub 用户名"
GITHUB_REPO="你的仓库名"
GITHUB_BRANCH="main"
GITHUB_FILE_PATH="data/messages.json"
```

运行：

```bash
npm run dev
```

打开终端显示的本地地址即可测试。

## 注意

- 不要把 `.dev.vars`、`.env`、GitHub Token 上传到 GitHub。
- 公开留言项目一定会有被乱刷的风险，本项目已经加了基础长度限制、危险内容过滤、蜜罐字段和 IP 提交冷却。
- 如果想更严格，可以后续接入 Cloudflare Turnstile 验证码。
