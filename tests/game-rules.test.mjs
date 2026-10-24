import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rainbowContacts, decideEnemy } from '../src/game/rules.ts';

test('rainbow absorbs ten separate contacts, not ten overlapping frames', () => {
  let remaining = 10;
  let previous = new Set();
  for (let i = 0; i < 10; i++) {
    let result = rainbowContacts(remaining, previous, new Set(['ghost']));
    assert.equal(result.remaining, 9 - i);
    assert.equal(result.protected, true);
    remaining = result.remaining;
    previous = result.contacts;
    result = rainbowContacts(remaining, previous, new Set(['ghost']));
    assert.equal(result.remaining, remaining);
    previous = rainbowContacts(remaining, previous, new Set()).contacts;
  }
  assert.equal(rainbowContacts(remaining, previous, new Set(['whale'])).protected, false);
});

test('simultaneous enemies consume charges without damaging the final protected contact', () => {
  const result = rainbowContacts(1, new Set(), new Set(['a', 'b']));
  assert.equal(result.remaining, 0);
  assert.equal(result.protected, true);
});

const situation = { direction: 1, chase: true, grounded: true, wallLeft: false, wallRight: false, floorAhead: true, targetDx: 100, targetDy: 0, targetVx: 0, targetRainbow: false, threatDx: undefined, canJump: true };
test('AI pursues, retreats from rainbow, avoids ledges and dodges shots', () => {
  assert.equal(decideEnemy(situation).direction, 1);
  assert.equal(decideEnemy({ ...situation, targetRainbow: true }).direction, -1);
  assert.equal(decideEnemy({ ...situation, floorAhead: false }).direction, -1);
  assert.equal(decideEnemy({ ...situation, threatDx: 50 }).jump, true);
  assert.equal(decideEnemy({ ...situation, threatDx: 50, canJump: false }).jump, false);
  assert.equal(decideEnemy({ ...situation, targetDy: -70 }).jump, true);
  assert.equal(decideEnemy({ ...situation, wallRight: true }).direction, -1);
});

test('all ten stages use new characters and at most two powerups, including rainbow', () => {
  let rainbows = 0;
  for (let i = 1; i <= 10; i++) {
    const stage = JSON.parse(readFileSync(new URL(`../docs/samples/stage-${String(i).padStart(2, '0')}.json`, import.meta.url)));
    assert.deepEqual(stage.playerSpawns.map(p => p.character), ['nakkong', 'muning']);
    assert.ok(stage.items.length <= 2);
    rainbows += stage.items.filter(item => item.kind === 'rainbow').length;
  }
  assert.ok(rainbows > 0);
});

test('first stage requires a boss defeat and supplies fire/lightning within the item cap', () => {
  const stage = JSON.parse(readFileSync(new URL('../docs/samples/stage-01.json', import.meta.url)));
  assert.ok(stage.boss.hp > 0);
  assert.equal(stage.enemies.length, 0);
  assert.deepEqual(stage.items.map(i=>i.kind).sort(), ['fire', 'lightning']);
  assert.equal(stage.rules.clearWhenBossDefeated, true);
});

test('boss damage, phase and clear gate respect defeat and elemental attacks', async () => {
  const { bossDamage, bossPhase, canClearStage } = await import('../src/game/rules.ts');
  assert.equal(bossDamage(), 1);
  assert.equal(bossDamage('lightning'), 2);
  assert.equal(bossDamage('fire'), 3);
  assert.equal(bossPhase(24,24), 1);
  assert.equal(bossPhase(12,24), 2);
  assert.equal(canClearStage(true, 1, true, true), false);
  assert.equal(canClearStage(true, 0, true, true), true);
  assert.equal(canClearStage(false, 0, false, true), false);
  assert.equal(canClearStage(false, 0, true, true), true);
});
