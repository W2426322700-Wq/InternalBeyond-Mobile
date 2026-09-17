const fs = require('fs');
let code = fs.readFileSync('custom/extension.js', 'utf8');

const targetModalHTML = `      sheet.innerHTML = \\\`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="font-size:1.15rem;margin:0;display:flex;align-items:center;gap:6px">
            <span>提炼记忆至「记忆房间」</span>
          </h3>
          <button id="evtm-ext-x" style="background:none;border:none;font-size:1.2rem;color:var(--tx-3, #888);cursor:pointer;padding:4px 8px">✕</button>
        </div>
        
        <div style="background:var(--bg-2, rgba(255,255,255,0.05));padding:10px 12px;border-radius:10px;margin-bottom:14px;font-size:0.86rem;line-height:1.6;border:1px solid var(--line, rgba(255,255,255,0.1))">
          <div style="font-weight:600;margin-bottom:6px;color:var(--tx-1)">角色：\\\${aiName}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:0.8rem">
            <span style="background:var(--card, rgba(0,0,0,0.2));padding:2px 8px;border-radius:6px;border:1px solid var(--line)">📊 总记录：<b>\\\${totalCount}</b> 条</span>
            <span style="background:var(--card, rgba(0,0,0,0.2));padding:2px 8px;border-radius:6px;border:1px solid var(--line)">🔖 上次提炼：<b>\\\${lastSummarized > 0 ? ('第 ' + lastSummarized + ' 条') : '无记录'}</b></span>
            <span style="background:var(--card, rgba(0,0,0,0.2));color:var(--pri, #6366f1);padding:2px 8px;border-radius:6px;border:1px solid var(--line);font-weight:600">⚡ 待沉淀新对话：<b>\\\${unsummarized > 0 ? (unsummarized + ' 条') : '0 条'}</b></span>
          </div>
        </div>

        <div class="f-group">
          <label style="font-size:0.88rem;color:var(--tx-2);margin-bottom:6px;display:block">快捷选择范围</label>
          <div class="chips" id="evtm-ext-chips" style="display:flex;gap:6px;flex-wrap:wrap">
            \\\${(unsummarized > 0 && lastSummarized > 0) ? \\\`<button type="button" class="chip active" data-start="\\\${lastSummarized + 1}" data-end="\\\${totalCount}">⚡ 未沉淀 (\\\${unsummarized}条)</button>\\\` : ''}
            <button type="button" class="chip \\\${(unsummarized <= 0 || lastSummarized <= 0) ? 'active' : ''}" data-start="\\\${Math.max(1, totalCount - 30 + 1)}" data-end="\\\${totalCount}">最近 30 条</button>
            <button type="button" class="chip" data-start="\\\${Math.max(1, totalCount - 50 + 1)}" data-end="\\\${totalCount}">最近 50 条</button>
            <button type="button" class="chip" data-start="\\\${Math.max(1, totalCount - 100 + 1)}" data-end="\\\${totalCount}">最近 100 条</button>
            <button type="button" class="chip" data-start="1" data-end="\\\${totalCount}">全部对话 (\\\${totalCount}条)</button>
          </div>
        </div>

        <div class="f-group" style="margin-top:14px">
          <label style="font-size:0.88rem;color:var(--tx-2);margin-bottom:6px;display:block">自定义提炼范围（手动输入起止条数）</label>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:0.86rem;color:var(--tx-2)">从第</span>
            <input type="number" id="evtm-ext-start" min="1" max="\\\${totalCount}" value="\\\${defaultStart}" style="width:70px;text-align:center;padding:6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--tx-1);font-size:0.9rem">
            <span style="font-size:0.86rem;color:var(--tx-2)">条  到 第</span>
            <input type="number" id="evtm-ext-end" min="1" max="\\\${totalCount}" value="\\\${defaultEnd}" style="width:70px;text-align:center;padding:6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--tx-1);font-size:0.9rem">
            <span style="font-size:0.86rem;color:var(--tx-2)">条对话</span>
          </div>
          <div id="evtm-ext-tip" style="margin-top:8px;font-size:0.82rem;color:var(--tx-2);background:var(--bg-2);padding:6px 10px;border-radius:6px;border:1px solid var(--line)"></div>
        </div>

        <div class="sheet-btns" style="margin-top:16px;display:flex;gap:10px">
          <button class="btn" id="evtm-ext-cancel" style="flex:1" data-close="1">取消</button>
          <button class="btn primary" id="evtm-ext-submit" style="flex:2">🚀 开始提炼沉淀</button>
        </div>
      \\\`;`;


const cleanModalHTML = `      sheet.innerHTML = \\\`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="font-size:1.15rem;margin:0;font-weight:600;color:var(--tx-1)">提炼至记忆房间</h3>
          <button id="evtm-ext-x" style="background:none;border:none;font-size:1.2rem;color:var(--tx-3);cursor:pointer;padding:4px">✕</button>
        </div>
        
        <div style="background:var(--card);padding:12px;border-radius:8px;margin-bottom:16px;font-size:0.85rem;line-height:1.6;border:1px solid var(--line)">
          <div style="font-weight:500;margin-bottom:8px;color:var(--tx-1)">角色：\\\${aiName}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;color:var(--tx-2)">
            <span>总记录：<b>\\\${totalCount}</b> 条</span>
            <span style="opacity:0.6">|</span>
            <span>上次提炼：\\\${lastSummarized > 0 ? '第 ' + lastSummarized + ' 条' : '无记录'}</span>
            <span style="opacity:0.6">|</span>
            <span style="color:var(--pri)">待沉淀：<b>\\\${unsummarized > 0 ? unsummarized : '0'}</b> 条</span>
          </div>
        </div>

        <div class="f-group" style="margin-bottom:16px">
          <label style="font-size:0.85rem;color:var(--tx-2);margin-bottom:8px;display:block">快捷范围</label>
          <div class="chips" id="evtm-ext-chips" style="display:flex;gap:8px;flex-wrap:wrap">
            \\\${(unsummarized > 0 && lastSummarized > 0) ? \\\`<button type="button" class="chip active" data-start="\\\${lastSummarized + 1}" data-end="\\\${totalCount}">未沉淀 (\\\${unsummarized})</button>\\\` : ''}
            <button type="button" class="chip \\\${(unsummarized <= 0 || lastSummarized <= 0) ? 'active' : ''}" data-start="\\\${Math.max(1, totalCount - 30 + 1)}" data-end="\\\${totalCount}">最近 30 条</button>
            <button type="button" class="chip" data-start="\\\${Math.max(1, totalCount - 50 + 1)}" data-end="\\\${totalCount}">最近 50 条</button>
            <button type="button" class="chip" data-start="\\\${Math.max(1, totalCount - 100 + 1)}" data-end="\\\${totalCount}">最近 100 条</button>
            <button type="button" class="chip" data-start="1" data-end="\\\${totalCount}">全部</button>
          </div>
        </div>

        <div class="f-group">
          <label style="font-size:0.85rem;color:var(--tx-2);margin-bottom:8px;display:block">自定义范围</label>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <input type="number" id="evtm-ext-start" min="1" max="\\\${totalCount}" value="\\\${defaultStart}" style="width:80px;text-align:center;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--tx-1);font-size:0.9rem" placeholder="起始">
            <span style="color:var(--tx-3)">至</span>
            <input type="number" id="evtm-ext-end" min="1" max="\\\${totalCount}" value="\\\${defaultEnd}" style="width:80px;text-align:center;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--tx-1);font-size:0.9rem" placeholder="结束">
          </div>
          <div id="evtm-ext-tip" style="margin-top:10px;font-size:0.82rem;color:var(--tx-2);background:transparent;padding:0"></div>
        </div>

        <div class="sheet-btns" style="margin-top:20px;display:flex;gap:12px">
          <button class="btn" id="evtm-ext-cancel" style="flex:1;background:var(--card);border:1px solid var(--line);color:var(--tx-2)" data-close="1">取消</button>
          <button class="btn primary" id="evtm-ext-submit" style="flex:2">开始提炼</button>
        </div>
      \\\`;`;


if (code.includes(targetModalHTML.trim().split('\\n')[0].trim())) {
  // It's safer to use regex replacement to avoid exact whitespace issues
  const regex = /sheet\.innerHTML\s*=\s*`[\s\S]*?`;/m;
  code = code.replace(regex, cleanModalHTML.replace(/\\\\/g, '\\'));
  
  // also fix the innerHTML tip emoji
  code = code.replace('tip.innerHTML = `<span style="color:var(--danger, #ef4444)">⚠️ 起始条数（第 ${s} 条）不能大于结束条数（第 ${e} 条）</span>`;', 
                      'tip.innerHTML = `<span style="color:var(--danger)">起始条数不能大于结束条数</span>`;');
                      
  code = code.replace('tip.innerHTML = `即将提炼：<b>第 ${s} 条 至 第 ${e} 条</b> 对话（共 <b>${count}</b> 条内容）`;',
                      'tip.innerHTML = `即将提炼 <b>第 ${s} 条 至 第 ${e} 条</b> 对话（共 ${count} 条）`;');
                      
  fs.writeFileSync('custom/extension.js', code);
  console.log("Styled modal successfully.");
} else {
  console.log("Target modal HTML not found.");
}
