const fs = require('fs');
let ext = fs.readFileSync('custom/extension.js', 'utf8');

ext = ext.replace(
  'var finalBody = (init && init.body) || body;',
  'var finalBody = (init && init.body) || body;\n      console.log("[Probe Hook Check] URL:", url, "Method:", method);'
);

fs.writeFileSync('custom/extension.js', ext);
