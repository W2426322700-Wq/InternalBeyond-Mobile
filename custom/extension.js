/**
 * InternalBeyond Mobile - 自定义扩展补丁
 * 
 * 本脚本包含：
 * 1. 移动端防缩放手势拦截与白屏看门狗
 * 2. HTML5 标准 Web Speech API（window.SpeechRecognition || window.webkitSpeechRecognition）
 *    浏览器自带原生语音识别全链路彻底同步连通（Safari / Chrome / Edge 直连）
 *    含错误诊断提示与 iFrame 跨域安全兼容指导
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
  // 2. HTML5 Web Speech API 标准识别引擎初始化
  // ----------------------------------------------------
  var SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;

  window._isBrowserNativeVT = false;
  window._nativeTranscript = '';
  window._nativeRecInstance = null;
  window._nativeIsListening = false;
  window._nativeLastError = '';

  function inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  // 0毫秒同步启动函数
  window._nativeSpeechStart = function () {
    window._nativeTranscript = '';
    window._nativeLastError = '';

    if (!SpeechRecClass) {
      window._nativeLastError = 'no-api-support';
      return false;
    }

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
          var hintEl = document.getElementById('vrec-hint');
          if (hintEl) {
            hintEl.textContent = '原生识别：' + window._nativeTranscript;
            hintEl.style.color = '#2563eb';
          }
        }
      };

      rec.onerror = function (e) {
        var errType = (e && e.error) ? e.error : 'unknown';
        window._nativeLastError = errType;
        console.warn('[WebSpeechAPI] Recognition Error:', errType, e);
      };

      rec.onend = function () {
        window._nativeIsListening = false;
      };

      window._nativeRecInstance = rec;
      window._nativeIsListening = true;
      rec.start(); // 0毫秒同步调用，保证用户手势 (User Gesture) 激活策略！
      return true;
    } catch (e) {
      window._nativeLastError = (e && e.message) || String(e);
      console.warn('[WebSpeechAPI] Start Exception:', e);
      return false;
    }
  };

  window._nativeSpeechStop = function () {
    return new Promise(function (resolve) {
      if (!window._nativeRecInstance || !window._nativeIsListening) {
        resolve({ text: window._nativeTranscript || '', err: window._nativeLastError });
        return;
      }
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        window._nativeIsListening = false;
        resolve({ text: window._nativeTranscript || '', err: window._nativeLastError });
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

  // ----------------------------------------------------
  // 3. 拦截 loadVT 与 vtReady，保证数据链路 100% 畅通
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // 4. 同步捕获手势按压事件（最关键触发环节！）
  // ----------------------------------------------------
  function bindGlobalMicTrigger() {
    var handleGestureDown = function (ev) {
      var target = ev.target;
      if (!target) return;
      var isMic = target.closest('#cv-mic') || target.closest('.chat-mic') || target.closest('#chat-mic');
      if (isMic && window._isBrowserNativeVT) {
        // 0 毫秒无延迟同步启动，避免微任务丢失 User Gesture！
        window._nativeSpeechStart();
      }
    };

    // 在捕获阶段拦截 pointerdown, touchstart, mousedown
    window.addEventListener('pointerdown', handleGestureDown, true);
    window.addEventListener('touchstart', handleGestureDown, true);
    window.addEventListener('mousedown', handleGestureDown, true);
  }

  // ----------------------------------------------------
  // 5. 劫持 vtTranscribe 与 callASR，直接对接识别文本
  // ----------------------------------------------------
  function hookTranscribe() {
    if (window._nativeTranscribeHooked) return;
    window._nativeTranscribeHooked = true;

    var origVtTranscribe = window.vtTranscribe;
    window.vtTranscribe = async function (blob, mime) {
      try {
        var vt = typeof loadVT === 'function' ? await loadVT() : null;
        if (vt && vt.model === 'browser-native') {
          var text = window._nativeTranscript || '';
          var err = window._nativeLastError || '';

          if (window._nativeIsListening) {
            var res = await window._nativeSpeechStop();
            if (res.text) text = res.text;
            if (res.err) err = res.err;
          }

          if (text) {
            window._nativeTranscript = '';
            if (typeof toast === 'function') {
              toast('原生识别成功：' + text);
            }
            return text;
          }

          if (err === 'not-allowed' || err === 'service-not-allowed') {
            if (typeof toast === 'function') {
              toast('预览框限制了语音识别权限，请点击右上角在新标签页打开', 4000);
            }
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
            var res = await window._nativeSpeechStop();
            text = res.text;
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
  // 6. UI 下拉选项 & 详细诊断测试组件
  // ----------------------------------------------------
  function injectUIEnhancements() {
    var sel = document.getElementById('vt-mpre');
    if (!sel) return;

    var exists = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === 'browser-native') {
        exists = true;
        sel.options[i].textContent = 'browser-native（浏览器自带语音识别 · Safari/Chrome/Edge）';
        break;
      }
    }

    if (!exists) {
      var opt = document.createElement('option');
      opt.value = 'browser-native';
      opt.textContent = 'browser-native（浏览器自带语音识别 · Safari/Chrome/Edge）';
      sel.appendChild(opt);
    }

    if (!sel._nativeBound) {
      sel._nativeBound = true;
      sel.addEventListener('change', async function () {
        if (sel.value === 'browser-native') {
          window._isBrowserNativeVT = true;
          var modelInput = document.getElementById('vt-model');
          var keyInput = document.getElementById('vt-key');
          var epInput = document.getElementById('vt-ep');

          if (modelInput) modelInput.value = 'browser-native';
          if (keyInput) keyInput.value = 'browser-native';
          if (epInput && (!epInput.value || epInput.value.trim() === 'https://api.openai.com/v1')) {
            epInput.value = 'browser-native';
          }

          var upd = {
            id: 'voiceTrans',
            endpoint: 'browser-native',
            apiKey: 'browser-native',
            model: 'browser-native'
          };
          try {
            if (typeof dbPut === 'function') await dbPut('apiSettings', upd);
            if (typeof _vt !== 'undefined') window._vt = upd;
          } catch (e) {}

          if (typeof toast === 'function') {
            toast('已开启浏览器自带语音识别（Safari Siri / Chrome 谷歌云）');
          }

          var saveBtn = document.getElementById('vt-save');
          if (saveBtn) {
            try { saveBtn.click(); } catch (e) {}
          }
        } else {
          window._isBrowserNativeVT = false;
        }
      });
    }

    var card = sel.closest('.card');
    if (card && !card.querySelector('#vt-native-test-btn')) {
      var btnGroup = document.createElement('div');
      btnGroup.style.marginTop = '10px';
      btnGroup.innerHTML = `
        <div style="font-size:12px;color:var(--tx3,#64748b);margin-bottom:8px;line-height:1.5;background:rgba(2,132,199,0.06);padding:8px 10px;border-radius:6px;border:1px solid rgba(2,132,199,0.15)">
          💡 <strong>浏览器原生识别（Web Speech API）须知</strong>：<br/>
          Safari 调 Siri 听写、Chrome 调 Google 云听写。<br/>
          ⚠️ <strong>如果在内嵌预览框（iFrame）中无响应</strong>，是由于浏览器安全策略限制了内嵌框架调用原生语音 API 的权限。请点击页面右上角的 <strong>“在新标签页打开（Open in new tab）”</strong> 按钮在独立窗口中使用。
        </div>
        <button type="button" class="btn wide" id="vt-native-test-btn" style="background:var(--accent-subtle, #e0f2fe);color:var(--accent, #0284c7);border:1px solid rgba(2,132,199,0.3);font-weight:600;padding:8px 12px;cursor:pointer">
          🎙️ 点击测试浏览器原生识别（诊断模式）
        </button>
      `;
      card.appendChild(btnGroup);

      var testBtn = card.querySelector('#vt-native-test-btn');
      if (testBtn) {
        testBtn.addEventListener('click', function () {
          if (!SpeechRecClass) {
            alert('❌ 当前浏览器未开放 HTML5 Web Speech API 接口。\n\n请使用原生 Safari、Chrome 或 Edge 浏览器打开。');
            return;
          }

          testBtn.textContent = '正在实时听写（请对着麦克风说话）…';
          testBtn.disabled = true;

          // 0毫秒同步唤起
          window._nativeSpeechStart();

          setTimeout(async function () {
            var res = await window._nativeSpeechStop();
            testBtn.disabled = false;
            testBtn.textContent = '🎙️ 点击测试浏览器原生识别（诊断模式）';

            if (res.text) {
              alert('✅ 原生识别成功！\n\n识别出的内容：\n"' + res.text + '"\n\n数据链路完全连通！可正常发送语音消息给 AI。');
            } else {
              var errDetail = res.err || 'no-speech-detected';
              var isEmbedded = inIframe();

              var msg = '⚠️ 暂未检测到识别文字。\n\n【诊断类型】：' + errDetail + '\n';
              if (errDetail === 'not-allowed' || errDetail === 'service-not-allowed' || isEmbedded) {
                msg += '\n【原因】：当前网页运行在开发环境的嵌入式 iFrame 框架内，浏览器（Safari / Chrome）出于安全跨域规范，限制了 iFrame 内部直接调用系统 Web Speech API 引擎的能力。\n\n【解决方法】：\n请点击页面右上角的“在新标签页打开 (Open in new tab)”或在浏览器独立窗口打开此页面进行测试！';
              } else if (errDetail === 'no-speech') {
                msg += '\n【原因】：未录制到声音，请检查麦克风并确保大声说话。';
              } else {
                msg += '\n请确认已在浏览器弹窗中授予麦克风权限。如果在预览小框中无响应，请切换到“在新标签页打开”重试。';
              }
              alert(msg);
            }
          }, 4500);
        });
      }
    }

    async function syncNativeVTState() {
      try {
        if (typeof loadVT === 'function') {
          var vt = await loadVT();
          if (vt && vt.model === 'browser-native') {
            window._isBrowserNativeVT = true;
            sel.value = 'browser-native';
          }
        }
      } catch (e) {}
    }

    syncNativeVTState();
  }

  // 初始化入口
  function initExtension() {
    hookVTReady();
    injectUIEnhancements();
    bindGlobalMicTrigger();
    hookTranscribe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
  } else {
    initExtension();
  }

  setTimeout(initExtension, 600);
  setTimeout(initExtension, 2000);

  console.log('[InternalBeyond Extension] Diagnostic Web Speech API pipeline active.');
})();
