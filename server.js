import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const SYNC_BACKUP_FILE = path.join(__dirname, 'sync_backup.json');

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
    res.status(500).json({ ok: false, error: err.message });
  }
});

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
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.includes('custom')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.post(['*browser-native*', '*/audio/transcriptions'], (req, res) => {
  res.status(200).json({ text: '' });
});

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`InternalBeyond Mobile server running at http://${HOST}:${PORT}`);
});
