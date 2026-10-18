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
import type { BubbleState, BubbleElementKind, Character, ElementItemState, ElementKind, EnemyState, ExitLetter, GhostKind, LetterItemState, PickupKind, PickupState, PlayerState, StageData, WhaleState } from './types';

const stages = [stage01, stage02, stage03, stage04, stage05, stage06, stage07, stage08, stage09, stage10] as StageData[];
const TILE = 32;
const WIDTH = 512;
const HEIGHT = 448;

type ControlSet = {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  fire: Phaser.Input.Keyboard.Key;
  fireAlt?: Phaser.Input.Keyboard.Key;
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
  private playerProgress: Array<{ lives: number }> = [];
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
    this.enemies = this.currentStage.enemies.map((enemy) => this.spawnEnemy(enemy.kind, enemy.behavior, enemy.tile.x, enemy.tile.y));
    this.elementItems = this.currentStage.items.map((item) => this.spawnElementItem(item.kind, item.tile.x, item.tile.y));
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
    this.showNotice(`STAGE ${index + 1} · ${this.currentStage.title}`, '#fff5b8', 1700);
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
    this.updateWhale();
    this.bubbles.forEach((bubble) => this.updateBubble(bubble));
    this.updateCollectibles();
    this.checkInteractions();
    this.cleanup();
    this.refreshHud();
    if (!this.exitBonusTriggered && this.enemies.every((enemy) => enemy.defeated) && this.pickups.every((pickup) => pickup.collected)) this.completeStage();
    else if (this.players.every((player) => player.dead)) this.offerContinue();
    if (this.playing && this.timeLeft <= 0 && !this.dangerActive) this.startDangerMode();
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('키보드 입력을 사용할 수 없습니다.');
    const p1 = keyboard.addKeys({ left: 'A', right: 'D', jump: 'W', fire: 'F' }) as ControlSet;
    const p2 = keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', jump: 'UP', fire: 'FORWARD_SLASH', fireAlt: 'ENTER' }) as ControlSet;
    this.controls = [p1, p2];
    this.esc = keyboard.addKey('ESC');
    this.continueKey = keyboard.addKey('C');
  }

  private spawnPlayer(character: Character, index: number, tx: number, ty: number): PlayerState {
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    const sprite = this.physics.add.sprite(x, y, character).setDepth(20).setCollideWorldBounds(false);
    sprite.setDisplaySize(28, character === 'my_melody' ? 36 : 34);
    sprite.setBodySize(40, 56).setBounce(0);
    sprite.setMaxVelocity(190, 440);
    const progress = this.playerProgress[index] ?? { lives: this.currentStage.rules.startingLives };
    return { sprite, character, index, lives: progress.lives, facing: index === 0 ? 1 : -1, spawnX: x, spawnY: y, cooldown: 0, invulnerable: 0, dead: false, bubbleElementUntil: 0, speedUntil: 0, shieldUntil: 0, flightUntil: 0 };
  }

  private spawnEnemy(kind: GhostKind, behavior: 'patrol' | 'chase', tx: number, ty: number): EnemyState {
    const sprite = this.physics.add.sprite(tx * TILE + TILE / 2, ty * TILE + TILE / 2, `${kind}-s${this.stageIndex + 1}`).setDepth(18);
    sprite.setDisplaySize(30, 34);
    sprite.setBodySize(48, 48).setBounce(0);
    return { sprite, kind, behavior, captured: false, defeated: false, enraged: false, direction: kind === 'ghost_bubblun' ? 1 : -1 };
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
    if (flying) player.sprite.setTint(0xe8f8ff);
    else if (shielded) player.sprite.setTint(0x9dffcf);
    else if (speedBoosted) player.sprite.setTint(0xffe36e);
    else if (player.bubbleElement === 'water') player.sprite.setTint(0x8deaff);
    else if (player.bubbleElement === 'fire') player.sprite.setTint(0xffa068);
    else player.sprite.clearTint();
    player.sprite.setAlpha(player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0 ? 0.3 : 1);
    const firePressed = Phaser.Input.Keyboard.JustDown(input.fire) || Boolean(input.fireAlt && Phaser.Input.Keyboard.JustDown(input.fireAlt));
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
    const target = this.nearestPlayer(enemy.sprite.x);
    if (enemy.behavior === 'chase') {
      if (target && Math.abs(target.sprite.x - enemy.sprite.x) < 220) enemy.direction = target.sprite.x < enemy.sprite.x ? -1 : 1;
    }
    if (body.blocked.left) enemy.direction = 1;
    if (body.blocked.right) enemy.direction = -1;
    const lookX = enemy.sprite.x + enemy.direction * 19;
    const footY = enemy.sprite.y + 18;
    const noFloorAhead = body.blocked.down && !this.isSolidAtWorld(lookX, footY);
    const targetBelow = Boolean(target && target.sprite.y > enemy.sprite.y + 26);
    if (noFloorAhead && !targetBelow) enemy.direction = enemy.direction === 1 ? -1 : 1;
    if (body.blocked.down && target && target.sprite.y < enemy.sprite.y - 52 && Phaser.Math.Between(0, 100) < 2) body.setVelocityY(-290);
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
    const texture = player.bubbleElement === 'fire' ? 'bubble-fire' : player.bubbleElement === 'water' ? 'bubble-water' : 'bubble';
    const sprite = this.physics.add.sprite(player.sprite.x + player.facing * 18, player.sprite.y - 2, texture).setDepth(15);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const speed = player.bubbleElement === 'fire' ? 230 : 165;
    body.setAllowGravity(false).setVelocity(player.facing * speed, -8).setCircle(11);
    const now = this.time.now;
    this.bubbles.push({ sprite, owner: player.index, bornAt: now, driftAt: now + 430, expiresAt: now + 5200, capturedAt: 0, element: player.bubbleElement });
    this.tweens.add({ targets: sprite, scale: 1.12, duration: 440, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private updateBubble(bubble: BubbleState): void {
    if (!bubble.sprite.active) return;
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
      if (player.dead || player.invulnerable > 0) continue;
      for (const enemy of this.enemies) {
        if (!enemy.captured && !enemy.defeated && this.physics.overlap(player.sprite, enemy.sprite)) {
          this.hurtPlayer(player);
          break;
        }
      }
      if (player.invulnerable <= 0 && this.whale?.sprite.active && this.physics.overlap(player.sprite, this.whale.sprite)) this.hurtPlayer(player);
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
    const kinds: PickupKind[] = ['strawberry', 'banana', 'cookie'];
    const kind = kinds[Math.floor(this.score / 100 + this.stageIndex) % kinds.length];
    const values: Record<PickupKind, number> = { strawberry: 250, banana: 350, cookie: 500 };
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
    const label = pickup.kind === 'strawberry' ? '딸기' : pickup.kind === 'banana' ? '바나나' : '쿠키';
    this.showNotice(`${label} +${pickup.value}`, '#fff5b8');
  }

  private spawnElementItem(kind: ElementKind, tx: number, ty: number): ElementItemState {
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    const sprite = this.physics.add.sprite(x, y, `${kind}-item`).setDepth(24);
    sprite.setDisplaySize(28, 32);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setCircle(22, 6, 10);
    const names: Record<ElementKind, string> = { water: '물방울', fire: '불꽃', shoes: '스피드 신발', shield: '보호 방패', cloud: '비행 구름' };
    const colors: Record<ElementKind, string> = { water: '#9deaff', fire: '#ffc18d', shoes: '#ffe36e', shield: '#9dffcf', cloud: '#e8f8ff' };
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
    if (item.kind === 'water' || item.kind === 'fire') {
      player.bubbleElement = item.kind as BubbleElementKind;
      player.bubbleElementUntil = this.time.now + 12_000;
    } else if (item.kind === 'shoes') {
      player.speedUntil = this.time.now + 12_000;
    } else if (item.kind === 'shield') {
      player.shieldUntil = this.time.now + 15_000;
    } else {
      player.flightUntil = this.time.now + 10_000;
    }
    this.score += 750;
    const colors: Record<ElementKind, number> = { water: 0x54d9ff, fire: 0xff8a4a, shoes: 0xffdc55, shield: 0x72e7ad, cloud: 0xdff7ff };
    const effects: Record<ElementKind, string> = {
      water: '12초 동안 빠른 거품!', fire: '12초 동안 고속 불꽃 거품!',
      shoes: '12초 동안 이동·점프 속도 UP!', shield: '15초 안의 피격 1회 방어!', cloud: '10초 동안 점프 키로 비행!',
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
    enemy.sprite.setVisible(true).setAlpha(0.72).setDisplaySize(18, 20).setDepth(16);
    bubble.capturedEnemy = enemy;
    bubble.capturedAt = this.time.now;
    bubble.expiresAt = this.time.now + 5600;
    bubble.sprite.setTexture(enemy.kind === 'ghost_bubblun' ? 'bubble-green' : 'bubble-blue').setScale(1.2);
    this.showNotice('가둔 거품에 몸으로 톡!', '#dff7ff');
  }

  private releaseEnemy(bubble: BubbleState): void {
    const enemy = bubble.capturedEnemy;
    if (!enemy) return;
    enemy.captured = false;
    enemy.enraged = true;
    enemy.sprite.setPosition(bubble.sprite.x, bubble.sprite.y).setVisible(true).setAlpha(0.9).setDisplaySize(30, 34).setDepth(18);
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
    this.showNotice(`${player.character === 'pochacco' ? '포차코' : '마이멜로디'} 성공! +100`, '#fff5b8');
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
    if (!this.playing) return;
    document.dispatchEvent(new CustomEvent('bubblebubble-calm'));
    if (this.stageIndex < stages.length - 1) {
      this.playing = false;
      this.physics.pause();
      this.players.forEach((player) => {
        this.playerProgress[player.index] = { lives: Math.max(1, player.lives) };
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
    this.players.forEach((player) => { if (player.sprite.active) player.sprite.destroy(); });
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
    this.notice = this.add.text(WIDTH / 2, 55, '', { ...style, fontSize: '16px', backgroundColor: '#100d24dd', padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(45).setVisible(false);
  }

  private refreshHud(): void {
    this.hudScore.setText(`SCORE ${String(this.score).padStart(4, '0')}`);
    const letters = (['E', 'X', 'I', 'T'] as ExitLetter[]).map((letter) => this.exitLetters.has(letter) ? letter : '_').join(' ');
    const timeText = this.awaitingContinue ? `CONTINUE ${Math.max(0, Math.ceil((this.continueUntil - this.time.now) / 1000))}` : this.dangerActive ? 'WHALE!' : `TIME ${Math.ceil(this.timeLeft)}`;
    this.hudTime.setText(`STAGE ${this.stageIndex + 1} · ${timeText} · EXIT [${letters}]`).setColor(this.timeLeft <= 30 || this.awaitingContinue ? '#ff8fa5' : '#ffffff');
    this.hudLives.setText(this.players.map((player) => `${player.index === 0 ? 'P' : 'M'} ♥${player.lives}`).join('   '));
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
    if (this.backdrop) {
      this.backdrop.each((child: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(child));
      this.backdrop.destroy(true);
    }
    const palette = this.currentStage.theme.palette;
    const colors = palette.map((color) => Phaser.Display.Color.HexStringToColor(color).color);
    const backdrop = this.add.container(0, 0).setDepth(-10);
    const background = this.add.graphics();
    backdrop.add(background);
    background.fillGradientStyle(colors[0], colors[0], colors[1], colors[1], 1);
    background.fillRect(0, 0, WIDTH, HEIGHT);
    const theme = this.currentStage.theme.background;
    if (theme === 'moonlight_playground') {
      background.fillStyle(colors[4], 0.96).fillCircle(425, 77, 34);
      background.fillStyle(colors[0], 1).fillCircle(438, 66, 33);
    } else if (theme === 'starlight_stairs') {
      background.lineStyle(3, colors[4], 0.6);
      for (let i = 0; i < 5; i += 1) background.lineBetween(65 + i * 95, 55 + (i % 2) * 35, 105 + i * 90, 42 + (i % 3) * 20);
    } else if (theme === 'ghost_tower') {
      background.fillStyle(colors[0], 0.65).fillRect(188, 62, 136, 350);
      for (let y = 92; y < 360; y += 62) for (let x = 210; x < 310; x += 48) background.fillStyle(colors[4], 0.18).fillRect(x, y, 19, 30);
    } else if (theme === 'candy_cavern') {
      for (let i = 0; i < 10; i += 1) {
        const x = 38 + (i * 53) % 460; const y = 58 + (i * 71) % 300;
        background.fillStyle(i % 2 ? colors[2] : colors[3], 0.22).fillCircle(x, y, 13 + (i % 3) * 4);
        background.lineStyle(2, colors[4], 0.25).lineBetween(x - 9, y + 9, x + 9, y - 9);
      }
    } else if (theme === 'rainbow_sky') {
      background.lineStyle(8, colors[2], 0.2).beginPath().arc(WIDTH / 2, 250, 130, Math.PI, Math.PI * 2).strokePath();
      background.lineStyle(8, colors[3], 0.22).beginPath().arc(WIDTH / 2, 250, 108, Math.PI, Math.PI * 2).strokePath();
      for (let x = 20; x < WIDTH; x += 70) background.fillStyle(0xffffff, 0.15).fillCircle(x, 390 - (x % 3) * 8, 34);
    } else if (theme === 'deep_sea_temple') {
      for (let y = 70; y < 390; y += 62) for (let x = 45; x < WIDTH; x += 88) background.fillStyle(colors[3], 0.12).fillCircle(x, y, 8 + (y % 3));
      background.lineStyle(5, colors[2], 0.18).strokeRect(182, 75, 148, 315);
      background.fillStyle(colors[4], 0.12).fillTriangle(210, 92, 302, 92, 256, 52);
    } else if (theme === 'toy_factory') {
      for (let x = 45; x < WIDTH; x += 82) for (let y = 70; y < 390; y += 95) {
        background.lineStyle(3, colors[3], 0.18).strokeCircle(x, y, 18);
        background.fillStyle(colors[2], 0.14).fillCircle(x, y, 7);
      }
    } else if (theme === 'ice_palace') {
      for (let x = 25; x < WIDTH; x += 54) background.fillStyle(colors[4], 0.13).fillTriangle(x, 35, x + 24, 35, x + 12, 105 + (x % 4) * 13);
      background.lineStyle(2, colors[3], 0.2); for (let y = 135; y < 400; y += 56) background.lineBetween(30, y, WIDTH - 30, y - 25);
    } else if (theme === 'volcano_core') {
      background.fillStyle(colors[3], 0.13); for (let x = 20; x < WIDTH; x += 64) background.fillTriangle(x, 410, x + 32, 280 - (x % 5) * 12, x + 64, 410);
      background.lineStyle(4, colors[4], 0.2); for (let x = 55; x < WIDTH; x += 95) background.lineBetween(x, 390, x + 12, 250);
    } else {
      for (let i = 0; i < 16; i += 1) background.fillStyle(colors[4], 0.3).fillCircle(22 + (i * 73) % 480, 48 + (i * 97) % 330, i % 4 === 0 ? 3 : 1);
      background.lineStyle(3, colors[3], 0.18).strokeCircle(WIDTH / 2, 220, 118);
      background.lineStyle(2, colors[2], 0.2).strokeCircle(WIDTH / 2, 220, 78);
    }
    const stars = [[50,66],[104,91],[173,55],[247,82],[321,51],[381,105],[469,133],[74,151],[284,128]];
    stars.forEach(([x, y], i) => {
      const star = this.add.circle(x, y, i % 3 === 0 ? 2 : 1, colors[4], 0.72);
      backdrop.add(star);
      this.tweens.add({ targets: star, alpha: 0.2, duration: 700 + i * 83, yoyo: true, repeat: -1 });
    });
    background.fillStyle(colors[1], 0.6);
    for (let x = -20; x < WIDTH + 30; x += 45) background.fillCircle(x, HEIGHT + 5, 55);
    const wind = this.add.graphics();
    backdrop.add(wind);
    wind.lineStyle(2, colors[4], 0.13);
    this.currentStage.airflow.forEach((zone) => {
      const cx = (zone.tileRect.x + zone.tileRect.width / 2) * TILE;
      const top = zone.tileRect.y * TILE;
      for (let y = top; y < (zone.tileRect.y + zone.tileRect.height) * TILE; y += 28) wind.strokeCircle(cx + Math.sin(y) * 11, y, 6);
    });
    this.backdrop = backdrop;
  }

  private createTextures(): void {
    stages.forEach((stage, index) => this.createCanvasTexture(`platform-s${index + 1}`, 32, 32, (c) => {
      const [dark, middle, bright] = stage.theme.palette;
      const gradient = c.createLinearGradient(0, 0, 0, 32); gradient.addColorStop(0, bright); gradient.addColorStop(.2, middle); gradient.addColorStop(1, dark);
      c.fillStyle = gradient; c.fillRect(0, 0, 32, 32); c.fillStyle = stage.theme.palette[4]; c.globalAlpha = .72; c.fillRect(0, 0, 32, 4); c.globalAlpha = 1;
      c.fillStyle = dark; c.fillRect(5, 15, 22, 4); c.fillStyle = bright; c.fillRect(3, 7, 4, 4); c.fillRect(23, 23, 5, 4);
    }));
    this.createHighResTexture('pochacco', 28, 34, (c) => this.drawPochacco(c));
    this.createHighResTexture('my_melody', 28, 36, (c) => this.drawMelody(c));
    const ghostColors = [
      ['#76dc82', '#70c5f4'], ['#f1a35f', '#bd8af2'], ['#f06186', '#68d8d0'], ['#ffb05f', '#f47eb6'], ['#75e0b8', '#82baff'],
      ['#37c9bd', '#4fa7d8'], ['#f08a61', '#d7a840'], ['#9fdfff', '#b7b2ff'], ['#ff6d42', '#d33f67'], ['#9c7cff', '#eb76e8'],
    ];
    ghostColors.forEach(([green, blue], index) => {
      this.createHighResTexture(`ghost_bubblun-s${index + 1}`, 30, 34, (c) => this.drawGhostTexture(c, green, index, 'bubblun'));
      this.createHighResTexture(`ghost_bobblun-s${index + 1}`, 30, 34, (c) => this.drawGhostTexture(c, blue, index, 'bobblun'));
    });
    this.createBubbleTexture('bubble', '#dff7ff');
    this.createBubbleTexture('bubble-green', '#8de99a');
    this.createBubbleTexture('bubble-blue', '#87d4ff');
    this.createBubbleTexture('bubble-water', '#54d9ff');
    this.createBubbleTexture('bubble-fire', '#ff8a4a');
    this.createCanvasTexture('strawberry', 28, 28, (c) => this.drawStrawberry(c));
    this.createCanvasTexture('banana', 28, 28, (c) => this.drawBanana(c));
    this.createCanvasTexture('cookie', 28, 28, (c) => this.drawCookie(c));
    this.createHighResTexture('water-item', 28, 32, (c) => this.drawElementItem(c, 'water'));
    this.createHighResTexture('fire-item', 28, 32, (c) => this.drawElementItem(c, 'fire'));
    this.createHighResTexture('shoes-item', 28, 32, (c) => this.drawElementItem(c, 'shoes'));
    this.createHighResTexture('shield-item', 28, 32, (c) => this.drawElementItem(c, 'shield'));
    this.createHighResTexture('cloud-item', 28, 32, (c) => this.drawElementItem(c, 'cloud'));
    (['E', 'X', 'I', 'T'] as ExitLetter[]).forEach((letter) => this.createLetterTexture(letter));
    this.createHighResTexture('ghost-whale', 64, 46, (c) => this.drawGhostWhale(c));
    this.createCanvasTexture('spark', 6, 6, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(3,0); c.lineTo(4,2); c.lineTo(6,3); c.lineTo(4,4); c.lineTo(3,6); c.lineTo(2,4); c.lineTo(0,3); c.lineTo(2,2); c.closePath(); c.fill(); });
  }

  private createCanvasTexture(key: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    const context = texture.getContext();
    context.imageSmoothingEnabled = true;
    draw(context);
    texture.refresh();
  }

  private createHighResTexture(key: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, width * 2, height * 2);
    if (!texture) return;
    const context = texture.getContext();
    context.imageSmoothingEnabled = true;
    context.scale(2, 2);
    draw(context);
    texture.refresh();
  }

  private createBubbleTexture(key: string, color: string): void {
    this.createCanvasTexture(key, 28, 28, (c) => {
      const gradient = c.createRadialGradient(9, 8, 2, 14, 14, 13); gradient.addColorStop(0, '#ffffffcc'); gradient.addColorStop(.18, `${color}66`); gradient.addColorStop(.72, `${color}22`); gradient.addColorStop(1, color);
      c.fillStyle = gradient; c.beginPath(); c.arc(14, 14, 12, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#ffffffcc'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(9, 8, 3, 0, Math.PI * 2); c.fill();
    });
  }

  private drawPochacco(c: CanvasRenderingContext2D): void {
    c.strokeStyle = '#38303f'; c.lineWidth = 2; c.lineJoin = 'round'; c.fillStyle = '#292432'; c.beginPath(); c.ellipse(5, 11, 5, 11, -.35, 0, Math.PI * 2); c.ellipse(23, 11, 5, 11, .35, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f7f5ed'; c.beginPath(); c.ellipse(14, 14, 11, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#f7f5ed'; c.beginPath(); c.roundRect(7, 22, 14, 11, 6); c.fill(); c.stroke();
    c.fillStyle = '#292432'; c.beginPath(); c.arc(10, 14, 1.4, 0, Math.PI * 2); c.arc(18, 14, 1.4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(14, 18, 1.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e9697c'; c.beginPath(); c.roundRect(8, 24, 12, 5, 2); c.fill();
  }

  private drawMelody(c: CanvasRenderingContext2D): void {
    c.strokeStyle = '#5b354a'; c.lineWidth = 2; c.fillStyle = '#f3a2c3'; c.beginPath(); c.roundRect(3, 0, 7, 17, 6); c.roundRect(18, 0, 7, 17, 6); c.fill(); c.stroke(); c.beginPath(); c.arc(14, 17, 13, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#fff8f2'; c.beginPath(); c.ellipse(14, 18, 9, 10, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#35263f'; c.beginPath(); c.arc(11, 17, 1.25, 0, Math.PI*2); c.arc(18, 17, 1.25, 0, Math.PI*2); c.arc(14.5, 21, 1.2, 0, Math.PI*2); c.fill();
    c.fillStyle = '#fff1a8'; c.beginPath(); c.arc(21, 8, 3.5, 0, Math.PI*2); c.fill(); c.fillStyle = '#f3a2c3'; c.beginPath(); c.roundRect(6, 27, 16, 8, 5); c.fill(); c.stroke();
  }

  private drawGhostTexture(c: CanvasRenderingContext2D, color: string, variant: number, family: 'bubblun' | 'bobblun'): void {
    if (variant === 1) {
      c.fillStyle = '#fff1a8'; c.beginPath(); c.moveTo(5, 9); c.lineTo(8, 1); c.lineTo(12, 9); c.moveTo(18, 9); c.lineTo(22, 1); c.lineTo(25, 9); c.fill();
    } else if (variant === 2) {
      c.fillStyle = '#ffe36f'; c.beginPath(); c.moveTo(7, 7); c.lineTo(9, 0); c.lineTo(14, 5); c.lineTo(20, 0); c.lineTo(23, 8); c.fill();
    } else if (variant === 3) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(8, 5, 4, 0, Math.PI * 2); c.arc(15, 3, 5, 0, Math.PI * 2); c.arc(22, 6, 4, 0, Math.PI * 2); c.fill();
    } else if (variant === 4) {
      c.strokeStyle = '#fff3a8'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, 8); c.quadraticCurveTo(15, -1, 26, 8); c.stroke();
    } else if (variant === 5) {
      c.fillStyle = '#8ff5ee'; c.beginPath(); c.moveTo(4, 12); c.lineTo(0, 5); c.lineTo(10, 9); c.moveTo(22, 9); c.lineTo(30, 4); c.lineTo(27, 14); c.fill();
    } else if (variant === 6) {
      c.fillStyle = '#ffe16a'; c.strokeStyle = '#6b4424'; c.lineWidth = 1.5; c.beginPath(); c.arc(15, 5, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (variant === 7) {
      c.fillStyle = '#e9fbff'; c.beginPath(); c.moveTo(5, 10); c.lineTo(8, 0); c.lineTo(12, 9); c.lineTo(16, 1); c.lineTo(20, 9); c.lineTo(24, 0); c.lineTo(27, 11); c.fill();
    } else if (variant === 8) {
      c.fillStyle = '#ffcf58'; c.beginPath(); c.moveTo(5, 11); c.lineTo(4, 0); c.lineTo(12, 9); c.lineTo(17, 0); c.lineTo(25, 11); c.fill();
    } else if (variant === 9) {
      c.strokeStyle = '#e8d8ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(15, 8); c.lineTo(15, 1); c.stroke(); c.fillStyle = '#ff77e8'; c.beginPath(); c.arc(15, 2, 3, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = .9; c.strokeStyle = '#243144'; c.lineWidth = 2; c.fillStyle = color; c.beginPath(); c.arc(15, 13, 12, Math.PI, 0); c.lineTo(27, 24); c.quadraticCurveTo(24, 29, 20, 24); c.quadraticCurveTo(15, 31, 11, 24); c.quadraticCurveTo(6, 29, 3, 24); c.lineTo(3, 13); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(11, 13, 3, 0, Math.PI*2); c.arc(20, 13, 3, 0, Math.PI*2); c.fill(); c.fillStyle = '#253042'; c.beginPath(); c.arc(12, 14, 1.2, 0, Math.PI*2); c.arc(21, 14, 1.2, 0, Math.PI*2); c.fill(); c.globalAlpha = 1;
    if (family === 'bobblun') {
      c.fillStyle = color; c.strokeStyle = '#243144'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(4, 15); c.lineTo(0, 8); c.lineTo(1, 21); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(26, 15); c.lineTo(30, 8); c.lineTo(29, 21); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(11, 19); c.lineTo(14, 24); c.lineTo(16, 19); c.fill();
    } else {
      c.strokeStyle = '#243144'; c.lineWidth = 2; c.beginPath(); c.arc(15, 20, 5, 0.15, Math.PI - 0.15); c.stroke();
      c.fillStyle = '#243144'; c.beginPath(); c.arc(12, 19, 1.1, 0, Math.PI * 2); c.arc(18, 19, 1.1, 0, Math.PI * 2); c.fill();
    }
    if (variant === 1) { c.fillStyle = '#fff'; c.fillRect(7, 20, 3, 3); c.fillRect(21, 18, 3, 3); }
    if (variant === 2) { c.strokeStyle = '#5b2542'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 20); c.quadraticCurveTo(15, 24, 21, 19); c.stroke(); }
    if (variant === 3) { c.fillStyle = '#fff1a8'; c.beginPath(); c.arc(15, 21, 4, 0, Math.PI * 2); c.fill(); }
    if (variant === 4) { c.fillStyle = '#dff7ff'; c.fillRect(6, 22, 4, 3); c.fillRect(20, 22, 4, 3); }
    if (variant === 5) { c.strokeStyle = '#d5fff8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(6, 18); c.lineTo(1, 22); c.moveTo(24, 18); c.lineTo(29, 22); c.stroke(); }
    if (variant === 6) { c.fillStyle = '#2d2638'; c.fillRect(6, 11, 18, 5); c.fillStyle = '#ff525d'; c.fillRect(9, 12, 4, 2); c.fillRect(18, 12, 4, 2); }
    if (variant === 7) { c.fillStyle = '#fff'; c.beginPath(); c.arc(8, 22, 2, 0, Math.PI * 2); c.arc(23, 20, 2, 0, Math.PI * 2); c.fill(); }
    if (variant === 8) { c.fillStyle = '#3d1720'; c.beginPath(); c.moveTo(10, 20); c.lineTo(14, 25); c.lineTo(18, 20); c.fill(); }
    if (variant === 9) { c.strokeStyle = '#f7e4ff'; c.lineWidth = 1.5; c.strokeRect(7, 10, 7, 6); c.strokeRect(17, 10, 7, 6); c.beginPath(); c.moveTo(14, 13); c.lineTo(17, 13); c.stroke(); }
  }

  private drawGhostWhale(c: CanvasRenderingContext2D): void {
    c.globalAlpha = 0.96;
    c.strokeStyle = '#121525'; c.lineWidth = 2.5; c.fillStyle = '#ebe9da';
    c.beginPath(); c.ellipse(49, 18, 13, 14, -0.08, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(45, 17); c.quadraticCurveTo(28, 13, 4, 20); c.lineTo(2, 25); c.quadraticCurveTo(25, 22, 47, 25); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(5, 29); c.quadraticCurveTo(27, 35, 53, 28); c.quadraticCurveTo(31, 42, 7, 35); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1b2038'; c.beginPath(); c.ellipse(51, 15, 5, 6, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(42, 13, 3, 4, 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff456c'; c.beginPath(); c.arc(52, 15, 1.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; for (let x = 12; x <= 43; x += 6) { c.beginPath(); c.moveTo(x, 28); c.lineTo(x + 3, 33); c.lineTo(x + 5, 27); c.fill(); }
    c.strokeStyle = '#d6d2bf'; c.lineWidth = 2; for (let x = 8; x < 36; x += 7) { c.beginPath(); c.moveTo(x, 18); c.lineTo(x + 2, 24); c.stroke(); }
    c.strokeStyle = '#ff456c'; c.beginPath(); c.moveTo(58, 8); c.quadraticCurveTo(61, 3, 63, 8); c.stroke();
    c.globalAlpha = 1;
  }

  private drawStrawberry(c: CanvasRenderingContext2D): void {
    c.strokeStyle = '#7d2945'; c.lineWidth = 2; c.fillStyle = '#f05274'; c.beginPath(); c.moveTo(4,8); c.quadraticCurveTo(14,3,24,8); c.quadraticCurveTo(22,22,14,27); c.quadraticCurveTo(6,22,4,8); c.fill(); c.stroke();
    c.fillStyle = '#76c66b'; c.beginPath(); c.moveTo(7,8); c.lineTo(10,2); c.lineTo(14,7); c.lineTo(19,2); c.lineTo(21,9); c.fill();
    c.fillStyle = '#ffe9a8'; [[10,12],[18,13],[13,18],[9,21],[18,21]].forEach(([x,y]) => c.fillRect(x,y,2,2));
  }

  private drawBanana(c: CanvasRenderingContext2D): void {
    c.strokeStyle = '#9b6d24'; c.lineWidth = 2.5; c.fillStyle = '#ffe16a'; c.beginPath(); c.moveTo(6,4); c.quadraticCurveTo(7,21,23,20); c.quadraticCurveTo(12,27,4,14); c.quadraticCurveTo(2,8,6,4); c.fill(); c.stroke(); c.fillStyle = '#6b4b20'; c.fillRect(4,2,4,3); c.fillRect(21,18,4,3);
  }

  private drawCookie(c: CanvasRenderingContext2D): void {
    c.strokeStyle = '#795038'; c.lineWidth = 2; c.fillStyle = '#dca56f'; c.beginPath(); c.arc(14,14,11,0,Math.PI*2); c.fill(); c.stroke(); c.fillStyle = '#70442f'; [[9,9],[18,8],[14,15],[8,19],[20,19]].forEach(([x,y]) => { c.beginPath(); c.arc(x,y,2,0,Math.PI*2); c.fill(); });
  }

  private drawElementItem(c: CanvasRenderingContext2D, kind: ElementKind): void {
    c.strokeStyle = '#fff'; c.lineWidth = 2;
    if (kind === 'water') {
      const gradient = c.createLinearGradient(5, 3, 23, 29); gradient.addColorStop(0, '#c7f6ff'); gradient.addColorStop(1, '#2ab7ed');
      c.fillStyle = gradient; c.beginPath(); c.moveTo(14, 2); c.bezierCurveTo(20, 11, 25, 17, 23, 23); c.bezierCurveTo(21, 31, 7, 31, 5, 23); c.bezierCurveTo(3, 17, 9, 10, 14, 2); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.globalAlpha = .7; c.beginPath(); c.arc(10, 20, 3, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    } else if (kind === 'fire') {
      const gradient = c.createLinearGradient(5, 2, 23, 30); gradient.addColorStop(0, '#fff08b'); gradient.addColorStop(.5, '#ff8a43'); gradient.addColorStop(1, '#e83d4c');
      c.fillStyle = gradient; c.beginPath(); c.moveTo(15, 1); c.bezierCurveTo(22, 10, 25, 17, 22, 25); c.bezierCurveTo(18, 33, 5, 29, 6, 20); c.bezierCurveTo(7, 14, 13, 12, 15, 1); c.fill(); c.stroke();
      c.fillStyle = '#fff3a8'; c.beginPath(); c.moveTo(15, 14); c.quadraticCurveTo(20, 22, 14, 28); c.quadraticCurveTo(9, 23, 15, 14); c.fill();
    } else if (kind === 'shoes') {
      c.fillStyle = '#ffe36e'; c.beginPath(); c.roundRect(2, 15, 22, 12, 5); c.fill(); c.stroke();
      c.fillStyle = '#ff7b82'; c.fillRect(7, 8, 12, 12); c.strokeRect(7, 8, 12, 12);
      c.fillStyle = '#fff'; c.fillRect(4, 24, 23, 5); c.strokeRect(4, 24, 23, 5);
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(10, 13); c.lineTo(18, 13); c.moveTo(10, 17); c.lineTo(18, 17); c.stroke();
    } else if (kind === 'shield') {
      c.fillStyle = '#79e0ae'; c.beginPath(); c.moveTo(14, 2); c.lineTo(25, 7); c.lineTo(23, 22); c.quadraticCurveTo(14, 31, 5, 22); c.lineTo(3, 7); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#eafff4'; c.beginPath(); c.moveTo(14, 7); c.lineTo(17, 13); c.lineTo(23, 14); c.lineTo(18, 18); c.lineTo(20, 25); c.lineTo(14, 21); c.lineTo(8, 25); c.lineTo(10, 18); c.lineTo(5, 14); c.lineTo(11, 13); c.closePath(); c.fill();
    } else {
      const gradient = c.createLinearGradient(0, 7, 0, 29); gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#a9ddf4');
      c.fillStyle = gradient; c.beginPath(); c.arc(8, 20, 6, 0, Math.PI * 2); c.arc(14, 13, 8, 0, Math.PI * 2); c.arc(21, 20, 6, 0, Math.PI * 2); c.roundRect(5, 18, 19, 10, 5); c.fill(); c.stroke();
      c.strokeStyle = '#5abfe8'; c.lineWidth = 2; c.beginPath(); c.moveTo(8, 29); c.lineTo(6, 32); c.moveTo(15, 29); c.lineTo(13, 32); c.moveTo(22, 29); c.lineTo(20, 32); c.stroke();
    }
  }

  private createLetterTexture(letter: ExitLetter): void {
    this.createCanvasTexture(`letter-${letter}`, 30, 34, (c) => {
      const colors: Record<ExitLetter, string> = { E: '#ff799c', X: '#77d8ff', I: '#ffe26e', T: '#8be793' };
      c.fillStyle = '#211a3e'; c.beginPath(); c.roundRect(1, 1, 28, 32, 7); c.fill();
      c.strokeStyle = colors[letter]; c.lineWidth = 3; c.stroke();
      c.fillStyle = colors[letter]; c.font = '900 23px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(letter, 15, 18);
    });
  }
}
