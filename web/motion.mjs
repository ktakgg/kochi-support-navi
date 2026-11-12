// Motion is decorative; search results, counts and focus update immediately.
const preference=matchMedia('(prefers-reduced-motion: reduce)');
const running=new Set();
export function move(el,frames,options){
 if(!el||preference.matches||!el.animate)return;
 const animation=el.animate(frames,{duration:360,easing:'cubic-bezier(.2,.8,.2,1)',...options});
 running.add(animation);animation.finished.then(()=>running.delete(animation),()=>running.delete(animation));
 return animation;
}
preference.addEventListener('change',()=>{if(preference.matches){running.forEach(a=>a.cancel());running.clear();}});
let signature='';
export function animateResults(){
 const cards=[...document.querySelectorAll('#cards .card')];
 const next=cards.map(c=>c.querySelector('h3 a')?.getAttribute('href')).join('|')+'|'+document.querySelector('#result-count')?.textContent;
 if(next===signature)return;signature=next;
 cards.forEach((card,i)=>move(card,[{opacity:0,transform:'translateY(18px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{delay:i*42,duration:420,fill:'backwards'}));
 move(document.querySelector('#cards .empty'),[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}]);
 move(document.querySelector('#result-count'),[{transform:'translateY(5px)',opacity:.35},{transform:'translateY(0)',opacity:1}],{duration:280});
 document.querySelectorAll('#selected button').forEach((b,i)=>move(b,[{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],{delay:i*25,duration:230}));
}
if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting)return;
  move(entry.target,[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],{duration:600});observer.unobserve(entry.target);
 }),{threshold:.12});
 document.querySelectorAll('.guide,.official-group,footer').forEach(el=>observer.observe(el));
}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(!button||button.disabled||preference.matches)return;
 move(button,[{transform:'scale(.96)'},{transform:'scale(1)'}],{duration:240});
});
