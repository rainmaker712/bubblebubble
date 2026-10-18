import type Phaser from 'phaser';

export type Character = 'pochacco' | 'my_melody';
export type GhostKind = 'ghost_bubblun' | 'ghost_bobblun';
export type BubbleElementKind = 'water' | 'fire';
export type ElementKind = BubbleElementKind | 'shoes' | 'shield' | 'cloud';
export type ExitLetter = 'E' | 'X' | 'I' | 'T';

export interface StageData {
  id: string;
  title: string;
  theme: { background: string; music: string; palette: string[] };
  layout: string[];
  playerSpawns: Array<{ player: number; character: Character; tile: { x: number; y: number } }>;
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
}

export interface EnemyState {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: GhostKind;
  behavior: 'patrol' | 'chase';
  captured: boolean;
  defeated: boolean;
  enraged: boolean;
  direction: -1 | 1;
}

export interface BubbleState {
  sprite: Phaser.Physics.Arcade.Sprite;
  owner: number;
  bornAt: number;
  driftAt: number;
  expiresAt: number;
  capturedAt: number;
  element?: BubbleElementKind;
  capturedEnemy?: EnemyState;
}

export type PickupKind = 'strawberry' | 'banana' | 'cookie';

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
