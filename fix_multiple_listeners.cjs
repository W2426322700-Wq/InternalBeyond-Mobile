const fs = require('fs');
let code = fs.readFileSync('custom/extension.js', 'utf8');

code = code.replace(/rollbackBtn\.addEventListener\('click',\s*(async\s*\(\)\s*=>\s*\{)/, 'rollbackBtn.onclick = $1');
code = code.replace(/searchInput\.addEventListener\('input',\s*drawEvtMemList\);/, 'searchInput.oninput = drawEvtMemList;');
code = code.replace(/addBtn\.addEventListener\('click',\s*(\(\)\s*=>\s*\{)/, 'addBtn.onclick = $1');
code = code.replace(/classifyBtn\.addEventListener\('click',\s*consolidateAndClassifyMemories\);/, 'classifyBtn.onclick = consolidateAndClassifyMemories;');
code = code.replace(/vectorizeBtn\.addEventListener\('click',\s*batchVectorizeMemories\);/, 'vectorizeBtn.onclick = batchVectorizeMemories;');
code = code.replace(/exportBtn\.addEventListener\('click',\s*(\(\)\s*=>\s*\{)/, 'exportBtn.onclick = $1');
code = code.replace(/importBtn\.addEventListener\('click',\s*(\(\)\s*=>\s*\{)/, 'importBtn.onclick = $1');

fs.writeFileSync('custom/extension.js', code);
console.log("DONE");
