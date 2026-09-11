# AI Agent 规范指南 (GEMINI.md)

详细开发规范请参见 [AGENTS.md](./AGENTS.md)。

### 关键准则总结：
- **上游仓库**: `https://github.com/Sui-IB/InternalBeyond-Mobile.git`
- **严禁直接重构或破坏上游主干文件**（如 `index.html`、`ib-sw.js`、`apps/*`）。
- **非侵入式扩展**: 所有二次开发、新增功能及样式调整，一律使用独立外挂文件（如 `/custom/` 目录）或基于 `server.js` 动态注入热补丁，确保随时可无冲突合并原作者更新。
