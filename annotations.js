/* Study notes V4. Uses CSS Custom Highlight API without changing article DOM. */
(function(){
"use strict";
const day=document.body.dataset.studyDay;
const root=document.querySelector(".layout > main")||document.querySelector(".wrap");
if(!day||!root)return;
const names={highlight:"study-reading-highlight",annotation:"study-reading-annotation"};
const menu=document.createElement("div");
menu.className="study-select-actions";
menu.innerHTML='<button class="study-hl-btn" type="button">高亮</button><button class="study-note-btn" type="button">添加批注</button><span class="study-error" role="status"></span>';
const editor=document.createElement("div");
editor.className="study-note-dialog";
editor.innerHTML='<h3>添加批注</h3><div class="study-quote"></div><textarea placeholder="写下你的理解、疑问或补充"></textarea><div class="study-note-status" role="status"></div><div class="study-note-actions"><button type="button" class="cancel">取消</button><button type="button" class="primary save">保存批注</button></div>';
const popover=document.createElement("div");
popover.className="study-note-popover";
popover.innerHTML='<button class="study-close" type="button" aria-label="关闭">×</button><h3>批注</h3><div class="study-quote"></div><div class="study-text"></div>';
document.body.append(menu,editor,popover);
let selected=null;
let visible=[];
let store=null;
const status=menu.querySelector(".study-error");
const noteStatus=editor.querySelector(".study-note-status");
const noteInput=editor.querySelector("textarea");
function getStore(){
 try{if(window.parent!==window&&window.parent.StudyNotes)return window.parent.StudyNotes;}catch(e){}
 if(!store){
  const key="bigmodel-study-site-annotations-v1";
  store={
   getAnnotations(d){try{return (JSON.parse(localStorage.getItem(key)||"{}")[d]||[]).slice();}catch(e){return[];}},
   getAnnotation(d,id){return this.getAnnotations(d).find(x=>x.id===id);},
   saveAnnotation(d,rec){
    const data=JSON.parse(localStorage.getItem(key)||"{}");data[d]=data[d]||[];
    rec.id="note-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
    data[d].push(rec);localStorage.setItem(key,JSON.stringify(data));return rec;
   },
   refreshCount(){}
  };
 }
 return store;
}
function supported(){
 return !!(window.CSS&&CSS.highlights&&typeof window.Highlight==="function");
}
function textNodes(){
 const result=[];
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
  acceptNode(n){
   if(!n.nodeValue||!n.nodeValue.length)return NodeFilter.FILTER_REJECT;
   if(n.parentElement&&n.parentElement.closest("script,style,.study-select-actions,.study-note-dialog,.study-note-popover"))return NodeFilter.FILTER_REJECT;
   return NodeFilter.FILTER_ACCEPT;
  }
 });
 let n;while((n=walker.nextNode()))result.push(n);
 return result;
}
function offsetOf(range,isEnd){
 const r=document.createRange();r.selectNodeContents(root);
 if(isEnd)r.setEnd(range.endContainer,range.endOffset);
 else r.setEnd(range.startContainer,range.startOffset);
 return r.toString().length;
}
function restoreRange(start,end,quote){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
 const nodes=textNodes();let pos=0,a=null,b=null;
 for(const n of nodes){
  const next=pos+n.length;
  if(!a&&start>=pos&&start<=next)a=[n,start-pos];
  if(!b&&end>=pos&&end<=next)b=[n,end-pos];
  pos=next;
  if(a&&b)break;
 }
 if(a&&b){
  try{
   const r=document.createRange();r.setStart(a[0],a[1]);r.setEnd(b[0],b[1]);
   if(!quote||r.toString()===quote)return r;
  }catch(e){}
 }
 // Recover older markers when an offset no longer matches after a previous layout change.
 if(quote){
  const combined=nodes.map(n=>n.nodeValue).join("");
  const found=combined.indexOf(quote);
  if(found>=0&&(found!==start||found+quote.length!==end))return restoreRange(found,found+quote.length,null);
 }
 return null;
}
function notes(){return getStore().getAnnotations(day);}
function refresh(){
 if(!supported()){
  if(!document.getElementById("study-highlight-warning")){
   const msg=document.createElement("p");msg.id="study-highlight-warning";msg.style.cssText="padding:10px;color:#92400e;background:#fffbeb;border-radius:8px";
   msg.textContent="当前浏览器不支持无侵入式文字标记。请使用较新版本的 Chrome、Edge 或 Safari。";
   root.insertBefore(msg,root.firstChild);
  }
  return;
 }
 const highlights=[],annotations=[];
 visible=[];
 for(const rec of notes()){
  const range=restoreRange(rec.start,rec.end,rec.quote);
  if(!range)continue;
  const kind=rec.type==="highlight"?"highlight":"annotation";
  if(kind==="highlight")highlights.push(range);
  else annotations.push(range);
  visible.push({rec,range,kind});
 }
 CSS.highlights.set(names.highlight,new Highlight(...highlights));
 CSS.highlights.set(names.annotation,new Highlight(...annotations));
}
function placeMenu(rect){
 const maxLeft=Math.max(8,window.innerWidth-226);
 menu.style.left=Math.max(8,Math.min(rect.left,maxLeft))+"px";
 menu.style.top=Math.max(8,Math.min(rect.bottom+7,window.innerHeight-54))+"px";
 menu.style.display="flex";
}
function hideMenu(){menu.style.display="none";status.textContent="";}
function selectRange(){
 const sel=window.getSelection();
 if(!sel||sel.isCollapsed||!sel.toString().trim()){hideMenu();return;}
 const range=sel.getRangeAt(0);
 if(!root.contains(range.commonAncestorContainer)){hideMenu();return;}
 selected={start:offsetOf(range,false),end:offsetOf(range,true),quote:range.toString()};
 if(selected.end<=selected.start){hideMenu();return;}
 placeMenu(range.getBoundingClientRect());
}
document.addEventListener("mouseup",e=>{
 if(e.target.closest&&e.target.closest(".study-select-actions,.study-note-dialog,.study-note-popover"))return;
 selectRange();
});
document.addEventListener("touchend",e=>{
 if(e.target.closest&&e.target.closest(".study-select-actions,.study-note-dialog,.study-note-popover"))return;
 setTimeout(selectRange,60);
});
menu.addEventListener("mousedown",e=>e.preventDefault());
function intersects(a,b){return a.start<b.end&&b.start<a.end;}
function save(kind,text){
 if(!selected)throw Error("未选择正文，请重新选取文字。");
 if(!supported())throw Error("当前浏览器不支持 CSS Custom Highlight API。");
 const existing=notes().find(n=>Number.isFinite(n.start)&&Number.isFinite(n.end)&&intersects(n,selected));
 if(existing)throw Error("选区与已有标记重叠，请先删除旧标记或重新选择。");
 const rec={...selected,type:kind,note:kind==="highlight"?"":text,createdAt:new Date().toISOString()};
 const saved=getStore().saveAnnotation(day,rec);
 if(!saved)throw Error("批注保存失败。");
 refresh();
 getStore().refreshCount();
 selected=null;
 const sel=window.getSelection();if(sel)sel.removeAllRanges();
 hideMenu();return saved;
}
menu.querySelector(".study-hl-btn").addEventListener("click",()=>{
 try{save("highlight","");}catch(e){status.textContent=e.message||String(e);menu.style.display="flex";}
});
menu.querySelector(".study-note-btn").addEventListener("click",()=>{
 if(!selected)return;
 editor.querySelector(".study-quote").textContent="“"+selected.quote+"”";
 noteInput.value="";noteStatus.textContent="";editor.style.display="block";
 popover.style.display="none";hideMenu();noteInput.focus();
});
editor.querySelector(".cancel").addEventListener("click",()=>{editor.style.display="none";selected=null;});
editor.querySelector(".save").addEventListener("click",()=>{
 const text=noteInput.value.trim();
 if(!text){noteStatus.textContent="请先填写批注内容。";return;}
 try{save("annotation",text);editor.style.display="none";}
 catch(e){noteStatus.textContent="保存失败："+(e.message||String(e));}
});
popover.querySelector(".study-close").addEventListener("click",()=>{popover.style.display="none";});
function showNote(rec){
 if(rec.type==="highlight")return;
 popover.querySelector(".study-quote").textContent="“"+rec.quote+"”";
 popover.querySelector(".study-text").textContent=rec.note||"";
 popover.style.display="block";
}
function hitRect(rect,x,y){return x>=rect.left-1&&x<=rect.right+1&&y>=rect.top-2&&y<=rect.bottom+2;}
root.addEventListener("click",e=>{
 if(window.getSelection()&&!window.getSelection().isCollapsed)return;
 // Decoration is not part of the DOM, so locate the annotated text using Range rectangles.
 const hit=visible.filter(v=>v.kind==="annotation").find(v=>
  Array.from(v.range.getClientRects()).some(rect=>hitRect(rect,e.clientX,e.clientY))
 );
 if(hit)showNote(hit.rec);
});
window.focusAnnotation=function(id){
 const v=visible.find(x=>x.rec.id===id);
 if(!v)return;
 const node=v.range.startContainer.nodeType===Node.TEXT_NODE?v.range.startContainer.parentElement:v.range.startContainer;
 if(node&&node.scrollIntoView)node.scrollIntoView({behavior:"smooth",block:"center"});
 if(v.kind==="annotation")showNote(v.rec);
};
window.refreshAnnotations=refresh;
function migrateLegacy(){
 const key="llm-study-day"+day+"-notes-v1";
 let items=[];try{items=JSON.parse(localStorage.getItem(key)||"[]");}catch(e){}
 if(!Array.isArray(items)||!items.length)return;
 const full=textNodes().map(n=>n.nodeValue).join("");let cursor=0;let done=true;
 for(const old of items){
  if(!old||!old.quote||!old.note)continue;
  let i=full.indexOf(old.quote,cursor);if(i<0)i=full.indexOf(old.quote);
  if(i<0)continue;
  try{getStore().saveAnnotation(day,{quote:old.quote,start:i,end:i+old.quote.length,type:"annotation",note:old.note,createdAt:old.time||new Date().toISOString()});}
  catch(e){done=false;break;}
  cursor=i+old.quote.length;
 }
 if(done)try{localStorage.removeItem(key);}catch(e){}
}
function init(){
 if(window.parent!==window){
  try{if(!window.parent.StudyNotes){setTimeout(init,35);return;}}catch(e){}
 }
 migrateLegacy();refresh();
}
init();
})();
