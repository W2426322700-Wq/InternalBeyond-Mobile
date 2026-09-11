# AI Agent 开发规范与约束指南 (AGENTS.md)

> **重要说明**：本项目 Fork 自上游原作者仓库：
> **Upstream Repository**: `https://github.com/Sui-IB/InternalBeyond-Mobile.git`
> 
> 所有后续参与本项目开发的 AI Agent，在执行任何改动或新增功能前，**必须严格遵守本文件中的全部规则**。

---

## 核心原则：零冲突、非侵入式开发（Upstream Compatibility First）

为了保证用户在未来能够无缝拉取并合并原作者（`Sui-IB/InternalBeyond-Mobile`）的最新提交，避免发生复杂的代码冲突，所有代码修改必须遵循**“主干代码免侵入 / 最小侵入扩展”**原则：

### 1. 严格保护上游核心文件
以下文件属于原作者核心代码资产，**严禁大范围篡改或重写其内部逻辑**：
- `/index.html`（超大单文件主干应用）
- `/ib-sw.js`（Service Worker 离线缓存核心逻辑）
- `/manifest.webmanifest`（PWA 清单）
- `/apps/ib-app-cinema.js`（官方观影室插件）
- `/icon-192.png`、`/icon-512.png`（图标文件）

### 2. 定制与新功能的实现策略
所有针对本项目的自定义改动（包括但不限于：功能扩展、UI 调整、逻辑拦截、API 接入、个性化配置），必须按以下优先级实施：

1. **优先方案：独立文件外挂 / 插件化（Non-invasive Patch）**
   - 新增的 JavaScript 逻辑应放置于独立目录中，例如 `/custom/extension.js` 或独立功能模块。
   - 新增的样式应放置于 `/custom/style.css`。
   - 优先通过 `server.js` 在向客户端返回 HTML 时动态注入外挂引用（或至多在 `index.html` 的尾部只添加单行 `<script src="./custom/extension.js"></script>`），最大程度保持 `index.html` 与上游一致。

2. **利用原生生态挂载（Sub-Apps 机制）**
   - 如果用户需要新增独立小程序、小工具、播放器等，优先按照原作者的规范在 `/apps/` 目录下创建独立脚本，并在 `/apps/catalog.json` 中声明注册。

3. **运行时 Monkey Patch / Hook 机制**
   - 如需修改 `index.html` 中已有的全局变量或方法，应在外挂脚本中使用 JS 的原型链拦截、`addEventListener` 捕获、或劫持全局方法等热补丁方式运行，切忌直接在 `index.html` 源码上直接涂改。

4. **宿主环境文件隔离**
   - 运行环境胶水文件（`/server.js`、`/package.json`、`/metadata.json`、`/.env.example`）与原作者源码物理隔离，只负责提供容器和端口服务，不污染任何前端源码。

---

## 合并同步指引

当用户需要从上游同步更新时，标准操作为：
```bash
git remote add upstream https://github.com/Sui-IB/InternalBeyond-Mobile.git
git fetch upstream
git merge upstream/main
```
由于核心文件未被污染破坏，Git 将能够以 fast-forward 或无冲突状态顺利合并更新。
