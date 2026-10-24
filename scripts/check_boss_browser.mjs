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
    const s=testScene; const check=(condition,message)=>{if(!condition)throw Error(message)};
    s.startSession(1); check(s.boss.hp===24,'Solo boss HP');
    s.update(0,16); check(s.playing && s.stageIndex===0,'Empty enemy list skipped boss');
    s.completeStage(true); check(s.playing,'EXIT skipped living boss');
    s.paused=true; s.physics.pause();
    const p=s.players[0];
    for(const [kind,damage] of [['lightning',2],['fire',3]]) {
      s.collectElementItem(s.elementItems.find(i=>i.kind===kind),p);
      check(p.bubbleElementUntil===Infinity,'Boss element expired');
      const before=s.boss.hp; s.fireBubble(p); const bubble=s.bubbles.at(-1);
      bubble.sprite.body.reset(s.boss.sprite.x,s.boss.sprite.y); s.checkInteractions();
      check(s.boss.hp===before-damage,kind+' damage/collision');
      check(!bubble.sprite.active,'Boss shot not consumed');
    }
    s.boss.attackIn=0; s.updateBoss(.016);
    check(s.bossHazards.length===1 && !s.bossHazards[0].launched,'Lightning telegraph');
    const hazard=s.bossHazards[0]; p.sprite.body.reset(hazard.sprite.x,390); p.invulnerable=0;
    const lives=p.lives; s.checkInteractions(); check(p.lives===lives,'Warning damaged player');
    const delay=hazard.delay; s.update(0,500); check(hazard.delay===delay,'Pause advanced warning');
    s.updateBossHazards(1.01); s.checkInteractions(); check(p.lives===lives-1,'Live lightning did not damage');
    s.clearBossHazards(); s.boss.attackIn=0;s.updateBoss(.016);
    check(s.bossHazards.length===3 && s.bossHazards.every(h=>h.kind==='fire'),'Fire fan');
    s.updateBossHazards(.71); check(s.bossHazards.every(h=>h.launched && h.sprite.body.velocity.length()>0),'Fire not moving');
    s.clearBossHazards(); s.boss.hp=12; s.boss.attackIn=0;s.updateBoss(.016);
    check(s.bossHazards.length===2,'Second-phase lightning');
    s.continueAfterGameOver(); check(s.bossHazards.length===0 && s.boss.hp===12,'Continue reset boss or kept hazards');
    s.physics.pause(); s.paused=true;
    while(s.boss.hp>0) { s.fireBubble(p);const bubble=s.bubbles.at(-1);bubble.sprite.body.reset(s.boss.sprite.x,s.boss.sprite.y);s.checkInteractions(); }
    check(!s.boss.sprite.active && s.score===6500,'Boss victory/reward');
    s.paused=false;s.update(0,16);check(!s.playing,'Victory failed to schedule transition');
    return 'PASS: boss gate, element damage, telegraphs, hazards, pause, phase, continue, victory';
  })()`));
  await new Promise(r=>setTimeout(r,1500));
  console.log(await evaluate(`(() => {
    const s=testScene;if(s.stageIndex!==1 || s.boss || s.bossHazards.length)throw Error('Stage 2 cleanup');
    if(s.players[0].bubbleElement)throw Error('Lost-life element returned');
    s.paused=true;s.physics.pause();const enemy=s.enemies[0];s.fireBubble(s.players[0]);const bubble=s.bubbles.at(-1);
    s.captureEnemy(bubble,enemy);if(!enemy.sprite.texture.key.endsWith('-trapped'))throw Error('Captured art missing');
    s.releaseEnemy(bubble);if(enemy.sprite.texture.key!==enemy.textureKey)throw Error('Released art missing');
    s.startSession(2);if(s.boss.maxHp!==36)throw Error('Coop HP');s.paused=true;s.physics.pause();
    return 'PASS: stage progression, cleanup, captured/released artwork, co-op';
  })()`));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'.',code:'Period',windowsVirtualKeyCode:190});
  console.log(await evaluate(`(() => {const s=testScene;const before=s.bubbles.length;s.players[1].cooldown=0;s.updatePlayer(s.players[1],.016);if(s.bubbles.length!==before+1 || s.bubbles.at(-1).owner!==1)throw Error('P2 period input');return 'PASS: period fires for P2';})()`));
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'.',code:'Period',windowsVirtualKeyCode:190});
  assert.deepEqual(errors, []);
  console.log('PASS: no browser runtime exceptions');
} finally { ws.close(); }
