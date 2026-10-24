import { drawCharacter } from './game/characters';
import Phaser from 'phaser';
import './style.css';
import { GameScene } from './game/GameScene';
import { MoonlightMusic } from './game/MoonlightMusic';

const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const title = document.querySelector<HTMLHeadingElement>('#overlay-title')!;
const copy = document.querySelector<HTMLParagraphElement>('#overlay-copy')!;
const label = document.querySelector<HTMLParagraphElement>('#result-label')!;
const onePlayer = document.querySelector<HTMLButtonElement>('#one-player')!;
const twoPlayer = document.querySelector<HTMLButtonElement>('#two-player')!;
const musicButton = document.querySelector<HTMLButtonElement>('#music-toggle')!;

const music = new MoonlightMusic(musicButton);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 512,
  height: 448,
  backgroundColor: '#17152f',
  transparent: false,
  antialias: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 840 }, fixedStep: true, fps: 60 } },
  scene: [GameScene],
});

let scene: GameScene;

document.addEventListener('bubblebubble-ready', () => {
  scene = game.scene.getScene('GameScene') as GameScene;
  onePlayer.disabled = false;
  twoPlayer.disabled = false;
});

document.addEventListener('bubblebubble-danger', () => music.setDangerMode(true));
document.addEventListener('bubblebubble-calm', () => music.setDangerMode(false));

async function begin(count: 1 | 2): Promise<void> {
  if (!scene) return;
  overlay.hidden = true;
  scene.startSession(count);
  await music.start();
  document.querySelector<HTMLElement>('#game-root')?.focus();
}

onePlayer.addEventListener('click', () => void begin(1));
twoPlayer.addEventListener('click', () => void begin(2));
musicButton.addEventListener('click', () => void music.toggle());

document.addEventListener('bubblebubble-result', (event) => {
  const { cleared, score } = (event as CustomEvent<{ cleared: boolean; score: number }>).detail;
  overlay.hidden = false;
  label.textContent = cleared ? 'STAGE CLEAR!' : 'TRY AGAIN';
  title.textContent = cleared ? '모든 스테이지 클리어!' : '다시 도전해 볼까요?';
  copy.textContent = cleared ? `점수 ${score}점 · 다시 한 번 놀아볼까요?` : '첫 스테이지는 보스전! 불·번개 아이템을 먹고 공격 키를 누르고 있어 보세요.';
  onePlayer.textContent = '낙콩로 다시 하기';
  twoPlayer.textContent = '둘이서 다시 하기';
});

for (const character of ['nakkong', 'muning'] as const) {
  const canvas = document.querySelector<HTMLCanvasElement>(`[data-character="${character}"]`);
  const context = canvas?.getContext('2d');
  if (context) { context.scale(2, 2); drawCharacter(context, character); }
}
