const fs = require('fs');
let ext = fs.readFileSync('custom/extension.js', 'utf8');

ext = ext.replace(
  "      hookChatSideDrawer();\n      return origOpenCvDrawer.apply(this, args);",
  "      const res = origOpenCvDrawer.apply(this, args);\n      hookChatSideDrawer();\n      return res;"
);

ext = ext.replace(
  "        _origDrawer = function(...args) {\n          hookChatSideDrawer();\n          return fn.apply(this, args);\n        };",
  "        _origDrawer = function(...args) {\n          const res = fn.apply(this, args);\n          hookChatSideDrawer();\n          return res;\n        };"
);

ext = ext.replace(
  "    if (e.target && (e.target.closest('#cv-menu-btn') || e.target.closest('#chat-side') || e.target.closest('#btn-chat-side'))) {\n      hookChatSideDrawer();\n    }",
  "    if (e.target && (e.target.closest('#cv-menu-btn') || e.target.closest('#chat-side') || e.target.closest('#chat-side-btn'))) {\n      setTimeout(hookChatSideDrawer, 0);\n    }"
);

fs.writeFileSync('custom/extension.js', ext);
