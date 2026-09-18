/* InternalBeyond Mobile — ib-sw.js（Service Worker 模板 · 联网优先，离线回退）
   与手机端 HTML 放在同一目录，经 HTTPS 访问时页面会自动注册本文件。
   只接管本站的 GET 请求；发往 AI 服务商 / 中转站的请求原样放行、绝不缓存。 */
const IB_CACHE='ib-cache-v4';
const NAV_TIMEOUT=12000,ASSET_TIMEOUT=9000;
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==IB_CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
function withTimeout(p,ms){return new Promise(function(res,rej){var t=setTimeout(function(){rej(new Error('timeout'))},ms);p.then(function(v){clearTimeout(t);res(v)},function(e){clearTimeout(t);rej(e)})})}
function offlinePage(){return new Response('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Internal Beyond</title><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Noto Sans SC\',sans-serif;background:#eef2f8;color:#132a52"><div style="text-align:center;padding:24px"><div style="font-size:1.05rem;margin-bottom:10px">暂时加载不上</div><div style="font-size:0.84rem;color:#3b5686;line-height:1.7">本机还没有离线副本，网络也没回应。<br>检查网络后点下面重试。</div><button onclick="location.reload()" style="margin-top:18px;height:40px;padding:0 22px;border-radius:999px;border:1px solid rgba(120,168,222,.6);background:#fff;color:#3f74ad;font-size:0.9rem">重试</button></div></body>',{status:200,headers:{'Content-Type':'text/html; charset=utf-8'}})}
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  var u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return;
  // 严格放行所有 API 路由，绝不拦截与缓存后端接口
  if(u.pathname.startsWith('/api/'))return;
  var isNav=e.request.mode==='navigate'||e.request.destination==='document';
  var net=fetch(e.request).then(function(r){if(r&&r.ok){var cp=r.clone();caches.open(IB_CACHE).then(function(c){c.put(e.request,cp)}).catch(function(){})}return r});
  if(isNav){
    e.respondWith(withTimeout(net,NAV_TIMEOUT).catch(function(){
      return caches.match(e.request,{ignoreSearch:true}).then(function(cached){
        if(cached)return cached;
        return offlinePage();
      });
    }));
    return;
  }
  e.respondWith(withTimeout(net,ASSET_TIMEOUT).catch(function(){return caches.match(e.request,{ignoreSearch:true}).then(function(m){if(m)return m;throw new Error('offline')})}));
});
