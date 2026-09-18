const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetStr = "let res=await fetch(url,{method:'POST',headers:headers,body:body,signal:signal});";
const replacementStr = `
  try {
    var reqInfo = { url: url, time: new Date().toLocaleTimeString(), body: body };
    window._ibLastRawReq = reqInfo;
    localStorage.setItem("ib_probe_raw_req", JSON.stringify(reqInfo));
    window._ibLastRawRes = "等待响应返回中…";
    localStorage.setItem("ib_probe_raw_res", "等待响应返回中…");
    if (window._ibUpdateProbeUI) window._ibUpdateProbeUI();
  } catch(e) {}
  
  let res=await fetch(url,{method:'POST',headers:headers,body:body,signal:signal});
  
  try {
    const clone = res.clone();
    if (clone.body && typeof clone.body.getReader === "function") {
      const reader = clone.body.getReader();
      const dec = new TextDecoder("utf-8");
      let acc = "";
      const pumpStream = () => {
        reader.read().then((chunk) => {
          if (chunk.value) {
            acc += dec.decode(chunk.value, { stream: true });
            window._ibLastRawRes = acc;
            try { localStorage.setItem("ib_probe_raw_res", acc); } catch(e){}
            if (window._ibUpdateProbeUI) window._ibUpdateProbeUI();
          }
          if (!chunk.done) pumpStream();
          else {
            acc += dec.decode();
            window._ibLastRawRes = acc;
            try { localStorage.setItem("ib_probe_raw_res", acc); } catch(e){}
            if (window._ibUpdateProbeUI) window._ibUpdateProbeUI();
          }
        }).catch(() => {});
      };
      pumpStream();
    } else {
      clone.text().then(txt => {
        window._ibLastRawRes = txt;
        try { localStorage.setItem("ib_probe_raw_res", txt); } catch(e){}
        if (window._ibUpdateProbeUI) window._ibUpdateProbeUI();
      }).catch(()=>{});
    }
  } catch(e) {}
`;

if (html.includes(targetStr)) {
  html = html.replace(targetStr, replacementStr);
  fs.writeFileSync('index.html', html);
  console.log("Nuclear patch applied to index.html");
} else {
  console.log("Could not find target string in index.html");
}
