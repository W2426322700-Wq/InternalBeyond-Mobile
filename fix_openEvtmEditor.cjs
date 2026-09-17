const fs = require('fs');
let code = fs.readFileSync('custom/extension.js', 'utf8');

const replacement = `      const delBtn = document.getElementById('evtme-del');
      if (delBtn) {
        delBtn.style.display = m ? 'inline-block' : 'none';
        delBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!_editEvtmId) return;
          const targetId = _editEvtmId;
          const ok = await safeConfirm('删除这条记忆房间？', '删除');
          if (!ok) return;
          _evtMems = _evtMems.filter(x => x.id !== targetId);
          saveAndRedraw();
          safeCloseSheets();
          safeToast('已删除');
        };
      }

      const btnCancel = document.getElementById('evtme-cancel');
      if (btnCancel) {
        btnCancel.onclick = (e) => {
          e.preventDefault();
          safeCloseSheets();
        };
      }

      const btnSave = document.getElementById('evtme-save');
      if (btnSave) {
        btnSave.onclick = async (e) => {
          e.preventDefault();
          const inT = document.getElementById('evtme-t');
          const title = (inT ? inT.value : '').trim();
          if (!title) {
            safeToast('请填写标题');
            return;
          }

          const inS = document.getElementById('evtme-s');
          const inC = document.getElementById('evtme-c');
          const inDom = document.getElementById('evtme-domain');
          const inTags = document.getElementById('evtme-tags');
          const inImp = document.getElementById('evtme-imp');
          const pinToggle = document.getElementById('evtme-pin');
          const sealToggle = document.getElementById('evtme-sealed');
          const inVis = document.getElementById('evtme-vis');

          const summary = inS ? inS.value.trim() : '';
          const content = inC ? inC.value.trim() : '';
          const domain = inDom ? inDom.value : '日常';
          const tags = inTags ? inTags.value.split(/[,，]/).map(x => x.trim()).filter(Boolean) : [];
          const importance = inImp ? parseInt(inImp.value, 10) : 5;
          const pinned = pinToggle ? pinToggle.classList.contains('on') : false;
          const sealed = sealToggle ? sealToggle.classList.contains('on') : false;
          const visibility = inVis ? inVis.value : 'all';

          let target = _editEvtmId ? _evtMems.find(x => x.id === _editEvtmId) : null;
          const isNew = !target;
          if (isNew) {
            target = {
              id: 'evtm_' + Date.now(),
              created: Date.now(),
              hasEmbedding: false,
              embedding: null
            };
            _evtMems.unshift(target);
          }

          target.title = title;
          target.summary = summary;
          target.content = content;
          target.domain = domain;
          target.tags = tags;
          target.importance = importance;
          target.pinned = pinned;
          target.sealed = sealed;
          target.visibility = visibility;
          if (visibility === 'only') {
            target.visibleTo = _evtmVisChips.slice();
            delete target.excludeFrom;
          } else if (visibility === 'except') {
            target.excludeFrom = _evtmVisChips.slice();
            delete target.visibleTo;
          } else {
            delete target.visibleTo;
            delete target.excludeFrom;
          }
          target.updated = Date.now();

          saveAndRedraw();
          safeCloseSheets();
          safeToast(isNew ? '已添加记忆卡片（可点击上方“向量化”生成向量）' : '已保存');
        };
      }

      safeOpenSheet('sheet-evtm');
    }`;

const target = `      const delBtn = document.getElementById('evtme-del');
      if (delBtn) {
        delBtn.style.display = m ? 'inline-block' : 'none';
        delBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!_editEvtmId) return;
          const targetId = _editEvtmId;
          const ok = await safeConfirm('删除这条记忆房间？', '删除');
          if (!ok) return;
          _evtMems = _evtMems.filter(x => x.id !== targetId);
          saveAndRedraw();
          safeCloseSheets();
          safeToast('已删除');
        };
      }

      safeOpenSheet('sheet-evtm');
    }`;

if (code.includes(target)) {
  fs.writeFileSync('custom/extension.js', code.replace(target, replacement));
  console.log("SUCCESS!");
} else {
  console.log("NO MATCH");
}
