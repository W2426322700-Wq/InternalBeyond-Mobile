import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Allow large json payloads for full workspace and chat history sync
app.use(express.json({ limit: '150mb' }));

// Cloud data backup directory and file
const DATA_DIR = path.join(__dirname, 'data_storage');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
const SYNC_BACKUP_FILE = path.join(DATA_DIR, 'ib-cloud-sync.json');

// Request logger for debugging
app.use((req, res, next) => {
  if (!req.url.startsWith('/api/sync')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ----------------------------------------------------
// 自动云同步 API 接口 (Auto Cloud Sync API)
// ----------------------------------------------------
// 1. 获取服务器云端保存的最新数据
app.get('/api/sync/latest', (req, res) => {
  try {
    if (fs.existsSync(SYNC_BACKUP_FILE)) {
      const raw = fs.readFileSync(SYNC_BACKUP_FILE, 'utf-8');
      const stat = fs.statSync(SYNC_BACKUP_FILE);
      res.status(200).json({ ok: true, exists: true, mtime: stat.mtimeMs, data: JSON.parse(raw) });
    } else {
      res.status(200).json({ ok: true, exists: false, data: null });
    }
  } catch (err) {
    console.error('Fetch cloud sync error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. 将浏览器最新数据推送到服务器保存
app.post('/api/sync/save', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }
    const jsonStr = JSON.stringify(payload);
    fs.writeFileSync(SYNC_BACKUP_FILE, jsonStr, 'utf-8');
    res.status(200).json({ ok: true, size: jsonStr.length, timestamp: Date.now() });
  } catch (err) {
    console.error('Save cloud sync error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve static assets with appropriate headers
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
    // Disable browser caching for core html, js, and service worker to prevent version rollback
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.includes('custom')) {
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
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`InternalBeyond Mobile server running at http://${HOST}:${PORT}`);
});
