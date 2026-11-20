import { buildApiUrl } from '@/api/url'
import type { IQDetectionRun, IQDetectionSample } from './types'

/**
 * 严格断网与隔离 CSP：禁止任何外部网络请求、图片外链、字体外链、表单提交与框架嵌套，
 * 仅允许内联样式与内联脚本在无 allow-same-origin 的 iframe 沙箱中运行 2D SVG 动画。
 */
export const PELICAN_SANDBOX_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:;"

export const PELICAN_SANDBOX_READY_EVENT = 'iq-pelican-sandbox-ready'
export const PELICAN_SANDBOX_RENDER_EVENT = 'iq-pelican-sandbox-render'

/**
 * 返回独立 HTTP CSP 的沙箱承载页 URL（避免 iframe srcdoc 继承主站 nonce-only script-src 导致模型 JS 动画被拦截）。
 */
export function getPelicanSandboxUrl(): string {
  return buildApiUrl('/iq-detection-sandbox')
}

const SANDBOX_EARLY_HEAD = `<meta http-equiv="Content-Security-Policy" content="${PELICAN_SANDBOX_CSP}"><style data-iq-stage-base>html,body{margin:0;padding:0;width:100%;height:100%;}</style>`

const SANDBOX_LATE_STYLE = `<style data-iq-stage>html{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;}html[data-iq-fit="svg-only"] body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;}html[data-iq-fit="svg-only"] [data-iq-svg-ancestor="1"]{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;aspect-ratio:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;transform:none!important;}html[data-iq-fit="svg-only"] svg[data-iq-primary-svg="1"]{display:block!important;max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;aspect-ratio:auto!important;overflow:hidden!important;}html[data-iq-fit="page-scale"] body{overflow:visible!important;}</style>`

/**
 * 舞台自适应脚本：
 * 1. 自动识别主场景 <svg>，补全缺失的 viewBox 并把会裁切画面的 preserveAspectRatio="... slice" 归一化为 meet；
 * 2. 纯 SVG 画作进入 svg-only 模式：按 viewBox 原始比例精确充满舞台且完全不裁切，同时防止画布外滚动元素溢出边距；
 * 3. 带标题/控制栏的完整 HTML 页面进入 page-scale 模式：保留交互控件并将整页等比缩放居中，必要时采用 960px 桌面视口避免卡片被压扁。
 */
const SANDBOX_STAGE_FIT_SCRIPT = `<script data-iq-stage-fit>(function(){
  var rafId=0,lastKey='';
  var skipTags={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEMPLATE:1,LINK:1,META:1,TITLE:1};
  var interactiveTags={BUTTON:1,INPUT:1,SELECT:1,TEXTAREA:1,A:1};
  function parseNum(v){
    if(!v) return 0;
    var s=String(v).trim();
    if(s.indexOf('%')!==-1) return 0;
    var n=parseFloat(s);
    return isFinite(n)&&n>0?n:0;
  }
  function parseViewBox(svg){
    var raw=svg.getAttribute('viewBox');
    if(raw){
      var parts=raw.trim().split(/[\\s,]+/).map(Number);
      if(parts.length>=4&&isFinite(parts[2])&&isFinite(parts[3])&&parts[2]>0&&parts[3]>0){
        return {w:parts[2],h:parts[3]};
      }
    }
    var w=parseNum(svg.getAttribute('width'));
    var h=parseNum(svg.getAttribute('height'));
    if(w>0&&h>0){
      svg.setAttribute('viewBox','0 0 '+w+' '+h);
      return {w:w,h:h};
    }
    try{
      var bb=svg.getBBox();
      if(bb&&bb.width>0&&bb.height>0){
        svg.setAttribute('viewBox',bb.x+' '+bb.y+' '+bb.width+' '+bb.height);
        return {w:bb.width,h:bb.height};
      }
    }catch(e){}
    return null;
  }
  function pickPrimarySvg(){
    var svgs=Array.prototype.slice.call(document.querySelectorAll('svg'));
    var best=null,bestScore=-1;
    for(var i=0;i<svgs.length;i++){
      var s=svgs[i];
      if(s.parentElement&&s.parentElement.closest&&s.parentElement.closest('svg')) continue;
      var vb=parseViewBox(s);
      var rect=s.getBoundingClientRect();
      var area=vb?(vb.w*vb.h):(rect.width*rect.height);
      var elems=s.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line,g').length;
      var score=area+elems*500;
      if(score>bestScore){bestScore=score;best=s;}
    }
    return best;
  }
  function hasVisibleChrome(primarySvg){
    if(!document.body) return false;
    function walk(node){
      var children=node.childNodes;
      for(var i=0;i<children.length;i++){
        var c=children[i];
        if(c.nodeType===3){
          if(c.textContent&&c.textContent.trim().length>0){
            var p=c.parentElement;
            if(p&&p!==primarySvg&&!primarySvg.contains(p)){
              var cs=getComputedStyle(p);
              if(cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity)>0){
                var pr=p.getBoundingClientRect();
                if(pr.width>1&&pr.height>1) return true;
              }
            }
          }
        }else if(c.nodeType===1){
          if(c===primarySvg||skipTags[c.tagName]) continue;
          var st=getComputedStyle(c);
          if(st.display==='none'||st.visibility==='hidden'||parseFloat(st.opacity)===0) continue;
          if(interactiveTags[c.tagName]||c.getAttribute('role')==='button'){
            var r=c.getBoundingClientRect();
            if(r.width>1&&r.height>1) return true;
          }
          if(walk(c)) return true;
        }
      }
      return false;
    }
    return walk(document.body);
  }
  function measureContentBounds(body){
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    function walk(node){
      var ch=node.children;
      for(var i=0;i<ch.length;i++){
        var el=ch[i];
        if(skipTags[el.tagName]) continue;
        var st=getComputedStyle(el);
        if(st.display==='none'||st.visibility==='hidden'||parseFloat(st.opacity)===0) continue;
        var r=el.getBoundingClientRect();
        if(r.width>0.5&&r.height>0.5){
          if(r.left<minX) minX=r.left;
          if(r.top<minY) minY=r.top;
          if(r.right>maxX) maxX=r.right;
          if(r.bottom>maxY) maxY=r.bottom;
        }
        if(el.tagName!=='svg'&&el.tagName!=='SVG') walk(el);
      }
    }
    walk(body);
    if(!isFinite(minX)) return null;
    return {minX:minX,minY:minY,maxX:maxX,maxY:maxY,w:Math.max(maxX-minX,1),h:Math.max(maxY-minY,1)};
  }
  function fit(force){
    try{
      var html=document.documentElement,body=document.body;
      if(!html||!body) return;
      var vw=window.innerWidth||html.clientWidth;
      var vh=window.innerHeight||html.clientHeight;
      if(vw<=0||vh<=0) return;
      var primarySvg=pickPrimarySvg();
      var vb=null,ancestors=[];
      if(primarySvg){
        vb=parseViewBox(primarySvg);
        var par=primarySvg.getAttribute('preserveAspectRatio');
        if(par&&/slice/i.test(par)){
          primarySvg.setAttribute('preserveAspectRatio',par.replace(/slice/gi,'meet'));
        }
        var cur=primarySvg.parentElement;
        while(cur&&cur!==body&&cur!==html){ancestors.push(cur);cur=cur.parentElement;}
      }
      var stateKey=vw+'x'+vh+':'+(vb?vb.w+'x'+vb.h:'none')+':'+(primarySvg?'svg':'nosvg');
      if(!force&&stateKey===lastKey&&html.getAttribute('data-iq-fit')) return;
      html.removeAttribute('data-iq-fit');
      body.style.removeProperty('transform');
      body.style.removeProperty('transform-origin');
      body.style.removeProperty('width');
      body.style.removeProperty('min-height');
      body.style.removeProperty('height');
      if(primarySvg){
        primarySvg.removeAttribute('data-iq-primary-svg');
        primarySvg.style.removeProperty('width');
        primarySvg.style.removeProperty('height');
      }
      var prevAnc=document.querySelectorAll('[data-iq-svg-ancestor]');
      for(var j=0;j<prevAnc.length;j++) prevAnc[j].removeAttribute('data-iq-svg-ancestor');
      if(primarySvg&&!hasVisibleChrome(primarySvg)){
        html.setAttribute('data-iq-fit','svg-only');
        primarySvg.setAttribute('data-iq-primary-svg','1');
        for(var k=0;k<ancestors.length;k++) ancestors[k].setAttribute('data-iq-svg-ancestor','1');
        if(vb&&vb.w>0&&vb.h>0){
          var ratio=vb.w/vb.h;
          var targetW=Math.min(vw,vh*ratio);
          var targetH=targetW/ratio;
          primarySvg.style.setProperty('width',targetW.toFixed(2)+'px','important');
          primarySvg.style.setProperty('height',targetH.toFixed(2)+'px','important');
        }else{
          primarySvg.style.setProperty('width','100%','important');
          primarySvg.style.setProperty('height','100%','important');
        }
        lastKey=stateKey;
        return;
      }
      html.setAttribute('data-iq-fit','page-scale');
      var htmlBg=getComputedStyle(html).backgroundColor;
      if(!htmlBg||htmlBg==='rgba(0, 0, 0, 0)'||htmlBg==='transparent'){
        var bodyBg=getComputedStyle(body).backgroundColor;
        if(bodyBg&&bodyBg!=='rgba(0, 0, 0, 0)'&&bodyBg!=='transparent'){
          html.style.backgroundColor=bodyBg;
        }
      }
      var bounds=measureContentBounds(body);
      if(!bounds){lastKey=stateKey;return;}
      var overflows=bounds.minX<-1||bounds.minY<-1||bounds.maxX>vw+1||bounds.maxY>vh+1;
      if(overflows){
        var chosen=bounds,useVirtualW=0;
        if(vw<960){
          var natScale=Math.min(vw/bounds.w,vh/bounds.h,1);
          var natArea=(bounds.w*natScale)*(bounds.h*natScale);
          body.style.setProperty('width','960px','important');
          body.style.setProperty('min-height','0','important');
          body.style.setProperty('height','auto','important');
          var deskBounds=measureContentBounds(body);
          if(deskBounds){
            var deskScale=Math.min(vw/deskBounds.w,vh/deskBounds.h,1);
            var deskArea=(deskBounds.w*deskScale)*(deskBounds.h*deskScale);
            if(deskArea>natArea*1.1){chosen=deskBounds;useVirtualW=960;}
            else{
              body.style.removeProperty('width');
              body.style.removeProperty('min-height');
              body.style.removeProperty('height');
            }
          }
        }
        var scale=Math.min(vw/chosen.w,vh/chosen.h,1);
        var ox=(vw-chosen.w*scale)/2-chosen.minX*scale;
        var oy=(vh-chosen.h*scale)/2-chosen.minY*scale;
        if(useVirtualW>0) body.style.setProperty('width',useVirtualW+'px','important');
        body.style.setProperty('transform-origin','0 0','important');
        body.style.setProperty('transform','translate('+ox.toFixed(2)+'px,'+oy.toFixed(2)+'px) scale('+scale.toFixed(4)+')','important');
      }
      lastKey=stateKey;
    }catch(e){}
  }
  function schedule(force){
    if(rafId) cancelAnimationFrame(rafId);
    rafId=requestAnimationFrame(function(){fit(Boolean(force));});
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){schedule(true);});
  }else{schedule(true);}
  window.addEventListener('load',function(){
    schedule(true);
    setTimeout(function(){schedule(false);},120);
  });
  window.addEventListener('resize',function(){schedule(false);});
  if(typeof ResizeObserver!=='undefined'){
    try{new ResizeObserver(function(){schedule(false);}).observe(document.documentElement);}catch(e){}
  }
})();</script>`

const SANDBOX_LATE_HEAD = `${SANDBOX_LATE_STYLE}${SANDBOX_STAGE_FIT_SCRIPT}`

function injectLateHead(doc: string, injection: string): string {
  const bodyMatch = /<body\b[^>]*>/i.exec(doc)
  const headCloseMatch = /<\/head>/i.exec(doc)

  if (headCloseMatch && (!bodyMatch || headCloseMatch.index < bodyMatch.index)) {
    const idx = headCloseMatch.index
    return `${doc.slice(0, idx)}${injection}${doc.slice(idx)}`
  }
  if (bodyMatch) {
    const idx = bodyMatch.index
    return `${doc.slice(0, idx)}${injection}${doc.slice(idx)}`
  }
  return `${doc}${injection}`
}

/**
 * 将模型生成的 HTML/SVG 工件封装为带强制断网 CSP、后置舞台样式与等比自适应脚本的沙箱文档。
 */
export function buildSandboxedPelicanSrcdoc(rawHtml: string): string {
  const trimmed = (rawHtml || '').trim()
  if (!trimmed) {
    return ''
  }

  // 移除可能劫持相对 URL 的 <base> 标签
  const cleaned = trimmed.replace(/<base\b[^>]*>/gi, '')

  let withEarlyHead: string
  if (/<head\b[^>]*>/i.test(cleaned)) {
    withEarlyHead = cleaned.replace(/<head\b[^>]*>/i, (match) => `${match}${SANDBOX_EARLY_HEAD}`)
  } else if (/<html\b[^>]*>/i.test(cleaned)) {
    withEarlyHead = cleaned.replace(
      /<html\b[^>]*>/i,
      (match) => `${match}<head>${SANDBOX_EARLY_HEAD}</head>`
    )
  } else {
    withEarlyHead = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">${SANDBOX_EARLY_HEAD}</head><body>${cleaned}</body></html>`
  }

  return injectLateHead(withEarlyHead, SANDBOX_LATE_HEAD)
}

export function pickPrimaryPelicanSample(run: IQDetectionRun | null | undefined): IQDetectionSample | null {
  if (!run || !Array.isArray(run.samples) || run.samples.length === 0) {
    return null
  }
  const withArtifact = run.samples.find((s) => Boolean(s.artifact_html && s.artifact_html.trim()))
  return withArtifact ?? run.samples[0] ?? null
}
