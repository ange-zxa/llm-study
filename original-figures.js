/* Display textbook figure crops extracted from the user's uploaded PDF.
   The separate illustrated teaching diagrams are intentionally retained.
   Original image bytes are stored once in 教材原图对照学习.html.
*/
(async function(){
 const containers=Array.from(document.querySelectorAll('[data-book-figures]'));
 if(!containers.length)return;
 try{
  const res=await fetch('教材原图对照学习.html',{cache:'force-cache'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const html=await res.text();
  const doc=new DOMParser().parseFromString(html,'text/html');
  const book=new Map();
  for(const article of doc.querySelectorAll('article.fig')){
   const title=article.querySelector('h3')?.textContent||'';
   const match=title.match(/教材原图\s*(\d+-\d+)/);
   const img=article.querySelector('img');
   if(match&&img)book.set(match[1],{src:img.getAttribute('src'),title,source:article.querySelector('.source')?.textContent||'',description:article.querySelector('p')?.textContent||''});
  }
  for(const area of containers){
   const ids=(area.dataset.bookFigures||'').trim().split(/[\s,]+/).filter(Boolean);
   area.replaceChildren();
   for(const id of ids){
    const item=book.get(id);
    if(!item)continue;
    const figure=document.createElement('figure');
    figure.className='textbook-original-figure';
    const img=document.createElement('img');img.src=item.src;img.alt='教材原图 '+id;img.loading='lazy';img.decoding='async';
    const caption=document.createElement('figcaption');
    const strong=document.createElement('strong');strong.textContent='《图解大模型》原书图 '+id;
    const desc=document.createElement('span');desc.textContent=' · '+item.description;
    const source=document.createElement('small');source.textContent=item.source;
    caption.append(strong,desc,document.createElement('br'),source);
    figure.append(img,caption);
    area.appendChild(figure);
   }
   if(!area.children.length){
    const warning=document.createElement('p');warning.textContent='教材原图暂时无法读取，请使用下方的原书图册链接。';
    area.appendChild(warning);
   }
  }
 }catch(err){
  for(const area of containers)area.textContent='教材原图加载失败。可以点击下方链接打开原书图册：'+(err?.message||'');
 }
})();