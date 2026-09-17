const fs = require('fs');
let code = fs.readFileSync('custom/extension.js', 'utf8');

const t1 = 'tip.innerHTML = `<span style="color:var(--danger, #ef4444)">⚠️ 起始条数（第 ${s} 条）不能大于结束条数（第 ${e} 条）</span>`;';
const r1 = 'tip.innerHTML = `<span style="color:var(--danger, #ef4444)">起始条数不能大于结束条数</span>`;';

const t2 = 'tip.innerHTML = `即将提炼：<b>第 ${s} 条 至 第 ${e} 条</b> 对话（共 <b>${count}</b> 条内容）`;';
const r2 = 'tip.innerHTML = `即将提炼 <b>第 ${s} 条 至 第 ${e} 条</b>（共 ${count} 条）`;';

if (code.includes(t1)) code = code.replace(t1, r1);
if (code.includes(t2)) code = code.replace(t2, r2);

fs.writeFileSync('custom/extension.js', code);
console.log('Fixed tips');
