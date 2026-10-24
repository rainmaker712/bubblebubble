// One-time migration: Vite on 4175 and Chrome CDP on 9337. Unity runs without either.
import { mkdir, writeFile } from 'node:fs/promises';
const targets = await (await fetch('http://127.0.0.1:9337/json')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
try {
  const result = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async()=>{
    const {drawArcadeArt}=await import('/src/game/arcadeArt.ts?t='+Date.now());
    const {drawCharacter}=await import('/src/game/characters.ts');
    const list=[];
    const add=(key,w,h,draw,scale=2)=>{const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;const ctx=c.getContext('2d');ctx.scale(scale,scale);draw(ctx);list.push({key,data:c.toDataURL('image/png').split(',')[1]});};
    for(const name of ['nakkong','muning'])add(name,38,40,c=>drawCharacter(c,name));
    const art=(key,w=28,h=28,accent,secondary)=>add(key,w,h,c=>drawArcadeArt(c,key,w,h,accent,secondary));
    for(let i=0;i<8;i++){art('ghost_enemy-v'+i,30,34);art('ghost_enemy-v'+i+'-trapped',30,34);}
    for(const k of ['bubble','bubble-green','bubble-blue','bubble-water','bubble-fire','bubble-lightning','strawberry','banana','cookie','apple','grapes','cherries'])art(k);
    for(const k of ['water','fire','lightning','shoes','shield','rainbow','cloud','shootingStar','trash'])art(k+'-item',28,32);
    for(const [i,k] of ['E','X','I','T'].entries())art('letter-'+k,30,34,['#ff6897','#53d6ff','#ffe36a','#7aef67'][i]);
    art('ghost-whale',48,48);art('ghost-whale-open',48,48);art('boss-king',96,96);art('boss-ember-king',96,96);art('boss-frost-king',96,96);art('boss-ice');art('boss-lightning',24,336);art('boss-fire');art('spark',6,6);
    for(let i=1;i<=10;i++){const s=await (await fetch('/Assets/BubbleBubble/Resources/Stages/stage-'+String(i).padStart(2,'0')+'.json')).json();art('platform-s'+i,32,32,s.theme.palette[2],s.theme.palette[4]);}
    return list;
  })()` });
  if(result.result.exceptionDetails)throw Error(JSON.stringify(result.result.exceptionDetails));
  const dir=new URL('../Assets/BubbleBubble/Resources/Art/',import.meta.url);await mkdir(dir,{recursive:true});
  for(const asset of result.result.result.value)await writeFile(new URL(asset.key+'.png',dir),Buffer.from(asset.data,'base64'));
  console.log('Exported '+result.result.result.value.length+' original game sprites.');
} finally {ws.close();}
