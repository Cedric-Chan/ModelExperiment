# Model Experiment — Figma 源与导出说明

## Zip 归档

仓库内未包含 `Model Experiment.zip`。若你从 Figma 重新导出 zip，请解压后与 `docs/prototype/model-experiment-web` 比对 `src/`、`package.json` 与静态资源，再合并差异。

- Figma 文件：<https://www.figma.com/design/C15E8rRER0qSqYsQZgdVif/Model-Experiment>

## 设计令牌（与产品对齐）

交互原型与 [README](../../README.md) 中「UI 风格」一致：**主色 `#13c2c2`**（Ant Design 青绿）、侧栏与页面背景参考离线原型。

| Token | 用途 |
| --- | --- |
| `--primary` / 主按钮、链接、激活态 | `#13c2c2`，hover `#08979c` |
| 页面背景 `--bg` | `#f0f2f5` |
| 侧栏 `--sidebar-bg` | `#f0f2f5` |
| 正文/次要文字 | `#333` / `#666` |
| 边框 | `#e8e8e8`、`#d9d9d9` |
| 圆角（表单/卡片） | `6px`（`--radius: 6px` 级） |
| 字体 | `DM Sans`，正文约 `13px`（与静态原型一致） |

实现位置：`docs/prototype/model-experiment-web/src/styles/theme.css`（随像素验收迭代）。

## 工程位置

正式原型目录：**[docs/prototype/model-experiment-web](../prototype/model-experiment-web/)**（原 `Model_Experiment_extracted` 已迁入此处）。
