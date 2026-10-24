// Run against a local Vite server and Chrome launched with --remote-debugging-port=9337.
import assert from 'node:assert/strict';
const targets = await (await fetch('http://127.0.0.1:9337/json')).json();
const ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.onopen = resolve);
let sequence = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
};
const send = (method, params = {}) => new Promise(resolve => { pending.set(++sequence, resolve); ws.send(JSON.stringify({ id: sequence, method, params })); });
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert.equal(result.result.exceptionDetails, undefined, JSON.stringify(result.result.exceptionDetails));
  return result.result.result.value;
};
try {
  await send('Runtime.enable');
  await send('Page.navigate', { url: process.env.GAME_URL ?? 'http://127.0.0.1:4175' });
  await new Promise(resolve=>setTimeout(resolve,700));
  for (let i=0;i<50;i++) { if (await evaluate("Boolean(document.querySelector('#one-player') && !document.querySelector('#one-player').disabled)")) break; await new Promise(r=>setTimeout(r,100)); }
  await evaluate("document.querySelector('#one-player').click()");
  const prototype = await send('Runtime.evaluate', { expression: "import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/game/GameScene.ts')).name).then(m=>m.GameScene.prototype)", awaitPromise:true });
  const objects = await send('Runtime.queryObjects', { prototypeObjectId: prototype.result.result.objectId });
  await send('Runtime.callFunctionOn', { objectId: objects.result.objects.objectId, functionDeclaration: 'function(){ globalThis.testScene=this[0]; }' });
  console.log(await evaluate(`(() => {
    const s=testScene; const check=(v,m)=>{if(!v)throw Error(m)};
    s.startSession(2); s.loadStage(1); s.paused=true;s.physics.pause();
    const p=s.players[0], other=s.players[1];
    const give=kind=>s.collectElementItem(s.spawnElementItem(kind,2,10),p);
    for(const kind of ['fire','shoes','cloud','rainbow','shootingStar'])give(kind);
    check(p.speedUntil===Infinity && p.flightUntil===Infinity && p.bubbleElementUntil===Infinity,'Timed powers');
    check(!other.shootingStar && !other.rainbowBubbles,'Coop power leak');
    const count=s.enemies.filter(e=>e.defeated).length;
    s.fireBubble(p);const bubble=s.bubbles.at(-1);
    check(bubble.rainbow && bubble.element==='fire' && bubble.sprite.isTinted,'Rainbow elemental bubble');
    check(s.enemies.filter(e=>e.defeated).length===count+1,'Star must take one enemy');
    s.fireBubble(p);check(s.enemies.filter(e=>e.defeated).length===count+2,'Star duplicate target');
    p.rainbowRemaining=0;s.fireBubble(p);check(s.bubbles.at(-1).rainbow,'Rainbow vanished after protection');
    s.completeStage();return 'PASS: permanent powers, rainbow elemental shots, one star target per shot, co-op isolation';
  })()`));
  await new Promise(r=>setTimeout(r,1500));
  console.log(await evaluate(`(() => {
    const s=testScene;const check=(v,m)=>{if(!v)throw Error(m)}; const p=s.players[0];
    s.paused=true;s.physics.pause();
    check(s.stageIndex===2 && p.shootingStar && p.rainbowBubbles && p.bubbleElement==='fire' && p.flightUntil===Infinity,'Stage persistence');
    check(s.starEffects.length===0,'Star effects leaked');
    const lives=p.lives;s.hurtPlayer(p);
    check(p.lives===lives-1 && !p.shootingStar && !p.rainbowBubbles && !p.bubbleElement && p.flightUntil===0 && p.speedUntil===0,'Death reset');
    check(p.sprite.body.allowGravity,'Flight gravity reset');
    s.continueAfterGameOver();check(!p.shootingStar && !p.rainbowBubbles,'Continue restored lost powers');
    s.startSession(1);check(!s.players[0].shootingStar,'New session powers');
    s.paused=true;s.physics.pause();
    return 'PASS: stage persistence, effect cleanup, lost-life reset, continue and new session';
  })()`));
  assert.deepEqual(errors, []);
  console.log('PASS: no browser runtime exceptions');
} finally { ws.close(); }
