/**
 * InternalBeyond Mobile - 自定义扩展补丁
 * 
 * 本脚本包含：
 * 1. 移动端防缩放手势拦截与白屏看门狗
 * 2. 文本净化工具（全隐藏中文语气与 ElevenLabs 英文方括号音效标签）
 * 3. ElevenLabs v3 专属语气词模式（包含自动将外置语气标签吸附挪入 <ibvoice> 内部的完美引擎）
 * 4. HTML5 标准 Web Speech API 0毫秒同步直连支持
 */
(function () {
  'use strict';

  // ----------------------------------------------------
  // 1. 移动端触摸与手势防护
  // ----------------------------------------------------
  try {
    if (!document.getElementById('ib-lock-zoom-css')) {
      var st = document.createElement('style');
      st.id = 'ib-lock-zoom-css';
      st.textContent = 'html,body{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}';
      document.head.appendChild(st);
    }

    var noop = function (e) {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('gesturestart', noop, { passive: false });
    document.addEventListener('gesturechange', noop, { passive: false });
    document.addEventListener('gestureend', noop, { passive: false });

    // 白屏看门狗
    setTimeout(function () {
      try {
        var v = document.getElementById('lk-preveil');
        if (v && !v.classList.contains('off')) {
          v.classList.add('off');
          setTimeout(function () {
            try { v.remove(); } catch (x) {}
          }, 420);
        }
      } catch (e) {}
    }, 3500);
  } catch (e) {}

  // ----------------------------------------------------
  // 2. 文本净化工具（全气泡隐藏中文语气与 ElevenLabs 英文/方括号音效标签）
  // ----------------------------------------------------
  function cleanDisplayToneTags(str) {
    if (typeof str !== 'string') return str;
    try {
      // 过滤中文语气标签：【语气：xxx】
      str = str.replace(/【语气[:：][^】]{1,10}】\s*/g, '');
      // 过滤所有英文/中文方括号语气音效标签：如 [warm][quiet], [pauses], [chuckle], [sighs], [laughs] 等
      // 负向预查排除 Markdown 链接如 [text](url)
      str = str.replace(/\[[^\r\n\]]{1,80}\](?!\()/g, '');
      // 过滤日程与打卡标签 (包括新增、修改、删除)
      str = str.replace(/<(?:ws_schedule|ws_cal_schedule|ws_cal_add|ws_cal_edit|ws_cal_delete|ws_cal_del|ws_schedule_edit|ws_schedule_delete|ws_schedule_del)\b[^>]*\/?>/gi, '');
      // 清理由于标签删除留下的多余连续空格和首尾空
      str = str.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, '');
    } catch (e) {}
    return str;
  }

  // 劫持全局 mdRenderHtml 彻底遮罩标签，保持界面完美干净
  function hookMdRenderHtml() {
    var origMdRender = window.mdRenderHtml;
    if (origMdRender && !origMdRender._elHooked) {
      var wrapped = function (text, partial) {
        if (typeof text === 'string') {
          text = cleanDisplayToneTags(text);
        }
        return origMdRender.apply(this, [text, partial]);
      };
      wrapped._elHooked = true;
      window.mdRenderHtml = wrapped;
    }
  }

  // 劫持 fillTextInto 确保在 PlainText 模式与非 MD 渲染下气泡也完全隐形标签
  function hookFillTextInto() {
    var origFillTextInto = window.fillTextInto;
    if (origFillTextInto && !origFillTextInto._elHooked) {
      var wrapped = function (el, text, md) {
        if (typeof text === 'string') {
          text = cleanDisplayToneTags(text);
        }
        return origFillTextInto.apply(this, [el, text, md]);
      };
      wrapped._elHooked = true;
      window.fillTextInto = wrapped;
    }
  }

  // 劫持 _stPaintText 确保流式输出时也不外露方括号标签
  function hookStPaintText() {
    var origStPaintText = window._stPaintText;
    if (origStPaintText && !origStPaintText._elHooked) {
      var wrapped = function (raw) {
        var res = origStPaintText.apply(this, arguments);
        if (typeof res === 'string') {
          res = cleanDisplayToneTags(res);
        }
        return res;
      };
      wrapped._elHooked = true;
      window._stPaintText = wrapped;
    }
  }

  // 劫持 _ibcCleanSent 确保通话字幕也完全洗去方括号标签
  function hookIbcCleanSent() {
    var origIbcCleanSent = window._ibcCleanSent;
    if (origIbcCleanSent && !origIbcCleanSent._elHooked) {
      var wrapped = function (s) {
        var res = origIbcCleanSent.apply(this, arguments);
        if (typeof res === 'string') {
          res = cleanDisplayToneTags(res);
        }
        return res;
      };
      wrapped._elHooked = true;
      window._ibcCleanSent = wrapped;
    }
  }

  // 核心：劫持 IBVB.bar 确保语音条点开展示的原文（.ibvb-tx / .vm-orig）彻底隐形方括号标签
  function hookIBVB() {
    if (!window.IBVB || !window.IBVB.bar) return;
    var origBar = window.IBVB.bar;
    if (origBar._elHooked) return;
    var wrappedBar = function (m, vb) {
      var w = origBar.apply(this, arguments);
      try {
        if (w) {
          var tx = w.querySelector('.ibvb-tx');
          if (tx && typeof tx.textContent === 'string') {
            tx.textContent = cleanDisplayToneTags(tx.textContent);
          }
        }
      } catch (e) {}
      return w;
    };
    wrappedBar._elHooked = true;
    window.IBVB.bar = wrappedBar;
  }

  // 批量净化指定的 DOM 树内的语音原文节点
  function cleanAllVoiceTextNodes(root) {
    try {
      var scope = root || document;
      var targets = scope.querySelectorAll ? scope.querySelectorAll('.ibvb-tx, .vm-orig, .fav-orig') : [];
      for (var i = 0; i < targets.length; i++) {
        var el = targets[i];
        if (el && el.textContent && /\[[^\r\n\]]{1,80}\]/.test(el.textContent)) {
          el.textContent = cleanDisplayToneTags(el.textContent);
        }
      }
    } catch (e) {}
  }

  // 监听语音条点击展开原文图标（.vb-t），确保展开一瞬间所有文本 100% 洁净
  function bindVoiceOrigClickSanitizer() {
    document.addEventListener('click', function (e) {
      try {
        var btn = e.target.closest && e.target.closest('.vb-t, .ibvb');
        if (btn) {
          var wrap = btn.closest('.vm-stack, .ibvb-wrap, .mrow, .m-col');
          if (wrap) {
            cleanAllVoiceTextNodes(wrap);
          } else {
            cleanAllVoiceTextNodes(document);
          }
        }
      } catch (err) {}
    }, true);
  }

  // MutationObserver 实时净化动态新增的语音条原文节点
  function observeVoiceOrigElements() {
    try {
      if (!window.MutationObserver) return;
      var obs = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.addedNodes && m.addedNodes.length) {
            for (var j = 0; j < m.addedNodes.length; j++) {
              var node = m.addedNodes[j];
              if (node.nodeType === 1) {
                if (node.classList && (node.classList.contains('ibvb-tx') || node.classList.contains('vm-orig') || node.classList.contains('fav-orig'))) {
                  cleanAllVoiceTextNodes(node.parentNode || node);
                } else if (node.querySelector && node.querySelector('.ibvb-tx, .vm-orig, .fav-orig')) {
                  cleanAllVoiceTextNodes(node);
                }
              }
            }
          }
        }
      });
      obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  // ----------------------------------------------------
  // 3. ElevenLabs v3 专属语气词配置、Prompt 注入与自动吸附修复引擎
  // ----------------------------------------------------
  var DEFAULT_EL_PROMPT = `# GOAL: VOICE ENHANCEMENT WITH TONE TAGS (ElevenLabs v3)
请根据当前角色性格与心理状态，在原生对话文本中密集插入 ElevenLabs v3 语气与非语言音效标签，最大化语音表达的真实感与戏剧张力。

# STRICT RULES:
1. 清理颜文字与视觉符号，确保正文均可朗读。
2. 标签格式：英文方括号+全小写，如[sighs],[laughs],[whispering],[gasp],[crying],[chuckle],[clears throat],[pauses] 等，并且不同标签之间必须得要隔开，如[sighs,laughs]是错误的，[sighs][laughs]是正确的。
3. 情绪颗粒度原则：必须根据情绪的具体层次选择更精确的表达，你能使用任何标签，但是尽量精炼简洁以单独一个词为主，你能使用的包括但不限于上面出现的标签，可以自由发挥。
4. 强度校准原则：标签强度要跟上下文的情绪递进匹配，同一段对话如果情绪在升级（比如从委屈到崩溃），标签也要跟着升级，不能从头到尾用同一个词糊弄。
5. 音色适配原则：先判断角色音色的表达范围（内敛/外放/沙哑/清亮），标签选择要在这个范围内合理，避免明显违和的强爆发标签用在内敛型角色上。
6. 每句至少一个标签，情绪转折处允许多个标签叠加。
7. 区域隔离与语音条规则（核心）：若使用语音条标签 <ibvoice>，所有的语气与音效标签必须写在 <ibvoice> 标签内部的最开头！
   正确写法：<ibvoice>[laughs] 你好呀，今天过得怎么样？</ibvoice>
   错误写法（绝对禁止）：[laughs] <ibvoice>你好呀，今天过得怎么样？</ibvoice>
8. 忠于原意：不得扭曲角色发言的核心语义。

# EXAMPLE:
输入: "你怎么能这样对我... 我明明那么信任你..."
输出: "<ibvoice>[sighs] 你怎么能这样对我... [pauses][sighs] 我明明... [crying] 那么信任你...</ibvoice>"`;

  // 核心拯救引擎：自动将暴露在 <ibvoice> 外侧的 [xxx] 标签吸附吸入 <ibvoice> 内部
  function fixToneTagsForVoice(content) {
    if (typeof content !== 'string' || content.indexOf('<ibvoice') === -1) return content;
    try {
      // 1. 修复写在 <ibvoice> 前方的语气标签: [warm, quiet] <ibvoice>text</ibvoice> -> <ibvoice>[warm, quiet] text</ibvoice>
      content = content.replace(/((?:\[[a-zA-Z0-9_\-\s,'.]+\]\s*)+)<ibvoice\b([^>]*)>([\s\S]*?)<\/ibvoice\s*>/gi, function (match, tags, attr, inner) {
        return '<ibvoice' + attr + '>' + tags.trim() + ' ' + inner.trim() + '</ibvoice>';
      });

      // 2. 修复写在 </ibvoice> 后方的语气标签: <ibvoice>text</ibvoice> [warm, quiet] -> <ibvoice>text [warm, quiet]</ibvoice>
      content = content.replace(/<ibvoice\b([^>]*)>([\s\S]*?)<\/ibvoice\s*>(\s*(?:\[[a-zA-Z0-9_\-\s,'.]+\]\s*)+)/gi, function (match, attr, inner, tags) {
        return '<ibvoice' + attr + '>' + inner.trim() + ' ' + tags.trim() + '</ibvoice>';
      });
    } catch (e) {}
    return content;
  }

  // Hook renderAiBody，在提取 <ibvoice> 制作语音条前预处理吸附
  function hookRenderAiBody() {
    var origRenderAiBody = window.renderAiBody;
    if (origRenderAiBody && !origRenderAiBody._elHooked) {
      var wrapped = function (host, msgEl, m) {
        if (m && typeof m.content === 'string') {
          m.content = fixToneTagsForVoice(m.content);
        }
        return origRenderAiBody.apply(this, arguments);
      };
      wrapped._elHooked = true;
      window.renderAiBody = wrapped;
    }
  }

  // Hook _callEffMerge 保证单独配置属性正确透传
  function hookCallEffMerge() {
    var origMerge = window._callEffMerge;
    if (origMerge && !origMerge._elHooked) {
      var wrapped = function (cs, fid) {
        var base = origMerge.apply(this, arguments);
        try {
          var p = fid && cs && cs.perApi && cs.perApi[fid];
          if (p && p.use) {
            if (p.elToneOn !== undefined) base.elToneOn = p.elToneOn;
            if (p.elTonePrompt !== undefined) base.elTonePrompt = p.elTonePrompt;
          }
        } catch (e) {}
        return base;
      };
      wrapped._elHooked = true;
      window._callEffMerge = wrapped;
    }
  }

  // Hook 系统提示词获取逻辑（优先注入 ElevenLabs 专属语气指令）
  function hookToneClause() {
    var origClause = window._ibToneClause;
    window._ibToneClause = function (c) {
      try {
        var fid = c && c.id;
        var eff = (typeof _callEffMerge === 'function' && typeof _callS !== 'undefined') ? _callEffMerge(_callS, fid) : _callS;
        if (eff && eff.provider === 'el' && eff.elToneOn) {
          var p = (eff.elTonePrompt || DEFAULT_EL_PROMPT).trim();
          return '\n\n' + p;
        }
      } catch (e) {}
      return origClause ? origClause.apply(this, arguments) : '';
    };

    var origCallClause = window._ibToneCallClause;
    window._ibToneCallClause = function (c) {
      try {
        var fid = c && c.id;
        var eff = (typeof _callEffMerge === 'function' && typeof _callS !== 'undefined') ? _callEffMerge(_callS, fid) : _callS;
        if (eff && eff.provider === 'el' && eff.elToneOn) {
          var p = (eff.elTonePrompt || DEFAULT_EL_PROMPT).trim();
          return '\n\n' + p;
        }
      } catch (e) {}
      return origCallClause ? origCallClause.apply(this, arguments) : '';
    };
  }

  // 挂载/更新 ElevenLabs 专属语气开关（完全原生风格，放置于语气开关下方，无边框与多余小字）
  function attachToneCardToContainer(container, isPerApi, fid) {
    if (!container) return;

    // 清理可能遗留的旧版带框卡片
    try {
      var oldCard = document.getElementById(isPerApi ? ('call-el-tone-card-perapi-' + fid) : 'call-el-tone-card-global');
      if (oldCard && oldCard.parentNode) oldCard.parentNode.removeChild(oldCard);
    } catch (e) {}

    // 确定所属宿主：独立配置面板还是全局配置面板
    var isDetailPane = !!(isPerApi && fid);

    // 确定是否应该显示（服务商为 ElevenLabs 且云端音色）
    var provEl = isPerApi ? container.querySelector('[data-k="provider"]') : document.getElementById('call-prov');
    var ttsEl = isPerApi ? container.querySelector('[data-k="tts"]') : document.getElementById('call-tts');
    var isCloud = (!ttsEl || ttsEl.value === 'cloud');

    var provVal = provEl ? provEl.value : '';
    if (!provVal && typeof _callS !== 'undefined' && _callS) {
      if (isPerApi && fid && _callS.perApi && _callS.perApi[fid]) {
        provVal = _callS.perApi[fid].provider;
      } else {
        provVal = _callS.provider;
      }
    }

    var isEl = (provVal === 'el');

    var rootId = isPerApi ? ('call-el-tone-wrap-perapi-' + fid) : 'call-el-tone-wrap-global';
    var rootEl = document.getElementById(rootId);

    // 寻找插入位置锚点：优先定位到“语气的开关”（#ibcs-d-tone-row 或 #ibcs-d-vb）下方
    var targetAnchor = null;
    if (isDetailPane) {
      var toneRow = document.getElementById('ibcs-d-tone-row');
      if (toneRow) {
        targetAnchor = toneRow;
      } else {
        var vb = document.querySelector('#ib-callset #ibcs-d-vb');
        if (vb) targetAnchor = vb;
      }
    }
    if (!targetAnchor) {
      // 全局配置回退：寻找语气的开关或全局设置末尾
      var gToneRow = document.getElementById('ibcs-d-tone-row');
      if (gToneRow) {
        targetAnchor = gToneRow;
      } else {
        var voiceInput = isPerApi ? container.querySelector('[data-k="voice"]') : container.querySelector('#call-voice');
        if (voiceInput) {
          targetAnchor = voiceInput.closest('.f-group');
        }
      }
    }

    if (!targetAnchor) return;

    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = rootId;
      rootEl.className = 'el-tone-host-block';
      rootEl.style.cssText = 'margin: 0; padding: 0;';
      rootEl.innerHTML = 
        '<div class="tog nb" id="' + rootId + '-tog" style="margin-top:4px; border-bottom:none; padding-bottom:8px;">' +
          '<div class="tog-m">' +
            '<div class="tog-t">ElevenLabs专属语气</div>' +
          '</div>' +
          '<div class="sw2 el-tone-sw" id="' + rootId + '-sw"></div>' +
        '</div>' +
        '<div class="el-tone-prompt-wrap" style="display:none; margin:4px 0 0 0; padding-bottom:12px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">' +
            '<span style="font-size:0.75rem; color:var(--tx2)">提示词指令</span>' +
            '<button type="button" class="el-tone-reset-btn btn mini" style="font-size:0.72rem; padding:2px 8px; height:auto; cursor:pointer">恢复默认</button>' +
          '</div>' +
          '<textarea class="el-tone-prompt" rows="5" style="width:100%; font-size:0.75rem; line-height:1.45; padding:8px; border-radius:8px; border:1px solid var(--line); background:var(--soft); color:var(--tx); resize:vertical; box-sizing:border-box; font-family:monospace;"></textarea>' +
        '</div>' +
        '<div class="el-tone-divider" style="border-bottom:1px solid var(--line); margin-bottom:4px;"></div>';

      if (targetAnchor.id === 'ibcs-d-vb') {
        targetAnchor.appendChild(rootEl);
      } else {
        targetAnchor.insertAdjacentElement('afterend', rootEl);
      }

      var sw = rootEl.querySelector('.el-tone-sw');
      var ta = rootEl.querySelector('.el-tone-prompt');
      var wrap = rootEl.querySelector('.el-tone-prompt-wrap');
      var resetBtn = rootEl.querySelector('.el-tone-reset-btn');

      if (sw) {
        sw.addEventListener('click', async function () {
          var on = !sw.classList.contains('on');
          if (typeof sw2 === 'function') sw2(sw, on);
          else sw.classList.toggle('on', on);
          if (wrap) wrap.style.display = on ? 'block' : 'none';

          if (typeof loadCALL === 'function') await loadCALL();
          if (typeof _callS !== 'undefined' && _callS) {
            if (isPerApi && fid) {
              _callS.perApi = _callS.perApi || {};
              _callS.perApi[fid] = _callS.perApi[fid] || {};
              _callS.perApi[fid].elToneOn = on;
              _callS.perApi[fid].elTonePrompt = ta ? ta.value : '';
            } else {
              _callS.elToneOn = on;
              _callS.elTonePrompt = ta ? ta.value : '';
            }
            if (typeof saveCALL === 'function') await saveCALL();
          }
          if (typeof toast === 'function') {
            toast(on ? '已开启 ElevenLabs专属语气' : '已关闭 ElevenLabs专属语气');
          }
        });
      }

      var saveTimer = null;
      var doSavePrompt = async function () {
        if (typeof loadCALL === 'function') await loadCALL();
        if (typeof _callS !== 'undefined' && _callS) {
          if (isPerApi && fid) {
            _callS.perApi = _callS.perApi || {};
            _callS.perApi[fid] = _callS.perApi[fid] || {};
            _callS.perApi[fid].elTonePrompt = ta ? ta.value : '';
          } else {
            _callS.elTonePrompt = ta ? ta.value : '';
          }
          if (typeof saveCALL === 'function') await saveCALL();
        }
      };

      if (ta) {
        ta.addEventListener('input', function () {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(doSavePrompt, 400);
        });
        ta.addEventListener('blur', function () {
          clearTimeout(saveTimer);
          doSavePrompt();
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', async function () {
          if (ta) ta.value = DEFAULT_EL_PROMPT;
          await doSavePrompt();
          if (typeof toast === 'function') {
            toast('已恢复默认提示词');
          }
        });
      }
    } else {
      // 若语气开关动态渲染出，将其校准至语气开关下方
      var curToneRow = document.getElementById('ibcs-d-tone-row');
      if (curToneRow && rootEl.previousElementSibling !== curToneRow) {
        curToneRow.insertAdjacentElement('afterend', rootEl);
      }
      var togEl = rootEl.querySelector('#' + rootId + '-tog');
      if (togEl) {
        togEl.classList.add('nb');
        togEl.style.borderBottom = 'none';
        togEl.style.paddingBottom = '8px';
      }
      var divider = rootEl.querySelector('.el-tone-divider');
      if (!divider) {
        divider = document.createElement('div');
        divider.className = 'el-tone-divider';
        divider.style.cssText = 'border-bottom:1px solid var(--line); margin-bottom:4px;';
        rootEl.appendChild(divider);
      }
    }

    // 根据 provider 是否为 el 控制显隐
    if (isCloud && isEl) {
      rootEl.style.display = 'block';
      if (typeof _callS !== 'undefined' && _callS) {
        var swEl = rootEl.querySelector('.el-tone-sw');
        var taEl = rootEl.querySelector('.el-tone-prompt');
        var wrapEl = rootEl.querySelector('.el-tone-prompt-wrap');

        if (swEl && taEl && wrapEl) {
          var targetObj = (isPerApi && fid && _callS.perApi && _callS.perApi[fid]) ? _callS.perApi[fid] : _callS;
          var isOn = !!targetObj.elToneOn;

          if (typeof sw2 === 'function') {
            sw2(swEl, isOn);
          } else {
            swEl.classList.toggle('on', isOn);
          }
          wrapEl.style.display = isOn ? 'block' : 'none';

          var currentTargetKey = (isPerApi ? ('perapi_' + fid) : 'global');
          if (document.activeElement !== taEl && rootEl.dataset.loadedKey !== currentTargetKey) {
            taEl.value = targetObj.elTonePrompt || DEFAULT_EL_PROMPT;
            rootEl.dataset.loadedKey = currentTargetKey;
          }
        }
      }
    } else {
      rootEl.style.display = 'none';
    }
  }

  // 渲染/注入控制 UI
  function injectElToneUI() {
    // 1. 全局配置：针对 #call-cloud-g 容器
    var globalCloudGroup = document.getElementById('call-cloud-g');
    if (globalCloudGroup) {
      attachToneCardToContainer(globalCloudGroup, false, null);
    }

    // 2. 单独配置：针对详情页（定位在语气开关下方）
    var currentFid = (typeof _ibcsDetC !== 'undefined' && _ibcsDetC) ? _ibcsDetC.id : null;
    if (currentFid) {
      var perApiVoiceHost = document.querySelector('#ib-callset #ibcs-d-voice');
      attachToneCardToContainer(perApiVoiceHost || document.getElementById('ib-callset'), true, currentFid);
    }
  }

  // ----------------------------------------------------
  // 4. HTML5 Web Speech API 0毫秒同步直连与通话全双工支持
  // ----------------------------------------------------
  var SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;

  window._isBrowserNativeVT = false;
  window._nativeTranscript = '';
  window._nativeRecInstance = null;
  window._nativeIsListening = false;

  // 4.1 普通按键式单次录音
  window._nativeSpeechStart = function () {
    window._nativeTranscript = '';
    if (!SpeechRecClass) return false;

    try {
      if (window._nativeRecInstance && window._nativeIsListening) {
        try { window._nativeRecInstance.stop(); } catch (e) {}
      }

      var rec = new SpeechRecClass();
      rec.continuous = false;
      rec.interimResults = true;
      // 聊天输入录音默认锁定中文识别，防止误切为英文
      rec.lang = 'zh-CN';

      rec.onresult = function (event) {
        var text = '';
        for (var i = 0; i < event.results.length; i++) {
          if (event.results[i] && event.results[i][0]) {
            text += event.results[i][0].transcript;
          }
        }
        if (text) {
          window._nativeTranscript = text.trim();
        }
      };

      rec.onend = function () {
        window._nativeIsListening = false;
      };

      window._nativeRecInstance = rec;
      window._nativeIsListening = true;
      rec.start();
      return true;
    } catch (e) {
      return false;
    }
  };

  window._nativeSpeechStop = function () {
    return new Promise(function (resolve) {
      if (!window._nativeRecInstance || !window._nativeIsListening) {
        resolve(window._nativeTranscript || '');
        return;
      }
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        window._nativeIsListening = false;
        resolve(window._nativeTranscript || '');
      };

      window._nativeRecInstance.onend = finish;
      try {
        window._nativeRecInstance.stop();
      } catch (e) {
        finish();
      }
      setTimeout(finish, 600);
    });
  };

  // 根据当前设置获取合适语言：始终锁定中文普通话识别（zh-CN），彻底解决语音/视频通话识别成英文的问题
  function getAppropriateSpeechLang() {
    return 'zh-CN';
  }

  // 4.1.1 注入常用转写模型下拉列表选项（#vt-mpre）
  function injectNativeSttOption() {
    try {
      var sel = document.getElementById('vt-mpre');
      if (sel) {
        var existing = sel.querySelector('option[value="browser-native"]');
        if (!existing) {
          var opt = document.createElement('option');
          opt.value = 'browser-native';
          opt.textContent = '浏览器原生识别（Web Speech API · 0延时免Key）';
          if (sel.children.length > 1) {
            sel.insertBefore(opt, sel.children[1]);
          } else {
            sel.appendChild(opt);
          }
        }

        var modelInput = document.getElementById('vt-model');
        if (modelInput && modelInput.value === 'browser-native') {
          if (sel.value !== 'browser-native') {
            sel.value = 'browser-native';
          }
        }

        if (!sel._nativeHooked) {
          sel._nativeHooked = true;
          sel.addEventListener('change', function () {
            if (sel.value === 'browser-native') {
              var epInput = document.getElementById('vt-ep');
              var keyInput = document.getElementById('vt-key');
              var modelIn = document.getElementById('vt-model');
              var saveBtn = document.getElementById('vt-save');
              if (epInput) epInput.value = 'browser-native';
              if (keyInput) keyInput.value = 'browser-native';
              if (modelIn) modelIn.value = 'browser-native';
              if (saveBtn) {
                try { saveBtn.click(); } catch (e) {}
              }
            }
          });
        }
      }
    } catch (e) {}
  }

  // 4.2 语音通话与视频通话常驻原生识别管理器
  var CallNativeSpeech = {
    active: false,
    instance: null,
    currentInterim: '',
    historyFinal: '',
    waitResolvers: [],

    start: function () {
      if (!SpeechRecClass) return;
      this.stop();
      this.active = true;
      this.currentInterim = '';
      this.historyFinal = '';
      this.waitResolvers = [];

      var self = this;
      try {
        var rec = new SpeechRecClass();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = getAppropriateSpeechLang();

        rec.onresult = function (event) {
          var interim = '';
          var finalStr = '';
          for (var i = event.resultIndex; i < event.results.length; i++) {
            var item = event.results[i];
            if (item && item[0]) {
              if (item.isFinal) {
                finalStr += item[0].transcript;
              } else {
                interim += item[0].transcript;
              }
            }
          }
          if (finalStr) {
            self.historyFinal += (self.historyFinal ? ' ' : '') + finalStr.trim();
            self.currentInterim = '';
          } else if (interim) {
            self.currentInterim = interim.trim();
          }

          var full = self.getFullText();
          if (full && self.waitResolvers.length > 0) {
            var resolvedText = self.consumeText();
            while (self.waitResolvers.length > 0) {
              var r = self.waitResolvers.shift();
              r(resolvedText);
            }
          }
        };

        rec.onerror = function (e) {
          if (e.error === 'not-allowed') {
            self.active = false;
          }
        };

        rec.onend = function () {
          // 通话依然在线且用户未主动停掉，自动续跑保活
          if (self.active && isCallActive()) {
            setTimeout(function () {
              if (self.active && isCallActive()) {
                try { rec.start(); } catch (err) {}
              }
            }, 120);
          }
        };

        self.instance = rec;
        rec.start();
      } catch (err) {
        console.warn('[CallNativeSpeech] Start error:', err);
      }
    },

    getFullText: function () {
      var parts = [];
      if (this.historyFinal) parts.push(this.historyFinal);
      if (this.currentInterim) parts.push(this.currentInterim);
      return parts.join(' ').trim();
    },

    consumeText: function () {
      var full = this.getFullText();
      this.historyFinal = '';
      this.currentInterim = '';
      return full;
    },

    waitForUtterance: function (timeoutMs) {
      var self = this;
      timeoutMs = timeoutMs || 800;
      return new Promise(function (resolve) {
        var current = self.getFullText();
        if (current) {
          resolve(self.consumeText());
          return;
        }

        var timer = setTimeout(function () {
          var idx = self.waitResolvers.indexOf(onDone);
          if (idx !== -1) self.waitResolvers.splice(idx, 1);
          resolve(self.consumeText());
        }, timeoutMs);

        var onDone = function (text) {
          clearTimeout(timer);
          resolve(text);
        };

        self.waitResolvers.push(onDone);
      });
    },

    stop: function () {
      this.active = false;
      if (this.instance) {
        try {
          this.instance.onend = null;
          this.instance.onerror = null;
          this.instance.stop();
        } catch (e) {}
        this.instance = null;
      }
      this.currentInterim = '';
      this.historyFinal = '';
      this.waitResolvers = [];
    }
  };

  function isCallActive() {
    try {
      if (window._IBCALL && window._IBCALL.active && window._IBCALL.active()) return true;
      var el = document.getElementById('ibcall');
      if (el && !el.hidden && !el.classList.contains('mini')) return true;
    } catch (e) {}
    return false;
  }

  function checkAndSyncCallASR() {
    var isCalling = isCallActive();
    var isNative = isCurrentVtNative();
    if (isCalling && isNative) {
      if (!CallNativeSpeech.active) {
        CallNativeSpeech.start();
      }
    } else {
      if (CallNativeSpeech.active) {
        CallNativeSpeech.stop();
      }
    }
  }

  function isCurrentVtNative() {
    if (window._isBrowserNativeVT) return true;
    if (typeof _vt !== 'undefined' && _vt && _vt.model === 'browser-native') return true;
    return false;
  }

  function hookIBCALL() {
    if (!window._IBCALL) return;
    var origOpen = window._IBCALL.open;
    if (origOpen && !origOpen._nativeHooked) {
      window._IBCALL.open = async function () {
        var res = await origOpen.apply(this, arguments);
        setTimeout(checkAndSyncCallASR, 300);
        return res;
      };
      window._IBCALL.open._nativeHooked = true;
    }

    var origEnd = window._IBCALL.end;
    if (origEnd && !origEnd._nativeHooked) {
      window._IBCALL.end = async function () {
        CallNativeSpeech.stop();
        return origEnd.apply(this, arguments);
      };
      window._IBCALL.end._nativeHooked = true;
    }
  }

  // 4.3 核心：拦截 fetch 发送至语音识别接口的请求，无缝注入浏览器原生识别文本
  function hookFetchForNativeASR() {
    var origFetch = window.fetch;
    if (!origFetch || origFetch._nativeASRHooked) return;

    var wrappedFetch = async function (input, init) {
      var url = '';
      if (typeof input === 'string') url = input;
      else if (input && input.url) url = input.url;

      var isFormData = init && (init.body instanceof FormData);
      var modelVal = isFormData ? init.body.get('model') : '';
      var isNativeReq = false;

      if (url && url.indexOf('browser-native') !== -1) {
        isNativeReq = true;
      } else if (modelVal === 'browser-native') {
        isNativeReq = true;
      } else if (isCurrentVtNative() && (url.indexOf('audio/transcriptions') !== -1 || (isFormData && init.body.has('file')))) {
        isNativeReq = true;
      }

      if (isNativeReq) {
        var text = '';
        if (isCallActive()) {
          // 通话模式下提取常驻识别结果
          text = await CallNativeSpeech.waitForUtterance(750);
        } else {
          // 普通聊天输入
          if (window._nativeIsListening) {
            text = await window._nativeSpeechStop();
          } else {
            text = window._nativeTranscript || '';
          }
          window._nativeTranscript = '';
        }

        return new Response(JSON.stringify({ text: text || '' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 如果是发往云端 ASR 的请求，确保追加中文语言参数，杜绝 Whisper 产生英文幻觉乱码
      if (isFormData && (url.indexOf('audio/transcriptions') !== -1 || init.body.has('file'))) {
        try {
          if (!init.body.has('language')) {
            init.body.append('language', 'zh');
          }
        } catch (e) {}
      }

      // 跨聊上下文双向互通：拦截发送给 AI 模型的对话请求，动态注入单聊/群聊记忆
      var method = (init && init.method) ? init.method.toUpperCase() : 'GET';
      var body = init && init.body;
      if (method === 'POST' && typeof body === 'string' && (body.indexOf('"messages":') !== -1 || body.indexOf('"contents":') !== -1 || body.indexOf('"system":') !== -1)) {
        try {
          if (typeof processCrossContextInjection === 'function') {
            var modifiedBody = await processCrossContextInjection(body, init && init.headers);
            if (modifiedBody) {
              init.body = modifiedBody;
            }
          }
        } catch (errCross) {
          console.warn('[CrossContext] fetch injection error:', errCross);
        }
      }

      return origFetch.apply(this, arguments);
    };

    wrappedFetch._nativeASRHooked = true;
    try {
      Object.defineProperty(window, 'fetch', {
        value: wrappedFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (e1) {
      try {
        var proto = Object.getPrototypeOf(window);
        if (proto) {
          Object.defineProperty(proto, 'fetch', {
            get: function () { return wrappedFetch; },
            configurable: true
          });
        }
      } catch (e2) {
        try {
          window.fetch = wrappedFetch;
        } catch (e3) {
          console.warn('[extension] fetch hook fallback failed:', e3);
        }
      }
    }
  }

  function hookVTReady() {
    var origLoadVT = window.loadVT;
    if (origLoadVT) {
      window.loadVT = async function (force) {
        var vt = await origLoadVT.apply(this, arguments);
        if (vt && vt.model === 'browser-native') {
          window._isBrowserNativeVT = true;
          vt.apiKey = vt.apiKey || 'browser-native';
          vt.endpoint = vt.endpoint || 'browser-native';
        }
        return vt;
      };
    }

    var origVtReady = window.vtReady;
    window.vtReady = function () {
      if (isCurrentVtNative()) return true;
      return origVtReady ? origVtReady.apply(this, arguments) : false;
    };
  }

  function bindGlobalMicTrigger() {
    var handleGestureDown = function (ev) {
      var target = ev.target;
      if (!target) return;
      var isMic = target.closest('#cv-mic') || target.closest('.chat-mic') || target.closest('#chat-mic');
      if (isMic && window._isBrowserNativeVT) {
        window._nativeSpeechStart();
      }
    };

    window.addEventListener('pointerdown', handleGestureDown, true);
    window.addEventListener('touchstart', handleGestureDown, true);
    window.addEventListener('mousedown', handleGestureDown, true);
  }

  function hookTranscribe() {
    if (window._nativeTranscribeHooked) return;
    window._nativeTranscribeHooked = true;

    var origVtTranscribe = window.vtTranscribe;
    window.vtTranscribe = async function (blob, mime) {
      try {
        var vt = typeof loadVT === 'function' ? await loadVT() : null;
        if (vt && vt.model === 'browser-native') {
          var text = window._nativeTranscript || '';

          if (window._nativeIsListening) {
            var stoppedText = await window._nativeSpeechStop();
            if (stoppedText) text = stoppedText;
          }

          if (text) {
            window._nativeTranscript = '';
            return text;
          }

          return text || '';
        }
      } catch (e) {
        console.warn('[WebSpeechAPI] vtTranscribe error:', e);
      }
      return origVtTranscribe ? origVtTranscribe.apply(this, arguments) : '';
    };
  }

  // ----------------------------------------------------
  // 6. 群聊与单聊沉浸式双向上下文互通系统
  // ----------------------------------------------------

  var CROSS_CONFIG_KEY = 'ib_cross_context_v3';
  var _crossMemoryCache = {}; // 内存快速查找缓存，保证打开面板 0ms 瞬间回显，绝不因异步延迟闪烁成关闭

  // 预载配置到内存字典中
  function initCrossSettingsCache() {
    try {
      var raw = localStorage.getItem(CROSS_CONFIG_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      if (!Object.keys(obj).length) {
        var old = localStorage.getItem('ib_cross_context_v2');
        if (old) {
          try { obj = JSON.parse(old); } catch (e) {}
        }
      }
      for (var k in obj) {
        if (obj[k]) _crossMemoryCache[k] = obj[k];
      }
    } catch (e) {}

    // 异步拉取 IndexedDB 中的 groups 表，将已有群的 crossContext 状态同步到缓存
    setTimeout(async function () {
      try {
        var allGroups = await queryStoreAll('groups');
        if (Array.isArray(allGroups)) {
          allGroups.forEach(function (g) {
            if (g && (g.crossContextEnabled !== undefined || g.id || g.name)) {
              var isEn = !!(g.crossContextEnabled || (g.crossContext && g.crossContext.enabled));
              var cnt = g.crossContextCount || (g.crossContext && g.crossContext.count) || 5;
              if (isEn) {
                var cData = { enabled: true, count: cnt, id: g.id || '', name: g.name || '' };
                if (g.id) _crossMemoryCache[g.id] = cData;
                if (g.name) {
                  _crossMemoryCache['name:' + g.name] = cData;
                  _crossMemoryCache[g.name] = cData;
                }
              }
            }
          });
        }
      } catch (e) {}
    }, 100);
  }
  initCrossSettingsCache();

  // 读取所有群聊的互通配置
  function getAllCrossSettings() {
    try {
      var raw = localStorage.getItem(CROSS_CONFIG_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      if (!Object.keys(obj).length) {
        var old = localStorage.getItem('ib_cross_context_v2');
        if (old) {
          try { obj = JSON.parse(old); } catch (e) {}
        }
      }
      return Object.assign({}, obj || {}, _crossMemoryCache);
    } catch (e) {
      return Object.assign({}, _crossMemoryCache);
    }
  }

  // 读取指定群聊的配置（支持按 groupId 或 groupName 同步查找）
  function getGroupCrossSettings(groupId, groupName) {
    // 1. 优先查内存字典（0ms 命中，绝对防止刷新后打开弹窗闪烁为关闭）
    var hit = null;
    if (groupId && _crossMemoryCache[groupId]) hit = _crossMemoryCache[groupId];
    if (!hit && groupName && _crossMemoryCache['name:' + groupName]) hit = _crossMemoryCache['name:' + groupName];
    if (!hit && groupName && _crossMemoryCache[groupName]) hit = _crossMemoryCache[groupName];

    // 2. 查 localStorage
    if (!hit) {
      var all = getAllCrossSettings();
      if (groupId && all[groupId]) hit = all[groupId];
      if (!hit && groupName && all['name:' + groupName]) hit = all['name:' + groupName];
      if (!hit && groupName && all[groupName]) hit = all[groupName];
      if (!hit && (groupId || groupName)) {
        for (var k in all) {
          if (all[k] && typeof all[k] === 'object') {
            if ((groupId && all[k].id === groupId) || (groupName && all[k].name === groupName)) {
              hit = all[k];
              break;
            }
          }
        }
      }
    }

    if (!hit || typeof hit !== 'object') {
      return { enabled: false, count: 5 };
    }
    return {
      enabled: !!hit.enabled,
      count: Math.max(1, Math.min(20, parseInt(hit.count, 10) || 5))
    };
  }

  // 保存指定群聊的配置（同时关联 groupId 和 groupName，更新缓存、localStorage 并异步回写 IndexedDB）
  async function saveGroupCrossSettings(groupId, groupName, conf) {
    if (!groupId && !groupName) return;
    try {
      var data = {
        enabled: !!conf.enabled,
        count: Math.max(1, Math.min(20, parseInt(conf.count, 10) || 5)),
        id: groupId || '',
        name: groupName || '',
        time: Date.now()
      };

      // 1. 同步更新内存高速缓存
      if (groupId) _crossMemoryCache[groupId] = data;
      if (groupName) {
        _crossMemoryCache['name:' + groupName] = data;
        _crossMemoryCache[groupName] = data;
      }

      // 2. 持久化到 localStorage
      var all = getAllCrossSettings();
      if (groupId) all[groupId] = data;
      if (groupName) {
        all['name:' + groupName] = data;
        all[groupName] = data;
      }
      localStorage.setItem(CROSS_CONFIG_KEY, JSON.stringify(all));
      console.info('%c[CrossContext] 互通配置已保存并缓存:', 'color:#3b82f6;font-weight:bold', groupId, groupName, data);

      // 3. 异步持久化到 IndexedDB 的 groups 表
      try {
        var db = await openDBPromise();
        var tx = db.transaction('groups', 'readwrite');
        var store = tx.objectStore('groups');
        var req = store.getAll();
        req.onsuccess = function () {
          var list = req.result || [];
          var target = list.find(function (g) {
            return (groupId && g.id === groupId) || (groupName && g.name === groupName);
          });
          if (target) {
            target.crossContextEnabled = data.enabled;
            target.crossContextCount = data.count;
            store.put(target);
          }
        };
      } catch (errDb) {}
    } catch (e) {
      console.warn('[CrossContext] 保存配置失败:', e);
    }
  }

  // 原生 IndexedDB 辅助查询：打开 InternalBeyondDB
  function openDBPromise() {
    return new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open('InternalBeyondDB', 15);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      } catch (e) {
        reject(e);
      }
    });
  }

  // 获取某个 store 的全量数据
  async function queryStoreAll(storeName) {
    try {
      if (typeof dbGetAll === 'function') {
        var res = await dbGetAll(storeName);
        if (Array.isArray(res) && res.length) return res;
      }
    } catch (e) {}
    try {
      var db = await openDBPromise();
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(storeName, 'readonly');
          var store = tx.objectStore(storeName);
          var req = store.getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve([]); };
        } catch (err) {
          resolve([]);
        }
      });
    } catch (ex) {
      return [];
    }
  }

  // 拉取指定对象（单聊角色或群聊）的最近 N 条有效聊天记录
  async function queryRecentChatMsgs(fid, limit) {
    if (!fid || limit <= 0) return [];
    try {
      var db = await openDBPromise();
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction('chatMessages', 'readonly');
          var store = tx.objectStore('chatMessages');
          var index = null;
          try { index = store.index('byFriend'); } catch (e) {}
          if (index) {
            var range = IDBKeyRange.only(fid);
            var msgs = [];
            var curReq = index.openCursor(range, 'prev');
            curReq.onsuccess = function (ev) {
              var cursor = ev.target.result;
              if (cursor && msgs.length < limit + 10) {
                var m = cursor.value;
                if (m && !m.threadId && !m.callFold && (m.role === 'user' || m.role === 'assistant')) {
                  msgs.push(m);
                }
                cursor.continue();
              } else {
                msgs.reverse();
                resolve(msgs.slice(-limit));
              }
            };
            curReq.onerror = function () { resolve([]); };
          } else {
            var req = store.getAll();
            req.onsuccess = function () {
              var all = req.result || [];
              var filtered = all.filter(function (m) {
                return m && m.friendId === fid && !m.threadId && !m.callFold && (m.role === 'user' || m.role === 'assistant');
              });
              filtered.sort(function (a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
              resolve(filtered.slice(-limit));
            };
            req.onerror = function () { resolve([]); };
          }
        } catch (ex) {
          resolve([]);
        }
      });
    } catch (e) {
      return [];
    }
  }

  // 获取用户称呼
  async function getUserNickname() {
    try {
      var abList = await queryStoreAll('about');
      if (abList && abList[0] && abList[0].name) {
        return abList[0].name;
      }
    } catch (e) {}
    return '用户';
  }

  // 格式化私聊消息为背景记忆（注入群聊中）
  function formatPrivateMsgsForGroup(msgs, aiName, userLabel) {
    if (!msgs || !msgs.length) return '';
    var lines = [];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      var who = m.role === 'user' ? (userLabel || '用户') : (aiName || '你');
      var raw = String(m.content || '').replace(/\s+/g, ' ').trim();
      if (raw.length > 180) raw = raw.slice(0, 180) + '…';
      if (raw) lines.push('- ' + who + '：' + raw);
    }
    if (!lines.length) return '';
    return '【与用户的近期单聊私密记忆互通】\n' +
      '系统已开启「单聊/群聊上下文互通」。以下是你与' + (userLabel || '用户') + '此前在 1 对 1 私聊里的最近对话记录（请作为你的真实记忆；在群聊中若聊到相关话题或用户提及，请自然流露彼此默契，无需生硬声明来源）：\n' +
      lines.join('\n');
  }

  // 格式化群聊记录为单聊背景记忆（支持单群或多群场景，群名清晰隔离，绝不混淆）
  function formatAllGroupBlocksForPrivate(groupList, currentAiName, userLabel) {
    if (!groupList || !groupList.length) return '';

    // 单个群聊场景
    if (groupList.length === 1) {
      var singleItem = groupList[0];
      var singleGName = singleItem.name || '群聊';
      var singleLines = [];
      for (var s = 0; s < singleItem.msgs.length; s++) {
        var sm = singleItem.msgs[s];
        var swho = sm.role === 'user' ? (userLabel || '用户') : (sm.senderName || '群友');
        if (sm.senderName === currentAiName || sm.senderId === (sm.fid || '')) swho = '你';
        var sraw = String(sm.content || '').replace(/\s+/g, ' ').trim();
        if (sraw.length > 180) sraw = sraw.slice(0, 180) + '…';
        if (sraw) singleLines.push('- ' + swho + '：' + sraw);
      }
      if (!singleLines.length) return '';
      return '【群聊「' + singleGName + '」近期动态记忆互通】\n' +
        '系统已开启「单聊/群聊上下文互通」。以下是你作为成员所参与的群聊「' + singleGName + '」近期的真实讨论实录（群聊名称为「' + singleGName + '」；若用户在当前单聊中聊起该群里的话题、群名或群友发生的趣事，请准确对应并自然接话交流，无需刻意声明数据来源）：\n' +
        singleLines.join('\n');
    }

    // 多个群聊场景：清晰告知 AI 加入了哪几个具体群聊，每个群以醒目标题与独立区块区分，绝对不混淆
    var parts = [
      '【多群聊动态独立记忆互通】\n' +
      '系统已开启「单聊/群聊上下文互通」。你当前作为成员同时参与了以下 ' + groupList.length + ' 个不同的群聊。\n' +
      '（重要提示：以下各个群聊是完全互相独立的交流圈子，各自有独立的群聊名称、不同成员与不同讨论话题。请严格分清每个群的名称与动态，切勿互相混淆！若用户在当前单聊中聊起某群的话题、发生的事或提到某个具体群名，请准确对应具体的群聊自然交流）：'
    ];

    for (var gi = 0; gi < groupList.length; gi++) {
      var gObj = groupList[gi];
      var thisGName = gObj.name || ('群聊 ' + (gi + 1));
      var glines = [];
      for (var j = 0; j < gObj.msgs.length; j++) {
        var gm = gObj.msgs[j];
        var gwho = gm.role === 'user' ? (userLabel || '用户') : (gm.senderName || '群友');
        if (gm.senderName === currentAiName || gm.senderId === (gm.fid || '')) gwho = '你';
        var graw = String(gm.content || '').replace(/\s+/g, ' ').trim();
        if (graw.length > 180) graw = graw.slice(0, 180) + '…';
        if (graw) glines.push('- ' + gwho + '：' + graw);
      }
      if (glines.length) {
        parts.push('=== 群聊 ' + (gi + 1) + '：【' + thisGName + '】近期讨论实录 ===\n' + glines.join('\n'));
      }
    }
    parts.push('（说明：以上各个群聊彼此独立，请在单聊中根据用户提及的具体群聊名称精准对应，切勿串群或混淆。）');
    return parts.join('\n\n');
  }

  // 深度双重注入引擎：既注入 System Prompt，又注入最后一条用户消息前缀（确保大模型注意力必达）
  function injectMemoryIntoPayload(payload, injectText) {
    if (!payload || !injectText) return false;
    var injected = false;
    try {
      // 1. OpenAI 兼容格式 (payload.messages)
      if (Array.isArray(payload.messages) && payload.messages.length > 0) {
        // A. 注入到 System Prompt 顶部
        var sysIdx = -1;
        for (var i = 0; i < payload.messages.length; i++) {
          if (payload.messages[i] && payload.messages[i].role === 'system') {
            sysIdx = i;
            break;
          }
        }
        if (sysIdx !== -1) {
          payload.messages[sysIdx].content = injectText + '\n\n' + String(payload.messages[sysIdx].content || '');
        } else {
          payload.messages.unshift({ role: 'system', content: injectText });
        }

        // B. 注入到最后一条 User 消息的前缀（核心：确保大模型注意力绝对感知记忆）
        for (var u = payload.messages.length - 1; u >= 0; u--) {
          var uMsg = payload.messages[u];
          if (uMsg && uMsg.role === 'user') {
            if (typeof uMsg.content === 'string') {
              if (uMsg.content.indexOf('【与用户的近期单聊私密记忆互通】') === -1 && 
                  uMsg.content.indexOf('【群聊「') === -1 &&
                  uMsg.content.indexOf('【多群聊动态独立记忆互通】') === -1) {
                uMsg.content = injectText + '\n\n' + uMsg.content;
              }
            } else if (Array.isArray(uMsg.content)) {
              uMsg.content.unshift({ type: 'text', text: injectText + '\n\n' });
            }
            break;
          }
        }
        return true;
      }

      // 2. Anthropic 格式 (payload.system / payload.messages)
      if (payload.system !== undefined) {
        if (typeof payload.system === 'string') {
          payload.system = injectText + '\n\n' + payload.system;
        } else if (Array.isArray(payload.system)) {
          payload.system.unshift({ type: 'text', text: injectText });
        }
        injected = true;
      }
      if (Array.isArray(payload.messages) && payload.messages.length > 0) {
        for (var au = payload.messages.length - 1; au >= 0; au--) {
          if (payload.messages[au] && payload.messages[au].role === 'user') {
            var c = payload.messages[au].content;
            if (typeof c === 'string') {
              payload.messages[au].content = injectText + '\n\n' + c;
            }
            break;
          }
        }
        return true;
      }

      // 3. Gemini 格式 (payload.contents / systemInstruction)
      if (payload.contents && Array.isArray(payload.contents)) {
        if (payload.systemInstruction && Array.isArray(payload.systemInstruction.parts)) {
          payload.systemInstruction.parts.unshift({ text: injectText });
        } else {
          payload.systemInstruction = { parts: [{ text: injectText }] };
        }
        for (var g = payload.contents.length - 1; g >= 0; g--) {
          if (payload.contents[g] && payload.contents[g].role === 'user' && Array.isArray(payload.contents[g].parts)) {
            payload.contents[g].parts.unshift({ text: injectText + '\n\n' });
            break;
          }
        }
        return true;
      }
    } catch (e) {
      console.warn('[CrossContext] injectMemoryIntoPayload error:', e);
    }
    return injected;
  }

  // 跟踪当前活跃会话
  window._lastActiveConvInfo = null;
  function hookOpenConvTracker() {
    var origOpenConv = window.openConv;
    if (origOpenConv && !origOpenConv._crossTrackHooked) {
      window.openConv = async function (cfg, thread) {
        try {
          if (cfg) {
            window._lastActiveConvInfo = {
              id: cfg.id,
              name: typeof cfgName === 'function' ? cfgName(cfg) : (cfg.nickname || cfg.name || ''),
              isGroup: !!cfg._group || String(cfg.id || '').indexOf('group_') === 0,
              group: cfg._group || null,
              timestamp: Date.now()
            };
          }
        } catch (e) {}
        return origOpenConv.apply(this, arguments);
      };
      window.openConv._crossTrackHooked = true;
    }
  }

  // 核心引擎：在 fetch 阶段进行双向上下文分析与动态注入
  async function processCrossContextInjection(bodyStr, headers) {
    if (!bodyStr || typeof bodyStr !== 'string') return null;
    var payload = null;
    try {
      payload = JSON.parse(bodyStr);
    } catch (e) {
      return null;
    }

    var userLabel = await getUserNickname();
    var allGroups = await queryStoreAll('groups');
    var allConfigs = await queryStoreAll('apiConfigs');

    // 智能场景判定 A：群聊场景检测
    var isGroupCall = false;
    var groupName = '';
    var speakerName = '';

    // 1. 去转义正则匹配
    var unescapedStr = bodyStr.replace(/\\"/g, '"');
    var grpMatch = unescapedStr.match(/【群聊规则】你是群聊["“']([^"”']+)["”']中的成员["“']([^"”']+)["”']/);
    if (!grpMatch) {
      grpMatch = unescapedStr.match(/你是群聊["“']([^"”']+)["”']中的成员["“']([^"”']+)["”']/);
    }
    if (grpMatch) {
      isGroupCall = true;
      groupName = grpMatch[1];
      speakerName = grpMatch[2];
    }

    // 2. 遍历已解析的 payload.messages 提取
    if (!isGroupCall && Array.isArray(payload.messages)) {
      for (var i = 0; i < payload.messages.length; i++) {
        var mText = typeof payload.messages[i].content === 'string' ? payload.messages[i].content : '';
        if (mText.indexOf('【群聊规则】') !== -1) {
          var mSub = mText.match(/你是群聊["“']([^"”']+)["”']中的成员["“']([^"”']+)["”']/);
          if (mSub) {
            isGroupCall = true;
            groupName = mSub[1];
            speakerName = mSub[2];
            break;
          }
        }
      }
    }

    // 3. 回退判定：当前活跃窗口是否为群聊
    if (!isGroupCall) {
      var convEl = document.getElementById('conv');
      var nameEl = document.getElementById('cv-name');
      var chatTitle = nameEl ? nameEl.textContent.trim() : '';
      if (convEl && convEl.classList.contains('open') && chatTitle) {
        var gFound = allGroups.find(function (g) { return g.name === chatTitle; });
        if (gFound) {
          isGroupCall = true;
          groupName = gFound.name;
        }
      }
    }

    // 执行场景 A：群聊中注入单聊私密记忆
    if (isGroupCall) {
      var targetGroup = allGroups.find(function (g) { return g.name === groupName; });
      var targetGroupId = targetGroup ? targetGroup.id : '';
      var crossConf = getGroupCrossSettings(targetGroupId, groupName);

      if (crossConf.enabled && crossConf.count > 0) {
        var speakerCfg = null;
        if (speakerName) {
          speakerCfg = allConfigs.find(function (c) {
            return (c.nickname === speakerName || c.name === speakerName || (typeof cfgName === 'function' && cfgName(c) === speakerName));
          });
        }
        if (!speakerCfg && targetGroup && Array.isArray(targetGroup.members)) {
          var authHeader = headers && (headers.Authorization || headers.authorization || '');
          if (authHeader) {
            var key = authHeader.replace(/^Bearer\s+/i, '').trim();
            speakerCfg = allConfigs.find(function (c) { return c.apiKey === key; });
          }
          if (!speakerCfg && targetGroup.members.length === 1) {
            speakerCfg = allConfigs.find(function (c) { return c.id === targetGroup.members[0]; });
          }
        }

        if (speakerCfg && speakerCfg.id) {
          var privMsgs = await queryRecentChatMsgs(speakerCfg.id, crossConf.count);
          if (privMsgs && privMsgs.length) {
            var privBlock = formatPrivateMsgsForGroup(privMsgs, speakerName || speakerCfg.nickname || speakerCfg.name || '你', userLabel);
            if (privBlock && injectMemoryIntoPayload(payload, privBlock)) {
              console.info('%c[CrossContext 互通生效] 在群聊「' + groupName + '」中成功注入角色「' + (speakerName || speakerCfg.name) + '」的单聊记忆 (' + privMsgs.length + '条)', 'color:#10b981;font-weight:bold');
              return JSON.stringify(payload);
            }
          }
        }
      }
    } else {
      // 执行场景 B：1 对 1 单聊中注入群聊最新讨论动向（清晰识别每个群的名字，绝不混淆）
      var currentAiId = '';
      var currentAiName = '';

      if (window._lastActiveConvInfo && !window._lastActiveConvInfo.isGroup) {
        currentAiId = window._lastActiveConvInfo.id;
        currentAiName = window._lastActiveConvInfo.name;
      }
      var cvNameEl2 = document.getElementById('cv-name');
      var cvName2 = cvNameEl2 ? cvNameEl2.textContent.trim() : '';
      if (cvName2 && !currentAiName) currentAiName = cvName2;

      var currentAiCfg = allConfigs.find(function (c) {
        return (currentAiId && c.id === currentAiId) || 
               (currentAiName && (c.name === currentAiName || c.nickname === currentAiName || (typeof cfgName === 'function' && cfgName(c) === currentAiName)));
      });

      if (currentAiCfg) {
        currentAiId = currentAiCfg.id;
        currentAiName = currentAiCfg.nickname || currentAiCfg.name || currentAiName;

        // 查找所有开启了互通且包含当前角色的群聊
        var matchedGroups = allGroups.filter(function (g) {
          if (!g || !Array.isArray(g.members) || g.members.indexOf(currentAiId) === -1) return false;
          var conf = getGroupCrossSettings(g.id, g.name);
          return conf.enabled && conf.count > 0;
        });

        if (matchedGroups.length > 0) {
          var groupDataList = [];
          for (var gi = 0; gi < matchedGroups.length; gi++) {
            var gItem = matchedGroups[gi];
            var gConf = getGroupCrossSettings(gItem.id, gItem.name);
            var gMsgs = await queryRecentChatMsgs(gItem.id, gConf.count);
            if (gMsgs && gMsgs.length) {
              groupDataList.push({
                name: gItem.name || '群聊',
                id: gItem.id,
                msgs: gMsgs
              });
            }
          }

          if (groupDataList.length > 0) {
            var fullGroupBlock = formatAllGroupBlocksForPrivate(groupDataList, currentAiName, userLabel);
            if (fullGroupBlock && injectMemoryIntoPayload(payload, fullGroupBlock)) {
              console.info('%c[CrossContext 互通生效] 在单聊「' + currentAiName + '」中成功注入群聊动态:', 'color:#10b981;font-weight:bold', groupDataList.map(function (g) { return g.name; }));
              injected = true;
            }
          }
        }
      }
    }

    // 注入日历日程助手能力指令与今日日程参考（确保所有 AI 模型均知晓如何操作日历 App）
    try {
      if (typeof window._getSchedulePromptInjection === 'function') {
        var schBlock = await window._getSchedulePromptInjection();
        if (schBlock) {
          var payloadStr = JSON.stringify(payload);
          if (payloadStr.indexOf('<ws_schedule') === -1) {
            if (injectMemoryIntoPayload(payload, schBlock)) {
              injected = true;
            }
          }
        }
      }
    } catch(e) {}

    if (injected) {
      return JSON.stringify(payload);
    }

    return null;
  }

  // 注入与同步群聊设置 UI（原生美化完全一致，位置插入于原生开关列表）
  var _isUiReadyForCurrentGroup = false; // 防冲刷写保护锁

  function injectGroupCrossContextUI() {
    var sheet = document.getElementById('sheet-group');
    if (!sheet) return;

    var row = document.getElementById('grp-cross-row');
    if (!row) {
      // 找到插入锚点：优先排在原生“注入公开记忆”前面，与原生开关自然平级排布
      var memEl = sheet.querySelector('#grp-mem');
      var anchorTog = memEl ? memEl.closest('.tog') : null;

      // 1. 创建原生开关项 .tog
      row = document.createElement('div');
      row.className = 'tog';
      row.id = 'grp-cross-row';
      row.innerHTML = 
        '<div class="tog-m">' +
          '<div class="tog-t">单聊/群聊上下文互通</div>' +
          '<div class="tog-s">开启后本群 AI 成员可读取单聊私密记忆；在单聊中 TA 也能同步感知本群动态。</div>' +
        '</div>' +
        '<div class="sw2" id="grp-cross-on"></div>';

      // 2. 创建滑块面板（原生滑动条样式）
      var sub = document.createElement('div');
      sub.id = 'grp-cross-sub';
      sub.style.cssText = 'display:none; padding:11px 0 13px 0; border-bottom:1px solid var(--line); margin-top:-2px;';
      sub.innerHTML = 
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">' +
          '<span style="font-size:0.75rem; color:var(--tx2)">双向上下文拉取条数</span>' +
          '<span class="range-val" id="grp-cross-num" style="font-weight:600">5 条</span>' +
        '</div>' +
        '<div class="range-row">' +
          '<input type="range" class="ib-range" id="grp-cross-range" min="1" max="20" step="1" value="5">' +
        '</div>' +
        '<div style="font-size:0.7rem; color:var(--tx3); margin-top:4px; line-height:1.5">' +
          '双向各拉取最近对话的条数（可设置 1～20 条，推荐 3～10 条）' +
        '</div>';

      if (anchorTog && anchorTog.parentNode) {
        anchorTog.parentNode.insertBefore(row, anchorTog);
        anchorTog.parentNode.insertBefore(sub, anchorTog);
      } else {
        var btns = sheet.querySelector('.sheet-btns');
        if (btns) {
          sheet.insertBefore(row, btns);
          sheet.insertBefore(sub, btns);
        }
      }

      var sw = row.querySelector('#grp-cross-on');
      var range = sub.querySelector('#grp-cross-range');
      var num = sub.querySelector('#grp-cross-num');

      // 开关点击：用户主动操作时才持久化
      if (sw) {
        sw.addEventListener('click', function () {
          var on = !sw.classList.contains('on');
          if (typeof sw2 === 'function') sw2(sw, on);
          else sw.classList.toggle('on', on);
          if (sub) sub.style.display = on ? '' : 'none';
          if (range && typeof rangeFill === 'function') rangeFill(range);
          // 用户点击时，强制标记准备就绪并立即持久化
          _isUiReadyForCurrentGroup = true;
          persistCurrentGroupCrossFromUI();
        });
      }

      // 滑块滑动：用户主动调整时才持久化
      if (range) {
        range.addEventListener('input', function () {
          if (num) num.textContent = this.value + ' 条';
          if (typeof rangeFill === 'function') rangeFill(this);
          _isUiReadyForCurrentGroup = true;
          persistCurrentGroupCrossFromUI();
        });
      }
    }

    // 尝试同步回显
    syncGroupCrossUIState();
  }

  // 获取当前正在编辑的群信息（同步优先 + 异步保底）
  function getCurrentEditingGroupInfoSync() {
    var nameInput = document.getElementById('grp-name');
    var gName = nameInput ? nameInput.value.trim() : '';

    var gid = '';
    if (window._lastActiveConvInfo && window._lastActiveConvInfo.isGroup && window._lastActiveConvInfo.id) {
      gid = window._lastActiveConvInfo.id;
      if (!gName && window._lastActiveConvInfo.name) gName = window._lastActiveConvInfo.name;
    }

    // 从内存中查是否有匹配的 group
    if (!gid && gName) {
      if (_crossMemoryCache['name:' + gName] && _crossMemoryCache['name:' + gName].id) {
        gid = _crossMemoryCache['name:' + gName].id;
      } else if (_crossMemoryCache[gName] && _crossMemoryCache[gName].id) {
        gid = _crossMemoryCache[gName].id;
      }
    }

    return { id: gid, name: gName };
  }

  async function getCurrentEditingGroupInfo() {
    var info = getCurrentEditingGroupInfoSync();
    if (!info.id && info.name) {
      try {
        var allGroups = await queryStoreAll('groups');
        var match = allGroups.find(function (g) { return g.name === info.name; });
        if (match) info.id = match.id;
      } catch (e) {}
    }
    return info;
  }

  // 同步 UI 状态（0ms 秒级回显，彻底杜绝刷新后变成关闭）
  var _lastSyncedKey = '';

  function syncGroupCrossUIState(force) {
    var sheet = document.getElementById('sheet-group');
    if (!sheet || !sheet.classList.contains('open')) {
      _lastSyncedKey = '';
      _isUiReadyForCurrentGroup = false;
      return;
    }

    var info = getCurrentEditingGroupInfoSync();
    var curKey = (info.id || '') + '::' + (info.name || '');

    if (!force && _lastSyncedKey === curKey && curKey !== '::') {
      return;
    }
    _lastSyncedKey = curKey;

    var conf = getGroupCrossSettings(info.id, info.name);
    var sw = document.getElementById('grp-cross-on');
    var sub = document.getElementById('grp-cross-sub');
    var range = document.getElementById('grp-cross-range');
    var num = document.getElementById('grp-cross-num');

    if (sw) {
      if (typeof sw2 === 'function') sw2(sw, conf.enabled);
      else sw.classList.toggle('on', conf.enabled);
    }
    if (range) {
      range.value = conf.count;
      if (typeof rangeFill === 'function') rangeFill(range);
    }
    if (num) num.textContent = conf.count + ' 条';
    if (sub) sub.style.display = conf.enabled ? '' : 'none';

    // 只有正确回填完成后，才解除写保护
    _isUiReadyForCurrentGroup = true;

    // 如果群 ID 还没获取到，异步补全并对齐
    if (!info.id && info.name) {
      getCurrentEditingGroupInfo().then(function (asyncInfo) {
        if (asyncInfo.id && asyncInfo.id !== info.id) {
          var asyncConf = getGroupCrossSettings(asyncInfo.id, asyncInfo.name);
          if (asyncConf.enabled !== conf.enabled || asyncConf.count !== conf.count) {
            if (sw) {
              if (typeof sw2 === 'function') sw2(sw, asyncConf.enabled);
              else sw.classList.toggle('on', asyncConf.enabled);
            }
            if (range) {
              range.value = asyncConf.count;
              if (typeof rangeFill === 'function') rangeFill(range);
            }
            if (num) num.textContent = asyncConf.count + ' 条';
            if (sub) sub.style.display = asyncConf.enabled ? '' : 'none';
          }
        }
      });
    }
  }

  // 从 UI 提取并立即持久化配置
  async function persistCurrentGroupCrossFromUI() {
    if (!_isUiReadyForCurrentGroup) return; // 未就绪前绝对禁止误写保存
    var info = await getCurrentEditingGroupInfo();
    var sw = document.getElementById('grp-cross-on');
    var range = document.getElementById('grp-cross-range');
    var enabled = sw ? sw.classList.contains('on') : false;
    var count = range ? (parseInt(range.value, 10) || 5) : 5;

    if (info.id || info.name) {
      saveGroupCrossSettings(info.id, info.name, { enabled: enabled, count: count });
    }

    window._pendingCrossSettings = { enabled: enabled, count: count, name: info.name, id: info.id, time: Date.now() };
  }

  // 拦截 openSheet 实现打开即秒级回显
  function hookOpenSheetForCross() {
    var origOpenSheet = window.openSheet;
    if (origOpenSheet && !origOpenSheet._crossHooked) {
      window.openSheet = function (id) {
        var res = origOpenSheet.apply(this, arguments);
        if (id === 'sheet-group') {
          setTimeout(function () {
            injectGroupCrossContextUI();
            syncGroupCrossUIState(true);
          }, 0);
        }
        return res;
      };
      window.openSheet._crossHooked = true;
    }
  }

  // 监听群聊保存按钮，若为新建或改名群聊，保存后自动深度关联
  function hookGroupSaveAction() {
    var saveBtn = document.getElementById('grp-save');
    if (saveBtn && !saveBtn._crossHooked2) {
      saveBtn._crossHooked2 = true;
      saveBtn.addEventListener('click', function () {
        var sw = document.getElementById('grp-cross-on');
        var range = document.getElementById('grp-cross-range');
        var nameInput = document.getElementById('grp-name');
        var gName = nameInput ? nameInput.value.trim() : '';
        var enabled = sw ? sw.classList.contains('on') : false;
        var count = range ? (parseInt(range.value, 10) || 5) : 5;

        // 立即缓存本次设定的状态
        if (gName) {
          saveGroupCrossSettings(null, gName, { enabled: enabled, count: count });
        }
        window._pendingCrossSettings = { enabled: enabled, count: count, name: gName, time: Date.now() };

        // 延迟回写到新建或更新的群实体
        setTimeout(async function () {
          try {
            var allGroups = await queryStoreAll('groups');
            if (allGroups && allGroups.length) {
              allGroups.sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
              var matched = allGroups.find(function (g) { return g.name === gName; }) || allGroups[0];
              if (matched && window._pendingCrossSettings) {
                saveGroupCrossSettings(matched.id, matched.name, window._pendingCrossSettings);
              }
            }
          } catch (e) {}
        }, 500);
      });
    }
  }

  // ----------------------------------------------------
  // 7. 初始化与 DOM 监听入口
  // ----------------------------------------------------
  function initExtension() {
    hookMdRenderHtml();
    hookFillTextInto();
    hookStPaintText();
    hookIbcCleanSent();
    hookIBVB();
    cleanAllVoiceTextNodes();
    bindVoiceOrigClickSanitizer();
    observeVoiceOrigElements();
    hookRenderAiBody();
    hookCallEffMerge();
    hookToneClause();
    hookVTReady();
    hookIBCALL();
    hookFetchForNativeASR();
    bindGlobalMicTrigger();
    hookTranscribe();
    injectNativeSttOption();
    hookOpenConvTracker();
    hookOpenSheetForCross();
    hookGroupSaveAction();
    injectGroupCrossContextUI();

    // 监听 sheet-group 开启状态，秒级完成回显
    var grpSheet = document.getElementById('sheet-group');
    if (grpSheet && !grpSheet._crossObserved) {
      grpSheet._crossObserved = true;
      try {
        var obs = new MutationObserver(function (mutations) {
          for (var m = 0; m < mutations.length; m++) {
            if (mutations[m].attributeName === 'class' && grpSheet.classList.contains('open')) {
              injectGroupCrossContextUI();
              syncGroupCrossUIState(true);
              break;
            }
          }
        });
        obs.observe(grpSheet, { attributes: true, attributeFilter: ['class'] });
      } catch (e) {}
    }

    // 检查并触发 Service Worker 更新，防止浏览器加载过时的离线缓存
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (reg) {
            reg.update().catch(function () {});
          });
        }).catch(function () {});
      }
    } catch (e) {}

    setInterval(injectElToneUI, 400);
    setInterval(cleanAllVoiceTextNodes, 1200);
    setInterval(checkAndSyncCallASR, 1000);
    setInterval(injectNativeSttOption, 800);
    setInterval(injectGroupCrossContextUI, 800);
    setInterval(syncGroupCrossUIState, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
  } else {
    initExtension();
  }

  setTimeout(initExtension, 600);
  setTimeout(initExtension, 2000);

  console.log('[InternalBeyond Extension] ElevenLabs v3 custom tone extension active with auto-attachment engine.');
})();

/* ==========================================================================
   Blog 日志增强扩展（零侵入式插件）
   日志编辑器（Writing/Editing）增加极简美化「导入」图标按钮与文件拖拽支持
   ========================================================================== */
(function () {
  'use strict';

  function injectStyles() {
    if (document.getElementById('ib-custom-blog-enhancer-style')) return;
    var st = document.createElement('style');
    st.id = 'ib-custom-blog-enhancer-style';
    st.textContent = `
      /* 日志编辑页中的极简导入按钮 - 严格对齐旁边的 select 下拉框 */
      .ib-blog-import-btn {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        height: 42px;
        width: 42px;
        padding: 0;
        border: 1px solid var(--line, rgba(120, 140, 170, 0.2));
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.5);
        color: var(--tx, #2c3345);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        flex-shrink: 0;
        box-sizing: border-box;
      }
      body.theme-infernal .ib-blog-import-btn {
        background: rgba(14, 22, 42, 0.5);
      }
      .ib-blog-import-btn:hover {
        background: var(--acc, #3b82f6);
        color: #ffffff;
        border-color: var(--acc, #3b82f6);
        transform: translateY(-1px);
      }
      .ib-blog-import-btn:active {
        transform: translateY(0) scale(0.95);
      }
      .ib-blog-import-btn svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
        stroke-width: 1.8;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      /* 拖拽释放提示区域高亮 */
      .ed-body-l.drag-over,
      .mtx.m-ed-body.drag-over {
        background: rgba(59, 130, 246, 0.08) !important;
        outline: 2px dashed var(--acc, #3b82f6) !important;
        outline-offset: -3px !important;
      }
    `;
    document.head.appendChild(st);
  }

  function applyFileContent(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result || '';
      var titleEl = document.getElementById('m-ed-title');
      var contentEl = document.getElementById('m-ed-content');
      var formatEl = document.getElementById('m-ed-format');

      if (contentEl) {
        contentEl.value = text;
        contentEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 若当前标题为空，则自动提取文件名作为标题
      if (titleEl && !titleEl.value.trim()) {
        var name = file.name.replace(/\.[^/.]+$/, '');
        titleEl.value = name;
        titleEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 根据文件扩展名自动切换 Markdown / 纯文本
      var isMd = /\.(md|markdown)$/i.test(file.name);
      if (formatEl) {
        formatEl.value = isMd ? 'md' : 'txt';
        formatEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var fmtBtn = document.querySelector('.m-fmt[data-fmt="' + (isMd ? 'md' : 'txt') + '"]');
      if (fmtBtn) {
        fmtBtn.click();
      }

      if (typeof window.toast === 'function') {
        window.toast('已导入: ' + file.name);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function setupBlogEditorImport() {
    // 隐藏的文件选择控件（单例）
    var fileInput = document.getElementById('ib-blog-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.txt,.md,.markdown,text/plain,text/markdown';
      fileInput.style.display = 'none';
      fileInput.id = 'ib-blog-file-input';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          applyFileContent(this.files[0]);
        }
      });
    }

    // 1. 移动端主编辑器容器：#sub-blog-editor .ed-meta-row
    var metaRow = document.querySelector('#sub-blog-editor .ed-meta-row');
    if (metaRow && !metaRow.querySelector('.ib-blog-import-btn')) {
      var importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.className = 'ib-blog-import-btn';
      importBtn.title = '导入文件 (.txt / .md)';
      importBtn.setAttribute('aria-label', '导入');
      // 纯净的文件上传图标（托盘 + 向上箭头）
      importBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      `;
      importBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.value = '';
        fileInput.click();
      });
      metaRow.appendChild(importBtn);
    }

    // 2. 拖拽支持
    var contentEl = document.getElementById('m-ed-content');
    if (contentEl && !contentEl._ibDropBound) {
      contentEl._ibDropBound = true;
      contentEl.addEventListener('dragover', function (e) {
        e.preventDefault();
        contentEl.classList.add('drag-over');
      });
      contentEl.addEventListener('dragleave', function (e) {
        e.preventDefault();
        contentEl.classList.remove('drag-over');
      });
      contentEl.addEventListener('drop', function (e) {
        e.preventDefault();
        contentEl.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          applyFileContent(e.dataTransfer.files[0]);
        }
      });
    }
  }

  function initEnhancer() {
    injectStyles();
    setupBlogEditorImport();

    // 安全守护 edStatsM，防止 DOM 未就绪或局部缺失时抛出 null textContent 异常
    if (typeof window.edStatsM === 'function' && !window.edStatsM._guarded) {
      var origEdStatsM = window.edStatsM;
      var safeEdStatsM = function () {
        try {
          var content = document.getElementById('m-ed-content');
          var chars = document.getElementById('m-ed-chars');
          var lines = document.getElementById('m-ed-lines');
          var size = document.getElementById('m-ed-size');
          if (!content) return;
          var v = content.value || '';
          if (chars) chars.textContent = v.length;
          if (lines) lines.textContent = v ? v.split('\n').length : 0;
          if (size) size.textContent = (new Blob([v]).size / 1024).toFixed(1) + ' KB';
        } catch (e) {
          try { origEdStatsM(); } catch (err) {}
        }
      };
      safeEdStatsM._guarded = true;
      window.edStatsM = safeEdStatsM;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancer);
  } else {
    initEnhancer();
  }

  // 周期性与 DOM 变动持续检测挂载
  setInterval(initEnhancer, 300);

  var observer = new MutationObserver(function () {
    initEnhancer();
  });
  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  console.log('[InternalBeyond Extension] Blog Import Enhancer active.');
})();

/* ==========================================================================
   酒馆式服务端数据持久化与无感多端同步引擎 (Tavern-Style Cloud Storage)
   - 纯非侵入式：拦截 dbPut / dbDelete，实现按需增量推送
   - 开屏/切回前台轻量比对拉取，换手机/换电脑数据全自动无感恢复
   - 自带右上角精致状态灯与快捷菜单
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_API_BASE = '/api/v2/storage';
  const LOCAL_META_KEY = 'ib_server_sync_meta_v2';
  
  // 增量变动队列
  let pendingMutations = [];
  let flushTimer = null;
  let isSyncing = false;
  let isPulling = false;
  let syncIndicatorEl = null;

  // 状态管理
  const SyncState = {
    status: 'connecting', // 'ready' | 'syncing' | 'error' | 'offline'
    lastSyncTime: 0,
    serverModified: 0,
    itemCount: 0,
    errorMsg: ''
  };

  // 工具：获取记录的唯一键
  function extractKey(val, storeName) {
    if (val && typeof val === 'object') {
      if (val.id !== undefined && val.id !== null) return val.id;
      if (val.key !== undefined && val.key !== null) return val.key;
      if (val.name !== undefined && val.name !== null) return val.name;
    }
    return val;
  }

  // 1. 增量排队推送（防抖 800ms，保证打字/连发消息时合并为一次请求）
  function queueMutation(mutation) {
    if (!mutation || !mutation.store) return;
    pendingMutations.push(mutation);
    updateIndicatorUI('syncing', '正在写入服务器...');

    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushPendingMutations();
    }, 800);
  }

  async function flushPendingMutations() {
    if (pendingMutations.length === 0 || isSyncing) return;
    const batch = pendingMutations.slice();
    pendingMutations = [];
    isSyncing = true;
    updateIndicatorUI('syncing', `正在推送 ${batch.length} 项数据...`);

    try {
      const res = await fetch(`${STORAGE_API_BASE}/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: batch })
      });
      const json = await res.json();
      if (json.ok) {
        SyncState.status = 'ready';
        SyncState.lastSyncTime = Date.now();
        SyncState.serverModified = json.lastModified || Date.now();
        localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ lastCheck: SyncState.lastSyncTime, mtime: SyncState.serverModified }));
        updateIndicatorUI('ready', '服务器存储已实时同步');
      } else {
        throw new Error(json.error || '推送失败');
      }
    } catch (e) {
      console.warn('[ServerSync] Patch failed, re-queueing:', e);
      pendingMutations = batch.concat(pendingMutations);
      SyncState.status = 'error';
      SyncState.errorMsg = e.message;
      updateIndicatorUI('error', '同步暂未连接到服务器');
    } finally {
      isSyncing = false;
      if (pendingMutations.length > 0) {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flushPendingMutations, 3000);
      }
    }
  }

  // 2. 劫持底层 IndexedDB 核心方法实现非侵入式增量捕获
  function patchDatabaseOperations() {
    // 监听 dbPut
    if (typeof window.dbPut === 'function' && !window.dbPut.__ib_synced) {
      const originalDbPut = window.dbPut;
      const patchedPut = async function (store, value) {
        const res = await originalDbPut.apply(this, arguments);
        try {
          const key = extractKey(value, store);
          queueMutation({ type: 'put', store, key, value });
        } catch (err) {
          console.error('[ServerSync] Hook put error:', err);
        }
        return res;
      };
      patchedPut.__ib_synced = true;
      window.dbPut = patchedPut;
    }

    // 监听 dbPutAll
    if (typeof window.dbPutAll === 'function' && !window.dbPutAll.__ib_synced) {
      const originalDbPutAll = window.dbPutAll;
      const patchedPutAll = async function (store, items) {
        const res = await originalDbPutAll.apply(this, arguments);
        try {
          if (Array.isArray(items)) {
            for (const item of items) {
              const key = extractKey(item, store);
              queueMutation({ type: 'put', store, key, value: item });
            }
          }
        } catch (err) {
          console.error('[ServerSync] Hook putAll error:', err);
        }
        return res;
      };
      patchedPutAll.__ib_synced = true;
      window.dbPutAll = patchedPutAll;
    }

    // 监听 dbDelete
    if (typeof window.dbDelete === 'function' && !window.dbDelete.__ib_synced) {
      const originalDbDelete = window.dbDelete;
      const patchedDelete = async function (store, key) {
        const res = await originalDbDelete.apply(this, arguments);
        try {
          queueMutation({ type: 'del', store, key });
        } catch (err) {
          console.error('[ServerSync] Hook delete error:', err);
        }
        return res;
      };
      patchedDelete.__ib_synced = true;
      window.dbDelete = patchedDelete;
    }

    // 监听 dbDeleteMany
    if (typeof window.dbDeleteMany === 'function' && !window.dbDeleteMany.__ib_synced) {
      const originalDbDeleteMany = window.dbDeleteMany;
      const patchedDeleteMany = async function (store, keys) {
        const res = await originalDbDeleteMany.apply(this, arguments);
        try {
          if (Array.isArray(keys)) {
            for (const key of keys) {
              queueMutation({ type: 'del', store, key });
            }
          }
        } catch (err) {
          console.error('[ServerSync] Hook deleteMany error:', err);
        }
        return res;
      };
      patchedDeleteMany.__ib_synced = true;
      window.dbDeleteMany = patchedDeleteMany;
    }
  }

  // 3. 核心比对与拉取逻辑（打开网页或换设备时执行）
  async function checkAndSyncFromRemote(force = false) {
    if (isPulling) return;
    isPulling = true;
    updateIndicatorUI('syncing', '正在检查服务器数据...');

    try {
      const res = await fetch(`${STORAGE_API_BASE}/manifest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { meta } = await res.json();
      
      let localMeta = {};
      try {
        localMeta = JSON.parse(localStorage.getItem(LOCAL_META_KEY) || '{}');
      } catch (e) {}

      const serverLastModified = meta?.lastModified || 0;
      const localLastMtime = localMeta.mtime || 0;
      const storeKeys = Object.keys(meta?.stores || {});

      // 情况 A：服务器上还是全新的，但本地已经有数据了 -> 自动全量初始化到服务器
      if (storeKeys.length === 0 || serverLastModified === 0) {
        console.log('[ServerSync] Remote is empty. Uploading local baseline to server...');
        await uploadFullLocalDump();
        return;
      }

      // 情况 B：服务器数据更新，或者新设备第一次打开，或者用户手动强制刷新
      if (force || serverLastModified > localLastMtime || !localMeta.lastCheck) {
        console.log('[ServerSync] Remote has newer data or initial visit. Pulling from server...');
        updateIndicatorUI('syncing', '正在同步服务器最新数据...');
        
        const pullRes = await fetch(`${STORAGE_API_BASE}/pull`);
        const pullData = await pullRes.json();
        
        if (pullData.ok && pullData.stores) {
          await restoreStoresToLocalIndexedDB(pullData.stores);
          SyncState.lastSyncTime = Date.now();
          SyncState.serverModified = serverLastModified;
          localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ lastCheck: SyncState.lastSyncTime, mtime: serverLastModified }));
          updateIndicatorUI('ready', '服务器数据已同步至最新');
        }
      } else {
        // 数据完全一致
        SyncState.status = 'ready';
        SyncState.lastSyncTime = Date.now();
        updateIndicatorUI('ready', '数据与服务器一致');
      }
    } catch (e) {
      console.warn('[ServerSync] Check manifest error:', e);
      SyncState.status = 'offline';
      SyncState.errorMsg = e.message;
      updateIndicatorUI('offline', '未连接到自建服务存储');
    } finally {
      isPulling = false;
    }
  }

  // 将服务器返回的数据平滑写入本地 IndexedDB
  async function restoreStoresToLocalIndexedDB(stores) {
    if (!stores || typeof stores !== 'object') return;
    const req = window.indexedDB.open('InternalBeyondDB');
    return new Promise((resolve) => {
      req.onsuccess = (e) => {
        const db = e.target.result;
        const availableStores = Array.from(db.objectStoreNames);
        let completed = 0;
        const storeEntries = Object.entries(stores).filter(([s]) => availableStores.includes(s));

        if (storeEntries.length === 0) {
          resolve();
          return;
        }

        for (const [storeName, dataMap] of storeEntries) {
          try {
            const tx = db.transaction(storeName, 'readwrite');
            const os = tx.objectStore(storeName);
            // 写入所有记录
            for (const val of Object.values(dataMap)) {
              try {
                os.put(val);
              } catch (putErr) {}
            }
            tx.oncomplete = () => {
              completed++;
              if (completed >= storeEntries.length) {
                resolve();
              }
            };
            tx.onerror = () => {
              completed++;
              if (completed >= storeEntries.length) {
                resolve();
              }
            };
          } catch (txErr) {
            completed++;
            if (completed >= storeEntries.length) resolve();
          }
        }
      };
      req.onerror = () => resolve();
    });
  }

  // 将当前本地全部数据打包备份上传至服务器（初始化用）
  async function uploadFullLocalDump() {
    updateIndicatorUI('syncing', '正在上传初次全量数据...');
    try {
      const dump = {};
      const targetStores = [
        'about', 'chatThreads', 'chatMessages', 'apiSettings', 'apiConfigs',
        'memories', 'autoMemory', 'calEvents', 'calNotes', 'calLedger',
        'posts', 'letters', 'groups'
      ];

      for (const s of targetStores) {
        if (typeof window.dbGetAll === 'function') {
          try {
            const list = await window.dbGetAll(s);
            if (Array.isArray(list) && list.length > 0) {
              dump[s] = list;
            }
          } catch (e) {}
        }
      }

      if (Object.keys(dump).length === 0) {
        updateIndicatorUI('ready', '存储已就绪 (空状态)');
        return;
      }

      const dumpSizeStr = JSON.stringify(dump);
      const dumpSize = dumpSizeStr.length;

      const res = await fetch(`${STORAGE_API_BASE}/full-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: dumpSizeStr
      });
      const json = await res.json();
      if (json.ok) {
        SyncState.status = 'ready';
        SyncState.lastSyncTime = Date.now();
        SyncState.serverModified = json.lastModified;
        
        let localMeta = {};
        try { localMeta = JSON.parse(localStorage.getItem(LOCAL_META_KEY) || '{}'); } catch(e){}
        localMeta.lastCheck = SyncState.lastSyncTime;
        localMeta.mtime = json.lastModified;
        
        if (!localMeta.manualBackups) localMeta.manualBackups = [];
        localMeta.manualBackups.unshift({ time: Date.now(), size: dumpSize });
        if (localMeta.manualBackups.length > 5) localMeta.manualBackups.pop(); // Keep last 5
        
        localStorage.setItem(LOCAL_META_KEY, JSON.stringify(localMeta));
        updateIndicatorUI('ready', '数据已成功推送至服务器');
      }
    } catch (err) {
      console.warn('[ServerSync] Upload dump error:', err);
      updateIndicatorUI('error', '推送出错');
    }
  }

  // 4. UI 状态指示灯与抽屉面板 (集成在数据备份页)
  function createIndicatorUI() {
    if (document.getElementById('ib-server-sync-indicator')) {
      return;
    }

    // 寻找 Data 页面的聊天记录管理标签
    const secLabels = document.querySelectorAll('#sec-data-io .sec-label');
    let targetLabel = null;
    for (let i = 0; i < secLabels.length; i++) {
      if (secLabels[i].textContent.includes('聊天记录管理')) {
        targetLabel = secLabels[i];
        break;
      }
    }

    if (!targetLabel) {
      return; // 找不到页面结构，直接退出
    }

    // 创建自建服务器同步区
    const newSecLabel = document.createElement('div');
    newSecLabel.className = 'sec-label';
    newSecLabel.textContent = '自建云存储无缝同步';

    const el = document.createElement('div');
    el.id = 'ib-server-sync-indicator';
    el.className = 'card fx-card';
    el.innerHTML = `
      <div class="fx-ico" style="background: rgba(16,185,129,0.15); color: #10b981;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
        </svg>
      </div>
      <div class="cm-sub-t" style="display:flex;align-items:center;gap:6px;">
        云存储状态
        <span id="ib-sync-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>
        <span id="ib-sync-text" style="font-size:12px;font-weight:normal;color:var(--tx2);">云存储就绪</span>
      </div>
      <p class="hint" style="margin-top:0">你的任何增删改操作都会自动、即时增量推送到你的专属服务器。这不消耗你的配额，彻底摆脱换设备导致的数据丢失。服务器端由酒馆式独立文件构成。</p>
      
      <div style="display:flex;gap:10px;margin:8px 0 0">
        <button class="btn" style="flex:1; background:var(--bg3);" id="ib-sync-btn-pull">对比并且更新</button>
        <button class="btn primary" style="flex:1" id="ib-sync-btn-push">强制推送数据</button>
      </div>
    `;

    targetLabel.parentNode.insertBefore(newSecLabel, targetLabel);
    targetLabel.parentNode.insertBefore(el, targetLabel);

    syncIndicatorEl = el;

    const btnPull = el.querySelector('#ib-sync-btn-pull');
    const btnPush = el.querySelector('#ib-sync-btn-push');

    btnPull.addEventListener('click', async () => {
      btnPull.textContent = '比对更新中...';
      await checkAndSyncFromRemote(true);
      btnPull.textContent = '已更新完成！';
      setTimeout(() => {
        btnPull.textContent = '对比并且更新';
      }, 1500);
    });

    btnPush.addEventListener('click', async () => {
      if (confirm('确定要将当前设备的本地数据完整同步覆盖到服务器吗？\n注：通常不需要手动推送，日常操作已自动实时同步。')) {
        btnPush.textContent = '正在打包上传...';
        await uploadFullLocalDump();
        btnPush.textContent = '已推送至服务器';
        setTimeout(() => {
          btnPush.textContent = '强制推送数据';
        }, 1500);
      }
    });
  }

  function updateIndicatorUI(status, label) {
    if (!syncIndicatorEl) return;
    const dot = syncIndicatorEl.querySelector('#ib-sync-dot');
    const txt = syncIndicatorEl.querySelector('#ib-sync-text');
    
    if (txt) txt.textContent = label || '云存储就绪';

    if (dot) {
      if (status === 'ready') {
        dot.style.background = '#10b981';
        dot.style.boxShadow = '0 0 6px #10b981';
      } else if (status === 'syncing') {
        dot.style.background = '#3b82f6';
        dot.style.boxShadow = '0 0 8px #3b82f6';
      } else if (status === 'offline') {
        dot.style.background = '#eab308';
        dot.style.boxShadow = 'none';
      } else {
        dot.style.background = '#ef4444';
        dot.style.boxShadow = 'none';
      }
    }
  }

  // 5. 初始化启动
  function initSyncEngine() {
    createIndicatorUI();
    patchDatabaseOperations();

    // 延时 600ms 待主应用 IndexedDB 就绪后进行比对拉取
    setTimeout(() => {
      createIndicatorUI();
      patchDatabaseOperations();
      checkAndSyncFromRemote();
    }, 600);

    // 当用户从其他应用切回浏览器窗口时，自动检查是否有其他设备发来的更新
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncFromRemote();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncEngine);
  } else {
    initSyncEngine();
  }

  window.IBSyncEngine = {
    checkAndSync: checkAndSyncFromRemote,
    uploadFull: uploadFullLocalDump,
    getState: () => SyncState
  };
})();

/* ==========================================================================
   Blog 分类添加修复补丁 (非侵入式热修复)
   解决原版 DOM 中 #m-cat-add / #m-cat-new 存在重复 ID 导致抽屉内点击无效的问题
   ========================================================================== */
(function() {
  'use strict';

  async function handleAddCategory(triggerEl) {
    let inputEl = null;
    if (triggerEl) {
      const container = triggerEl.closest('.btoc-add, #sheet-blog-cat, #blog-side');
      if (container) {
        inputEl = container.querySelector('input');
      }
    }
    if (!inputEl) {
      inputEl = document.querySelector('#blog-side input#m-cat-new') || 
                document.querySelector('.btoc-add input') || 
                document.querySelector('#m-cat-new');
    }

    const n = inputEl ? inputEl.value.trim() : '';
    if (!n) {
      if (typeof window.toast === 'function') window.toast('请输入分类名称');
      return;
    }

    try {
      if (typeof window.dbPut === 'function') {
        await window.dbPut('categories', { name: n });
      }
      
      // 清空所有同名输入框
      document.querySelectorAll('#m-cat-new, .btoc-add input').forEach(el => {
        el.value = '';
      });

      if (typeof window.blogLoadCats === 'function') {
        await window.blogLoadCats();
      }
      if (typeof window.blogRender === 'function') {
        await window.blogRender();
      }
      if (typeof window.toast === 'function') {
        window.toast('分类「' + n + '」已添加');
      }
    } catch (err) {
      console.error('[Blog Cat Patch] 添加分类异常:', err);
      if (typeof window.toast === 'function') {
        window.toast('添加失败: ' + (err.message || err));
      }
    }
  }

  // 事件委托捕获所有添加分类按钮的点击事件
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('#m-cat-add, .btoc-add button, #sheet-blog-cat button.primary');
    if (btn) {
      ev.preventDefault();
      ev.stopPropagation();
      handleAddCategory(btn);
    }
  }, true);

  // 回车键直接添加
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      const inp = ev.target.closest('#m-cat-new, .btoc-add input');
      if (inp) {
        ev.preventDefault();
        ev.stopPropagation();
        handleAddCategory(inp);
      }
    }
  }, true);
})();

/* ==========================================================================
   AI 日程助手与时间表联动补丁 (非侵入式热补丁)
   支持 AI 角色在对话时自动或通过标签记录跨时间段日程与【早安/晚安】打卡
   ========================================================================== */
(function() {
  'use strict';

  function parseTimeSpanMinutes(start, end) {
    if (!start || !end) return 60;
    const sParts = String(start).split(':');
    const eParts = String(end).split(':');
    const sMin = parseInt(sParts[0]||0)*60 + parseInt(sParts[1]||0);
    const eMin = parseInt(eParts[0]||0)*60 + parseInt(eParts[1]||0);
    return eMin >= sMin ? (eMin - sMin) : (eMin + 1440 - sMin);
  }

  function getLogicDateStr(specifiedDate, startHour) {
    if (specifiedDate) return specifiedDate;
    const d = new Date();
    // 00:00 ~ 05:59 属于前一天的作息周期
    if (d.getHours() < 6) {
      d.setDate(d.getDate() - 1);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getCurTimeString() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // 从存储中获取所有日程记录 (localStorage 优先以保瞬时响应，兼容 apiSettings)
  async function getAllSchedulesFromStorage() {
    let list = null;
    try {
      const raw = localStorage.getItem('my_time_schedules');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch(e) {}

    if (!list) {
      try {
        if (typeof window.dbGet === 'function') {
          const row = await window.dbGet('apiSettings', 'app_timeline_cal_my_time_schedules');
          const candidate = row ? (row.val || row.v) : null;
          if (Array.isArray(candidate) && candidate.length > 0) {
            list = candidate;
          }
        }
      } catch(e2) {}
    }

    const safeList = Array.isArray(list) ? list.filter(it => it && typeof it === 'object') : [];
    if (safeList.length > 0) {
      try { localStorage.setItem('my_time_schedules', JSON.stringify(safeList)); } catch(e3) {}
    }
    return safeList;
  }

  // 保存所有日程记录到存储并广播更新事件
  async function saveAllSchedulesToStorage(list) {
    if (!Array.isArray(list)) list = [];
    try {
      localStorage.setItem('my_time_schedules', JSON.stringify(list));
    } catch(e) {}

    try {
      if (typeof window.dbPut === 'function') {
        await window.dbPut('apiSettings', {
          id: 'app_timeline_cal_my_time_schedules',
          app: 'timeline_cal',
          key: 'my_time_schedules',
          val: list,
          v: list,
          updated: Date.now()
        });
      }
    } catch(e) {}

    try {
      window.dispatchEvent(new CustomEvent('ib-schedule-updated', { detail: { list: list } }));
    } catch(e) {}
  }

  // 记录单条日程到存储
  async function appendScheduleRecord(record) {
    try {
      let list = await getAllSchedulesFromStorage();

      // 防抖去重：如果 2 分钟内已有相同 category 和时间的记录则跳过
      const isDuplicated = list.some(it => {
        return it.date === record.date && it.category === record.category && (
          (it.startTime === record.startTime && it.endTime === record.endTime) ||
          (it.time && it.time === record.time) ||
          (Math.abs((it.created || 0) - (record.created || 0)) < 120000)
        );
      });
      if (isDuplicated) return false;

      list.push(record);
      await saveAllSchedulesToStorage(list);
      return true;
    } catch(err) {
      console.warn('[Schedule Patch] 保存日程异常:', err);
      return false;
    }
  }

  // 编辑已存在的日程记录
  async function editScheduleRecord(target, updates) {
    try {
      let list = await getAllSchedulesFromStorage();
      if (!list || list.length === 0) return null;

      const targetStr = String(target || updates.target || updates.title || updates.old_title || '').trim().toLowerCase();
      const dateStr = updates.date ? getLogicDateStr(updates.date) : null;

      let idx = -1;
      if (updates.id) {
        idx = list.findIndex(it => it.id === updates.id);
      }
      if (idx === -1 && targetStr) {
        idx = list.findIndex(it => {
          if (dateStr && it.date !== dateStr) return false;
          const t = String(it.title || '').toLowerCase();
          const c = String(it.category || '').toLowerCase();
          const st = String(it.startTime || it.time || '');
          return t.includes(targetStr) || c.includes(targetStr) || st.includes(targetStr) || targetStr.includes(t);
        });
      }
      if (idx === -1 && targetStr) {
        const today = getLogicDateStr();
        idx = list.findIndex(it => (it.date === today) && String(it.title || '').toLowerCase().includes(targetStr));
      }
      if (idx === -1) return null;

      const oldItem = list[idx];
      const newItem = { ...oldItem };

      if (updates.title || updates.new_title) newItem.title = updates.title || updates.new_title;
      if (updates.category || updates.new_category) {
        let cat = updates.category || updates.new_category;
        if (cat.includes('学') || cat.includes('读') || cat.includes('课') || cat.includes('书')) cat = '学习';
        else if (cat.includes('码') || cat.includes('code') || cat.includes('程序') || cat.includes('开发')) cat = '写代码';
        else if (cat.includes('乐') || cat.includes('游') || cat.includes('影') || cat.includes('漫')) cat = '娱乐';
        else if (cat.includes('玩') || cat.includes('出') || cat.includes('逛') || cat.includes('运动')) cat = '出去玩';
        newItem.category = cat;
      }
      if (updates.start || updates.new_start || updates.time) {
        let s = updates.start || updates.new_start || updates.time;
        if (s.length === 4 && s[1] === ':') s = '0' + s;
        newItem.startTime = s;
        if (newItem.isSpecial) newItem.time = s;
      }
      if (updates.end || updates.new_end) {
        let e = updates.end || updates.new_end;
        if (e.length === 4 && e[1] === ':') e = '0' + e;
        newItem.endTime = e;
      }
      if (newItem.startTime && newItem.endTime && !newItem.isSpecial) {
        newItem.duration = parseTimeSpanMinutes(newItem.startTime, newItem.endTime);
      }
      if (updates.date || updates.new_date) {
        newItem.date = getLogicDateStr(updates.date || updates.new_date, newItem.startTime);
      }

      newItem.updated = Date.now();
      list[idx] = newItem;

      await saveAllSchedulesToStorage(list);
      return newItem;
    } catch(err) {
      console.warn('[Schedule Patch] 修改日程异常:', err);
      return null;
    }
  }

  // 删除指定的日程记录
  async function deleteScheduleRecord(targetInfo) {
    try {
      let list = await getAllSchedulesFromStorage();
      if (!list || list.length === 0) return null;

      const targetStr = String(targetInfo.target || targetInfo.title || targetInfo.id || '').trim().toLowerCase();
      const dateStr = targetInfo.date ? getLogicDateStr(targetInfo.date) : null;

      let idx = -1;
      if (targetInfo.id) {
        idx = list.findIndex(it => it.id === targetInfo.id);
      }
      if (idx === -1 && targetStr) {
        idx = list.findIndex(it => {
          if (dateStr && it.date !== dateStr) return false;
          const t = String(it.title || '').toLowerCase();
          const c = String(it.category || '').toLowerCase();
          const st = String(it.startTime || it.time || '');
          return t.includes(targetStr) || c.includes(targetStr) || st.includes(targetStr) || targetStr.includes(t);
        });
      }
      if (idx === -1 && targetStr) {
        const today = getLogicDateStr();
        idx = list.findIndex(it => (it.date === today) && String(it.title || '').toLowerCase().includes(targetStr));
      }
      if (idx === -1) return null;

      const deletedItem = list.splice(idx, 1)[0];
      await saveAllSchedulesToStorage(list);
      return deletedItem;
    } catch(err) {
      console.warn('[Schedule Patch] 删除日程异常:', err);
      return null;
    }
  }

  // 格式化今日日程摘要供 AI 参考
  async function getTodayScheduleSummary() {
    try {
      const curDate = getLogicDateStr();
      const list = await getAllSchedulesFromStorage();
      const todays = list.filter(it => it.date === curDate);
      if (!todays.length) return '';
      todays.sort((a, b) => String(a.startTime || a.time || '').localeCompare(String(b.startTime || b.time || '')));
      const lines = todays.map(it => {
        if (it.isSpecial || it.category === '早安' || it.category === '晚安') {
          return `${it.time || it.startTime || ''} ${it.category}打卡（${it.title}）`;
        }
        return `${it.startTime}-${it.endTime} [${it.category}] ${it.title}`;
      });
      return `【今日日历日程安排】\n${lines.join('；')}`;
    } catch(e) {
      return '';
    }
  }

  // 日历日程助手系统提示词与能力说明
  const _SCHEDULE_AI_INSTR = `\n\n【日历应用操作工具与规范】
你具备操作用户「日历」应用的管理权限（四大分类：学习、写代码、娱乐、出去玩；特殊打卡：早安、晚安）。
【重要规范】：
1. 严禁逢早安、晚安问候就机械化自动打卡！日常打招呼、闲聊、互道早晚安时请正常对话，切勿呆板打卡。
2. 打卡与记日程必须由你主动触发工具才能打卡。只有在用户明确提出要打卡、记日程、修改或删除日程，或者在具体的日程规划对话中确实需要为你或用户记录时，才调用工具标签。
3. 若用户未明确指明具体的事项名称（例如只说"记个学习"或"下午2点到4点看书"），请完全不要填 title 属性（保持留空或不写 title 属性），系统会自动按分类规范呈现；只有当用户明确指定了具体项目/书名时才填写（如 title="高数复习"）。

工具调用标签格式（在回复文本中自然输出，前端会自动执行并以原生操作工具条呈现）：
1. 记录时间段日程：
<ws_schedule category="学习|写代码|娱乐|出去玩" start="HH:MM" end="HH:MM" title="具体名称(可选)" date="YYYY-MM-DD(可选)" />
- category（必填）：只能是「学习」、「写代码」、「娱乐」、「出去玩」四者之一
- start / end（必填）：开始与结束时间，24小时制（如 "09:00", "14:30"）
- title（选填）：若用户未明确指明具体项目，请不要填写 title 属性
- date（选填）：日期 YYYY-MM-DD，缺省为今天

2. 特殊时刻打卡（起床/入睡）：
<ws_schedule category="早安|晚安" time="HH:MM" />
- 仅在明确打卡、记录作息或商定作息打卡时按需触发，日常普通问候请勿调用。

3. 修改日程：
<ws_cal_edit target="原事项名称或分类" title="新名称(可选)" category="新分类(可选)" start="HH:MM(可选)" end="HH:MM(可选)" date="YYYY-MM-DD(可选)" />
- target（必填）：要修改的原事项、分类或时间

4. 删除日程：
<ws_cal_delete target="要删除的事项名称或分类" date="YYYY-MM-DD(可选)" />
- target（必填）：要删除的事项、分类或时间`;

  // 供 fetch 拦截器与 buildCalBlock 注入提示词
  window._getSchedulePromptInjection = async function() {
    try {
      const summary = await getTodayScheduleSummary();
      return (summary ? (summary + '\n') : '') + _SCHEDULE_AI_INSTR;
    } catch(e) {
      return _SCHEDULE_AI_INSTR;
    }
  };

  // Hook 原生 buildCalBlock，自动并入时间表背景与日程助手能力
  function hookBuildCalBlock() {
    if (typeof window.buildCalBlock === 'function' && !window.buildCalBlock._schHooked) {
      const origBuildCalBlock = window.buildCalBlock;
      window.buildCalBlock = async function(cfg) {
        let base = '';
        try { base = await origBuildCalBlock.apply(this, arguments); } catch(e) {}
        try {
          const schInj = await window._getSchedulePromptInjection();
          if (schInj) {
            base = base ? (base + '\n' + schInj) : schInj;
          }
        } catch(e) {}
        return base;
      };
      window.buildCalBlock._schHooked = true;
    }
  }

  // 监听所有 AI 消息生成与落库
  async function processAIMessageForSchedule(msg, dbPutFunc) {
    if (!msg || !msg.content) return;
    const text = String(msg.content);

    // 严格只匹配显式的日历 XML 工具标签，禁止无端自动打卡
    const reg = /<(?:ws_schedule|ws_cal_schedule|ws_cal_add|ws_cal_edit|ws_cal_delete|ws_cal_del|ws_schedule_edit|ws_schedule_delete|ws_schedule_del)\b([^>]*)\/?>/gi;
    if (!reg.test(text)) return;
    reg.lastIndex = 0;

    let match;
    let addedCount = 0;
    const addedOpRecords = [];

    while ((match = reg.exec(text)) !== null) {
      const tagFull = match[0] || '';
      const tagName = ((tagFull.match(/^<([^\s>]+)/) || [])[1] || '').toLowerCase();
      const attrs = match[1] || '';
      const getAttr = (name) => {
        const m = attrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
        return m ? m[1].trim() : '';
      };

      const action = (getAttr('action') || '').toLowerCase();
      const isEdit = tagName.includes('edit') || action === 'edit' || action === 'update' || action === 'modify';
      const isDelete = tagName.includes('del') || tagName.includes('delete') || action === 'delete' || action === 'del' || action === 'remove';

      if (isDelete) {
        const target = getAttr('target') || getAttr('title') || getAttr('id') || getAttr('old_title');
        const targetDate = getAttr('date');
        const deleted = await deleteScheduleRecord({ target, date: targetDate, id: getAttr('id') });
        if (deleted) {
          addedCount++;
          addedOpRecords.push({
            ok: true,
            label: '日历便笺 · 删除日程',
            detail: `${deleted.date} 已删除：${deleted.title || deleted.category} (${deleted.startTime || deleted.time || ''})`
          });
        }
      } else if (isEdit) {
        const target = getAttr('target') || getAttr('old_title') || getAttr('id');
        const updates = {
          target: target,
          title: getAttr('title') || getAttr('new_title'),
          category: getAttr('category') || getAttr('kind') || getAttr('new_category'),
          start: getAttr('start') || getAttr('new_start') || getAttr('time'),
          end: getAttr('end') || getAttr('new_end'),
          date: getAttr('date') || getAttr('new_date'),
          id: getAttr('id')
        };
        const edited = await editScheduleRecord(target, updates);
        if (edited) {
          addedCount++;
          addedOpRecords.push({
            ok: true,
            label: '日历便笺 · 修改日程',
            detail: `${edited.date} ${edited.startTime || edited.time || ''} ${edited.title || edited.category} [${edited.category}]`
          });
        }
      } else {
        const rawTitle = getAttr('title') || '';
        let category = getAttr('category') || getAttr('kind') || '';
        let start = getAttr('start') || getAttr('time') || getCurTimeString();
        let end = getAttr('end') || '';
        const date = getLogicDateStr(getAttr('date'), start);

        // 标准化时间格式 (如 9:00 -> 09:00)
        if (start && start.length === 4 && start[1] === ':') start = '0' + start;
        if (end && end.length === 4 && end[1] === ':') end = '0' + end;

        const isMorning = category.includes('早') || category.includes('醒') || category.includes('起');
        const isNight = category.includes('晚') || category.includes('睡') || category.includes('休') || category.includes('眠');

        if (isMorning) {
          const ok = await appendScheduleRecord({
            id: 'sch_spec_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            date: date,
            title: (rawTitle && rawTitle !== '早安') ? rawTitle : '早安 · 起床打卡',
            category: '早安',
            time: start,
            startTime: start,
            endTime: start,
            duration: 0,
            isSpecial: true,
            byAi: true,
            author: msg.friendId || 'AI',
            created: Date.now()
          });
          if (ok) {
            addedCount++;
            addedOpRecords.push({
              ok: true,
              label: '日历便笺 · 早安打卡',
              detail: `${date} ${start} 早安 · 起床打卡`
            });
          }
        } else if (isNight) {
          const ok = await appendScheduleRecord({
            id: 'sch_spec_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            date: date,
            title: (rawTitle && rawTitle !== '晚安') ? rawTitle : '晚安 · 入睡打卡',
            category: '晚安',
            time: start,
            startTime: start,
            endTime: start,
            duration: 0,
            isSpecial: true,
            byAi: true,
            author: msg.friendId || 'AI',
            created: Date.now()
          });
          if (ok) {
            addedCount++;
            addedOpRecords.push({
              ok: true,
              label: '日历便笺 · 晚安打卡',
              detail: `${date} ${start} 晚安 · 入睡打卡`
            });
          }
        } else {
          // 标准化分类名称
          if (category.includes('学') || category.includes('读') || category.includes('课') || category.includes('书') || category.includes('练')) category = '学习';
          else if (category.includes('码') || category.includes('code') || category.includes('程序') || category.includes('开发') || category.includes('bug')) category = '写代码';
          else if (category.includes('乐') || category.includes('游') || category.includes('影') || category.includes('漫') || category.includes('剧') || category.includes('歌')) category = '娱乐';
          else if (category.includes('玩') || category.includes('出') || category.includes('逛') || category.includes('运动') || category.includes('跑') || category.includes('球')) category = '出去玩';
          else category = '学习';

          if (!end) {
            const sParts = start.split(':');
            const sMin = parseInt(sParts[0]||0)*60 + parseInt(sParts[1]||0) + 90;
            const eH = String(Math.floor(sMin / 60) % 24).padStart(2, '0');
            const eM = String(sMin % 60).padStart(2, '0');
            end = `${eH}:${eM}`;
          }

          const dur = parseTimeSpanMinutes(start, end);
          const recordTitle = (rawTitle && rawTitle !== category) ? rawTitle : '';
          const ok = await appendScheduleRecord({
            id: 'sch_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            date: date,
            title: recordTitle,
            category: category,
            startTime: start,
            endTime: end,
            duration: dur,
            isSpecial: false,
            byAi: true,
            author: msg.friendId || 'AI',
            created: Date.now()
          });
          if (ok) {
            addedCount++;
            const titleLabel = recordTitle ? `（${recordTitle}）` : '';
            addedOpRecords.push({
              ok: true,
              label: `写入日历便笺 · ${category}`,
              detail: `${date} ${start}–${end} [${category}]${titleLabel}`
            });
          }
        }
      }
    }

    // 清理文本中的 XML 标签，保持气泡纯净美观
    reg.lastIndex = 0;
    const cleanContent = text.replace(reg, '').replace(/\n{3,}/g, '\n\n').trim();
    if (cleanContent) {
      msg.content = cleanContent;
    }

    if (addedCount > 0) {
      // 依用户需求：完全不需要底部弹出 toast 弹窗（地下弹窗），只保留工具条美化！
      // 将操作结果写入 msg.ibOps 并重绘该消息气泡，展示原生工具卡片
      msg.ibOps = Array.isArray(msg.ibOps) ? msg.ibOps : [];
      addedOpRecords.forEach(rec => {
        if (!msg.ibOps.some(e => e.label === rec.label && e.detail === rec.detail)) {
          msg.ibOps.push(rec);
        }
      });

      // 避免二次触发 hook：直接使用原始 dbPut 方法保存
      const putFn = dbPutFunc || window.dbPut;
      if (typeof putFn === 'function') {
        try {
          await putFn('chatMessages', msg);
        } catch(e) {}
      }
      try {
        if (typeof window.redrawMsg === 'function') {
          window.redrawMsg(msg);
        }
      } catch(e) {}
    }
  }

  // 挂载消息监听器与提示词钩子
  const _processingMsgIds = new Set();

  function initSchedulePatch() {
    hookBuildCalBlock();

    const originalDbPut = window.dbPut;
    if (typeof originalDbPut === 'function' && !originalDbPut.__ib_schedule_hooked) {
      const wrappedDbPut = async function(storeName, data) {
        if (storeName === 'chatMessages' && data && data.role === 'assistant') {
          const msgId = data.id || (data.timestamp + '_' + (data.content ? data.content.slice(0, 15) : ''));
          // 仅当包含日历工具标签且未处理过时，才触发处理
          if (!data._schProcessed && !_processingMsgIds.has(msgId)) {
            const hasCalTag = /<(?:ws_schedule|ws_cal_schedule|ws_cal_add|ws_cal_edit|ws_cal_delete|ws_cal_del|ws_schedule_edit|ws_schedule_delete|ws_schedule_del)\b/i.test(String(data.content || ''));
            if (hasCalTag) {
              data._schProcessed = true;
              _processingMsgIds.add(msgId);
              setTimeout(() => {
                processAIMessageForSchedule(data, originalDbPut)
                  .finally(() => {
                    setTimeout(() => _processingMsgIds.delete(msgId), 3000);
                  });
              }, 10);
            }
          }
        }
        return originalDbPut.apply(this, arguments);
      };
      wrappedDbPut.__ib_schedule_hooked = true;
      window.dbPut = wrappedDbPut;
    }
  }

  // ── 副 API 配置 (多模态) ──
  function initSubApiPatch() {
    const secApiTools = document.getElementById('sec-api-tools');
    if (!secApiTools || document.getElementById('sub-api-card')) return;

    // 1. 创建标头与卡片容器
    const secLabel = document.createElement('div');
    secLabel.className = 'sec-label';
    secLabel.id = 'sub-api-sec-label';
    secLabel.textContent = '副 API';

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'sub-api-card';
    card.style.cssText = 'position:relative;margin-top:8px;';

    card.innerHTML = `
      <div style="font-size:0.75rem;color:var(--tx3);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span>连接 — 连接</span>
      </div>
      
      <!-- 服务商 -->
      <div class="f-group">
        <label>服务商</label>
        <div class="sel">
          <select id="sub-api-provider">
            <option value="anthropic">克劳德（Anthropic 公司）</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">谷歌 Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="qwen">阿里千问（通义千问）</option>
            <option value="siliconflow">硅基流动 SiliconFlow</option>
            <option value="stepfun">阶跃星辰 StepFun</option>
            <option value="moonshot">月之暗面 Moonshot</option>
            <option value="custom">自定义</option>
          </select>
        </div>
      </div>

      <!-- 模型 -->
      <div class="f-group">
        <label>模型 <span class="lb-note">（可手输；或拉取列表后直接选）</span></label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="sub-api-model" placeholder="claude-sonnet-4-6" autocomplete="off" style="flex:1;min-width:0">
          <button class="btn" type="button" id="sub-api-fetch-models" style="flex:none">拉取模型列表</button>
        </div>
        <div class="sel" id="sub-api-models-wrap" style="margin-top:8px;display:none">
          <select id="sub-api-models-select">
            <option value="">— 选中即填入 —</option>
          </select>
        </div>
      </div>

      <!-- 接口地址 -->
      <div class="f-group">
        <label>接口地址</label>
        <input id="sub-api-endpoint" placeholder="https://api.anthropic.com/v1/messages" autocomplete="off">
      </div>

      <!-- API 密钥 -->
      <div class="f-group">
        <label>API 密钥</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="sub-api-key" type="password" autocomplete="off" style="flex:1;min-width:0">
          <button class="btn" type="button" id="sub-api-key-eye" style="flex:none">显示</button>
        </div>
      </div>

      <!-- 接口预设 -->
      <div class="f-group" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
        <label>接口预设 <span class="lb-note">（服务商 + 模型 + 地址 + 密钥一套一套存，随时切）</span></label>
        <div id="sub-api-preset-list" style="margin-bottom:8px"></div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="sub-api-preset-name" placeholder="给当前这套起个名" autocomplete="off" style="flex:1;min-width:0">
          <button class="btn" type="button" id="sub-api-preset-add" style="flex:none">存为预设</button>
        </div>
        <p class="hint" id="sub-api-preset-hint" style="margin:6px 0 0">新配置先保存一次，再回来存预设。</p>
      </div>

      <!-- 保存按钮 -->
      <div style="margin-top:14px">
        <button class="btn wide primary" id="sub-api-save" type="button">保存副 API 配置</button>
      </div>
    `;

    secApiTools.prepend(card);
    secApiTools.prepend(secLabel);

    // 2. 绑定事件逻辑
    const provSelect = document.getElementById('sub-api-provider');
    const modelInput = document.getElementById('sub-api-model');
    const epInput = document.getElementById('sub-api-endpoint');
    const keyInput = document.getElementById('sub-api-key');
    const keyEye = document.getElementById('sub-api-key-eye');
    const fetchBtn = document.getElementById('sub-api-fetch-models');
    const modelsSelect = document.getElementById('sub-api-models-select');
    const modelsWrap = document.getElementById('sub-api-models-wrap');
    const presetName = document.getElementById('sub-api-preset-name');
    const presetAdd = document.getElementById('sub-api-preset-add');
    const presetList = document.getElementById('sub-api-preset-list');
    const saveBtn = document.getElementById('sub-api-save');

    if (!provSelect || !saveBtn) return;

    // 密码显示/隐藏
    keyEye.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        keyEye.textContent = '隐藏';
      } else {
        keyInput.type = 'password';
        keyEye.textContent = '显示';
      }
    });

    // 服务商切换联动预设默认值
    const providerDefaults = {
      anthropic: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-6' },
      openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
      gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
      deepseek: { endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
      qwen: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-max' },
      siliconflow: { endpoint: 'https://api.siliconflow.cn/v1/chat/completions', model: 'Qwen/Qwen2.5-72B-Instruct' },
      stepfun: { endpoint: 'https://api.stepfun.com/v1/chat/completions', model: 'step-1-8k' },
      moonshot: { endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
      custom: { endpoint: '', model: '' }
    };

    provSelect.addEventListener('change', () => {
      const p = provSelect.value;
      const def = providerDefaults[p];
      if (def) {
        if (!epInput.value || Object.values(providerDefaults).some(d => d.endpoint === epInput.value)) {
          epInput.value = def.endpoint;
        }
        if (!modelInput.value || Object.values(providerDefaults).some(d => d.model === modelInput.value)) {
          modelInput.value = def.model;
        }
      }
    });

    // 拉取模型列表
    fetchBtn.addEventListener('click', async () => {
      const ep = epInput.value.trim();
      const key = keyInput.value.trim();
      const prov = provSelect.value;

      fetchBtn.disabled = true;
      fetchBtn.textContent = '拉取中…';

      let baseUrl = ep;
      if (!baseUrl) {
        if (prov === 'openai') baseUrl = 'https://api.openai.com/v1';
        else if (prov === 'siliconflow') baseUrl = 'https://api.siliconflow.cn/v1';
        else if (prov === 'deepseek') baseUrl = 'https://api.deepseek.com/v1';
      }
      baseUrl = baseUrl.replace(/\/+(chat\/completions|messages|responses)?\/?$/i, '').replace(/\/+$/, '') + '/models';

      try {
        const headers = {};
        if (key) {
          if (prov === 'anthropic') headers['x-api-key'] = key;
          else headers['Authorization'] = 'Bearer ' + key;
        }
        const res = await fetch(baseUrl, { headers });
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data || data.models || []);
        if (list && list.length) {
          modelsSelect.innerHTML = '<option value="">— 选中即填入 —</option>' + list.map(m => {
            const id = typeof m === 'string' ? m : (m.id || m.name);
            return `<option value="${id}">${id}</option>`;
          }).join('');
          modelsWrap.style.display = '';
          if (typeof window.toast === 'function') window.toast(`已获取 ${list.length} 个模型`);
        } else {
          if (typeof window.toast === 'function') window.toast('未查找到模型列表，可手动输入');
        }
      } catch(err) {
        if (typeof window.toast === 'function') window.toast('拉取模型列表失败：' + (err.message || err));
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = '拉取模型列表';
      }
    });

    modelsSelect.addEventListener('change', () => {
      if (modelsSelect.value) {
        modelInput.value = modelsSelect.value;
      }
    });

    // 预设列表绘制
    function renderSubPresets() {
      const savedConfigRaw = localStorage.getItem('ib_sub_api_config');
      const curCfg = savedConfigRaw ? JSON.parse(savedConfigRaw) : null;

      const presetsStr = localStorage.getItem('ib_sub_api_presets');
      let presets = [];
      try { if (presetsStr) presets = JSON.parse(presetsStr); } catch(e) {}

      const hintEl = document.getElementById('sub-api-preset-hint');
      if (hintEl) {
        if (!curCfg) {
          hintEl.textContent = '新配置先保存一次，再回来存预设。';
        } else if (!presets.length) {
          hintEl.textContent = '还没有预设：把服务商、模型、地址、密钥填好，起个名点「存为预设」。';
        } else {
          hintEl.textContent = `共 ${presets.length} 套。点一套换上并保存，行尾 × 删。`;
        }
      }

      presetList.innerHTML = presets.map((p, i) => {
        const isCur = curCfg && curCfg.provider === p.provider && curCfg.model === p.model && curCfg.endpoint === p.endpoint && curCfg.key === p.key;
        const meta = [p.provider, p.model || '', p.endpoint || ''].filter(Boolean).join(' · ');
        return `<div class="pwl-row${isCur ? ' on' : ''}" data-i="${i}" style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--line);cursor:pointer">
          <div style="flex:1;min-width:0">
            <div class="pwl-t" style="font-size:0.86rem;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
            <div class="pwl-s" style="font-size:0.72rem;color:var(--tx3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta}</div>
          </div>
          <button class="pwl-x" type="button" title="删除" data-del="${i}" style="flex:none;width:24px;height:24px;border-radius:50%;border:none;background:none;display:flex;align-items:center;justify-content:center;color:var(--tx3);cursor:pointer">
            <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>
          </button>
        </div>`;
      }).join('');
    }

    // 点击预设项或删除
    presetList.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('[data-del]');
      const presetsStr = localStorage.getItem('ib_sub_api_presets');
      let presets = presetsStr ? JSON.parse(presetsStr) : [];

      if (delBtn) {
        e.stopPropagation();
        const i = parseInt(delBtn.dataset.del, 10);
        if (i >= 0 && presets[i]) {
          const pName = presets[i].name;
          presets.splice(i, 1);
          localStorage.setItem('ib_sub_api_presets', JSON.stringify(presets));
          try { if (typeof window.dbPut === 'function') await window.dbPut('apiSettings', { id: 'sub_api_presets', list: presets }); } catch(err) {}
          renderSubPresets();
          if (typeof window.toast === 'function') window.toast(`已删除预设「${pName}」`);
        }
        return;
      }

      const row = e.target.closest('.pwl-row');
      if (row) {
        const i = parseInt(row.dataset.i, 10);
        const p = presets[i];
        if (p) {
          provSelect.value = p.provider || 'anthropic';
          modelInput.value = p.model || '';
          epInput.value = p.endpoint || '';
          keyInput.value = p.key || '';
          saveBtn.click();
        }
      }
    });

    // 存为预设
    presetAdd.addEventListener('click', async () => {
      const savedConfigRaw = localStorage.getItem('ib_sub_api_config');
      if (!savedConfigRaw) {
        if (typeof window.toast === 'function') window.toast('新配置先保存一次');
        return;
      }
      const curModel = modelInput.value.trim();
      if (!curModel) {
        if (typeof window.toast === 'function') window.toast('模型填好再存');
        return;
      }
      let name = presetName.value.trim();
      if (!name) name = curModel;

      const presetsStr = localStorage.getItem('ib_sub_api_presets');
      let presets = presetsStr ? JSON.parse(presetsStr) : [];

      const curRec = {
        name: name,
        provider: provSelect.value,
        model: curModel,
        endpoint: epInput.value.trim(),
        key: keyInput.value.trim()
      };

      const idx = presets.findIndex(p => p.name === name);
      if (idx >= 0) presets[idx] = curRec;
      else presets.push(curRec);

      localStorage.setItem('ib_sub_api_presets', JSON.stringify(presets));
      try { if (typeof window.dbPut === 'function') await window.dbPut('apiSettings', { id: 'sub_api_presets', list: presets }); } catch(e) {}

      presetName.value = '';
      renderSubPresets();
      if (typeof window.toast === 'function') {
        window.toast((idx >= 0 ? '已更新预设「' : '已存为预设「') + name + '」');
      }
    });

    // 保存副 API
    saveBtn.addEventListener('click', async () => {
      const cfg = {
        id: 'sub_api',
        provider: provSelect.value,
        model: modelInput.value.trim(),
        endpoint: epInput.value.trim(),
        key: keyInput.value.trim(),
        updatedAt: Date.now()
      };
      localStorage.setItem('ib_sub_api_config', JSON.stringify(cfg));
      try {
        if (typeof window.dbPut === 'function') {
          await window.dbPut('apiSettings', cfg);
        }
      } catch(e) {}
      renderSubPresets();
      if (typeof window.toast === 'function') {
        window.toast('副 API 配置已保存');
      }
    });

    // 回填初始保存的值
    function loadSavedConfig() {
      const raw = localStorage.getItem('ib_sub_api_config');
      if (raw) {
        try {
          const cfg = JSON.parse(raw);
          if (cfg.provider) provSelect.value = cfg.provider;
          if (cfg.model) modelInput.value = cfg.model;
          if (cfg.endpoint) epInput.value = cfg.endpoint;
          if (cfg.key) keyInput.value = cfg.key;
        } catch(e) {}
      } else {
        // 默认呈现图片中所示的默认值
        provSelect.value = 'anthropic';
        modelInput.value = 'claude-sonnet-4-6';
        epInput.value = 'https://api.anthropic.com/v1/messages';
      }
      renderSubPresets();
    }

    loadSavedConfig();


    if (typeof window.dbGet === 'function') {
      window.dbGet('apiSettings', 'sub_api').then(cfg => {
        if (cfg) {
          localStorage.setItem('ib_sub_api_config', JSON.stringify(cfg));
          if (cfg.provider) provSelect.value = cfg.provider;
          if (cfg.model) modelInput.value = cfg.model;
          if (cfg.endpoint) epInput.value = cfg.endpoint;
          if (cfg.key) keyInput.value = cfg.key;
          renderSubPresets();
        }
      }).catch(() => {});

      window.dbGet('apiSettings', 'sub_api_presets').then(res => {
        if (res && Array.isArray(res.list)) {
          localStorage.setItem('ib_sub_api_presets', JSON.stringify(res.list));
          renderSubPresets();
        }
      }).catch(() => {});
    }

    // 暴露全局读取与调用接口供后续功能接入
    window.getSubApiConfig = function() {
      try {
        const raw = localStorage.getItem('ib_sub_api_config');
        if (raw) return JSON.parse(raw);
      } catch(e) {}
      return {
        provider: provSelect.value,
        model: modelInput.value.trim(),
        endpoint: epInput.value.trim(),
        key: keyInput.value.trim()
      };
    };
  }

  // ── Embedding 向量 API 配置 (多模态) ──
  function initEmbeddingApiPatch() {
    const secApiTools = document.getElementById('sec-api-tools');
    if (!secApiTools || document.getElementById('emb-api-card')) return;

    // 创建标头与卡片容器（与原作者副 API 完全一致的排版设计）
    const secLabel = document.createElement('div');
    secLabel.className = 'sec-label';
    secLabel.id = 'emb-api-sec-label';
    secLabel.textContent = 'Embedding 向量 API';

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'emb-api-card';
    card.style.cssText = 'position:relative;margin-top:8px;';

    card.innerHTML = `
      <div style="font-size:0.75rem;color:var(--tx3);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span>连接 — 连接</span>
      </div>
      
      <!-- 服务商 -->
      <div class="f-group">
        <label>服务商</label>
        <div class="sel">
          <select id="emb-api-provider">
            <option value="siliconflow">硅基流动 SiliconFlow（推荐 · BGE 等）</option>
            <option value="openai">OpenAI</option>
            <option value="qwen">阿里千问（通义千问）</option>
            <option value="gemini">谷歌 Gemini</option>
            <option value="custom">自定义 / 本地 Ollama</option>
          </select>
        </div>
      </div>

      <!-- 模型 -->
      <div class="f-group">
        <label>模型 <span class="lb-note">（可手输；或拉取列表后直接选）</span></label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="emb-api-model" placeholder="BAAI/bge-m3" autocomplete="off" style="flex:1;min-width:0">
          <button class="btn" type="button" id="emb-api-fetch-models" style="flex:none">拉取模型列表</button>
        </div>
        <div class="sel" id="emb-api-models-wrap" style="margin-top:8px;display:none">
          <select id="emb-api-models-select">
            <option value="">— 选中即填入 —</option>
          </select>
        </div>
      </div>

      <!-- 接口地址 -->
      <div class="f-group">
        <label>接口地址</label>
        <input id="emb-api-endpoint" placeholder="https://api.siliconflow.cn/v1/embeddings" autocomplete="off">
      </div>

      <!-- API 密钥 -->
      <div class="f-group">
        <label>API 密钥</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="emb-api-key" type="password" autocomplete="off" style="flex:1;min-width:0">
          <button class="btn" type="button" id="emb-api-key-eye" style="flex:none">显示</button>
        </div>
      </div>

      <!-- 接口预设 -->
      <div class="f-group" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
        <label>接口预设 <span class="lb-note">（服务商 + 模型 + 地址 + 密钥一套一套存，随时切）</span></label>
        <div id="emb-api-preset-list" style="margin-bottom:8px"></div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="emb-api-preset-name" placeholder="给当前这套起个名" autocomplete="off" style="flex:1;min-width:0">
          <button class="btn" type="button" id="emb-api-preset-add" style="flex:none">存为预设</button>
        </div>
        <p class="hint" id="emb-api-preset-hint" style="margin:6px 0 0">新配置先保存一次，再回来存预设。</p>
      </div>

      <!-- 保存按钮 -->
      <div style="margin-top:14px">
        <button class="btn wide primary" id="emb-api-save" type="button">保存 Embedding API 配置</button>
      </div>
    `;

    // 放置在副 API 卡片后方
    const subCard = document.getElementById('sub-api-card');
    if (subCard && subCard.nextSibling) {
      secApiTools.insertBefore(card, subCard.nextSibling);
      secApiTools.insertBefore(secLabel, card);
    } else {
      secApiTools.appendChild(secLabel);
      secApiTools.appendChild(card);
    }

    const provSelect = document.getElementById('emb-api-provider');
    const modelInput = document.getElementById('emb-api-model');
    const epInput = document.getElementById('emb-api-endpoint');
    const keyInput = document.getElementById('emb-api-key');
    const keyEye = document.getElementById('emb-api-key-eye');
    const fetchBtn = document.getElementById('emb-api-fetch-models');
    const modelsSelect = document.getElementById('emb-api-models-select');
    const modelsWrap = document.getElementById('emb-api-models-wrap');
    const presetName = document.getElementById('emb-api-preset-name');
    const presetAdd = document.getElementById('emb-api-preset-add');
    const presetList = document.getElementById('emb-api-preset-list');
    const saveBtn = document.getElementById('emb-api-save');

    if (!provSelect || !saveBtn) return;

    keyEye.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        keyEye.textContent = '隐藏';
      } else {
        keyInput.type = 'password';
        keyEye.textContent = '显示';
      }
    });

    const providerDefaults = {
      siliconflow: { endpoint: 'https://api.siliconflow.cn/v1/embeddings', model: 'BAAI/bge-m3' },
      openai: { endpoint: 'https://api.openai.com/v1/embeddings', model: 'text-embedding-3-small' },
      qwen: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', model: 'text-embedding-v3' },
      gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'text-embedding-004' },
      custom: { endpoint: 'http://localhost:11434/api/embeddings', model: 'bge-m3' }
    };

    provSelect.addEventListener('change', () => {
      const p = provSelect.value;
      const def = providerDefaults[p];
      if (def) {
        if (!epInput.value || Object.values(providerDefaults).some(d => d.endpoint === epInput.value)) {
          epInput.value = def.endpoint;
        }
        if (!modelInput.value || Object.values(providerDefaults).some(d => d.model === modelInput.value)) {
          modelInput.value = def.model;
        }
      }
    });

    fetchBtn.addEventListener('click', async () => {
      const ep = epInput.value.trim();
      const key = keyInput.value.trim();
      const prov = provSelect.value;

      fetchBtn.disabled = true;
      fetchBtn.textContent = '拉取中…';

      let baseUrl = ep;
      if (!baseUrl) {
        if (prov === 'siliconflow') baseUrl = 'https://api.siliconflow.cn/v1';
        else if (prov === 'openai') baseUrl = 'https://api.openai.com/v1';
      }
      baseUrl = baseUrl.replace(/\/+(embeddings|chat\/completions|messages)?\/?$/i, '').replace(/\/+$/, '') + '/models';

      try {
        const headers = {};
        if (key) headers['Authorization'] = 'Bearer ' + key;
        const res = await fetch(baseUrl, { headers });
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data || data.models || []);
        if (list && list.length) {
          modelsSelect.innerHTML = '<option value="">— 选中即填入 —</option>' + list.map(m => {
            const id = typeof m === 'string' ? m : (m.id || m.name);
            return `<option value="${id}">${id}</option>`;
          }).join('');
          modelsWrap.style.display = '';
          if (typeof window.toast === 'function') window.toast(`已获取 ${list.length} 个模型`);
        } else {
          if (typeof window.toast === 'function') window.toast('未查找到模型列表，可手动输入');
        }
      } catch(err) {
        if (typeof window.toast === 'function') window.toast('拉取模型列表失败：' + (err.message || err));
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = '拉取模型列表';
      }
    });

    modelsSelect.addEventListener('change', () => {
      if (modelsSelect.value) modelInput.value = modelsSelect.value;
    });

    function renderEmbPresets() {
      const savedConfigRaw = localStorage.getItem('ib_emb_api_config');
      const curCfg = savedConfigRaw ? JSON.parse(savedConfigRaw) : null;
      const presetsStr = localStorage.getItem('ib_emb_api_presets');
      let presets = [];
      try { if (presetsStr) presets = JSON.parse(presetsStr); } catch(e) {}

      const hintEl = document.getElementById('emb-api-preset-hint');
      if (hintEl) {
        if (!curCfg) hintEl.textContent = '新配置先保存一次，再回来存预设。';
        else if (!presets.length) hintEl.textContent = '还没有预设：把服务商、模型、地址、密钥填好，起个名点「存为预设」。';
        else hintEl.textContent = `共 ${presets.length} 套。点一套换上并保存，行尾 × 删。`;
      }

      presetList.innerHTML = presets.map((p, i) => {
        const isCur = curCfg && curCfg.provider === p.provider && curCfg.model === p.model && curCfg.endpoint === p.endpoint && curCfg.key === p.key;
        const meta = [p.provider, p.model || '', p.endpoint || ''].filter(Boolean).join(' · ');
        return `<div class="pwl-row${isCur ? ' on' : ''}" data-i="${i}" style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--line);cursor:pointer">
          <div style="flex:1;min-width:0">
            <div class="pwl-t" style="font-size:0.86rem;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
            <div class="pwl-s" style="font-size:0.72rem;color:var(--tx3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta}</div>
          </div>
          <button class="pwl-x" type="button" title="删除" data-del="${i}" style="flex:none;width:24px;height:24px;border-radius:50%;border:none;background:none;display:flex;align-items:center;justify-content:center;color:var(--tx3);cursor:pointer">
            <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>
          </button>
        </div>`;
      }).join('');
    }

    presetList.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('[data-del]');
      const presetsStr = localStorage.getItem('ib_emb_api_presets');
      let presets = presetsStr ? JSON.parse(presetsStr) : [];

      if (delBtn) {
        e.stopPropagation();
        const i = parseInt(delBtn.dataset.del, 10);
        if (i >= 0 && presets[i]) {
          const pName = presets[i].name;
          presets.splice(i, 1);
          localStorage.setItem('ib_emb_api_presets', JSON.stringify(presets));
          try { if (typeof window.dbPut === 'function') await window.dbPut('apiSettings', { id: 'emb_api_presets', list: presets }); } catch(err) {}
          renderEmbPresets();
          if (typeof window.toast === 'function') window.toast(`已删除预设「${pName}」`);
        }
        return;
      }

      const row = e.target.closest('.pwl-row');
      if (row) {
        const i = parseInt(row.dataset.i, 10);
        const p = presets[i];
        if (p) {
          provSelect.value = p.provider || 'siliconflow';
          modelInput.value = p.model || '';
          epInput.value = p.endpoint || '';
          keyInput.value = p.key || '';
          saveBtn.click();
        }
      }
    });

    presetAdd.addEventListener('click', async () => {
      const savedConfigRaw = localStorage.getItem('ib_emb_api_config');
      if (!savedConfigRaw) {
        if (typeof window.toast === 'function') window.toast('新配置先保存一次');
        return;
      }
      const curModel = modelInput.value.trim();
      if (!curModel) {
        if (typeof window.toast === 'function') window.toast('模型填好再存');
        return;
      }
      let name = presetName.value.trim();
      if (!name) name = curModel;

      const presetsStr = localStorage.getItem('ib_emb_api_presets');
      let presets = presetsStr ? JSON.parse(presetsStr) : [];

      const curRec = {
        name: name,
        provider: provSelect.value,
        model: curModel,
        endpoint: epInput.value.trim(),
        key: keyInput.value.trim()
      };

      const idx = presets.findIndex(p => p.name === name);
      if (idx >= 0) presets[idx] = curRec;
      else presets.push(curRec);

      localStorage.setItem('ib_emb_api_presets', JSON.stringify(presets));
      try { if (typeof window.dbPut === 'function') await window.dbPut('apiSettings', { id: 'emb_api_presets', list: presets }); } catch(e) {}

      presetName.value = '';
      renderEmbPresets();
      if (typeof window.toast === 'function') {
        window.toast((idx >= 0 ? '已更新预设「' : '已存为预设「') + name + '」');
      }
    });

    saveBtn.addEventListener('click', async () => {
      const cfg = {
        id: 'emb_api',
        provider: provSelect.value,
        model: modelInput.value.trim(),
        endpoint: epInput.value.trim(),
        key: keyInput.value.trim(),
        updatedAt: Date.now()
      };
      localStorage.setItem('ib_emb_api_config', JSON.stringify(cfg));
      try {
        if (typeof window.dbPut === 'function') {
          await window.dbPut('apiSettings', cfg);
        }
      } catch(e) {}
      renderEmbPresets();
      if (typeof window.toast === 'function') {
        window.toast('Embedding API 配置已保存');
      }
    });

    function loadSavedConfig() {
      const raw = localStorage.getItem('ib_emb_api_config');
      if (raw) {
        try {
          const cfg = JSON.parse(raw);
          if (cfg.provider) provSelect.value = cfg.provider;
          if (cfg.model) modelInput.value = cfg.model;
          if (cfg.endpoint) epInput.value = cfg.endpoint;
          if (cfg.key) keyInput.value = cfg.key;
        } catch(e) {}
      } else {
        provSelect.value = 'siliconflow';
        modelInput.value = 'BAAI/bge-m3';
        epInput.value = 'https://api.siliconflow.cn/v1/embeddings';
      }
      renderEmbPresets();
    }

    loadSavedConfig();

    if (typeof window.dbGet === 'function') {
      window.dbGet('apiSettings', 'emb_api').then(cfg => {
        if (cfg) {
          localStorage.setItem('ib_emb_api_config', JSON.stringify(cfg));
          if (cfg.provider) provSelect.value = cfg.provider;
          if (cfg.model) modelInput.value = cfg.model;
          if (cfg.endpoint) epInput.value = cfg.endpoint;
          if (cfg.key) keyInput.value = cfg.key;
          renderEmbPresets();
        }
      }).catch(() => {});

      window.dbGet('apiSettings', 'emb_api_presets').then(res => {
        if (res && Array.isArray(res.list)) {
          localStorage.setItem('ib_emb_api_presets', JSON.stringify(res.list));
          renderEmbPresets();
        }
      }).catch(() => {});
    }

    window.getEmbeddingApiConfig = function() {
      try {
        const raw = localStorage.getItem('ib_emb_api_config');
        if (raw) return JSON.parse(raw);
      } catch(e) {}
      return {
        provider: provSelect.value,
        model: modelInput.value.trim(),
        endpoint: epInput.value.trim(),
        key: keyInput.value.trim()
      };
    };
  }

  // ── 复制记忆库板块：记忆房间 / 动态档案 (与原生美化完全一致) ──
  function initEventMemorySection() {
    const pageMemory = document.getElementById('page-memory');
    if (!pageMemory) return;

    // 1. 扩充底部 Dock 坞位项：在记忆库和 Auto Memory 中间加入「记忆房间」
    if (typeof DOCKS !== "undefined" && DOCKS.memory) {
      const hasEvt = DOCKS.memory.some(item => item.k === 'evt');
      if (!hasEvt) {
        // 查找 lib 索引
        const libIdx = DOCKS.memory.findIndex(item => item.k === 'lib');
        const evtItem = { k: 'evt', t: '记忆房间', i: 'lib' };
        if (libIdx >= 0) {
          DOCKS.memory.splice(libIdx + 1, 0, evtItem);
        } else {
          DOCKS.memory.push(evtItem);
        }
        if ((typeof currentPage !== "undefined" ? currentPage : "") === 'memory' && typeof window.renderDock === 'function') {
          window.renderDock();
        }
      }
    }

    // 2. 注入记忆房间分区 DOM (sec-memory-evt)，完全复制自 sec-memory-lib 并保持原汁原味
    if (!document.getElementById('sec-memory-evt')) {
      const secEvt = document.createElement('div');
      secEvt.className = 'psec';
      secEvt.id = 'sec-memory-evt';
      secEvt.innerHTML = `
        <div class="mem-hero">
          <div class="mh-en">Memory Room<span class="mh-zh">记忆房间</span></div>
        </div>
        <div class="mem-stats" id="evtm-stats">
          <div class="ms-cell"><div class="ms-num" id="evtm-cnt-total">0</div><div class="ms-lab">Total</div></div>
          <div class="ms-cell"><div class="ms-num" id="evtm-cnt-pinned">0</div><div class="ms-lab">Pinned</div></div>
          <div class="ms-cell"><div class="ms-num" id="evtm-cnt-active">0</div><div class="ms-lab">Active</div></div>
        </div>
        <div class="mem-dbar" id="evtm-dbar">
          <i style="width:30%;background:rgba(214,138,154,0.7)"></i>
          <i style="width:40%;background:rgba(127,168,217,0.7)"></i>
          <i style="width:20%;background:rgba(148,198,166,0.7)"></i>
          <i style="width:10%;background:rgba(206,170,123,0.7)"></i>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn wide primary" id="evtm-add" style="margin-bottom:0">＋ 新记忆房间</button>
          <button class="btn wide" id="evtm-vectorize">向量化检测</button>
        </div>
        <input class="search" id="evtm-search" placeholder="搜索记忆房间…">
        <div class="chips" id="evtm-filter" style="margin-bottom:12px"></div>
        <div id="evtm-list"></div>
        <div class="sec-label" style="margin-top:18px">记忆房间管理</div>
        <div class="card">
          <button class="btn wide" id="evtm-export">导出记忆房间</button>
          <div style="height:10px"></div>
          <button class="btn wide" id="evtm-import">导入记忆房间</button>
          <p class="hint">独立于原生记忆库，由副 API 自动按事件拆解归类提炼，支持 Embedding 向量语义化检索与匹配。</p>
        </div>
      `;

      // 插入到 sec-memory-lib 与 sec-memory-am 之间
      const secLib = document.getElementById('sec-memory-lib');
      if (secLib && secLib.nextSibling) {
        pageMemory.insertBefore(secEvt, secLib.nextSibling);
      } else {
        pageMemory.appendChild(secEvt);
      }
    }

    // 3. 注册渲染与业务逻辑
    let _evtMems = [];
    let _evtmFilter = 'all';
    let _evtmSort = 'created';

    async function loadEventMemories() {
      try {
        const raw = localStorage.getItem('ib_custom_event_memories');
        if (raw) _evtMems = JSON.parse(raw);
        else _evtMems = [];
      } catch(e) { _evtMems = []; }

      // 默认若为空，初始化几个优美的范例日常事件展示原生质感
      if (!_evtMems.length) {
        _evtMems = [
          {
            id: 'evtm_' + (Date.now() - 3600000),
            title: '关于饮食与重口辣味偏好',
            summary: '压力大或疲惫时喜欢吃麻辣烫来减压，极度排斥香菜与生冷海鲜。',
            domain: '日常',
            importance: 8,
            pinned: true,
            hasEmbedding: true,
            created: Date.now() - 3600000,
            tags: ['饮食习惯', '生活解压']
          },
          {
            id: 'evtm_' + (Date.now() - 7200000),
            title: '近期备考与作息状态',
            summary: '正在准备近期的重要专业测试，晚上经常复习到深夜，需要适时督促早睡。',
            domain: '日常',
            importance: 7,
            pinned: false,
            hasEmbedding: true,
            created: Date.now() - 7200000,
            tags: ['考试', '作息']
          }
        ];
        localStorage.setItem('ib_custom_event_memories', JSON.stringify(_evtMems));
      }
    }

    function drawEvtMemList() {
      const q = (document.getElementById('evtm-search') ? document.getElementById('evtm-search').value : '').trim().toLowerCase();
      const box = document.getElementById('evtm-list');
      if (!box) return;
      box.innerHTML = '';

      const hit = _evtMems.filter(m => {
        if (_evtmFilter !== 'all' && m.domain !== _evtmFilter) return false;
        if (!q) return true;
        return [m.title, m.summary, (m.tags || []).join(' ')].join(' ').toLowerCase().indexOf(q) !== -1;
      });

      if (_evtmSort === 'importance') hit.sort((a, b) => (b.importance || 0) - (a.importance || 0));
      else hit.sort((a, b) => (b.created || 0) - (a.created || 0));
      hit.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

      // 统计数字刷新
      const totalEl = document.getElementById('evtm-cnt-total');
      const pinEl = document.getElementById('evtm-cnt-pinned');
      const actEl = document.getElementById('evtm-cnt-active');
      if (totalEl) totalEl.textContent = _evtMems.length;
      if (pinEl) pinEl.textContent = _evtMems.filter(m => m.pinned).length;
      if (actEl) actEl.textContent = _evtMems.filter(m => !m.resolved).length;

      if (!hit.length) {
        box.innerHTML = '<div class="empty">' + (q || _evtmFilter !== 'all' ? '没有匹配的记忆房间。' : '还没有记忆房间。<br>聊天达到设定轮数后副 API 会自动提炼，或点击上方新增。') + '</div>';
        return;
      }

      const domainColors = (typeof window.DOMAIN_COLOR !== 'undefined') ? window.DOMAIN_COLOR : {
        '情感': 'rgba(214,138,154,0.7)',
        '日常': 'rgba(127,168,217,0.7)',
        '创作': 'rgba(148,198,166,0.7)',
        '思考': 'rgba(206,170,123,0.7)'
      };

      hit.forEach(m => {
        const d = document.createElement('div');
        d.className = 'mem-card' + (m.pinned ? ' pin' : '');
        d.style.setProperty('--dom', domainColors[m.domain] || 'rgba(127,168,217,0.5)');
        const line = m.summary || m.content || '';
        const tags = (m.tags || []).slice(0, 3).join(' · ');
        const imp = Math.max(0, Math.min(10, m.importance || 0));

        d.innerHTML = '<div class="mem-title">' + (m.pinned ? '<span class="mem-pin"></span>' : '') + (m.title || '（无标题）')
          + (m.hasEmbedding ? '<span style="margin-left:auto;font-size:0.65rem;color:var(--acc);background:rgba(100,160,220,0.15);padding:1px 6px;border-radius:6px">向量就绪</span>' : '')
          + '</div>'
          + (line ? '<div class="mem-line">' + line + '</div>' : '')
          + '<div class="mem-meta"><span class="mem-dot"></span>' + (m.domain || '日常')
          + '<span class="mem-bar"><i style="width:' + (imp * 10) + '%"></i></span>' + imp
          + (tags ? '<span>' + tags + '</span>' : '')
          + '</div><div class="mem-card-fold"></div>';

        d.addEventListener('click', () => {
          openEvtmDetail(m);
        });

        box.appendChild(d);
      });
    }

    function saveAndRedraw() {
      localStorage.setItem('ib_custom_event_memories', JSON.stringify(_evtMems));
      drawEvtMemList();
    }

    function renderFilterChips() {
      const fbox = document.getElementById('evtm-filter');
      if (!fbox) return;
      fbox.innerHTML = '';
      const domains = [['all', '全部领域'], ['日常', '日常'], ['情感', '情感'], ['创作', '创作'], ['思考', '思考']];
      const curDomain = (domains.find(x => x[0] === _evtmFilter) || domains[0])[1];
      const dBtn = document.createElement('button');
      dBtn.className = 'mem-cat-btn';
      dBtn.innerHTML = '<span>' + curDomain + '</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
      dBtn.addEventListener('click', () => {
        if (typeof window.actionSheet === 'function') {
          window.actionSheet(domains.map(([k, t]) => ({
            label: t,
            fn: () => { _evtmFilter = k; renderFilterChips(); drawEvtMemList(); }
          })));
        }
      });
      fbox.appendChild(dBtn);

      const sorts = [['created', '按时间'], ['importance', '按重要性']];
      const curSort = (sorts.find(x => x[0] === _evtmSort) || sorts[0])[1];
      const sBtn = document.createElement('button');
      sBtn.className = 'mem-cat-btn';
      sBtn.innerHTML = '<span>' + curSort + '</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
      sBtn.addEventListener('click', () => {
        if (typeof window.actionSheet === 'function') {
          window.actionSheet(sorts.map(([k, t]) => ({
            label: t,
            fn: () => { _evtmSort = k; renderFilterChips(); drawEvtMemList(); }
          })));
        }
      });
      fbox.appendChild(sBtn);
    }

    window.renderEventMemLib = async function() {
      await loadEventMemories();
      renderFilterChips();
      drawEvtMemList();
    };

    // 挂载到原生的 SEC_RENDER
    if (typeof SEC_RENDER !== "undefined" && SEC_RENDER) {
      SEC_RENDER['memory:evt'] = window.renderEventMemLib;
    }

    // 按钮事件绑定

    let _detailEvtm = null;
    let _editEvtmId = null;
    let _evtmVisChips = [];

    function fillEvtmVisList(m) {
      const box = document.getElementById('evtme-vis-list');
      if (!box) return;
      box.innerHTML = '';
      _evtmVisChips = m ? (m.visibility === 'only' ? (m.visibleTo || []).slice() : m.visibility === 'except' ? (m.excludeFrom || []).slice() : []) : [];
      const cfgs = (typeof window._cfgs !== 'undefined') ? window._cfgs : [];
      cfgs.forEach(c => {
        const chip = document.createElement('div');
        chip.className = 'chip' + (_evtmVisChips.indexOf(c.id) !== -1 ? ' on' : '');
        chip.textContent = c.nickname || c.id;
        chip.addEventListener('click', () => {
          const i = _evtmVisChips.indexOf(c.id);
          if (i === -1) _evtmVisChips.push(c.id); else _evtmVisChips.splice(i, 1);
          chip.classList.toggle('on', _evtmVisChips.indexOf(c.id) !== -1);
        });
        box.appendChild(chip);
      });
    }

    async function openEvtmDetail(m) {
      _detailEvtm = m;
      if (typeof window.loadCfgs === 'function') await window.loadCfgs();
      document.getElementById('evtmd-title').textContent = m.title || '（无标题）';
      const _sm = String(m.summary || '').replace(/\s+/g, ' ').trim();
      const _ct = String(m.content || '');
      const _dup = !!(_sm && _ct && _ct.replace(/\s+/g, ' ').trim().indexOf(_sm) === 0);
      const _se = document.getElementById('evtmd-sum');
      if (_se) {
        _se.textContent = _sm;
        _se.style.display = (_sm && !_dup) ? '' : 'none';
      }
      
      const parts = [];
      if (_ct) parts.push(_ct);
      document.getElementById('evtmd-body').textContent = parts.join('\n\n') || (_sm ? '' : '（无内容）');
      
      const cfgs = (typeof window._cfgs !== 'undefined') ? window._cfgs : [];
      const getNames = (arr) => arr.map(id => {
         const c = cfgs.find(x => x.id === id);
         return c ? (c.nickname || id) : id;
      }).join('、');
      
      let visStr = '所有 AI 可见';
      if (m.visibility === 'private') visStr = '完全私密';
      else if (m.visibility === 'only') visStr = '仅对：' + getNames(m.visibleTo || []);
      else if (m.visibility === 'except') visStr = '排除：' + getNames(m.excludeFrom || []);

      document.getElementById('evtmd-meta').textContent = 
        '领域：' + (m.domain || '—') + '　重要性：' + (m.importance != null ? m.importance : '—') +
        '\n可见性：' + visStr +
        '\n置顶：' + (m.pinned ? '是' : '否') +
        (m.tags && m.tags.length ? '\n标签：' + m.tags.join('，') : '') +
        (m.created ? '\n创建：' + new Date(m.created).toLocaleString('zh-CN') : '');
      
      if (typeof window.openSheet === 'function') {
        window.openSheet('sheet-evtm-detail');
      } else {
        document.getElementById('sheet-evtm-detail').classList.add('open');
        const scrim = document.getElementById('sheet-scrim');
        if (scrim) scrim.classList.add('show');
      }
    }

    async function openEvtmEditor(m) {
      ensureEvtmSheets();
      if (typeof window.loadCfgs === 'function') await window.loadCfgs();
      _editEvtmId = m ? m.id : null;
      document.getElementById('evtme-title').textContent = m ? '编辑记忆房间' : '新记忆房间';
      document.getElementById('evtme-t').value = m ? (m.title || '') : '';
      document.getElementById('evtme-c').value = m ? (m.content || '') : '';
      document.getElementById('evtme-s').value = m ? (m.summary || '') : '';
      document.getElementById('evtme-domain').value = m && ['情感','日常','创作','思考'].indexOf(m.domain) !== -1 ? m.domain : '日常';
      document.getElementById('evtme-tags').value = m ? (m.tags || []).join('，') : '';
      document.getElementById('evtme-imp').value = m && m.importance != null ? m.importance : 5;
      document.getElementById('evtme-imp-val').textContent = m && m.importance != null ? m.importance : 5;
      
      const pinSw = document.getElementById('evtme-pin');
      const pinned = m ? !!m.pinned : false;
      if (typeof window.sw2 === 'function') {
        window.sw2(pinSw, pinned);
      } else {
        if (pinned) pinSw.classList.add('on');
        else pinSw.classList.remove('on');
      }

      const vis = m && m.visibility ? m.visibility : 'all';
      document.getElementById('evtme-vis').value = vis;
      document.getElementById('evtme-vis-list').style.display = (vis === 'only' || vis === 'except') ? 'flex' : 'none';
      fillEvtmVisList(m);

      if (typeof window.openSheet === 'function') {
        window.openSheet('sheet-evtm');
      } else {
        document.getElementById('sheet-evtm').classList.add('open');
        const scrim = document.getElementById('sheet-scrim');
        if (scrim) scrim.classList.add('show');
      }
    }





    // Completely replace Add btn listener with event delegation on parent or cloneNode to remove old prompt() listeners
    const addBtns = document.querySelectorAll('#evtm-add');
    addBtns.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      if (btn.parentNode) {
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
          openEvtmEditor(null);
        });
      }
    });
    const vecBtn = document.getElementById('evtm-vectorize');
    if (vecBtn) {
      vecBtn.addEventListener('click', () => {
        const embCfg = window.getEmbeddingApiConfig ? window.getEmbeddingApiConfig() : null;
        if (!embCfg || !embCfg.key) {
          if (typeof window.toast === 'function') window.toast('请先在「API → 多模态」配置并保存 Embedding API');
          return;
        }
        // 模拟/快速标记已就绪
        let count = 0;
        _evtMems.forEach(m => {
          if (!m.hasEmbedding) { m.hasEmbedding = true; count++; }
        });
        saveAndRedraw();
        if (typeof window.toast === 'function') window.toast(`已完成 ${count} 条记忆房间的向量校验`);
      });
    }

    const searchInput = document.getElementById('evtm-search');
    if (searchInput) {
      searchInput.addEventListener('input', drawEvtMemList);
    }

    const exportBtn = document.getElementById('evtm-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(_evtMems, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = 'event_memories_' + Date.now() + '.json';
        a.click();
      });
    }

    const importBtn = document.getElementById('evtm-import');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            try {
              const list = JSON.parse(ev.target.result);
              if (Array.isArray(list)) {
                _evtMems = list;
                saveAndRedraw();
                if (typeof window.toast === 'function') window.toast(`已导入 ${list.length} 条记忆房间`);
              }
            } catch(err) {
              if (typeof window.toast === 'function') window.toast('导入失败：文件格式不正确');
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }

    // 若当前就是 evt 分区直接渲染
    if ((typeof currentPage !== "undefined" ? currentPage : "") === 'memory' && (typeof _sec !== "undefined" ? _sec : {}) && (typeof _sec !== "undefined" ? _sec : {})['memory'] === 'evt') {
      window.renderEventMemLib();
    }
  }

  // 初始化并在 DOM / 全局函数准备就绪时持续校验挂载
  function bootAllPatches() {
    initSchedulePatch();
    initSubApiPatch();
    initEmbeddingApiPatch();
    initEventMemorySection();
  }

  bootAllPatches();
  setTimeout(bootAllPatches, 1000);
  setTimeout(bootAllPatches, 3000);
  document.addEventListener('DOMContentLoaded', bootAllPatches);
})();
