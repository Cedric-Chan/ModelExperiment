# 前端交互原型

- **`MODEL_TRAINING.html`** — 说明页：指向 [GitHub Pages 演示](https://cedric-chan.github.io/ModelExperiment/) 与仓库地址。
- **`model-experiment-web/`** — React + Vite 交互原型源码（自 Figma / Make 导出演进）。

本地运行：

```bash
cd model-experiment-web
npm install
npm run dev
```

生产构建（`base` 已为 `/ModelExperiment/`，供 GitHub Pages 使用）：

```bash
npm run build
```

**GitHub Actions 部署**：将 [`github-actions-deploy-pages.yml`](github-actions-deploy-pages.yml) 复制到仓库 `.github/workflows/deploy-pages.yml` 后推送（需具备 `workflow` 权限的凭据）。在仓库 **Settings → Pages** 中将 Source 设为 **GitHub Actions**。
