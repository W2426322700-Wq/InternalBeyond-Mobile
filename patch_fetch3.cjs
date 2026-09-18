const fs = require('fs');
let ext = fs.readFileSync('custom/extension.js', 'utf8');

ext = ext.replace(
  "var wrappedFetch = async function (input, init) {",
  "var wrappedFetch = async function (input, init) {\n      try { console.log('[IB FETCH HOOK CALLED] input:', input); } catch(e){}"
);

fs.writeFileSync('custom/extension.js', ext);
