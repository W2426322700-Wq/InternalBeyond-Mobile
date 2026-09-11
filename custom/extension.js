/**
 * InternalBeyond Mobile - 自定义扩展补丁
 * 
 * 本脚本提供移动端防缩放手势拦截与异常启动兜底保护。
 */
(function () {
  'use strict';

  // 1. 移动端触摸样式锁定：禁止双击缩放，保证流畅滚动
  var st = document.createElement('style');
  st.id = 'ib-lock-zoom-css';
  st.textContent = 'html,body{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}';
  document.head.appendChild(st);

  // 2. iOS Safari 手势拦截（针对 Safari 忽略 user-scalable=no 的特性）
  var noop = function (e) {
    if (e.cancelable) e.preventDefault();
  };
  document.addEventListener('gesturestart', noop, { passive: false });
  document.addEventListener('gesturechange', noop, { passive: false });
  document.addEventListener('gestureend', noop, { passive: false });

  // 3. 白屏防御看门狗：防止预遮罩（#lk-preveil）因配置加载挂起而长时间滞留
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

  console.log('[InternalBeyond Extension] Mobile lock & watchdog initialized.');
})();
