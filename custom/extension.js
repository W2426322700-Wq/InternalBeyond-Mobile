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
      str = str.replace(/【语气[:：][^】]{1,6}】\s*/g, '');
      // 过滤所有英文/中文方括号语气音效标签：[sighs], [laughs], [warm][quiet], [pauses], [chuckle] 等
      str = str.replace(/\[[a-zA-Z0-9_\-\s,'.:!?()\u4e00-\u9fa5]{1,80}\]/g, '');
      // 清理由于标签删除留下的多余连续空格
      str = str.replace(/ {2,}/g, ' ');
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

  // 挂载卡片至指定 DOM 容器
  function attachToneCardToContainer(container, isPerApi, fid) {
    if (!container) return;

    var voiceInput = isPerApi ? container.querySelector('[data-k="voice"]') : container.querySelector('#call-voice');
    if (!voiceInput) return;

    var voiceGroup = voiceInput.closest('.f-group');
    if (!voiceGroup) return;

    var cardId = isPerApi ? ('call-el-tone-card-perapi-' + fid) : 'call-el-tone-card-global';
    var card = document.getElementById(cardId);

    if (!card) {
      card = document.createElement('div');
      card.id = cardId;
      card.style.cssText = 'margin-top:10px;margin-bottom:12px;padding:12px;background:rgba(2,132,199,0.06);border:1px solid rgba(2,132,199,0.25);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.05)';
      card.innerHTML = `
        <div style="font-weight:600;color:var(--accent,#0284c7);font-size:13px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
          <span>🎙️ ElevenLabs v3 专属语气词模式</span>
        </div>
        <div class="f-group" style="margin-bottom:8px">
          <div class="sel">
            <select class="el-tone-sw" style="font-size:13px;padding:6px 10px;border-radius:6px;width:100%">
              <option value="off">关闭（使用默认 8 种简单语气）</option>
              <option value="on">开启（使用 ElevenLabs v3 动态语气与音效标签）</option>
            </select>
          </div>
        </div>
        <div class="el-tone-prompt-wrap" style="display:none;margin-top:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <label style="font-size:12px;color:var(--tx2,#475569);font-weight:500;margin:0">
              专属语气词提示词指令（自动注入 AI 提示词）：
            </label>
            <button type="button" class="el-tone-reset-btn" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--accent,#0284c7);color:var(--accent,#0284c7);background:none;cursor:pointer;line-height:1.2">恢复默认</button>
          </div>
          <textarea class="el-tone-prompt" rows="8" style="width:100%;font-size:12px;font-family:monospace;line-height:1.45;padding:8px;border-radius:6px;border:1px solid var(--bd,#cbd5e1);background:var(--bg1,#ffffff);color:var(--tx1,#1e293b);resize:vertical;box-sizing:border-box"></textarea>
          <div style="font-size:11px;color:var(--tx3,#64748b);margin-top:4px;line-height:1.4">
            💡 开启后，AI 将根据角色心理自动生成如 <code>[voice breaking]</code>、<code>[nervous laugh]</code> 等精致音效标签。聊天界面自动隐藏，音频合成原样保留。
          </div>
        </div>
      `;

      voiceGroup.insertAdjacentElement('afterend', card);

      var sw = card.querySelector('.el-tone-sw');
      var ta = card.querySelector('.el-tone-prompt');
      var wrap = card.querySelector('.el-tone-prompt-wrap');
      var resetBtn = card.querySelector('.el-tone-reset-btn');

      var syncUIState = function () {
        var isOn = (sw.value === 'on');
        wrap.style.display = isOn ? 'block' : 'none';
      };

      sw.addEventListener('change', async function () {
        syncUIState();
        if (typeof loadCALL === 'function') await loadCALL();
        if (typeof _callS !== 'undefined' && _callS) {
          if (isPerApi && fid) {
            _callS.perApi = _callS.perApi || {};
            _callS.perApi[fid] = _callS.perApi[fid] || {};
            _callS.perApi[fid].elToneOn = (sw.value === 'on');
            _callS.perApi[fid].elTonePrompt = ta.value;
          } else {
            _callS.elToneOn = (sw.value === 'on');
            _callS.elTonePrompt = ta.value;
          }
          if (typeof saveCALL === 'function') await saveCALL();
        }
        if (typeof toast === 'function') {
          toast(sw.value === 'on' ? '已开启 ElevenLabs v3 专属语气词模式' : '已关闭 ElevenLabs 专属语气词');
        }
      });

      var saveTimer = null;
      var doSavePrompt = async function () {
        if (typeof loadCALL === 'function') await loadCALL();
        if (typeof _callS !== 'undefined' && _callS) {
          if (isPerApi && fid) {
            _callS.perApi = _callS.perApi || {};
            _callS.perApi[fid] = _callS.perApi[fid] || {};
            _callS.perApi[fid].elTonePrompt = ta.value;
          } else {
            _callS.elTonePrompt = ta.value;
          }
          if (typeof saveCALL === 'function') await saveCALL();
        }
      };

      ta.addEventListener('input', function () {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(doSavePrompt, 400);
      });

      ta.addEventListener('blur', function () {
        clearTimeout(saveTimer);
        doSavePrompt();
      });

      if (resetBtn) {
        resetBtn.addEventListener('click', async function () {
          ta.value = DEFAULT_EL_PROMPT;
          await doSavePrompt();
          if (typeof toast === 'function') {
            toast('已恢复默认语气词提示词');
          }
        });
      }
    }

    // 确定是否应该显示 Card
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

    if (isCloud && isEl) {
      card.style.display = 'block';
      if (typeof _callS !== 'undefined' && _callS) {
        var sw = card.querySelector('.el-tone-sw');
        var ta = card.querySelector('.el-tone-prompt');
        var wrap = card.querySelector('.el-tone-prompt-wrap');

        if (sw && ta && wrap) {
          var targetObj = (isPerApi && fid && _callS.perApi && _callS.perApi[fid]) ? _callS.perApi[fid] : _callS;
          var isOn = !!targetObj.elToneOn;

          if (document.activeElement !== sw) {
            sw.value = isOn ? 'on' : 'off';
          }
          wrap.style.display = isOn ? 'block' : 'none';

          var currentTargetKey = (isPerApi ? ('perapi_' + fid) : 'global');
          if (document.activeElement !== ta && card.dataset.loadedKey !== currentTargetKey) {
            ta.value = targetObj.elTonePrompt || DEFAULT_EL_PROMPT;
            card.dataset.loadedKey = currentTargetKey;
          }
        }
      }
    } else {
      card.style.display = 'none';
    }
  }

  // 渲染/注入控制 UI
  function injectElToneUI() {
    // 1. 全局配置卡片：针对 #call-cloud-g 容器
    var globalCloudGroup = document.getElementById('call-cloud-g');
    if (globalCloudGroup) {
      attachToneCardToContainer(globalCloudGroup, false, null);
    }

    // 2. 单独配置卡片：针对 #ibcs-d-voice (详情页单独配置容器)
    var perApiVoiceHost = document.querySelector('#ib-callset #ibcs-d-voice');
    if (perApiVoiceHost && perApiVoiceHost.children.length > 0) {
      var currentFid = (typeof _ibcsDetC !== 'undefined' && _ibcsDetC) ? _ibcsDetC.id : null;
      if (currentFid) {
        attachToneCardToContainer(perApiVoiceHost, true, currentFid);
      }
    }
  }

  // ----------------------------------------------------
  // 4. HTML5 Web Speech API 0毫秒同步直连支持
  // ----------------------------------------------------
  var SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;

  window._isBrowserNativeVT = false;
  window._nativeTranscript = '';
  window._nativeRecInstance = null;
  window._nativeIsListening = false;

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
      if (window._isBrowserNativeVT) return true;
      if (typeof _vt !== 'undefined' && _vt && _vt.model === 'browser-native') return true;
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

    var origCallASR = window.callASR;
    window.callASR = async function (blob) {
      try {
        var vt = typeof loadVT === 'function' ? await loadVT() : null;
        if (vt && vt.model === 'browser-native') {
          var text = window._nativeTranscript || '';
          if (window._nativeIsListening) {
            text = await window._nativeSpeechStop();
            window._nativeSpeechStart();
          }
          return text || '';
        }
      } catch (e) {
        console.warn('[WebSpeechAPI] callASR error:', e);
      }
      return origCallASR ? origCallASR.apply(this, arguments) : '';
    };
  }

  // ----------------------------------------------------
  // 5. 初始化与 DOM 监听入口
  // ----------------------------------------------------
  function initExtension() {
    hookMdRenderHtml();
    hookFillTextInto();
    hookIbcCleanSent();
    hookRenderAiBody();
    hookCallEffMerge();
    hookToneClause();
    hookVTReady();
    bindGlobalMicTrigger();
    hookTranscribe();

    setInterval(injectElToneUI, 400);
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
