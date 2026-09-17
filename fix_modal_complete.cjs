const fs = require('fs');
let code = fs.readFileSync('custom/extension.js', 'utf8');

// 1. Ensure global helper definitions for safeToast, safeOpenSheet, safeCloseSheets, safeConfirm exist at top level or window
const globalHelpers = `
  // ── 通用 UI 弹窗与 Toast 兼容包装器 ──
  function safeToast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
    else {
      try { if (typeof toast === 'function') toast(msg); } catch(e) {}
    }
  }
  window.safeToast = safeToast;

  function safeOpenSheet(id) {
    try {
      if (typeof openSheet === 'function') { openSheet(id); return; }
      if (typeof window.openSheet === 'function') { window.openSheet(id); return; }
    } catch(e) {}
    const s = document.getElementById(id);
    if (s) s.classList.add('open');
    const sc = document.getElementById('sheet-scrim');
    if (sc) sc.classList.add('show');
  }
  window.safeOpenSheet = safeOpenSheet;

  function safeCloseSheets() {
    try {
      if (typeof closeSheets === 'function') { closeSheets(); return; }
      if (typeof window.closeSheets === 'function') { window.closeSheets(); return; }
    } catch(e) {}
    document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open'));
    const sc = document.getElementById('sheet-scrim');
    if (sc) sc.classList.remove('show');
  }
  window.safeCloseSheets = safeCloseSheets;
`;

// Insert globalHelpers near top if not already at outer scope
if (!code.includes('window.safeOpenSheet = safeOpenSheet;')) {
  code = globalHelpers + '\n' + code;
}

// 2. Refactor openEvtmExtractModal to be bulletproof
const modalCode = `
  // ── 弹出提炼记忆房间的交互弹窗 ──
  async function openEvtmExtractModal() {
    try {
      let sheet = document.getElementById('sheet-evtm-extract');
      if (!sheet) {
        sheet = document.createElement('div');
        sheet.className = 'sheet';
        sheet.id = 'sheet-evtm-extract';
        document.body.appendChild(sheet);
      }

      const cfg = getActiveCharacterConfig() || {};
      const aiName = (typeof window.cfgName === 'function') ? window.cfgName(cfg) : (cfg.nickname || cfg.name || cfg.id || 'AI');
      const cfgId = cfg.id || 'default';

      let msgs = window._msgs || [];
      if ((!msgs || msgs.length < 2) && cfg.id && typeof window.dbGetByIndex === 'function') {
        try {
          const dbMsgs = await window.dbGetByIndex('chatMessages', 'byFriend', cfg.id);
          if (dbMsgs && dbMsgs.length >= 2) {
            msgs = dbMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          }
        } catch(e) {}
      }
      if ((!msgs || msgs.length < 2) && cfg.id && typeof window.dbGetAll === 'function') {
        try {
          const allMsgs = await window.dbGetAll('chatMessages');
          const filtered = (allMsgs || []).filter(m => m && (m.friendId === cfg.id || m.senderId === cfg.id));
          if (filtered.length >= 2) {
            msgs = filtered.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          }
        } catch(e) {}
      }

      const totalCount = msgs ? msgs.length : 0;
      if (totalCount < 2) {
        safeToast('与「' + aiName + '」暂未读取到足够聊天记录（当前 ' + totalCount + ' 条），多聊几句再来提炼吧');
        return;
      }

      const lastSummarized = parseInt(localStorage.getItem('ib_last_summarized_msg_count_' + cfgId) || '0', 10);
      const unsummarized = Math.max(0, totalCount - lastSummarized);

      let defaultStart = (lastSummarized > 0 && lastSummarized < totalCount) ? (lastSummarized + 1) : Math.max(1, totalCount - 30 + 1);
      let defaultEnd = totalCount;

      sheet.innerHTML = \`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="font-size:1.15rem;margin:0;display:flex;align-items:center;gap:6px">
            <span>提炼记忆至「记忆房间」</span>
          </h3>
          <button id="evtm-ext-x" style="background:none;border:none;font-size:1.2rem;color:var(--tx-3, #888);cursor:pointer;padding:4px 8px">✕</button>
        </div>
        
        <div style="background:var(--bg-2, rgba(255,255,255,0.05));padding:10px 12px;border-radius:10px;margin-bottom:14px;font-size:0.86rem;line-height:1.6;border:1px solid var(--line, rgba(255,255,255,0.1))">
          <div style="font-weight:600;margin-bottom:6px;color:var(--tx-1)">角色：\${aiName}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:0.8rem">
            <span style="background:var(--card, rgba(0,0,0,0.2));padding:2px 8px;border-radius:6px;border:1px solid var(--line)">📊 总记录：<b>\${totalCount}</b> 条</span>
            <span style="background:var(--card, rgba(0,0,0,0.2));padding:2px 8px;border-radius:6px;border:1px solid var(--line)">🔖 上次提炼：<b>\${lastSummarized > 0 ? ('第 ' + lastSummarized + ' 条') : '无记录'}</b></span>
            <span style="background:var(--card, rgba(0,0,0,0.2));color:var(--pri, #6366f1);padding:2px 8px;border-radius:6px;border:1px solid var(--line);font-weight:600">⚡ 待沉淀新对话：<b>\${unsummarized > 0 ? (unsummarized + ' 条') : '0 条'}</b></span>
          </div>
        </div>

        <div class="f-group">
          <label style="font-size:0.88rem;color:var(--tx-2);margin-bottom:6px;display:block">快捷选择范围</label>
          <div class="chips" id="evtm-ext-chips" style="display:flex;gap:6px;flex-wrap:wrap">
            \${(unsummarized > 0 && lastSummarized > 0) ? \`<button type="button" class="chip active" data-start="\${lastSummarized + 1}" data-end="\${totalCount}">⚡ 未沉淀 (\${unsummarized}条)</button>\` : ''}
            <button type="button" class="chip \${(unsummarized <= 0 || lastSummarized <= 0) ? 'active' : ''}" data-start="\${Math.max(1, totalCount - 30 + 1)}" data-end="\${totalCount}">最近 30 条</button>
            <button type="button" class="chip" data-start="\${Math.max(1, totalCount - 50 + 1)}" data-end="\${totalCount}">最近 50 条</button>
            <button type="button" class="chip" data-start="\${Math.max(1, totalCount - 100 + 1)}" data-end="\${totalCount}">最近 100 条</button>
            <button type="button" class="chip" data-start="1" data-end="\${totalCount}">全部对话 (\${totalCount}条)</button>
          </div>
        </div>

        <div class="f-group" style="margin-top:14px">
          <label style="font-size:0.88rem;color:var(--tx-2);margin-bottom:6px;display:block">自定义提炼范围（手动输入起止条数）</label>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:0.86rem;color:var(--tx-2)">从第</span>
            <input type="number" id="evtm-ext-start" min="1" max="\${totalCount}" value="\${defaultStart}" style="width:70px;text-align:center;padding:6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--tx-1);font-size:0.9rem">
            <span style="font-size:0.86rem;color:var(--tx-2)">条  到 第</span>
            <input type="number" id="evtm-ext-end" min="1" max="\${totalCount}" value="\${defaultEnd}" style="width:70px;text-align:center;padding:6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--tx-1);font-size:0.9rem">
            <span style="font-size:0.86rem;color:var(--tx-2)">条对话</span>
          </div>
          <div id="evtm-ext-tip" style="margin-top:8px;font-size:0.82rem;color:var(--tx-2);background:var(--bg-2);padding:6px 10px;border-radius:6px;border:1px solid var(--line)"></div>
        </div>

        <div class="sheet-btns" style="margin-top:16px;display:flex;gap:10px">
          <button class="btn" id="evtm-ext-cancel" style="flex:1" data-close="1">取消</button>
          <button class="btn primary" id="evtm-ext-submit" style="flex:2">🚀 开始提炼沉淀</button>
        </div>
      \`;

      safeOpenSheet('sheet-evtm-extract');

      const inStart = sheet.querySelector('#evtm-ext-start');
      const inEnd = sheet.querySelector('#evtm-ext-end');
      const tip = sheet.querySelector('#evtm-ext-tip');
      const chips = sheet.querySelectorAll('#evtm-ext-chips .chip');

      function updatePreviewTip() {
        let s = parseInt(inStart.value, 10) || 1;
        let e = parseInt(inEnd.value, 10) || totalCount;
        if (s < 1) s = 1;
        if (e > totalCount) e = totalCount;
        if (s > e) {
          tip.innerHTML = \`<span style="color:var(--danger, #ef4444)">⚠️ 起始条数（第 \${s} 条）不能大于结束条数（第 \${e} 条）</span>\`;
          return false;
        }
        const count = e - s + 1;
        tip.innerHTML = \`即将提炼：<b>第 \${s} 条 至 第 \${e} 条</b> 对话（共 <b>\${count}</b> 条内容）\`;
        return true;
      }

      updatePreviewTip();

      inStart.oninput = () => {
        chips.forEach(c => c.classList.remove('active'));
        updatePreviewTip();
      };
      inEnd.oninput = () => {
        chips.forEach(c => c.classList.remove('active'));
        updatePreviewTip();
      };

      chips.forEach(btnChip => {
        btnChip.onclick = (e) => {
          e.preventDefault();
          chips.forEach(c => c.classList.remove('active'));
          btnChip.classList.add('active');
          const st = btnChip.getAttribute('data-start');
          const ed = btnChip.getAttribute('data-end');
          if (st && ed) {
            inStart.value = st;
            inEnd.value = ed;
            updatePreviewTip();
          }
        };
      });

      const btnX = sheet.querySelector('#evtm-ext-x');
      if (btnX) {
        btnX.onclick = (e) => {
          e.preventDefault();
          safeCloseSheets();
        };
      }

      const btnCancel = sheet.querySelector('#evtm-ext-cancel');
      if (btnCancel) {
        btnCancel.onclick = (e) => {
          e.preventDefault();
          safeCloseSheets();
        };
      }

      const btnSubmit = sheet.querySelector('#evtm-ext-submit');
      if (btnSubmit) {
        btnSubmit.onclick = async (e) => {
          e.preventDefault();
          if (!updatePreviewTip()) return;
          let s = parseInt(inStart.value, 10) || 1;
          let eIdx = parseInt(inEnd.value, 10) || totalCount;
          if (s > eIdx) return;

          safeCloseSheets();
          try {
            await window.saveToEventMemoryRoom({ startIndex: s, endIndex: eIdx, messages: msgs });
          } catch(err) {
            safeToast('提炼失败：' + (err.message || err));
          }
        };
      }
    } catch(err) {
      console.error('[MemoryRoom] 打开提炼弹窗异常:', err);
      safeToast('打开提炼窗口失败：' + (err.message || err));
    }
  }
  window.openEvtmExtractModal = openEvtmExtractModal;
`;

// Replace existing openEvtmExtractModal
const oldStart = code.indexOf('  // ── 弹出提炼记忆房间的交互弹窗 ──');
const oldEnd = code.indexOf('// ── 挂载聊天菜单「进入房间」按钮 ──');

if (oldStart !== -1 && oldEnd !== -1) {
  code = code.substring(0, oldStart) + modalCode + '\n\n' + code.substring(oldEnd);
  console.log("Replaced openEvtmExtractModal block successfully!");
}

fs.writeFileSync('custom/extension.js', code);
console.log("Updated!");
