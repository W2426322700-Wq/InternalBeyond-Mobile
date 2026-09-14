/* v201-p / v235-a：apps/catalog.json 的 JS 壳——直接双击打开 index（file://）时 fetch 读不到 json，底座退回用 <script> 读这一份；两份内容必须一致 */
window.IB_APP_CATALOG={
  "sdk": 2,
  "apps": [
    {
      "id": "coread",
      "name": "共读间",
      "version": "2.7.0",
      "file": "inline",
      "desc": "常驻在 Blog 里：一篇日志＝一本书，和 TA 一起读；聊天落在「共读 · 书名」频道，纸条区与 Chat 同款",
      "icon": "<path d=\"M12 6.6c-1.7-1.4-3.9-2.1-6.6-2.1v13c2.7 0 4.9.7 6.6 2.1 1.7-1.4 3.9-2.1 6.6-2.1v-13c-2.7 0-4.9.7-6.6 2.1z\"/><path d=\"M12 6.6v13\"/>",
      "builtin": true,
      "hidden": true
    },
    {
      "id": "cinema",
      "name": "观影室",
      "version": "1.12.0",
      "file": "ib-app-cinema.js",
      "desc": "选一段手机里的视频、配一份 .srt / .vtt 字幕，和 TA 一起看：通栏播放器 / 留影 / 看画面 / 弹幕 / 全屏；视频与字幕不入库",
      "icon": "<rect x=\"3.5\" y=\"6\" width=\"17\" height=\"12\" rx=\"2.5\"/><path d=\"M3.5 9.5h17M7.5 6v12M16.5 6v12\"/><path d=\"M10.8 11v4l3.4-2z\"/>"
    }
  ]
};
