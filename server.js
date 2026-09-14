import express from 'express';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();

const app = express();
const PORT = process.env.PORT || 3003;
const HOST = '0.0.0.0';

// 模块化持久存储根目录（类似酒馆按表和模块独立保存）
const STORAGE_DIR = path.join(__dirname, 'server_storage');
const META_FILE = path.join(STORAGE_DIR, '__meta__.json');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// 辅助函数：安全读写元数据
function getMeta() {
  try {
    if (fs.existsSync(META_FILE)) {
      return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[ServerStorage] Error reading meta:', e);
  }
  return { version: 1, lastModified: 0, stores: {} };
}

function saveMeta(meta) {
  try {
    meta.lastModified = Date.now();
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {
    console.error('[ServerStorage] Error writing meta:', e);
  }
}

// 辅助函数：根据表名获取文件路径
function getStoreFilePath(storeName) {
  // 安全过滤表名，防止路径遍历
  const safeName = storeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STORAGE_DIR, `${safeName}.json`);
}

function readStoreData(storeName) {
  const filePath = getStoreFilePath(storeName);
  if (!fs.existsSync(filePath)) {
    return { data: {}, mtime: 0 };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const stat = fs.statSync(filePath);
    return { data: parsed, mtime: stat.mtimeMs };
  } catch (e) {
    console.error(`[ServerStorage] Error reading store ${storeName}:`, e);
    return { data: {}, mtime: 0 };
  }
}

function writeStoreData(storeName, dataMap) {
  const filePath = getStoreFilePath(storeName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(dataMap), 'utf-8');
    const meta = getMeta();
    meta.stores[storeName] = {
      count: Object.keys(dataMap).length,
      updatedAt: Date.now()
    };
    saveMeta(meta);
  } catch (e) {
    console.error(`[ServerStorage] Error writing store ${storeName}:`, e);
    throw e;
  }
}

// 中间件设置
app.use(express.json({ limit: '60mb' }));

// 请求日志
app.use((req, res, next) => {
  if (req.url.startsWith('/api/v2/storage')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ==========================================
// 酒馆式轻量、细粒度存储 API (v2)
// ==========================================

// 1. 获取轻量元数据清单 (Manifest)
// 前端只要请求这个微小的 JSON (仅几百字节) 即可判断是否有新变动，无需拉取大文件
app.get('/api/v2/storage/manifest', (req, res) => {
  try {
    const meta = getMeta();
    res.json({ ok: true, meta });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 2. 细粒度增量拉取单个或多个 Store
app.get('/api/v2/storage/pull', (req, res) => {
  try {
    const { store } = req.query;
    if (store) {
      // 拉取单个表
      const storeData = readStoreData(store);
      return res.json({ ok: true, store, data: storeData.data, mtime: storeData.mtime });
    }

    // 若未指定表名，拉取全部表的数据（用于新设备一键初始化）
    const meta = getMeta();
    const result = {};
    for (const s of Object.keys(meta.stores)) {
      result[s] = readStoreData(s).data;
    }
    res.json({ ok: true, stores: result, meta });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 3. 增量 Patch 推送（核心！发一条消息或修改人设时，只推这几条变更）
app.post('/api/v2/storage/patch', (req, res) => {
  try {
    const { mutations } = req.body;
    if (!Array.isArray(mutations) || mutations.length === 0) {
      return res.json({ ok: true, updated: 0 });
    }

    // 按表分组应用变更
    const storeGroups = {};
    for (const m of mutations) {
      if (!m.store) continue;
      if (!storeGroups[m.store]) storeGroups[m.store] = [];
      storeGroups[m.store].push(m);
    }

    let affectedCount = 0;
    for (const [storeName, ops] of Object.entries(storeGroups)) {
      const current = readStoreData(storeName).data;
      for (const op of ops) {
        if (op.type === 'put') {
          current[String(op.key)] = op.value;
          affectedCount++;
        } else if (op.type === 'del') {
          delete current[String(op.key)];
          affectedCount++;
        }
      }
      writeStoreData(storeName, current);
    }

    const meta = getMeta();
    res.json({ ok: true, affected: affectedCount, lastModified: meta.lastModified });
  } catch (e) {
    console.error('[ServerStorage] Patch error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 4. 全量覆盖初始化
app.post('/api/v2/storage/full-dump', (req, res) => {
  try {
    const { dump } = req.body;
    if (!dump || typeof dump !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid dump format' });
    }

    for (const [storeName, records] of Object.entries(dump)) {
      const dataMap = {};
      if (Array.isArray(records)) {
        for (const item of records) {
          const key = item.id !== undefined ? item.id : (item.key !== undefined ? item.key : JSON.stringify(item));
          dataMap[String(key)] = item;
        }
      } else if (typeof records === 'object' && records !== null) {
        Object.assign(dataMap, records);
      }
      writeStoreData(storeName, dataMap);
    }

    const meta = getMeta();
    res.json({ ok: true, totalStores: Object.keys(dump).length, lastModified: meta.lastModified });
  } catch (e) {
    console.error('[ServerStorage] Full dump error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 5. 存储状态与健康检查
app.get('/api/v2/storage/status', (req, res) => {
  try {
    const meta = getMeta();
    res.json({
      ok: true,
      service: 'InternalBeyond Storage Server (Tavern-Style)',
      meta,
      uptime: process.uptime()
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 专门处理 Service Worker 文件，确保绝对不被强缓存
app.get('/ib-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'ib-sw.js'));
});

// 动态处理 HTML 入口：自动注入扩展脚本并彻底阻断缓存
function serveIndexHtml(req, res) {
  try {
    const htmlPath = path.join(__dirname, 'index.html');
    let content = fs.readFileSync(htmlPath, 'utf-8');
    
    // 自动确保 custom/extension.js 在最底部注入（带最新时间戳防缓存）
    const extScript = `<script src="./custom/extension.js?v=${Date.now()}"></script>`;
    if (!content.includes('custom/extension.js')) {
      content = content.replace('</body>', `${extScript}\n</body>`);
    } else {
      content = content.replace(/<script\s+src=["']\.\/custom\/extension\.js[^"']*["']><\/script>/gi, extScript);
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(content);
  } catch (e) {
    res.status(500).send('Error loading index.html: ' + e.message);
  }
}

app.get(['/', '/index.html'], serveIndexHtml);

// Serve static assets with appropriate headers
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
    // Disable browser caching for core html, js, json, and service worker to prevent version rollback
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.includes('custom') || filePath.includes('apps')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Fallback for browser-native speech recognition requests
app.post(['*browser-native*', '*/audio/transcriptions'], (req, res) => {
  res.status(200).json({ text: '' });
});

// Fallback all other routes to index.html for SPA behavior
app.get('*', serveIndexHtml);

app.listen(PORT, HOST, () => {
  console.log(`InternalBeyond Mobile server running at http://${HOST}:${PORT}`);
  console.log(`Modular server storage enabled at ${STORAGE_DIR}`);
});
