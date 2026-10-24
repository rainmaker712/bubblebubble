import type Phaser from 'phaser';

export type Character = 'nakkong' | 'muning';
export type GhostKind = 'ghost_bubblun' | 'ghost_bobblun';
export type BubbleElementKind = 'water' | 'fire' | 'lightning';
export type ElementKind = BubbleElementKind | 'shoes' | 'shield' | 'cloud' | 'rainbow' | 'shootingStar';
export type ExitLetter = 'E' | 'X' | 'I' | 'T';

export interface StageData {
  id: string;
  title: string;
  theme: { background: string; music: string; palette: string[] };
  layout: string[];
  playerSpawns: Array<{ player: number; character: Character; tile: { x: number; y: number } }>;
  boss?: { name: string; hp: number; tile: { x: number; y: number } };
  enemies: Array<{ id: string; kind: GhostKind; behavior: 'patrol' | 'chase'; tile: { x: number; y: number } }>;
  items: Array<{ id: string; kind: ElementKind; tile: { x: number; y: number } }>;
  airflow: Array<{ tileRect: { x: number; y: number; width: number; height: number }; direction: { x: number; y: number } }>;
  rules: { startingLives: number; timeLimitSeconds: number; enrageAtSecondsRemaining: number };
}

export interface PlayerState {
  sprite: Phaser.Physics.Arcade.Sprite;
  character: Character;
  index: number;
  lives: number;
  facing: -1 | 1;
  spawnX: number;
  spawnY: number;
  cooldown: number;
  invulnerable: number;
  dead: boolean;
  bubbleElement?: BubbleElementKind;
  bubbleElementUntil: number;
  speedUntil: number;
  shieldUntil: number;
  flightUntil: number;
  rainbowBubbles: boolean;
  shootingStar: boolean;
  rainbowRemaining: number;
  rainbowContacts: Set<Phaser.Physics.Arcade.Sprite>;
  rainbowLabel: Phaser.GameObjects.Text;
}

export interface EnemyState {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: GhostKind;
  textureKey: string;
  behavior: 'patrol' | 'chase';
  captured: boolean;
  defeated: boolean;
  enraged: boolean;
  direction: -1 | 1;
  nextDecisionAt: number;
  nextJumpAt: number;
}

export interface BubbleState {
  sprite: Phaser.Physics.Arcade.Sprite;
  owner: number;
  bornAt: number;
  driftAt: number;
  expiresAt: number;
  capturedAt: number;
  element?: BubbleElementKind;
  rainbow: boolean;
  capturedEnemy?: EnemyState;
}

export type PickupKind = 'strawberry' | 'banana' | 'cookie' | 'apple' | 'grapes' | 'cherries';

export interface PickupState {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: PickupKind;
  value: number;
  collected: boolean;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

export interface ElementItemState {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: ElementKind;
  collected: boolean;
  label: Phaser.GameObjects.Text;
}

export interface LetterItemState {
  sprite: Phaser.Physics.Arcade.Sprite;
  letter: ExitLetter;
  collected: boolean;
  marker: Phaser.GameObjects.Arc;
}

export interface WhaleState {
  sprite: Phaser.Physics.Arcade.Sprite;
  phase: number;
}

export interface BossState {
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  elapsed: number;
  attackIn: number;
  attackIndex: number;
  hurtFor: number;
  hud: Phaser.GameObjects.Container;
  healthFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export interface BossHazard {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: 'fire' | 'lightning';
  warning: Phaser.GameObjects.Rectangle;
  warningLabel: Phaser.GameObjects.Text;
  delay: number;
  life: number;
  vx: number;
  vy: number;
  launched: boolean;
}

export type PlayerProgress = Pick<PlayerState, 'lives' | 'bubbleElement' | 'bubbleElementUntil' | 'speedUntil' | 'shieldUntil' | 'flightUntil' | 'rainbowBubbles' | 'rainbowRemaining' | 'shootingStar'>;
