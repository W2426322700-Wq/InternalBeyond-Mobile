const fs = require('fs');
let ext = fs.readFileSync('custom/extension.js', 'utf8');

ext = ext.replace(
  "const isLLM = url.includes('/chat/completions') || ",
  "console.log('[Fetch Hook] URL:', url); const isLLM = url.includes('/chat/completions') || "
);

fs.writeFileSync('custom/extension.js', ext);
