import { drawArcadeArt } from './arcadeArt';
import { drawCharacter } from './characters';
import { bossDamage, bossPhase, canClearStage, decideEnemy, rainbowContacts } from './rules';
import Phaser from 'phaser';
import stage01 from '../../docs/samples/stage-01.json';
import stage02 from '../../docs/samples/stage-02.json';
import stage03 from '../../docs/samples/stage-03.json';
import stage04 from '../../docs/samples/stage-04.json';
import stage05 from '../../docs/samples/stage-05.json';
import stage06 from '../../docs/samples/stage-06.json';
import stage07 from '../../docs/samples/stage-07.json';
import stage08 from '../../docs/samples/stage-08.json';
import stage09 from '../../docs/samples/stage-09.json';
import stage10 from '../../docs/samples/stage-10.json';
import type { BossState, BossHazard, BubbleState, BubbleElementKind, Character, ElementItemState, ElementKind, EnemyState, ExitLetter, GhostKind, LetterItemState, PickupKind, PickupState, PlayerState, PlayerProgress, StageData, WhaleState } from './types';

const stages = [stage01, stage02, stage03, stage04, stage05, stage06, stage07, stage08, stage09, stage10] as StageData[];
const TILE = 32;
const WIDTH = 512;
const HEIGHT = 448;

type ControlSet = {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  fire: Phaser.Input.Keyboard.Key;
};

export class GameScene extends Phaser.Scene {
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private players: PlayerState[] = [];
  private enemies: EnemyState[] = [];
  private bubbles: BubbleState[] = [];
  private pickups: PickupState[] = [];
  private elementItems: ElementItemState[] = [];
  private letterItems: LetterItemState[] = [];
  private whale?: WhaleState;
  private boss?: BossState;
  private bossHazards: BossHazard[] = [];
  private backdrop?: Phaser.GameObjects.Container;
  private dangerOverlay?: Phaser.GameObjects.Rectangle;
  private controls: ControlSet[] = [];
  private hudScore!: Phaser.GameObjects.Text;
  private hudTime!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Text;
  private notice!: Phaser.GameObjects.Text;
  private score = 0;
  private timeLeft = 70;
  private playing = false;
  private paused = false;
  private esc!: Phaser.Input.Keyboard.Key;
  private continueKey!: Phaser.Input.Keyboard.Key;
  private stageIndex = 0;
  private playerCount: 1 | 2 = 1;
  private currentStage = stages[0];
  private playerProgress: Array<Partial<PlayerProgress> & { lives: number }> = [];
  private starEffects: Phaser.GameObjects.Sprite[] = [];
  private exitLetters = new Set<ExitLetter>();
  private nextExitLetter = 0;
  private exitBonusTriggered = false;
  private awaitingContinue = false;
  private continueUntil = 0;
  private dangerActive = false;

  constructor() { super('GameScene'); }

  create(): void {
    this.createTextures();
    this.drawBackdrop();
    this.buildPlatforms();
    this.createHud();
    this.createControls();
    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
    document.dispatchEvent(new CustomEvent('bubblebubble-ready'));
  }

  startSession(playerCount: 1 | 2): void {
    this.score = 0;
    this.stageIndex = 0;
    this.playerCount = playerCount;
    this.playerProgress = Array.from({ length: playerCount }, () => ({ lives: stages[0].rules.startingLives }));
    this.loadStage(0);
  }

  private loadStage(index: number): void {
    this.clearSession();
    this.stageIndex = index;
    this.currentStage = stages[index];
    this.drawBackdrop();
    this.buildPlatforms();
    this.timeLeft = this.currentStage.rules.timeLimitSeconds;
    this.players = this.currentStage.playerSpawns.slice(0, this.playerCount).map((spawn, playerIndex) => this.spawnPlayer(spawn.character, playerIndex, spawn.tile.x, spawn.tile.y));
    this.enemies = this.currentStage.enemies.map((enemy, enemyIndex) => this.spawnEnemy(enemy.kind, enemy.behavior, enemy.tile.x, enemy.tile.y, enemyIndex));
    this.elementItems = this.currentStage.items.slice(0, 2).map((item) => this.spawnElementItem(item.kind, item.tile.x, item.tile.y));
    this.spawnBoss();
    this.exitLetters.clear();
    this.nextExitLetter = 0;
    this.exitBonusTriggered = false;
    this.awaitingContinue = false;
    this.dangerActive = false;
    document.dispatchEvent(new CustomEvent('bubblebubble-calm'));
    for (const player of this.players) {
      this.physics.add.collider(player.sprite, this.platforms, undefined, (playerObject, platformObject) => {
        const playerBody = (playerObject as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        const platform = platformObject as Phaser.Physics.Arcade.Sprite;
        const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;
        if (platform.x <= TILE / 2 || platform.x >= WIDTH - TILE / 2) return true;
        return playerBody.velocity.y >= 0 && playerBody.bottom <= platformBody.top + 10;
      });
    }
    for (const enemy of this.enemies) this.physics.add.collider(enemy.sprite, this.platforms);
    this.playing = true;
    this.paused = false;
    this.physics.resume();
    this.showNotice(this.currentStage.boss ? '불·번개로 왕을 공격! 경고를 피하세요' : `STAGE ${index + 1} · ${this.currentStage.title}`, '#fff5b8', 2200);
    this.refreshHud();
  }

  update(_time: number, deltaMs: number): void {
    if (!this.playing) return;
    if (this.awaitingContinue) {
      if (Phaser.Input.Keyboard.JustDown(this.continueKey)) this.continueAfterGameOver();
      else if (this.time.now >= this.continueUntil) this.finish(false);
      else this.refreshHud();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.esc)) this.togglePause();
    if (this.paused) return;
    const dt = Math.min(deltaMs / 1000, 0.04);
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.players.forEach((player) => this.updatePlayer(player, dt));
    this.enemies.forEach((enemy) => this.updateEnemy(enemy));
    this.updateBoss(dt);
    this.updateBossHazards(dt);
    this.updateWhale();
    this.bubbles.forEach((bubble) => this.updateBubble(bubble));
    this.updateCollectibles();
    this.checkInteractions();
    this.cleanup();
    this.refreshHud();
    if (!this.exitBonusTriggered && canClearStage(Boolean(this.currentStage.boss), this.boss?.hp ?? 1, this.enemies.every((enemy) => enemy.defeated), this.pickups.every((pickup) => pickup.collected))) this.completeStage();
    else if (this.players.every((player) => player.dead)) this.offerContinue();
    if (this.playing && this.timeLeft <= 0 && !this.dangerActive && !this.currentStage.boss) this.startDangerMode();
  }

  private spawnBoss(): void {
    const config = this.currentStage.boss;
    if (!config) return;
    const sprite = this.physics.add.sprite(config.tile.x * TILE + 16, config.tile.y * TILE + 16, 'boss-king').setDepth(19).setDisplaySize(96, 96);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(140, 144).setOffset(26, 40);
    const maxHp = config.hp + (this.playerCount === 2 ? 12 : 0);
    const hud = this.add.container(256, 50).setDepth(42);
    const track = this.add.rectangle(0, 12, 224, 8, 0x29152d).setStrokeStyle(1, 0xffdc59);
    const healthFill = this.add.rectangle(-110, 12, 220, 4, 0xff5b94).setOrigin(0, 0.5);
    const label = this.add.text(0, -6, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ffdc59' }).setOrigin(0.5);
    hud.add([track, healthFill, label]);
    this.boss = { sprite, hp: maxHp, maxHp, elapsed: 0, attackIn: 3, attackIndex: 0, hurtFor: 0, hud, healthFill, label };
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (!boss || boss.hp <= 0) return;
    boss.elapsed += dt;
    boss.hurtFor = Math.max(0, boss.hurtFor - dt);
    const phase = bossPhase(boss.hp, boss.maxHp);
    const x = 256 + Math.sin(boss.elapsed * (phase === 2 ? .8 : .55)) * 125;
    const y = 254 + Math.sin(boss.elapsed * 1.2) * 34;
    boss.sprite.setPosition(x, y).setFlipX(Math.cos(boss.elapsed * .55) < 0);
    boss.sprite.setTint(boss.hurtFor > 0 ? 0xffaaa8 : phase === 2 ? 0xffd4e6 : 0xffffff);
    boss.healthFill.width = 220 * boss.hp / boss.maxHp;
    boss.label.setText(`번개 왕 · ${boss.hp}/${boss.maxHp} · ${phase === 2 ? '분노' : 'BOSS'}`);
    boss.attackIn -= dt;
    if (boss.attackIn > 0) return;
    const target = this.nearestPlayer(x);
    if (!target) return;
    if (boss.attackIndex % 2 === 0) {
      const columns = [target.sprite.x];
      if (phase === 2) columns.push(Phaser.Math.Clamp(target.sprite.x + (target.sprite.x < 256 ? 80 : -80), 52, 460));
      for (const column of columns) this.spawnBossHazard('lightning', column, 245, 0, 0);
    } else {
      const angle = Math.atan2(target.sprite.y - y, target.sprite.x - x);
      const speed = phase === 2 ? 145 : 110;
      for (const spread of [-.3, 0, .3]) this.spawnBossHazard('fire', x, y + 22, Math.cos(angle + spread) * speed, Math.sin(angle + spread) * speed);
    }
    boss.attackIndex += 1;
    boss.attackIn = this.timeLeft <= 0 ? 1.7 : phase === 2 ? 2.2 : 3.1;
  }

  private spawnBossHazard(kind: 'fire' | 'lightning', x: number, y: number, vx: number, vy: number): void {
    const lightning = kind === 'lightning';
    const sprite = this.physics.add.sprite(x, y, lightning ? 'boss-lightning' : 'boss-fire').setDepth(23).setVisible(false);
    sprite.setDisplaySize(lightning ? 22 : 22, lightning ? 332 : 26);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    const warning = this.add.rectangle(x, lightning ? 245 : y, lightning ? 30 : 36, lightning ? 332 : 36, lightning ? 0xffde5a : 0xff6544, .16).setStrokeStyle(2, lightning ? 0xffde5a : 0xff6544, .8).setDepth(16);
    const warningLabel = this.add.text(x, lightning ? 391 : y - 22, lightning ? '⚡ 주의' : '불꽃!', { fontFamily: 'sans-serif', fontSize: '10px', color: '#ffdf65', backgroundColor: '#160c1f' }).setOrigin(.5).setDepth(24);
    this.bossHazards.push({ sprite, kind, warning, warningLabel, delay: lightning ? 1 : .7, life: lightning ? .45 : 4, vx, vy, launched: false });
  }

  private updateBossHazards(dt: number): void {
    for (const hazard of this.bossHazards) {
      if (!hazard.sprite.active) continue;
      let activeDt = dt;
      if (!hazard.launched) {
        hazard.delay -= dt;
        hazard.warning.setAlpha(.5 + .5 * Math.abs(Math.sin(hazard.delay * 12)));
        if (hazard.delay > 0) continue;
        activeDt = -hazard.delay;
        hazard.launched = true;
        hazard.warning.destroy(); hazard.warningLabel.destroy();
        hazard.sprite.setVisible(true);
        const body = hazard.sprite.body as Phaser.Physics.Arcade.Body;
        body.enable = true; body.reset(hazard.sprite.x, hazard.sprite.y); body.setVelocity(hazard.vx, hazard.vy);
      }
      hazard.life -= activeDt;
      if (hazard.life <= 0 || hazard.sprite.x < 25 || hazard.sprite.x > WIDTH - 25 || hazard.sprite.y > HEIGHT - 22 || hazard.sprite.y < 34) hazard.sprite.destroy();
    }
    this.bossHazards = this.bossHazards.filter(hazard => hazard.sprite.active);
  }

  private hitBoss(bubble: BubbleState): void {
    const boss = this.boss;
    if (!boss || boss.hp <= 0) return;
    this.destroyBubble(bubble);
    boss.hp = Math.max(0, boss.hp - bossDamage(bubble.element));
    boss.hurtFor = .12;
    this.burst(boss.sprite.x, boss.sprite.y, bubble.element === 'fire' ? 0xff8844 : 0xffee77, 12);
    boss.healthFill.width = 220 * boss.hp / boss.maxHp;
    boss.label.setText(`번개 왕 · ${boss.hp}/${boss.maxHp}`);
    if (boss.hp > 0) return;
    this.score += 5000;
    this.burst(boss.sprite.x, boss.sprite.y, 0xffdc59, 40);
    boss.sprite.destroy();
    this.clearBossHazards();
    this.showNotice('왕을 물리쳤어요! +5000', '#ffdc59', 1100);
  }

  private clearBossHazards(): void {
    for (const hazard of this.bossHazards) {
      hazard.sprite.destroy();
      if (hazard.warning.active) hazard.warning.destroy();
      if (hazard.warningLabel.active) hazard.warningLabel.destroy();
    }
    this.bossHazards = [];
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('키보드 입력을 사용할 수 없습니다.');
    const p1 = keyboard.addKeys({ left: 'A', right: 'D', jump: 'W', fire: 'F' }) as ControlSet;
    const p2 = keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', jump: 'UP', fire: 'PERIOD' }) as ControlSet;
    this.controls = [p1, p2];
    this.esc = keyboard.addKey('ESC');
    this.continueKey = keyboard.addKey('C');
  }

  private spawnPlayer(character: Character, index: number, tx: number, ty: number): PlayerState {
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    const sprite = this.physics.add.sprite(x, y, character).setDepth(20).setCollideWorldBounds(false);
    sprite.setDisplaySize(38, 40);
    sprite.setBodySize(40, 56).setBounce(0);
    sprite.setMaxVelocity(190, 440);
    const rainbowLabel = this.add.text(x, y - 30, '', { fontFamily: 'sans-serif', fontSize: '10px', color: '#fff5b8', backgroundColor: '#17152fcc', padding: { x: 3, y: 2 } }).setOrigin(0.5).setDepth(29);
    const progress = this.playerProgress[index] ?? { lives: this.currentStage.rules.startingLives };
    return { sprite, character, index, facing: index === 0 ? 1 : -1, spawnX: x, spawnY: y, cooldown: 0, invulnerable: 0, dead: false, bubbleElementUntil: 0, speedUntil: 0, shieldUntil: 0, flightUntil: 0, rainbowBubbles: false, shootingStar: false, rainbowRemaining: 0, ...progress, rainbowContacts: new Set(), rainbowLabel };
  }

  private spawnEnemy(kind: GhostKind, behavior: 'patrol' | 'chase', tx: number, ty: number, enemyIndex = 0): EnemyState {
    const textureKey = `ghost_enemy-v${(enemyIndex + this.stageIndex * 2) % 8}`;
    const sprite = this.physics.add.sprite(tx * TILE + TILE / 2, ty * TILE + TILE / 2, textureKey).setDepth(18);
    sprite.setDisplaySize(30, 34);
    sprite.setBodySize(48, 48).setBounce(0);
    return { sprite, kind, textureKey, behavior, captured: false, defeated: false, enraged: false, direction: kind === 'ghost_bubblun' ? 1 : -1, nextDecisionAt: 0, nextJumpAt: 0 };
  }

  private updatePlayer(player: PlayerState, dt: number): void {
    if (player.dead) return;
    const body = player.sprite.body as Phaser.Physics.Arcade.Body;
    if (player.sprite.y > HEIGHT + 24) {
      player.sprite.setPosition(Phaser.Math.Clamp(player.sprite.x, 40, WIDTH - 40), 46);
      body.setVelocityY(70);
      this.burst(player.sprite.x, 48, 0xdff7ff, 10);
    } else if (player.sprite.y < 22) {
      player.sprite.y = 22;
      body.setVelocityY(Math.max(0, body.velocity.y));
    }
    const input = this.controls[player.index];
    const direction = (input.right.isDown ? 1 : 0) - (input.left.isDown ? 1 : 0);
    const speedBoosted = this.time.now < player.speedUntil;
    const flying = this.time.now < player.flightUntil;
    body.setAllowGravity(!flying);
    body.setVelocityX(direction * (speedBoosted ? 225 : 150));
    if (direction !== 0) {
      player.facing = direction as -1 | 1;
      player.sprite.setFlipX(direction < 0);
    }
    if (flying) body.setVelocityY(input.jump.isDown ? -145 : 38);
    else if (Phaser.Input.Keyboard.JustDown(input.jump) && body.blocked.down) body.setVelocityY(speedBoosted ? -375 : -340);
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.bubbleElement && this.time.now >= player.bubbleElementUntil) player.bubbleElement = undefined;
    const shielded = this.time.now < player.shieldUntil;
    player.rainbowLabel.setPosition(player.sprite.x, player.sprite.y - 28).setText(player.rainbowRemaining > 0 ? `무지개 ${player.rainbowRemaining}/10` : '');
    if (player.rainbowBubbles) {
      const hue = (this.time.now % 1800) / 1800;
      player.sprite.setTint(Phaser.Display.Color.HSVToRGB(hue, 0.45, 1).color, Phaser.Display.Color.HSVToRGB((hue + .25) % 1, .45, 1).color, Phaser.Display.Color.HSVToRGB((hue + .5) % 1, .45, 1).color, Phaser.Display.Color.HSVToRGB((hue + .75) % 1, .45, 1).color);
    }
    else if (flying) player.sprite.setTint(0xe8f8ff);
    else if (shielded) player.sprite.setTint(0x9dffcf);
    else if (speedBoosted) player.sprite.setTint(0xffe36e);
    else if (player.bubbleElement === 'water') player.sprite.setTint(0x8deaff);
    else if (player.bubbleElement === 'lightning') player.sprite.setTint(0xffed86);
    else if (player.bubbleElement === 'fire') player.sprite.setTint(0xffa068);
    else player.sprite.clearTint();
    player.sprite.setAlpha(player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0 ? 0.3 : 1);
    const firePressed = input.fire.isDown;
    if (firePressed && player.cooldown <= 0) this.fireBubble(player);
  }

  private updateEnemy(enemy: EnemyState): void {
    if (enemy.captured || enemy.defeated) return;
    const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
    if (enemy.sprite.y > HEIGHT + 24) {
      enemy.sprite.setPosition(Phaser.Math.Clamp(enemy.sprite.x, 42, WIDTH - 42), 48);
      body.setVelocityY(80);
    }
    const angry = enemy.enraged || this.timeLeft <= this.currentStage.rules.enrageAtSecondsRemaining;
    const speed = angry ? 92 : 58;
    if (this.time.now >= enemy.nextDecisionAt) {
      const target = this.players.filter(player => !player.dead).sort((a, b) =>
        Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, a.sprite.x, a.sprite.y) - Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, b.sprite.x, b.sprite.y))[0];
      const threat = this.bubbles.find(bubble => {
        const velocity = (bubble.sprite.body as Phaser.Physics.Arcade.Body)?.velocity.x ?? 0;
        return bubble.sprite.active && !bubble.capturedEnemy && this.time.now < bubble.driftAt &&
          Math.abs(bubble.sprite.y - enemy.sprite.y) < 28 && Math.abs(bubble.sprite.x - enemy.sprite.x) < 100 &&
          (enemy.sprite.x - bubble.sprite.x) * velocity > 0;
      });
      const decision = decideEnemy({
        direction: enemy.direction, chase: enemy.behavior === 'chase', grounded: body.blocked.down,
        wallLeft: body.blocked.left, wallRight: body.blocked.right,
        floorAhead: this.isSolidAtWorld(enemy.sprite.x + enemy.direction * 22, body.bottom + 6),
        targetDx: target ? target.sprite.x - enemy.sprite.x : undefined,
        targetDy: target ? target.sprite.y - enemy.sprite.y : undefined,
        targetVx: target ? (target.sprite.body as Phaser.Physics.Arcade.Body).velocity.x : 0,
        targetRainbow: Boolean(target && target.rainbowRemaining > 0),
        threatDx: threat ? threat.sprite.x - enemy.sprite.x : undefined,
        canJump: this.time.now >= enemy.nextJumpAt,
      });
      enemy.direction = decision.direction;
      if (decision.jump) { body.setVelocityY(-310); enemy.nextJumpAt = this.time.now + 1100; }
      enemy.nextDecisionAt = this.time.now + (angry ? 100 : 180);
    }
    body.setVelocityX(enemy.direction * speed);
    enemy.sprite.setFlipX(enemy.direction < 0);
    enemy.sprite.setTint(angry ? 0xffb2bd : 0xffffff);
  }

  private startDangerMode(): void {
    this.dangerActive = true;
    this.enemies.forEach((enemy) => { if (!enemy.defeated) enemy.enraged = true; });
    const target = this.nearestPlayer(WIDTH / 2);
    const spawnX = target && target.sprite.x < WIDTH / 2 ? WIDTH - 52 : 52;
    const sprite = this.physics.add.sprite(spawnX, 72, 'ghost-whale').setDepth(32);
    sprite.setDisplaySize(64, 46);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setCircle(48, 12, 8);
    this.whale = { sprite, phase: 0 };
    this.dangerOverlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x5c0018, 0.06).setDepth(34);
    this.tweens.add({ targets: this.dangerOverlay, alpha: 0.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.cameras.main.shake(420, 0.008);
    this.showNotice('TIME OVER · 무적 귀신 고래 출현!', '#ff9aab', 2200);
    document.dispatchEvent(new CustomEvent('bubblebubble-danger'));
  }

  private updateWhale(): void {
    if (!this.whale?.sprite.active) return;
    const target = this.nearestPlayer(this.whale.sprite.x);
    const body = this.whale.sprite.body as Phaser.Physics.Arcade.Body;
    if (!target) {
      body.setVelocity(0, 0);
      return;
    }
    this.whale.phase += 0.045;
    const dx = target.sprite.x - this.whale.sprite.x;
    const dy = target.sprite.y - this.whale.sprite.y + Math.sin(this.whale.phase) * 28;
    const length = Math.max(1, Math.hypot(dx, dy));
    const speed = 105 + this.stageIndex * 7;
    body.setVelocity(dx / length * speed, dy / length * speed);
    this.whale.sprite.setFlipX(dx < 0).setAngle(Math.sin(this.whale.phase * 0.7) * 4);
  }

  private fireBubble(player: PlayerState): void {
    player.cooldown = player.bubbleElement === 'water' ? 0.14 : 0.3;
    const texture = player.bubbleElement === 'lightning' ? 'bubble-lightning' : player.bubbleElement === 'fire' ? 'bubble-fire' : player.bubbleElement === 'water' ? 'bubble-water' : 'bubble';
    const sprite = this.physics.add.sprite(player.sprite.x + player.facing * 18, player.sprite.y - 2, texture).setDepth(15);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const speed = player.bubbleElement === 'lightning' ? 330 : player.bubbleElement === 'fire' ? 230 : 165;
    body.setAllowGravity(false).setVelocity(player.facing * speed, -8).setCircle(11);
    const now = this.time.now;
    this.bubbles.push({ sprite, owner: player.index, bornAt: now, driftAt: now + (player.bubbleElement === 'lightning' ? 900 : player.bubbleElement === 'fire' ? 700 : 430), expiresAt: now + 5200, capturedAt: 0, rainbow: player.rainbowBubbles, element: player.bubbleElement });
    if (player.rainbowBubbles) this.tintRainbow(sprite);
    if (player.shootingStar) this.fireShootingStar(player);
    this.tweens.add({ targets: sprite, scale: 1.12, duration: 440, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private tintRainbow(sprite: Phaser.Physics.Arcade.Sprite): void {
    const hue = (this.time.now % 1600) / 1600;
    const colors = [0, .25, .5, .75].map(offset => Phaser.Display.Color.HSVToRGB((hue + offset) % 1, .65, 1).color);
    sprite.setTint(colors[0], colors[1], colors[2], colors[3]);
  }

  private fireShootingStar(player: PlayerState): void {
    const target = this.enemies.filter(enemy => !enemy.defeated && !enemy.captured)
      .sort((a, b) => Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, a.sprite.x, a.sprite.y)
        - Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, b.sprite.x, b.sprite.y))[0];
    if (!target) return;
    // Reserve immediately so simultaneous shots cannot take the same enemy twice.
    target.defeated = true;
    const { x, y } = target.sprite;
    (target.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.tweens.killTweensOf(target.sprite);
    const star = this.add.sprite(player.sprite.x, player.sprite.y, 'shootingStar-item').setDepth(35);
    this.starEffects.push(star);
    this.score += 100;
    this.spawnPickup(x, y);
    this.maybeSpawnExitLetter(x, y - 12);
    this.tweens.add({ targets: star, x, y, angle: 360, duration: 220, onComplete: () => {
      this.burst(x, y, 0xffe584, 16);
      this.tweens.add({ targets: [star, target.sprite], x: x + 100, y: -40, alpha: 0, duration: 550,
        onComplete: () => { star.destroy(); target.sprite.destroy(); this.starEffects = this.starEffects.filter(effect => effect !== star); } });
    } });
  }

  private updateBubble(bubble: BubbleState): void {
    if (!bubble.sprite.active) return;
    if (bubble.rainbow) this.tintRainbow(bubble.sprite);
    const body = bubble.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.time.now >= bubble.driftAt) {
      const wind = this.airflowAt(bubble.sprite.x, bubble.sprite.y);
      body.setVelocityX(Phaser.Math.Linear(body.velocity.x, wind.x * 44, 0.045));
      body.setVelocityY(-48 + wind.y * 18);
    }
    if (bubble.sprite.x < TILE) body.setVelocityX(Math.abs(body.velocity.x));
    if (bubble.sprite.x > WIDTH - TILE) body.setVelocityX(-Math.abs(body.velocity.x));
    if (bubble.capturedEnemy) {
      bubble.capturedEnemy.sprite.setPosition(bubble.sprite.x, bubble.sprite.y + 1);
      if (this.time.now - bubble.capturedAt > 5000) this.releaseEnemy(bubble);
    }
    if (bubble.sprite.y < 28 && bubble.capturedEnemy) {
      bubble.sprite.y = HEIGHT - 48;
      bubble.capturedEnemy.sprite.setPosition(bubble.sprite.x, bubble.sprite.y + 1);
      this.burst(bubble.sprite.x, bubble.sprite.y, 0xdff7ff, 10);
    } else if (this.time.now >= bubble.expiresAt || bubble.sprite.y < 28) this.destroyBubble(bubble);
  }

  private checkInteractions(): void {
    for (const bubble of this.bubbles) {
      if (!bubble.sprite.active) continue;
      if (!bubble.capturedEnemy && this.boss && this.boss.hp > 0 && this.time.now < bubble.driftAt && this.physics.overlap(bubble.sprite, this.boss.sprite)) {
        this.hitBoss(bubble);
        continue;
      }
      if (!bubble.capturedEnemy) {
        for (const enemy of this.enemies) {
          const directShot = this.time.now < bubble.driftAt;
          if (directShot && !enemy.captured && !enemy.defeated && this.physics.overlap(bubble.sprite, enemy.sprite)) {
            this.captureEnemy(bubble, enemy);
            break;
          }
        }
      }
      for (const player of this.players) {
        if (player.dead || this.time.now - bubble.bornAt < 220 || !this.physics.overlap(player.sprite, bubble.sprite)) continue;
        if (bubble.capturedEnemy) this.popCapturedBubble(bubble, player);
        else {
          const body = player.sprite.body as Phaser.Physics.Arcade.Body;
          if (body.velocity.y > 35 && this.controls[player.index].jump.isDown) {
            body.setVelocityY(-300);
            this.burst(bubble.sprite.x, bubble.sprite.y, 0xdff7ff);
            this.destroyBubble(bubble);
          }
        }
      }
    }
    for (const player of this.players) {
      if (player.dead) continue;
      const contacts = new Set(this.enemies.filter(enemy => !enemy.captured && !enemy.defeated && this.physics.overlap(player.sprite, enemy.sprite)).map(enemy => enemy.sprite));
      if (this.boss?.sprite.active && this.boss.hp > 0 && this.physics.overlap(player.sprite, this.boss.sprite)) contacts.add(this.boss.sprite);
      for (const hazard of this.bossHazards) {
        if (hazard.launched && hazard.sprite.active && this.physics.overlap(player.sprite, hazard.sprite)) contacts.add(hazard.sprite);
      }
      if (this.whale?.sprite.active && this.physics.overlap(player.sprite, this.whale.sprite)) contacts.add(this.whale.sprite);
      const rainbow = rainbowContacts(player.rainbowRemaining, player.rainbowContacts, contacts);
      player.rainbowContacts = rainbow.contacts;
      if (rainbow.protected) {
        if (rainbow.remaining < player.rainbowRemaining) this.burst(player.sprite.x, player.sprite.y, 0xffc4ef, 10);
        player.rainbowRemaining = rainbow.remaining;
        if (rainbow.remaining === 0) {
          player.sprite.clearTint();
          player.rainbowLabel.setText('');
          player.invulnerable = 0.8;
          this.showNotice('무지개 보호 10회를 모두 사용했어요!', '#ffd9f5');
        }
        continue;
      }
      if (player.invulnerable <= 0 && contacts.size > 0) this.hurtPlayer(player);
    }
    for (const pickup of this.pickups) {
      if (pickup.collected || !pickup.sprite.active) continue;
      for (const player of this.players) {
        if (!player.dead && (this.physics.overlap(player.sprite, pickup.sprite) || Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, pickup.sprite.x, pickup.sprite.y) <= 30)) {
          this.collectPickup(pickup, player);
          break;
        }
      }
    }
    for (const item of this.elementItems) {
      if (item.collected || !item.sprite.active) continue;
      for (const player of this.players) {
        if (!player.dead && (this.physics.overlap(player.sprite, item.sprite) || Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, item.sprite.x, item.sprite.y) <= 32)) {
          this.collectElementItem(item, player);
          break;
        }
      }
    }
    for (const item of this.letterItems) {
      if (item.collected || !item.sprite.active) continue;
      for (const player of this.players) {
        if (!player.dead && (this.physics.overlap(player.sprite, item.sprite) || Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, item.sprite.x, item.sprite.y) <= 30)) {
          this.collectLetter(item);
          break;
        }
      }
    }
  }

  private spawnPickup(x: number, y: number): void {
    const kinds: PickupKind[] = ['strawberry', 'banana', 'cookie', 'apple', 'grapes', 'cherries'];
    const kind = kinds[Math.floor(this.score / 100 + this.stageIndex) % kinds.length];
    const values: Record<PickupKind, number> = { strawberry: 250, banana: 350, cookie: 500, apple: 300, grapes: 400, cherries: 450 };
    const spawnX = Phaser.Math.Clamp(x, 42, WIDTH - 42);
    const spawnY = Phaser.Math.Clamp(y, 58, HEIGHT - 74);
    const sprite = this.physics.add.sprite(spawnX, spawnY, kind).setDepth(27).setScale(0.35);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 22).setBounce(0.55).setVelocity(Phaser.Math.Between(-70, 70), -190);
    this.physics.add.collider(sprite, this.platforms);
    const marker = this.add.circle(spawnX, spawnY, 19, 0xfff1a8, 0.13).setStrokeStyle(2, 0xfff1a8, 0.95).setDepth(25);
    const label = this.add.text(spawnX, spawnY - 26, '▼ 간식', { fontFamily: 'Arial Rounded MT Bold, sans-serif', fontSize: '10px', color: '#fff5b8', backgroundColor: '#17152fcc', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(28);
    this.tweens.add({ targets: [sprite, marker], scale: 1.18, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: marker, alpha: 0.35, scale: 1.42, duration: 650, yoyo: true, repeat: -1 });
    this.pickups.push({ sprite, kind, value: values[kind], collected: false, marker, label });
  }

  private collectPickup(pickup: PickupState, player: PlayerState): void {
    pickup.collected = true;
    pickup.sprite.destroy();
    pickup.marker.destroy();
    pickup.label.destroy();
    this.score += pickup.value;
    this.burst(player.sprite.x, player.sprite.y, pickup.kind === 'strawberry' ? 0xff85a7 : pickup.kind === 'banana' ? 0xffe17a : 0xd9a46c, 18);
    const label = { strawberry: '딸기', banana: '바나나', cookie: '쿠키', apple: '사과', grapes: '포도', cherries: '체리' }[pickup.kind];
    this.showNotice(`${label} +${pickup.value}`, '#fff5b8');
  }

  private spawnElementItem(kind: ElementKind, tx: number, ty: number): ElementItemState {
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    const sprite = this.physics.add.sprite(x, y, `${kind}-item`).setDepth(24);
    sprite.setDisplaySize(28, 32);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setCircle(22, 6, 10);
    const names: Record<ElementKind, string> = { water: '물방울', lightning: '번개', fire: '불꽃', shoes: '스피드 신발', shield: '보호 방패', cloud: '비행 구름', rainbow: '무지개', shootingStar: '별똥별' };
    const colors: Record<ElementKind, string> = { water: '#9deaff', lightning: '#ffed86', fire: '#ffc18d', shoes: '#ffe36e', shield: '#9dffcf', cloud: '#e8f8ff', rainbow: '#ffc4ef', shootingStar: '#ffe584' };
    const name = names[kind];
    const label = this.add.text(x, y - 26, `SPECIAL ${name}`, {
      fontFamily: 'Arial Rounded MT Bold, sans-serif', fontSize: '9px', color: colors[kind],
      backgroundColor: '#17152fcc', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: [sprite, label], y: '-=5', duration: 720, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return { sprite, kind, collected: false, label };
  }

  private collectElementItem(item: ElementItemState, player: PlayerState): void {
    item.collected = true;
    item.sprite.destroy();
    item.label.destroy();
    if (item.kind === 'water' || item.kind === 'fire' || item.kind === 'lightning') {
      player.bubbleElement = item.kind as BubbleElementKind;
      player.bubbleElementUntil = Infinity;
    } else if (item.kind === 'shoes') {
      player.speedUntil = Infinity;
    } else if (item.kind === 'shield') {
      player.shieldUntil = Infinity;
    } else if (item.kind === 'shootingStar') {
      player.shootingStar = true;
    } else if (item.kind === 'rainbow') {
      player.rainbowBubbles = true;
      player.rainbowRemaining = 10;
      player.rainbowContacts.clear();
    } else {
      player.flightUntil = Infinity;
    }
    this.score += 750;
    const colors: Record<ElementKind, number> = { water: 0x54d9ff, lightning: 0xffed86, fire: 0xff8a4a, shoes: 0xffdc55, shield: 0x72e7ad, cloud: 0xdff7ff, rainbow: 0xffc4ef, shootingStar: 0xffe584 };
    const effects: Record<ElementKind, string> = {
      water: '목숨을 잃기 전까지 빠른 거품!', lightning: this.currentStage.boss ? '왕에게 번개 공격! (피해 2)' : '목숨을 잃기 전까지 번개 거품!', fire: this.currentStage.boss ? '왕에게 불꽃 공격! (피해 3)' : '목숨을 잃기 전까지 고속 불꽃 거품!',
      shoes: '목숨을 잃기 전까지 이동·점프 속도 UP!', shield: '시간제한 없이 피격 1회 방어!', cloud: '목숨을 잃기 전까지 점프 키로 비행!', rainbow: '무지개 거품! 귀신 충돌 10회 보호!', shootingStar: '발사할 때 별똥별이 적 하나를 데려가요!',
    };
    this.burst(player.sprite.x, player.sprite.y, colors[item.kind], 24);
    this.showNotice(`${effects[item.kind]} +750`, `#${colors[item.kind].toString(16).padStart(6, '0')}`, 1800);
  }

  private maybeSpawnExitLetter(x: number, y: number): void {
    if (this.nextExitLetter >= 4 || Phaser.Math.Between(1, 100) > 22) return;
    this.spawnNextExitLetter(x, y);
  }

  private spawnNextExitLetter(x: number, y: number): void {
    const order: ExitLetter[] = ['E', 'X', 'I', 'T'];
    const letter = order[this.nextExitLetter];
    if (!letter) return;
    this.nextExitLetter += 1;
    const spawnX = Phaser.Math.Clamp(x + Phaser.Math.Between(-18, 18), 42, WIDTH - 42);
    const spawnY = Phaser.Math.Clamp(y, 58, HEIGHT - 74);
    const sprite = this.physics.add.sprite(spawnX, spawnY, `letter-${letter}`).setDepth(29);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(23, 27).setBounce(0.62).setVelocity(Phaser.Math.Between(-55, 55), -220);
    this.physics.add.collider(sprite, this.platforms);
    const marker = this.add.circle(spawnX, spawnY, 19, 0xffffff, 0.1).setStrokeStyle(2, 0xffffff, 0.85).setDepth(27);
    this.tweens.add({ targets: marker, scale: 1.35, alpha: 0.28, duration: 520, yoyo: true, repeat: -1 });
    this.letterItems.push({ sprite, letter, collected: false, marker });
    this.showNotice(`스페셜 알파벳 ${letter} 등장!`, '#fff5b8');
  }

  private collectLetter(item: LetterItemState): void {
    const { x, y } = item.sprite;
    item.collected = true;
    item.sprite.destroy();
    item.marker.destroy();
    this.exitLetters.add(item.letter);
    this.score += 1000;
    this.burst(x, y, 0xfff1a8, 22);
    if (this.exitLetters.size === 4) {
      this.exitBonusTriggered = true;
      this.score += 5000;
      this.cameras.main.flash(320, 255, 245, 184);
      this.completeStage(true);
    } else {
      this.showNotice(`${item.letter} 획득! EXIT +1000`, '#fff5b8');
    }
  }

  private updateCollectibles(): void {
    for (const pickup of this.pickups) {
      if (!pickup.collected && pickup.sprite.active) {
        if (pickup.sprite.y > HEIGHT + 24) {
          pickup.sprite.setPosition(Phaser.Math.Clamp(pickup.sprite.x, 42, WIDTH - 42), 48);
          (pickup.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(70);
        }
        pickup.marker.setPosition(pickup.sprite.x, pickup.sprite.y);
        pickup.label.setPosition(pickup.sprite.x, pickup.sprite.y - 28);
      }
    }
    for (const item of this.letterItems) {
      if (!item.collected && item.sprite.active) {
        if (item.sprite.y > HEIGHT + 24) {
          item.sprite.setPosition(Phaser.Math.Clamp(item.sprite.x, 42, WIDTH - 42), 48);
          (item.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(70);
        }
        item.marker.setPosition(item.sprite.x, item.sprite.y);
      }
    }
  }

  private offerContinue(): void {
    this.awaitingContinue = true;
    this.continueUntil = this.time.now + 10_000;
    this.physics.pause();
    this.showNotice('CONTINUE? 10초 안에 C 키를 누르세요', '#fff5b8', 86_400_000);
  }

  private continueAfterGameOver(): void {
    this.awaitingContinue = false;
    this.clearBossHazards();
    if (this.boss) this.boss.attackIn = 3;
    for (const player of this.players) {
      player.lives = this.currentStage.rules.startingLives;
      player.dead = false;
      player.invulnerable = 3;
      player.sprite.setPosition(player.spawnX, player.spawnY).setVisible(true).setAlpha(1);
      const body = player.sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      body.setVelocity(0, 0);
      this.playerProgress[player.index] = { lives: player.lives };
    }
    this.physics.resume();
    this.notice.setVisible(false);
    this.showNotice('CONTINUE! 생명 3개로 이어서 시작', '#dff7ff');
  }

  private captureEnemy(bubble: BubbleState, enemy: EnemyState): void {
    enemy.captured = true;
    this.tweens.killTweensOf(enemy.sprite);
    (enemy.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    enemy.sprite.setTexture(`${enemy.textureKey}-trapped`).clearTint().setVisible(true).setAlpha(1).setDisplaySize(18, 20).setDepth(16);
    bubble.capturedEnemy = enemy;
    bubble.capturedAt = this.time.now;
    bubble.expiresAt = this.time.now + 5600;
    bubble.sprite.setTexture('bubble-green').setScale(1.2);
    this.showNotice('가둔 거품에 몸으로 톡!', '#dff7ff');
  }

  private releaseEnemy(bubble: BubbleState): void {
    const enemy = bubble.capturedEnemy;
    if (!enemy) return;
    enemy.captured = false;
    enemy.enraged = true;
    enemy.sprite.setTexture(enemy.textureKey).setPosition(bubble.sprite.x, bubble.sprite.y).setVisible(true).setAlpha(0.9).setDisplaySize(30, 34).setDepth(18);
    const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocityY(60);
    bubble.capturedEnemy = undefined;
    this.destroyBubble(bubble);
    this.showNotice('공룡 귀신이 화가 났어요!', '#ff9daf');
  }

  private popCapturedBubble(bubble: BubbleState, player: PlayerState): void {
    const enemy = bubble.capturedEnemy;
    if (!enemy || enemy.defeated) return;
    enemy.defeated = true;
    enemy.captured = false;
    enemy.sprite.destroy();
    bubble.capturedEnemy = undefined;
    this.score += 100;
    this.spawnPickup(bubble.sprite.x, bubble.sprite.y);
    this.maybeSpawnExitLetter(bubble.sprite.x, bubble.sprite.y - 12);
    this.burst(bubble.sprite.x, bubble.sprite.y, enemy.kind === 'ghost_bubblun' ? 0x84e58d : 0x7fc9ff);
    this.cameras.main.shake(90, 0.004);
    this.showNotice(`${player.character === 'nakkong' ? '낙콩' : '무닝'} 성공! +100`, '#fff5b8');
    this.destroyBubble(bubble);
  }

  private hurtPlayer(player: PlayerState): void {
    if (this.time.now < player.shieldUntil) {
      player.shieldUntil = 0;
      player.invulnerable = 0.8;
      this.burst(player.sprite.x, player.sprite.y, 0x9dffcf, 20);
      this.showNotice('보호 방패가 공격을 막았어요!', '#9dffcf');
      return;
    }
    player.lives -= 1;
    player.bubbleElement = undefined;
    player.bubbleElementUntil = player.speedUntil = player.shieldUntil = player.flightUntil = 0;
    player.rainbowBubbles = player.shootingStar = false;
    player.rainbowRemaining = 0;
    player.rainbowContacts.clear();
    player.rainbowLabel.setText('');
    player.sprite.clearTint();
    (player.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    player.invulnerable = 3;
    this.burst(player.sprite.x, player.sprite.y, 0xfff1a8);
    this.cameras.main.shake(130, 0.007);
    if (player.lives <= 0) {
      player.dead = true;
      player.sprite.setVisible(false);
      (player.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    } else {
      player.sprite.setPosition(player.spawnX, player.spawnY);
      (player.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
    this.playerProgress[player.index] = { lives: player.lives };
  }

  private completeStage(exitBonus = false): void {
    if (!this.playing || (this.currentStage.boss && (!this.boss || this.boss.hp > 0))) return;
    document.dispatchEvent(new CustomEvent('bubblebubble-calm'));
    if (this.stageIndex < stages.length - 1) {
      this.playing = false;
      this.physics.pause();
      this.players.forEach((player) => {
        this.playerProgress[player.index] = {
          lives: Math.max(1, player.lives), bubbleElement: player.bubbleElement,
          bubbleElementUntil: player.bubbleElementUntil, speedUntil: player.speedUntil,
          shieldUntil: player.shieldUntil, flightUntil: player.flightUntil,
          rainbowBubbles: player.rainbowBubbles, rainbowRemaining: player.rainbowRemaining,
          shootingStar: player.shootingStar,
        };
      });
      this.cameras.main.flash(260, 255, 245, 184);
      this.showNotice(exitBonus ? 'EXIT 완성! 보너스 +5000 · STAGE CLEAR!' : `STAGE ${this.stageIndex + 1} CLEAR!`, '#fff5b8', 700);
      this.time.delayedCall(1200, () => this.loadStage(this.stageIndex + 1));
      return;
    }
    if (exitBonus) this.showNotice('EXIT 완성! 보너스 +5000', '#fff5b8', 900);
    this.finish(true);
  }

  private finish(cleared: boolean): void {
    this.playing = false;
    this.physics.pause();
    document.dispatchEvent(new CustomEvent('bubblebubble-calm'));
    if (cleared) {
      this.cameras.main.flash(350, 255, 245, 184);
      this.burst(WIDTH / 2, HEIGHT / 2, 0xfff1a8, 30);
    }
    document.dispatchEvent(new CustomEvent('bubblebubble-result', { detail: { cleared, score: this.score } }));
  }

  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.showNotice('PAUSE', '#fff5b8', 86_400_000);
    } else {
      this.physics.resume();
      this.notice.setVisible(false);
    }
  }

  private cleanup(): void {
    this.bubbles = this.bubbles.filter((bubble) => bubble.sprite.active);
  }

  private clearSession(): void {
    for (const sprite of this.starEffects) {
      this.tweens.killTweensOf(sprite);
      sprite.destroy();
    }
    this.starEffects = [];
    this.clearBossHazards();
    if (this.boss) { if (this.boss.sprite.active) this.boss.sprite.destroy(); this.boss.hud.destroy(true); this.boss = undefined; }
    this.players.forEach((player) => { if (player.sprite.active) player.sprite.destroy(); player.rainbowLabel.destroy(); });
    this.enemies.forEach((enemy) => { if (enemy.sprite.active) enemy.sprite.destroy(); });
    this.bubbles.forEach((bubble) => { if (bubble.sprite.active) bubble.sprite.destroy(); });
    this.pickups.forEach((pickup) => { if (pickup.sprite.active) pickup.sprite.destroy(); });
    this.pickups.forEach((pickup) => { if (pickup.marker.active) pickup.marker.destroy(); if (pickup.label.active) pickup.label.destroy(); });
    this.elementItems.forEach((item) => { if (item.sprite.active) item.sprite.destroy(); if (item.label.active) item.label.destroy(); });
    this.letterItems.forEach((item) => { if (item.sprite.active) item.sprite.destroy(); if (item.marker.active) item.marker.destroy(); });
    if (this.whale?.sprite.active) this.whale.sprite.destroy();
    if (this.dangerOverlay?.active) this.dangerOverlay.destroy();
    this.players = [];
    this.enemies = [];
    this.bubbles = [];
    this.pickups = [];
    this.elementItems = [];
    this.letterItems = [];
    this.whale = undefined;
    this.dangerOverlay = undefined;
  }

  private destroyBubble(bubble: BubbleState): void {
    if (bubble.sprite.active) bubble.sprite.destroy();
  }

  private nearestPlayer(x: number): PlayerState | undefined {
    return this.players.filter((player) => !player.dead).sort((a, b) => Math.abs(a.sprite.x - x) - Math.abs(b.sprite.x - x))[0];
  }

  private airflowAt(x: number, y: number): { x: number; y: number } {
    for (const zone of this.currentStage.airflow) {
      const rect = zone.tileRect;
      if (x >= rect.x * TILE && x < (rect.x + rect.width) * TILE && y >= rect.y * TILE && y < (rect.y + rect.height) * TILE) return zone.direction;
    }
    return { x: 0, y: -1 };
  }

  private isSolidAtWorld(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return ty < 0 || ty >= this.currentStage.layout.length || tx < 0 || tx >= this.currentStage.layout[0].length || this.currentStage.layout[ty][tx] === '#';
  }

  private buildPlatforms(): void {
    if (this.platforms) this.platforms.clear(true, true);
    else this.platforms = this.physics.add.staticGroup();
    this.currentStage.layout.forEach((row, ty) => [...row].forEach((tile, tx) => {
      if (tile === '#') this.platforms.create(tx * TILE + TILE / 2, ty * TILE + TILE / 2, `platform-s${this.stageIndex + 1}`);
    }));
  }

  private createHud(): void {
    this.add.rectangle(WIDTH / 2, 17, WIDTH, 34, 0x0c0a1d, 0.94).setDepth(40);
    const style: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Arial Rounded MT Bold, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#fff' };
    this.hudScore = this.add.text(14, 10, 'SCORE 0000', { ...style, color: '#fff1a8' }).setDepth(41);
    this.hudTime = this.add.text(WIDTH / 2, 10, 'TIME 70', { ...style, fontSize: '12px' }).setOrigin(0.5, 0).setDepth(41);
    this.hudLives = this.add.text(WIDTH - 14, 10, '', { ...style, color: '#dff7ff' }).setOrigin(1, 0).setDepth(41);
    this.notice = this.add.text(WIDTH / 2, 89, '', { ...style, fontSize: '16px', backgroundColor: '#100d24dd', padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(45).setVisible(false);
  }

  private refreshHud(): void {
    this.hudScore.setText(`SCORE ${String(this.score).padStart(4, '0')}`);
    const letters = (['E', 'X', 'I', 'T'] as ExitLetter[]).map((letter) => this.exitLetters.has(letter) ? letter : '_').join(' ');
    const timeText = this.awaitingContinue ? `CONTINUE ${Math.max(0, Math.ceil((this.continueUntil - this.time.now) / 1000))}` : this.dangerActive ? 'WHALE!' : `TIME ${Math.ceil(this.timeLeft)}`;
    this.hudTime.setText(this.currentStage.boss ? `ROUND 01 · ${this.timeLeft <= 0 ? '분노!' : timeText}` : `STAGE ${this.stageIndex + 1} · ${timeText} · EXIT [${letters}]`).setColor(this.timeLeft <= 30 || this.awaitingContinue ? '#ff8fa5' : '#ffffff');
    this.hudLives.setText(this.players.map((player) => `${player.index + 1}P ♥${player.lives}`).join('   '));
  }

  private showNotice(message: string, color: string, duration = 1400): void {
    this.notice.setText(message).setColor(color).setVisible(true).setAlpha(1).setScale(0.94);
    this.tweens.killTweensOf(this.notice);
    this.tweens.add({ targets: this.notice, scale: 1, duration: 160, ease: 'Back.out', onComplete: () => {
      if (duration < 86_400_000) this.tweens.add({ targets: this.notice, alpha: 0, delay: duration, duration: 280, onComplete: () => this.notice.setVisible(false) });
    } });
  }

  private burst(x: number, y: number, color: number, count = 14): void {
    const manager = this.add.particles(x, y, 'spark', {
      speed: { min: 65, max: 170 },
      lifespan: { min: 350, max: 650 },
      quantity: count,
      scale: { start: 1.2, end: 0 },
      tint: color,
      emitting: false,
    }).setDepth(35);
    manager.explode(count);
    this.time.delayedCall(800, () => manager.destroy());
  }

  private drawBackdrop(): void {
    this.backdrop?.destroy(true);
    const backdrop = this.add.container(0, 0).setDepth(-10);
    const graphics = this.add.graphics();
    backdrop.add(graphics);
    graphics.fillStyle(0x05050d).fillRect(0, 0, WIDTH, HEIGHT);
    const color = Phaser.Display.Color.HexStringToColor(this.currentStage.theme.palette[2]).color;
    // Sparse pixels leave the playfield legible, with a different motif per round.
    for (let i = 0; i < 44; i++) {
      const x = 40 + (i * 83 + this.stageIndex * 17) % 430;
      const y = 83 + (i * 61) % 310;
      graphics.fillStyle(color, .14).fillRect(x, y, 2, 2);
      if (i % 7 === 0) graphics.fillRect(x - 2, y + 2, 6, 2);
    }
    if (this.currentStage.boss) {
      graphics.lineStyle(2, 0x81366f, .2);
      graphics.strokeRect(178, 114, 156, 262);
      graphics.strokeRect(190, 126, 132, 250);
      graphics.fillStyle(0x632076, .14).fillRect(194, 130, 124, 246);
      for (let x = 202; x < 320; x += 24) graphics.fillStyle(0xffdc59, .12).fillRect(x, 114, 10, 10);
    } else {
      // Diamond constellations echo each stage's palette without hiding shots.
      for (let i = 0; i < 5; i++) {
        const x = 76 + i * 86, y = 125 + ((i + this.stageIndex) % 3) * 78;
        graphics.lineStyle(2, color, .14).strokeRect(x, y, 14 + this.stageIndex, 14 + this.stageIndex);
      }
    }
    this.backdrop = backdrop;
  }

  private createTextures(): void {
    const art = (key: string, width: number, height: number, highRes = false, accent?: string, secondary?: string) => {
      const draw = (c: CanvasRenderingContext2D) => drawArcadeArt(c, key, width, height, accent, secondary);
      if (highRes) this.createHighResTexture(key, width, height, draw);
      else this.createCanvasTexture(key, width, height, draw);
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    stages.forEach((stage, index) => {
      art(`platform-s${index + 1}`, 32, 32, false, stage.theme.palette[2], stage.theme.palette[4]);

    });
    for (let i = 0; i < 8; i++) {
      art(`ghost_enemy-v${i}`, 30, 34, true);
      art(`ghost_enemy-v${i}-trapped`, 30, 34, true);
    }
    this.createHighResTexture('nakkong', 38, 40, (c) => drawCharacter(c, 'nakkong'));
    this.createHighResTexture('muning', 38, 40, (c) => drawCharacter(c, 'muning'));
    ['bubble', 'bubble-green', 'bubble-blue', 'bubble-water', 'bubble-fire', 'bubble-lightning'].forEach(key => art(key, 28, 28));
    ['strawberry', 'banana', 'cookie', 'apple', 'grapes', 'cherries'].forEach(key => art(key, 28, 28));
    ['water', 'fire', 'lightning', 'shoes', 'shield', 'rainbow', 'cloud', 'shootingStar'].forEach(kind => art(`${kind}-item`, 28, 32, true));
    ['E', 'X', 'I', 'T'].forEach((letter, index) => art(`letter-${letter}`, 30, 34, false, ['#ff6897', '#53d6ff', '#ffe36a', '#7aef67'][index]));
    art('ghost-whale', 64, 46, true);
    art('boss-king', 96, 96, true);
    art('boss-lightning', 24, 336);
    art('boss-fire', 28, 28);
    art('spark', 6, 6);
  }

  private createCanvasTexture(key: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    draw(texture.getContext());
    texture.refresh();
  }

  private createHighResTexture(key: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): void {
    this.createCanvasTexture(key, width * 2, height * 2, c => { c.scale(2, 2); draw(c); });
  }
}
