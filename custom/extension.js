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

    // 自动 Service Worker 版本检测与离线缓存强制刷新引擎
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          registrations.forEach(function (reg) {
            reg.update().catch(function () {});
          });
        }).catch(function () {});
      }
      if ('caches' in window) {
        caches.keys().then(function (keys) {
          var validCache = 'ib-cache-v2211-cal-update';
          keys.forEach(function (key) {
            if (key !== validCache && key.indexOf('ib-cache') === 0) {
              caches.delete(key).catch(function () {});
            }
          });
        }).catch(function () {});
      }
    } catch (e) {}

    // 自动确保日历 APP 自动就绪并挂载到桌面
    function ensureCalendarApp() {
      try {
        if (window.IBApps) {
          if (typeof window.IBApps.install === 'function') {
            var list = typeof window.IBApps.installed === 'function' ? window.IBApps.installed() : [];
            if (!list || !list.includes('timeline_cal')) {
              window.IBApps.install('timeline_cal').catch(function () {});
            }
          }
        }
        if (!document.querySelector('script[data-ibapp="timeline_cal"]') && !document.querySelector('script[src*="ib-app-schedule.js"]')) {
          var sc = document.createElement('script');
          sc.src = 'apps/ib-app-schedule.js?v=' + Date.now();
          sc.defer = true;
          sc.dataset.ibapp = 'timeline_cal';
          document.head.appendChild(sc);
        }
      } catch (e) {}
    }
    ensureCalendarApp();
    setTimeout(ensureCalendarApp, 600);
    setTimeout(ensureCalendarApp, 2000);
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
              return JSON.stringify(payload);
            }
          }
        }
      }
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

  // 记录单条日程到存储
  async function appendScheduleRecord(record) {
    try {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem('my_time_schedules') || '[]');
      } catch(e) {}
      if (!Array.isArray(list)) list = [];

      // 防抖去重：如果 2 分钟内已有相同 category 和时间的记录则跳过
      const isDuplicated = list.some(it => {
        return it.date === record.date && it.category === record.category && (Math.abs((it.created || 0) - (record.created || 0)) < 120000);
      });
      if (isDuplicated) return false;

      list.push(record);
      localStorage.setItem('my_time_schedules', JSON.stringify(list));

      if (window.addAIScheduleEvent) {
        window.addAIScheduleEvent(record);
      }
      return true;
    } catch(err) {
      console.warn('[Schedule Patch] 保存日程异常:', err);
      return false;
    }
  }

  // 监听所有 AI 消息生成与落库
  async function processAIMessageForSchedule(msg) {
    if (!msg || !msg.content) return;
    const text = String(msg.content);

    // 1. 匹配标签格式：<ws_schedule category="学习" start="14:00" end="16:00" title="看书" date="2026-09-14" />
    const reg = /<(?:ws_schedule|ws_cal_schedule)\b([^>]*)\/?>/gi;
    let match;
    let addedCount = 0;
    let hasTagHandled = false;

    while ((match = reg.exec(text)) !== null) {
      hasTagHandled = true;
      const attrs = match[1] || '';
      const getAttr = (name) => {
        const m = attrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
        return m ? m[1].trim() : '';
      };

      const title = getAttr('title') || '';
      let category = getAttr('category') || getAttr('kind') || '';
      const start = getAttr('start') || getAttr('time') || getCurTimeString();
      const end = getAttr('end') || '15:00';
      const date = getLogicDateStr(getAttr('date'), start);

      const isMorning = category.includes('早') || category.includes('醒') || category.includes('起');
      const isNight = category.includes('晚') || category.includes('睡') || category.includes('休') || category.includes('眠');

      if (isMorning) {
        const ok = await appendScheduleRecord({
          id: 'sch_spec_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          date: date,
          title: title || '早安 · 起床',
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
        if (ok) addedCount++;
      } else if (isNight) {
        const ok = await appendScheduleRecord({
          id: 'sch_spec_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          date: date,
          title: title || '晚安 · 入睡',
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
        if (ok) addedCount++;
      } else {
        // 标准化分类名称
        if (category.includes('学') || category.includes('读') || category.includes('课') || category.includes('书')) category = '学习';
        else if (category.includes('乐') || category.includes('游') || category.includes('影') || category.includes('漫')) category = '娱乐';
        else if (category.includes('码') || category.includes('code') || category.includes('程序') || category.includes('开发')) category = '写代码';
        else if (category.includes('玩') || category.includes('出') || category.includes('逛') || category.includes('运动')) category = '出去玩';
        else category = '学习';

        const dur = parseTimeSpanMinutes(start, end);
        const ok = await appendScheduleRecord({
          id: 'sch_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          date: date,
          title: title || category,
          category: category,
          startTime: start,
          endTime: end,
          duration: dur,
          isSpecial: false,
          byAi: true,
          author: msg.friendId || 'AI',
          created: Date.now()
        });
        if (ok) addedCount++;
      }
    }

    if (addedCount > 0 && typeof window.toast === 'function') {
      window.toast(`📅 日历日程已自动同步更新！`);
    }
  }

  // 监听用户发出的聊天消息意图（如“帮我记录我要睡觉了”、“帮我记个早安”）
  async function processUserMessageForIntent(msg) {
    if (!msg || !msg.content || msg.role !== 'user') return;
    const text = String(msg.content).trim();
    const curTime = getCurTimeString();
    const date = getLogicDateStr(null, curTime);

    // 识别睡觉 / 晚安意图
    const isSleepIntent = /(?:帮我)?(?:记录|记一下|记个|记)?(?:我要|准备|去|去要)?(?:睡觉|睡了|睡啦|入睡|晚安)/.test(text) && 
                          (text.includes('睡') || text.includes('晚安'));
    
    // 识别起床 / 早安意图
    const isWakeIntent = /(?:帮我)?(?:记录|记一下|记个|记)?(?:我)?(?:起床|醒了|醒啦|起啦|早安)/.test(text) && 
                         (text.includes('起床') || text.includes('醒') || text.includes('早安'));

    if (isSleepIntent) {
      const ok = await appendScheduleRecord({
        id: 'sch_spec_u_' + Date.now(),
        date: date,
        title: '晚安 · 入睡打卡',
        category: '晚安',
        time: curTime,
        startTime: curTime,
        endTime: curTime,
        duration: 0,
        isSpecial: true,
        byAi: false,
        created: Date.now()
      });
      if (ok && typeof window.toast === 'function') {
        window.toast(`已为你记录「晚安」打卡（${curTime}）`);
      }
    } else if (isWakeIntent) {
      const ok = await appendScheduleRecord({
        id: 'sch_spec_u_' + Date.now(),
        date: date,
        title: '早安 · 起床打卡',
        category: '早安',
        time: curTime,
        startTime: curTime,
        endTime: curTime,
        duration: 0,
        isSpecial: true,
        byAi: false,
        created: Date.now()
      });
      if (ok && typeof window.toast === 'function') {
        window.toast(`已为你记录「早安」打卡（${curTime}）`);
      }
    }
  }

  // 挂载消息监听器
  const originalDbPut = window.dbPut;
  if (typeof originalDbPut === 'function') {
    window.dbPut = async function(storeName, data) {
      if (storeName === 'chatMessages' && data) {
        if (data.role === 'assistant') {
          processAIMessageForSchedule(data);
        } else if (data.role === 'user') {
          processUserMessageForIntent(data);
        }
      }
      return originalDbPut.apply(this, arguments);
    };
  }
})();



