(function() {
  'use strict';
  if (!window.IBApps) return;

  var host = null;
  var ctx = null;
  var currentSelectedDate = getLogicToday();
  var isAddModalOpen = false;
  var editingItem = null;
  var deleteConfirmState = false; // 内联二次确认状态

  function vib() {
    try {
      if (navigator.vibrate) navigator.vibrate(15);
    } catch(e) {}
  }

  // 极简线条风格 SVG 图标
  var SVG_ICONS = {
    study: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="13" y2="10"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    entertainment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    outing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  // 常规跨时间段分类（由浅到深蓝色系梯度）
  var CATEGORIES = [
    { 
      id: 'study', 
      name: '学习', 
      icon: SVG_ICONS.study, 
      color: '#70a4d4', 
      bg: 'rgba(112, 164, 212, 0.14)', 
      border: 'rgba(112, 164, 212, 0.35)', 
      solid: '#5b92c4',
      lightBg: 'linear-gradient(135deg, rgba(112, 164, 212, 0.18), rgba(112, 164, 212, 0.06))',
      txColor: 'var(--tx)',
      tagColor: '#4f85b6',
      isSpecial: false
    },
    { 
      id: 'code', 
      name: '写代码', 
      icon: SVG_ICONS.code, 
      color: '#3d8cd6', 
      bg: 'rgba(61, 140, 214, 0.18)', 
      border: 'rgba(61, 140, 214, 0.42)', 
      solid: '#2d77bc',
      lightBg: 'linear-gradient(135deg, rgba(61, 140, 214, 0.24), rgba(61, 140, 214, 0.08))',
      txColor: 'var(--tx)',
      tagColor: '#256eb4',
      isSpecial: false
    },
    { 
      id: 'entertainment', 
      name: '娱乐', 
      icon: SVG_ICONS.entertainment, 
      color: '#1a75d2', 
      bg: 'rgba(26, 117, 210, 0.24)', 
      border: 'rgba(26, 117, 210, 0.48)', 
      solid: '#135fae',
      lightBg: 'linear-gradient(135deg, rgba(26, 117, 210, 0.32), rgba(26, 117, 210, 0.14))',
      txColor: 'var(--tx)',
      tagColor: '#0f549c',
      isSpecial: false
    },
    { 
      id: 'outing', 
      name: '出去玩', 
      icon: SVG_ICONS.outing, 
      color: '#0052cc', // 饱和度高、深邃皇家蓝
      bg: 'rgba(0, 82, 204, 0.35)', 
      border: 'rgba(0, 82, 204, 0.65)', 
      solid: '#0043a8',
      lightBg: 'linear-gradient(135deg, rgba(0, 82, 204, 0.48), rgba(0, 82, 204, 0.22))',
      txColor: '#ffffff',
      tagColor: '#bde0fe',
      isSpecial: false
    }
  ];

  // 特殊单时间点事项（全蓝色系：早安浅蓝 / 晚安深蓝），不参与投入时间统计
  var SPECIAL_CATEGORIES = [
    {
      id: 'morning',
      name: '早安',
      icon: SVG_ICONS.sun,
      color: '#70a4d4', // 晨曦清透浅天蓝
      bg: 'rgba(112, 164, 212, 0.2)',
      border: 'rgba(112, 164, 212, 0.45)',
      solid: '#1c3656', // 墨蓝色图标
      badgeBg: 'linear-gradient(135deg, rgba(235, 244, 253, 0.96), rgba(216, 234, 252, 0.9))',
      badgeBgDark: 'linear-gradient(135deg, rgba(34, 54, 80, 0.8), rgba(24, 40, 64, 0.9))',
      txColor: '#1c3656', // 普通墨蓝色字样
      txColorDark: '#dbeafe',
      isSpecial: true
    },
    {
      id: 'night',
      name: '晚安',
      icon: SVG_ICONS.moon,
      color: '#2b588c', // 柔和深蓝，不再过深过黑
      bg: 'rgba(255, 255, 255, 0.22)', // 图标背景轻盈透白
      border: 'rgba(70, 115, 170, 0.55)',
      solid: '#ffffff', // 晚安图标纯白色
      badgeBg: 'linear-gradient(135deg, rgba(44, 89, 140, 0.92), rgba(30, 64, 105, 0.96))',
      badgeBgDark: 'linear-gradient(135deg, rgba(36, 72, 115, 0.9), rgba(25, 52, 86, 0.95))',
      txColor: '#ffffff', // 纯白字样
      txColorDark: '#f8fafc',
      isSpecial: true
    }
  ];

  var ALL_TYPES = CATEGORIES.concat(SPECIAL_CATEGORIES);

  // 凌晨 06:00 为分界点的作息逻辑
  function getLogicToday() {
    var now = new Date();
    if (now.getHours() < 6) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function timeStrToOffsetMinutes(timeStr) {
    if (!timeStr) return 0;
    var parts = String(timeStr).split(':');
    var h = parseInt(parts[0] || 0, 10);
    var m = parseInt(parts[1] || 0, 10);
    var adjustedH = (h < 6) ? (h + 24) : h;
    return (adjustedH - 6) * 60 + m;
  }

  function formatYMD(d) {
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var weekMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return {
      monthDay: m + '月' + day + '日',
      yearWeek: d.getFullYear() + ' · ' + weekMap[d.getDay()] + '（06:00 – 次日06:00）'
    };
  }

  var _renderDebounceTimer = null;

  async function getSchedules() {
    var list = [];
    try {
      if (typeof window.dbGet === 'function') {
        var row = await window.dbGet('apiSettings', 'app_timeline_cal_my_time_schedules');
        if (row && Array.isArray(row.val) && row.val.length > 0) {
          list = row.val;
        }
      }
    } catch(e) {}

    if (!list || list.length === 0) {
      try {
        var str = localStorage.getItem('my_time_schedules');
        if (str) {
          var parsed = JSON.parse(str);
          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
        }
      } catch(e2) {}
    }

    if ((!list || list.length === 0) && ctx && ctx.storage) {
      try {
        var fromCtx = await ctx.storage.get('my_time_schedules');
        if (Array.isArray(fromCtx) && fromCtx.length > 0) list = fromCtx;
      } catch(e3) {}
    }

    return Array.isArray(list) ? list : [];
  }

  async function saveSchedules(list) {
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
          updated: Date.now()
        });
      }
    } catch(e) {}
    try {
      if (ctx && ctx.storage) {
        await ctx.storage.set('my_time_schedules', list);
      }
    } catch(e) {}
    try {
      window.dispatchEvent(new CustomEvent('ib-schedule-updated', { detail: { list: list } }));
    } catch(e) {}
  }

  var _onScheduleUpdateGlobal = null;

  IBApps.register({
    id: 'timeline_cal',
    name: '日历',
    version: '2.0.0',
    sdk: 2,
    wall: true,
    headless: true,
    icon: '<rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="15" x2="16" y2="15"/>',
    mount: async function(container, appCtx) {
      host = container;
      ctx = appCtx;
      host.style.padding = '0';
      host.style.overflow = 'hidden';
      host.style.display = 'flex';
      host.style.flexDirection = 'column';

      injectStyles();
      await renderApp();

      if (ctx.on) {
        ctx.on('message', function() {
          if (_renderDebounceTimer) clearTimeout(_renderDebounceTimer);
          _renderDebounceTimer = setTimeout(function() {
            renderApp();
          }, 50);
        });
      }

      _onScheduleUpdateGlobal = function() {
        if (!host) return;
        if (_renderDebounceTimer) clearTimeout(_renderDebounceTimer);
        _renderDebounceTimer = setTimeout(function() {
          renderApp();
        }, 50);
      };
      window.addEventListener('ib-schedule-updated', _onScheduleUpdateGlobal);
    },
    unmount: function() {
      if (_onScheduleUpdateGlobal) {
        window.removeEventListener('ib-schedule-updated', _onScheduleUpdateGlobal);
        _onScheduleUpdateGlobal = null;
      }
      if (host) host.innerHTML = '';
      host = null;
      ctx = null;
      isAddModalOpen = false;
      editingItem = null;
      deleteConfirmState = false;
    }
  });

  function injectStyles() {
    var old = document.getElementById('ib-tc-css');
    if (old) old.remove();
    var st = document.createElement('style');
    st.id = 'ib-tc-css';
    st.textContent = `
      .ib-tc {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
        color: var(--tx);
        font-family: inherit;
        background: var(--bg);
      }
      .ib-tc-top {
        flex: none;
        display: flex;
        align-items: center;
        gap: 10px;
        margin: calc(6px + var(--sat, 0px)) 12px 6px;
        padding: 8px 12px;
        border-radius: 16px;
        background: var(--sheet);
        border: 1px solid var(--glass-line);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        z-index: 20;
      }
      .ib-tc-top .ib-tc-close {
        flex: none;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 5px 12px;
        background: none;
        color: var(--tx2);
        font-size: 0.72rem;
        font-family: inherit;
        letter-spacing: 0.04em;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        -webkit-tap-highlight-color: transparent;
      }
      .ib-tc-top .ib-tc-close svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; }
      .ib-tc-top .ib-tc-close:active { transform: scale(0.96); }

      .ib-tc-tt {
        flex: 1;
        min-width: 0;
        font-family: var(--serif);
        font-weight: 600;
        font-size: 0.98rem;
        color: var(--tx);
        letter-spacing: 0.02em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ib-tc-tt small {
        display: block;
        font-family: var(--disp);
        font-weight: 300;
        font-size: 0.52rem;
        letter-spacing: 0.22em;
        color: var(--tx3);
        text-transform: uppercase;
        margin-top: 1px;
      }

      .ib-tc-pick {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 32px;
        padding: 0 13px;
        border-radius: 11px;
        border: 1px solid rgba(114, 168, 216, 0.55);
        background: rgba(150, 190, 235, 0.15);
        color: var(--acc);
        font-size: 0.76rem;
        font-family: inherit;
        letter-spacing: 0.04em;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
        box-shadow: 0 3px 10px rgba(90, 120, 170, 0.1);
      }
      body.theme-infernal .ib-tc-pick {
        border-color: rgba(165, 190, 228, 0.25);
        background: rgba(30, 45, 75, 0.5);
      }
      .ib-tc-pick svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2; }
      .ib-tc-pick:active { transform: scale(0.97); }

      .ib-tc-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 2px 14px calc(30px + var(--sab, 0px));
      }

      .ib-tc-section-lab {
        font-family: var(--disp);
        font-weight: 300;
        font-size: 0.6rem;
        letter-spacing: 0.22em;
        color: var(--tx3);
        text-transform: uppercase;
        margin: 10px 2px 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      /* 蓝色系阶梯统计网格（只统计四大投入，不计早晚安） */
      .ib-tc-grid-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 14px;
      }
      .ib-tc-stat-tile {
        position: relative;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 11px;
        border-radius: 12px;
        background: var(--soft);
        border: 1px solid var(--line);
      }
      .ib-tc-stat-ico {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
      }
      .ib-tc-stat-ico svg { width: 14px; height: 14px; }
      .ib-tc-stat-num {
        font-family: var(--serif);
        font-weight: 600;
        font-size: 1.02rem;
        color: var(--tx);
        line-height: 1.1;
      }
      .ib-tc-stat-pct {
        font-family: var(--disp);
        font-weight: 300;
        font-size: 0.52rem;
        letter-spacing: 0.1em;
        color: var(--tx3);
        margin-top: 1px;
      }

      .ib-tc-divider {
        height: 1px;
        background: var(--line);
        margin: 12px 0 10px;
        opacity: 0.75;
      }

      .ib-tc-daybar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 2px 2px 8px;
      }
      .ib-tc-nav-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid var(--line);
        background: var(--soft);
        color: var(--tx2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .ib-tc-nav-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; }
      .ib-tc-day-main { text-align: center; }
      .ib-tc-day-t { font-family: var(--serif); font-weight: 600; font-size: 1.15rem; color: var(--tx); }
      .ib-tc-day-sub { font-family: var(--disp); font-weight: 300; font-size: 0.54rem; letter-spacing: 0.16em; color: var(--tx3); margin-top: 2px; }

      .ib-cal-schedule-view {
        position: relative;
        margin-top: 8px;
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
        padding-top: 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.03);
      }
      .ib-cal-grid {
        position: relative;
        height: 1214px;
        width: 100%;
        box-sizing: border-box;
      }
      .ib-cal-hour-row {
        position: absolute;
        left: 0;
        right: 0;
        height: 50px;
        box-sizing: border-box;
        border-top: 1px solid var(--line);
        display: flex;
        pointer-events: auto;
      }
      .ib-cal-hour-label {
        width: 48px;
        flex: none;
        font-family: var(--disp);
        font-size: 0.64rem;
        color: var(--tx3);
        letter-spacing: 0.05em;
        text-align: right;
        padding-right: 8px;
        margin-top: -8px;
        user-select: none;
      }
      .ib-cal-hour-line {
        flex: 1;
        height: 100%;
        border-left: 1px solid var(--line);
        box-sizing: border-box;
      }
      .ib-cal-hour-line:hover {
        background: rgba(114, 168, 216, 0.05);
      }

      /* 跨时间段卡片（由浅到深蓝色系） */
      .ib-cal-event-block {
        position: absolute;
        left: 54px;
        right: 8px;
        border-radius: 10px;
        box-sizing: border-box;
        padding: 6px 10px;
        overflow: hidden;
        cursor: pointer;
        z-index: 10;
        box-shadow: 0 3px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.35);
        border: 1px solid var(--glass-line);
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        user-select: none;
        -webkit-user-select: none;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      body.theme-infernal .ib-cal-event-block {
        box-shadow: 0 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.1);
      }
      .ib-cal-event-block:active {
        transform: scale(0.985);
      }
      .ib-cal-ev-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .ib-cal-ev-title {
        font-size: 0.82rem;
        font-weight: 600;
        line-height: 1.25;
        word-break: break-all;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ib-cal-ev-time {
        font-family: var(--disp);
        font-size: 0.62rem;
        letter-spacing: 0.05em;
        opacity: 0.88;
        margin-top: 2px;
      }
      .ib-cal-ev-tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.62rem;
        font-weight: 500;
      }
      .ib-cal-ev-tag svg { width: 11px; height: 11px; }

      /* 特殊单时间点打卡徽章（蓝色系：早安浅蓝 / 晚安深蓝） */
      .ib-cal-point-badge {
        position: absolute;
        left: 54px;
        right: 8px;
        height: 28px;
        margin-top: -14px; /* 居中挂在刻度线上 */
        border-radius: 999px;
        box-sizing: border-box;
        padding: 0 10px 0 6px;
        cursor: pointer;
        z-index: 12;
        box-shadow: 0 3px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4);
        border: 1px solid var(--glass-line);
        display: flex;
        align-items: center;
        gap: 7px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        user-select: none;
        -webkit-user-select: none;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .ib-cal-point-badge:active {
        transform: scale(0.98);
      }
      .ib-cal-point-ico {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
      }
      .ib-cal-point-ico svg { width: 12px; height: 12px; }
      .ib-cal-point-txt {
        font-size: 0.76rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ib-cal-point-time {
        font-family: var(--disp);
        font-size: 0.62rem;
        letter-spacing: 0.05em;
        opacity: 0.85;
        margin-left: auto;
        white-space: nowrap;
      }

      .ib-cal-now-line {
        position: absolute;
        left: 42px;
        right: 0;
        height: 2px;
        background: #ef4444;
        z-index: 15;
        pointer-events: none;
      }
      .ib-cal-now-line::before {
        content: "";
        position: absolute;
        left: -4px;
        top: -3px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
      }

      /* 模态弹窗 */
      .ib-tc-modal-mask {
        position: absolute;
        inset: 0;
        z-index: 50;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: flex-end;
        animation: ibTcFadeIn 0.2s ease;
      }
      .ib-tc-modal-panel {
        width: 100%;
        background: var(--panel);
        border-top: 1px solid var(--glass-line);
        border-radius: 24px 24px 0 0;
        padding: 18px 18px calc(24px + var(--sab, 0px));
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
        box-sizing: border-box;
        animation: ibTcSlideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.1);
      }
      @keyframes ibTcFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ibTcSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

      .ib-tc-m-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .ib-tc-m-t { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; color: var(--tx); }
      .ib-tc-m-close { background: none; border: none; color: var(--tx3); cursor: pointer; padding: 4px; }
      .ib-tc-m-close svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; }
      .ib-tc-field-group { margin-bottom: 12px; }
      .ib-tc-label { font-size: 0.75rem; color: var(--tx2); margin-bottom: 6px; display: block; font-weight: 500; }
      .ib-tc-input { width: 100%; box-sizing: border-box; background: var(--soft); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; color: var(--tx); font-size: 0.88rem; outline: none; }
      .ib-tc-input:focus { border-color: var(--acc); }
      
      .ib-tc-cat-select { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
      .ib-tc-cat-special-select { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .ib-tc-cat-btn {
        border: 1px solid var(--line);
        background: var(--soft);
        border-radius: 10px;
        padding: 8px 4px;
        text-align: center;
        font-size: 0.75rem;
        color: var(--tx2);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        -webkit-tap-highlight-color: transparent;
      }
      .ib-tc-cat-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 1.8; }
      .ib-tc-cat-btn.active { border-color: var(--acc); color: var(--acc); background: rgba(114, 168, 216, 0.15); font-weight: 600; }
      
      /* 早安与晚安蓝色系高亮态 */
      .ib-tc-cat-btn.special-btn {
        flex-direction: row;
        justify-content: center;
        padding: 8px 10px;
        gap: 6px;
      }
      .ib-tc-cat-btn.special-btn.active-morning {
        border-color: rgba(112, 164, 212, 0.6);
        color: #1c3656;
        background: rgba(112, 164, 212, 0.22);
        font-weight: 600;
      }
      .ib-tc-cat-btn.special-btn.active-morning svg {
        stroke: #1c3656;
      }
      body.theme-infernal .ib-tc-cat-btn.special-btn.active-morning {
        color: #dbeafe;
        border-color: #60a5fa;
        background: rgba(59, 130, 246, 0.25);
      }
      body.theme-infernal .ib-tc-cat-btn.special-btn.active-morning svg {
        stroke: #dbeafe;
      }
      .ib-tc-cat-btn.special-btn.active-night {
        border-color: #2b588c;
        color: #ffffff;
        background: #2b588c;
        font-weight: 600;
      }
      .ib-tc-cat-btn.special-btn.active-night svg {
        stroke: #ffffff;
      }
      body.theme-infernal .ib-tc-cat-btn.special-btn.active-night {
        color: #ffffff;
        border-color: #4b8cd6;
        background: #234c7a;
      }

      .ib-tc-btn-row {
        display: flex;
        gap: 10px;
        margin-top: 14px;
        align-items: center;
      }
      .ib-tc-submit-btn { 
        flex: 1; 
        height: 42px; 
        border-radius: 12px; 
        background: var(--acc); 
        color: #fff; 
        border: none; 
        font-size: 0.9rem; 
        font-weight: 600; 
        cursor: pointer; 
        -webkit-tap-highlight-color: transparent;
      }
      
      /* 纯图标删除按键与二次确认态 */
      .ib-tc-del-btn { 
        min-width: 44px;
        height: 42px; 
        flex: none;
        padding: 0 10px;
        border-radius: 12px; 
        background: rgba(239, 68, 68, 0.12); 
        color: #ef4444; 
        border: 1px solid rgba(239, 68, 68, 0.28); 
        cursor: pointer; 
        display: inline-flex; 
        align-items: center; 
        justify-content: center;
        gap: 4px;
        font-size: 0.76rem;
        font-weight: 600;
        transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        -webkit-tap-highlight-color: transparent;
      }
      .ib-tc-del-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.8; }
      .ib-tc-del-btn.confirm-mode {
        background: #ef4444;
        color: #ffffff;
        border-color: #dc2626;
        padding: 0 12px;
      }
      .ib-tc-del-btn.confirm-mode svg { width: 15px; height: 15px; stroke: #ffffff; stroke-width: 2.2; }
      .ib-tc-del-btn:active { transform: scale(0.95); }
    `;
    document.head.appendChild(st);
  }

  async function renderApp() {
    if (!host) return;
    var schedules = await getSchedules();
    var curDateStr = formatYMD(currentSelectedDate);
    var dateDisplay = formatDisplayDate(currentSelectedDate);
    var isDark = document.body.classList.contains('theme-infernal') || document.body.classList.contains('dark');

    // 过滤出当个作息周期的日程
    var todayList = schedules.filter(function(s) {
      return s.date === curDateStr;
    });

    // 投入统计计算：只统计【当前日历所选逻辑日期（06:00 - 次日06:00）】四大投入，早安和晚安不计入！
    var stats = {};
    CATEGORIES.forEach(function(c) { stats[c.name] = 0; });
    todayList.forEach(function(s) {
      var catName = s.category;
      if (s.isSpecial || catName === '早安' || catName === '晚安' || s.duration === 0) return;
      if (stats[catName] !== undefined) {
        var dur = Number(s.duration) || 0;
        stats[catName] += dur;
      }
    });
    var totalMin = Object.values(stats).reduce(function(a, b) { return a + b; }, 0) || 0;

    // 生成 24 个小时（06:00 -> 23:00 -> 00:00 -> 05:00）的刻度
    var hourRowsHtml = '';
    var HOUR_HEIGHT = 50;
    var TOP_PADDING = 14;
    for (var i = 0; i < 24; i++) {
      var h = (6 + i) % 24;
      var hStr = String(h).padStart(2, '0') + ':00';
      var topPx = TOP_PADDING + i * HOUR_HEIGHT;
      hourRowsHtml += `
        <div class="ib-cal-hour-row" style="top: ${topPx}px;" data-time="${hStr}">
          <div class="ib-cal-hour-label">${hStr}</div>
          <div class="ib-cal-hour-line"></div>
        </div>
      `;
    }

    // 计算当前时间红线位置
    var now = new Date();
    var logicNow = getLogicToday();
    var isTodayPage = formatYMD(logicNow) === curDateStr;
    var nowLineHtml = '';
    var nowTopPx = 0;
    if (isTodayPage) {
      var curHourStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      var nowMinutes = timeStrToOffsetMinutes(curHourStr);
      nowTopPx = TOP_PADDING + (nowMinutes / 60) * HOUR_HEIGHT;
      nowLineHtml = `<div class="ib-cal-now-line" style="top: ${nowTopPx}px;" title="当前时间 ${curHourStr}"></div>`;
    }

    // 渲染日程卡片（包含跨度卡片和早安/晚安特殊单点徽章）
    var eventsHtml = todayList.map(function(item, idx) {
      var isMorning = (item.category === '早安');
      var isNight = (item.category === '晚安');
      var isPointMilestone = item.isSpecial || isMorning || isNight || item.duration === 0;

      if (isPointMilestone) {
        // 特殊单点打卡（早安浅蓝 / 晚安深蓝）
        var pointTime = item.time || item.startTime || (isMorning ? '07:30' : '23:30');
        var pointMin = timeStrToOffsetMinutes(pointTime);
        var pTopPx = TOP_PADDING + (pointMin / 60) * HOUR_HEIGHT;
        var specObj = SPECIAL_CATEGORIES.find(function(c) { return c.name === item.category; }) || SPECIAL_CATEGORIES[0];
        var bgVal = isDark ? specObj.badgeBgDark : specObj.badgeBg;
        var txVal = isDark ? specObj.txColorDark : specObj.txColor;
        var displayTitle = (item.title && item.title !== item.category) ? item.title : (isMorning ? '早安 · 起床打卡' : '晚安 · 入睡打卡');

        return `
          <div class="ib-cal-point-badge" style="top: ${pTopPx}px; background: ${bgVal}; border-color: ${specObj.border}; color: ${txVal};" data-id="${item.id || idx}">
            <div class="ib-cal-point-ico" style="background: ${specObj.bg}; color: ${specObj.solid};">
              ${specObj.icon}
            </div>
            <div class="ib-cal-point-txt">${displayTitle}</div>
            <div class="ib-cal-point-time">${pointTime}</div>
          </div>
        `;
      }

      // 常规跨度卡片
      var startMin = timeStrToOffsetMinutes(item.startTime || '08:00');
      var endMin = timeStrToOffsetMinutes(item.endTime || '09:00');
      if (endMin <= startMin) endMin = startMin + 60;

      var topPx = TOP_PADDING + (startMin / 60) * HOUR_HEIGHT;
      var heightPx = Math.max(32, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2);

      var catObj = CATEGORIES.find(function(c) { return c.name === item.category; }) || CATEGORIES[0];
      var isLateNight = (parseInt((item.startTime||'').split(':')[0]||0, 10) < 6);

      var hasCustomTitle = item.title && String(item.title).trim() && String(item.title).trim() !== item.category;
      var titleHtml = hasCustomTitle ? `<div class="ib-cal-ev-title" style="color: ${catObj.txColor};">${item.title}</div>` : '';

      return `
        <div class="ib-cal-event-block" style="top: ${topPx}px; height: ${heightPx}px; background: ${catObj.lightBg}; border-color: ${catObj.border}; color: ${catObj.txColor};" data-id="${item.id || idx}">
          <div class="ib-cal-ev-top">
            <div class="ib-cal-ev-tag" style="color: ${catObj.tagColor};">
              ${catObj.icon}
              <span>${item.category || '学习'}</span>
              ${isLateNight ? `<span style="font-size:0.58rem;opacity:0.85;">[深夜]</span>` : ''}
            </div>
          </div>
          ${titleHtml}
          <div class="ib-cal-ev-time" style="color: ${catObj.txColor};">${item.startTime || '00:00'} – ${item.endTime || '00:00'} (${item.duration || 60}m)</div>
        </div>
      `;
    }).join('');

    host.innerHTML = `
      <div class="ib-tc">
        <!-- 贴顶轻盈毛玻璃顶栏 -->
        <div class="ib-tc-top">
          <button class="ib-tc-close" id="tc-close-btn">
            ${SVG_ICONS.back}
            <span>关闭</span>
          </button>
          <div class="ib-tc-tt">日历<small>Calendar · 06:00–06:00</small></div>
          <button id="tc-add-btn" class="ib-tc-pick">
            ${SVG_ICONS.plus}
            <span>记录事项</span>
          </button>
        </div>

        <!-- 滚动日程流 -->
        <div class="ib-tc-body">
          <!-- 蓝色系梯度统计网格（不计入早晚安） -->
          <div class="ib-tc-section-lab">
            <span>投入分布统计</span>
            <span>TOTAL ${(totalMin/60).toFixed(1)} H</span>
          </div>

          <div class="ib-tc-grid-stats">
            ${CATEGORIES.map(function(c) {
              var mins = stats[c.name] || 0;
              var hrs = (mins / 60).toFixed(1);
              var pct = totalMin > 0 ? Math.round((mins / totalMin) * 100) : 0;
              return `
                <div class="ib-tc-stat-tile">
                  <div class="ib-tc-stat-ico" style="background: ${c.bg}; color: ${c.solid};">
                    ${c.icon}
                  </div>
                  <div>
                    <div class="ib-tc-stat-num">${hrs}<span style="font-size:0.62rem;color:var(--tx3);font-family:var(--disp);margin-left:3px;">H</span></div>
                    <div class="ib-tc-stat-pct">${c.name} · ${pct}%</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="ib-tc-divider"></div>

          <!-- 日期切换栏 -->
          <div class="ib-tc-daybar">
            <button id="tc-prev-day" class="ib-tc-nav-btn" aria-label="前一天">${SVG_ICONS.left}</button>
            <div class="ib-tc-day-main">
              <div class="ib-tc-day-t">${dateDisplay.monthDay}</div>
              <div class="ib-tc-day-sub">${dateDisplay.yearWeek}</div>
            </div>
            <button id="tc-next-day" class="ib-tc-nav-btn" aria-label="后一天">${SVG_ICONS.right}</button>
          </div>

          <div class="ib-tc-section-lab">
            <span>24 小时日程安排</span>
            <span>${todayList.length} 项记录</span>
          </div>

          <!-- 24 小时跨度与打卡标尺舞台 -->
          <div class="ib-cal-schedule-view" id="tc-cal-container">
            <div class="ib-cal-grid" id="tc-cal-grid">
              ${hourRowsHtml}
              ${nowLineHtml}
              ${eventsHtml}
            </div>
          </div>
        </div>

        <!-- 记录与编辑事项弹窗 -->
        <div id="tc-modal" class="ib-tc-modal-mask" style="${isAddModalOpen ? '' : 'display:none;'}">
          <div class="ib-tc-modal-panel">
            <div class="ib-tc-m-head">
              <div class="ib-tc-m-t" id="tc-m-heading">${editingItem ? '编辑日程' : '记录事项'}</div>
              <button id="tc-m-close" class="ib-tc-m-close">${SVG_ICONS.close}</button>
            </div>
            
            <div class="ib-tc-field-group">
              <label class="ib-tc-label">事项名称 <span style="font-size:0.68rem;color:var(--tx3);font-weight:normal;">（选填，不填默认使用分类名）</span></label>
              <input id="tc-m-title" class="ib-tc-input" placeholder="例如：看《深入浅出》、写代码（选填）" />
            </div>

            <div class="ib-tc-field-group">
              <label class="ib-tc-label">投入分类（跨时间段统计）</label>
              <div class="ib-tc-cat-select" id="tc-cat-boxes">
                ${CATEGORIES.map(function(c, i) {
                  return `
                    <div class="ib-tc-cat-btn ${i===0?'active':''}" data-cat="${c.name}" data-special="false">
                      ${c.icon}
                      <span>${c.name}</span>
                    </div>
                  `;
                }).join('')}
              </div>

              <label class="ib-tc-label" style="margin-top: 8px;">特殊时刻打卡（不计入时间统计）</label>
              <div class="ib-tc-cat-special-select" id="tc-cat-spec-boxes">
                <div class="ib-tc-cat-btn special-btn" data-cat="早安" data-special="true">
                  ${SVG_ICONS.sun}
                  <span>早安</span>
                </div>
                <div class="ib-tc-cat-btn special-btn" data-cat="晚安" data-special="true">
                  ${SVG_ICONS.moon}
                  <span>晚安</span>
                </div>
              </div>
            </div>

            <!-- 时间选择区（常规为起止时间，早晚安为单一时间） -->
            <div id="tc-time-range-group" class="ib-tc-field-group" style="display:flex;gap:10px;">
              <div style="flex:1;">
                <label class="ib-tc-label" id="tc-lbl-start">开始时间</label>
                <input id="tc-m-start" type="time" class="ib-tc-input" value="14:00" />
              </div>
              <div style="flex:1;" id="tc-end-wrap">
                <label class="ib-tc-label">结束时间</label>
                <input id="tc-m-end" type="time" class="ib-tc-input" value="16:30" />
              </div>
            </div>

            <div class="ib-tc-btn-row">
              <button id="tc-m-submit" class="ib-tc-submit-btn">${editingItem ? '保存修改' : '确认记录'}</button>
              ${editingItem ? `
                <button id="tc-m-delete" class="ib-tc-del-btn ${deleteConfirmState ? 'confirm-mode' : ''}" title="删除日程" aria-label="删除此日程">
                  ${deleteConfirmState ? `${SVG_ICONS.check} 确认删除` : SVG_ICONS.trash}
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    // 自动平滑滚动
    setTimeout(function() {
      var calView = host.querySelector('.ib-tc-body');
      if (calView) {
        var scrollTarget = isTodayPage ? (nowTopPx - 100) : 300;
        if (todayList.length > 0) {
          var firstMin = timeStrToOffsetMinutes(todayList[0].time || todayList[0].startTime);
          scrollTarget = (firstMin / 60) * HOUR_HEIGHT + 180;
        }
        calView.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
      }
    }, 100);

    // 绑定关闭应用
    host.querySelector('#tc-close-btn').addEventListener('click', function() {
      if (ctx && ctx.ui && ctx.ui.close) {
        ctx.ui.close();
      } else if (window.IBApps && window.IBApps.close) {
        window.IBApps.close('timeline_cal');
      }
    });

    // 翻页
    host.querySelector('#tc-prev-day').addEventListener('click', function() {
      currentSelectedDate.setDate(currentSelectedDate.getDate() - 1);
      renderApp();
    });

    host.querySelector('#tc-next-day').addEventListener('click', function() {
      currentSelectedDate.setDate(currentSelectedDate.getDate() + 1);
      renderApp();
    });

    // 分类与时间输入框切换更新
    function updateCatSelectionUI(catName, isSpecial) {
      host.querySelectorAll('.ib-tc-cat-btn').forEach(function(b) {
        var bCat = b.getAttribute('data-cat');
        var bSpec = b.getAttribute('data-special') === 'true';
        b.classList.remove('active', 'active-morning', 'active-night');
        if (bCat === catName) {
          if (bCat === '早安') b.classList.add('active-morning');
          else if (bCat === '晚安') b.classList.add('active-night');
          else b.classList.add('active');
        }
      });

      var endWrap = host.querySelector('#tc-end-wrap');
      var lblStart = host.querySelector('#tc-lbl-start');
      var titleInp = host.querySelector('#tc-m-title');

      if (isSpecial || catName === '早安' || catName === '晚安') {
        if (endWrap) endWrap.style.display = 'none';
        if (lblStart) lblStart.textContent = '打卡时刻';
        if (titleInp && !titleInp.value) {
          titleInp.placeholder = (catName === '早安' ? '例如：醒了、元气满满（选填）' : '例如：准备睡觉、晚安啦（选填）');
        }
      } else {
        if (endWrap) endWrap.style.display = 'block';
        if (lblStart) lblStart.textContent = '开始时间';
        if (titleInp) titleInp.placeholder = '例如：看《深入浅出》、写代码（选填）';
      }
    }

    // 弹窗控制
    var modal = host.querySelector('#tc-modal');
    var selectedCat = '学习';
    var isSpecialSelected = false;

    function openModalForAdd(defaultStart, defaultEnd, forceCat) {
      editingItem = null;
      deleteConfirmState = false;
      isAddModalOpen = true;
      selectedCat = forceCat || '学习';
      isSpecialSelected = (selectedCat === '早安' || selectedCat === '晚安');
      renderApp();

      setTimeout(function() {
        if (host.querySelector('#tc-m-heading')) host.querySelector('#tc-m-heading').textContent = '记录事项';
        if (host.querySelector('#tc-m-title')) host.querySelector('#tc-m-title').value = '';
        if (host.querySelector('#tc-m-start')) host.querySelector('#tc-m-start').value = defaultStart || '14:00';
        if (host.querySelector('#tc-m-end')) host.querySelector('#tc-m-end').value = defaultEnd || '16:30';
        updateCatSelectionUI(selectedCat, isSpecialSelected);
      }, 40);
    }

    function openModalForEdit(item) {
      vib();
      editingItem = item;
      deleteConfirmState = false;
      selectedCat = item.category || '学习';
      isSpecialSelected = item.isSpecial || (selectedCat === '早安' || selectedCat === '晚安');
      isAddModalOpen = true;
      renderApp();

      setTimeout(function() {
        if (host.querySelector('#tc-m-heading')) host.querySelector('#tc-m-heading').textContent = '编辑事项';
        if (host.querySelector('#tc-m-title')) host.querySelector('#tc-m-title').value = (item.title !== item.category ? item.title : '');
        if (host.querySelector('#tc-m-start')) host.querySelector('#tc-m-start').value = item.time || item.startTime || '14:00';
        if (host.querySelector('#tc-m-end')) host.querySelector('#tc-m-end').value = item.endTime || '16:30';
        updateCatSelectionUI(selectedCat, isSpecialSelected);
      }, 40);
    }

    // 点击刻度新建
    host.querySelectorAll('.ib-cal-hour-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var time = row.getAttribute('data-time') || '14:00';
        var h = parseInt(time.split(':')[0], 10);
        var nextH = String((h + 1) % 24).padStart(2, '0') + ':00';
        openModalForAdd(time, nextH);
      });
    });

    // 顶栏新建
    host.querySelector('#tc-add-btn').addEventListener('click', function() {
      var d = new Date();
      var nowH = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      var nextH = String((d.getHours() + 1) % 24).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      openModalForAdd(nowH, nextH);
    });

    host.querySelector('#tc-m-close').addEventListener('click', function() {
      isAddModalOpen = false;
      editingItem = null;
      deleteConfirmState = false;
      renderApp();
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        isAddModalOpen = false;
        editingItem = null;
        deleteConfirmState = false;
        renderApp();
      }
    });

    // 分类按钮点击切换
    host.querySelectorAll('.ib-tc-cat-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        selectedCat = btn.getAttribute('data-cat');
        isSpecialSelected = btn.getAttribute('data-special') === 'true';
        updateCatSelectionUI(selectedCat, isSpecialSelected);
      });
    });

    // 提交保存 / 新增
    host.querySelector('#tc-m-submit').addEventListener('click', async function() {
      var rawTitle = (host.querySelector('#tc-m-title').value || '').trim();
      var title = rawTitle || selectedCat;
      var start = host.querySelector('#tc-m-start').value || '14:00';
      var end = host.querySelector('#tc-m-end').value || '16:30';

      var list = await getSchedules();

      if (isSpecialSelected || selectedCat === '早安' || selectedCat === '晚安') {
        // 特殊单时间点打卡（早安 / 晚安），不计入统计
        if (editingItem) {
          var targetId = editingItem.id;
          list = list.map(function(it, idx) {
            if ((it.id || idx) == targetId) {
              return Object.assign({}, it, {
                title: title,
                category: selectedCat,
                time: start,
                startTime: start,
                endTime: start,
                duration: 0,
                isSpecial: true,
                updated: Date.now()
              });
            }
            return it;
          });
          if (typeof window.toast === 'function') window.toast(selectedCat + '打卡已更新');
        } else {
          var newSpecRecord = {
            id: 'sch_spec_' + Date.now(),
            date: formatYMD(currentSelectedDate),
            title: title,
            category: selectedCat,
            time: start,
            startTime: start,
            endTime: start,
            duration: 0,
            isSpecial: true,
            byAi: false,
            created: Date.now()
          };
          list.push(newSpecRecord);
          if (typeof window.toast === 'function') window.toast(selectedCat + '已打卡！');
        }
      } else {
        // 常规跨度事项
        var sParts = start.split(':');
        var eParts = end.split(':');
        var sMin = parseInt(sParts[0]||0)*60 + parseInt(sParts[1]||0);
        var eMin = parseInt(eParts[0]||0)*60 + parseInt(eParts[1]||0);
        var dur = eMin >= sMin ? (eMin - sMin) : (eMin + 1440 - sMin);

        if (editingItem) {
          var targetId2 = editingItem.id;
          list = list.map(function(it, idx) {
            if ((it.id || idx) == targetId2) {
              return Object.assign({}, it, {
                title: title,
                category: selectedCat,
                startTime: start,
                endTime: end,
                duration: dur,
                isSpecial: false,
                updated: Date.now()
              });
            }
            return it;
          });
          if (typeof window.toast === 'function') window.toast('日程已更新');
        } else {
          var newRecord = {
            id: 'sch_' + Date.now(),
            date: formatYMD(currentSelectedDate),
            title: title,
            category: selectedCat,
            startTime: start,
            endTime: end,
            duration: dur,
            isSpecial: false,
            byAi: false,
            created: Date.now()
          };
          list.push(newRecord);
          if (typeof window.toast === 'function') window.toast('日程已记录');
        }
      }

      await saveSchedules(list);
      isAddModalOpen = false;
      editingItem = null;
      deleteConfirmState = false;
      await renderApp();
    });

    // 内联二次确认删除
    var delBtn = host.querySelector('#tc-m-delete');
    if (delBtn) {
      delBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!editingItem) return;

        if (!deleteConfirmState) {
          vib();
          deleteConfirmState = true;
          delBtn.classList.add('confirm-mode');
          delBtn.innerHTML = SVG_ICONS.check + ' 确认删除';
          return;
        }

        vib();
        var targetId = editingItem.id;
        var list = await getSchedules();
        list = list.filter(function(it, idx) { return (it.id || idx) != targetId; });
        await saveSchedules(list);
        isAddModalOpen = false;
        editingItem = null;
        deleteConfirmState = false;
        if (typeof window.toast === 'function') window.toast('事项已删除');
        await renderApp();
      });
    }

    // 卡片 & 单点徽章点击/长按进入编辑
    host.querySelectorAll('.ib-cal-event-block, .ib-cal-point-badge').forEach(function(card) {
      var pressTimer = null;
      var id = card.getAttribute('data-id');
      var itemData = todayList.find(function(it, idx) { return (it.id || idx) == id; });

      card.addEventListener('touchstart', function(e) {
        pressTimer = setTimeout(function() {
          if (itemData) openModalForEdit(itemData);
        }, 450);
      }, { passive: true });

      card.addEventListener('touchend', function(e) {
        if (pressTimer) clearTimeout(pressTimer);
      });

      card.addEventListener('touchmove', function(e) {
        if (pressTimer) clearTimeout(pressTimer);
      });

      card.addEventListener('click', function(e) {
        e.stopPropagation();
        if (itemData) openModalForEdit(itemData);
      });
    });
  }

  window.addAIScheduleEvent = async function(evData) {
    try {
      var all = await (ctx ? ctx.storage.get('my_time_schedules') : JSON.parse(localStorage.getItem('my_time_schedules') || '[]')) || [];
      all.push(evData);
      if (ctx) {
        await ctx.storage.set('my_time_schedules', all);
      } else {
        localStorage.setItem('my_time_schedules', JSON.stringify(all));
      }
      if (host) renderApp();
    } catch(e) {
      console.warn('addAIScheduleEvent error:', e);
    }
  };
})();
