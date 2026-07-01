# 毕业留言圣诞树 Pro

新版效果：

- 真实感烟花：从屏幕底部发射，上升轨迹、爆炸、粒子下落、余辉轨迹、连发模式。
- 圣诞树更像真实松树：多层枝叶、树光、星星、雪地、月光。
- 每一句留言都会变成树上的小纸条，点击可展开大卡片。
- 手机端优化：按钮更大、树和留言自动缩放、低性能设备自动降低烟花粒子量。
- 后端使用 Cloudflare Pages Functions，留言写入 GitHub 的 `data/messages.json`。
- 已带 GitHub Actions 自动部署 Cloudflare Pages 的 workflow。

## 文件结构

```txt
public/                       前端静态页面
functions/api/messages.js      Cloudflare Pages Functions API
data/messages.json             GitHub 留言数据库
.github/workflows/deploy.yml   GitHub Actions 自动部署到 Cloudflare Pages
wrangler.toml                  Cloudflare Pages 配置
```

## GitHub Actions 部署到 Cloudflare Pages

### 1. GitHub 仓库里添加 Secrets

进入仓库：

```txt
Settings → Secrets and variables → Actions → New repository secret
```

添加：

```txt
CLOUDFLARE_API_TOKEN = 你的 Cloudflare API Token
CLOUDFLARE_ACCOUNT_ID = 你的 Cloudflare Account ID
```

Cloudflare API Token 权限：

```txt
Account → Cloudflare Pages → Edit
```

### 2. 推送代码

把整个项目上传到 GitHub 仓库根目录。每次 push 到 `main`，GitHub Actions 会自动部署到 Cloudflare Pages。

默认项目名是：

```txt
graduation-wish-tree
```

如果你的 Cloudflare Pages 项目名不是这个，改：

```txt
.github/workflows/deploy.yml
```

里的两处 `graduation-wish-tree`。

## 留言写入 GitHub 的 Cloudflare 环境变量

进入 Cloudflare Pages 项目：

```txt
Settings → Variables and Secrets
```

普通变量：

```txt
GITHUB_OWNER = 你的 GitHub 用户名
GITHUB_REPO = graduation-wish-tree
GITHUB_BRANCH = main
GITHUB_FILE_PATH = data/messages.json
```

Secret：

```txt
GITHUB_TOKEN = 你的 GitHub Fine-grained Token
```

GitHub Token 权限：

```txt
Repository permissions → Contents → Read and write
```

保存后，重新跑一次 GitHub Actions 部署。

## 绑定域名

部署成功后，在 Cloudflare Pages 项目里：

```txt
Custom domains → Set up a domain
```

输入你的域名，例如：

```txt
biye.nadev.xyz
```

## 常见问题

### 页面提示“API 未配置，当前显示本地示例留言”

说明 Cloudflare Pages 还没有配置 GitHub 留言变量。检查：

```txt
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
GITHUB_FILE_PATH
GITHUB_TOKEN
```

然后重新部署。

### 401

GitHub Token 错了，或者没有 Contents Read and write。

### 404

`GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_FILE_PATH` 其中一个填错了。

### 烟花声音没有

浏览器限制自动播放声音。点一下“发射烟花”后才会启用声音。


## 轻量版说明

这一版把烟花粒子数量、DPR、阴影和连发频率都降下来了，手机和低配置电脑会自动进入低功耗模式。默认不会疯狂连发，点击天空或按钮才会明显燃放。
