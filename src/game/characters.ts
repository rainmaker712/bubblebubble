import type { Character } from './types';

/** Native canvas artwork traced from the silhouettes and details in imgs/. */
export function drawCharacter(c: CanvasRenderingContext2D, character: Character): void {
  c.save();
  c.scale(38 / 100, 40 / 106);
  c.lineWidth = 2.8;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = '#65566d';
  const shape = (path: string, color: string) => { const p = new Path2D(path); c.fillStyle = color; c.fill(p); c.stroke(p); };
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string, stroke = true) => {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill(); if (stroke) c.stroke();
  };
  const line = (path: string) => c.stroke(new Path2D(path));
  const heart = (x: number, y: number, scale: number, color: string) => {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    shape('M 0 5 C -14 -4 -10 -15 0 -8 C 10 -15 14 -4 0 5 Z', color); c.restore();
  };
  // Cloud-shaped angel wings appear on both original drawings.
  shape('M 24 53 C 9 36 1 46 7 52 C -4 52 1 65 21 65 Z', '#eaf6ff');
  shape('M 76 53 C 91 36 99 46 93 52 C 104 52 99 65 79 65 Z', '#eaf6ff');
  c.strokeStyle = '#d0a453';
  ellipse(50, 12, 12, 5, '#fff1b6');
  ellipse(50, 12, 7, 2, '#fffdf6', false);
  c.strokeStyle = '#65566d';
  if (character === 'nakkong') {
    ellipse(36, 35, 10, 22, '#fff9ed');
    ellipse(65, 35, 10, 22, '#fff9ed');
    ellipse(36, 36, 4, 15, '#f2bfd2', false);
    ellipse(65, 36, 4, 15, '#f2bfd2', false);
    ellipse(34, 96, 9, 5, '#fff9ed');
    ellipse(65, 96, 8, 6, '#fff9ed');
    ellipse(22, 73, 8, 5, '#fff9ed');
    ellipse(78, 73, 8, 5, '#fff9ed');
    shape('M 21 60 C 22 36 44 40 50 46 C 63 37 81 42 80 64 C 80 82 63 97 50 97 C 35 97 20 78 21 60 Z', '#fff9ed');
    heart(50, 42, .9, '#eaa6c7');
    heart(50, 41, .4, '#fff4d8');
    ellipse(37, 63, 6, 8, '#68566f'); ellipse(64, 63, 6, 8, '#68566f');
    ellipse(35, 60, 2, 3, '#fff', false); ellipse(62, 60, 2, 3, '#fff', false);
    ellipse(31, 74, 5, 2.5, '#f6c8d2', false); ellipse(71, 74, 5, 2.5, '#f6c8d2', false);
    heart(50, 77, .45, '#c28e97');
    line('M 50 78 Q 49 86 44 83 M 50 78 Q 53 85 58 81');
    // Slanted flower wand from the right side of the sketch.
    c.strokeStyle = '#9973a2'; c.lineWidth = 3;
    line('M 79 89 L 93 64');
    heart(90, 61, .6, '#e9bbe6'); heart(96, 64, .45, '#f2cbe5');
    ellipse(92, 64, 2, 2, '#ffe5a0', false);
  } else {
    ellipse(22, 76, 10, 5, '#f5efff'); ellipse(79, 72, 10, 5, '#f5efff');
    shape('M 25 41 L 29 22 Q 32 18 37 25 L 46 35 L 63 34 L 75 20 Q 79 18 80 25 L 83 44 L 83 75 Q 82 91 72 101 Q 68 104 64 93 L 58 84 L 45 84 Q 41 97 33 102 Q 28 104 26 93 L 21 75 L 22 49 Z', '#f5efff');
    shape('M 29 34 L 32 26 L 39 34 Z', '#e8b9d6');
    shape('M 69 33 L 76 25 L 78 35 Z', '#e8b9d6');
    ellipse(39, 51, 6, 8, '#68566f'); ellipse(37, 48, 2, 3, '#fff', false);
    line('M 68 46 L 62 52 L 68 57 M 63 49 L 61 44 M 65 48 L 66 43');
    ellipse(33, 67, 9, 6, '#f2c2da'); ellipse(70, 67, 9, 6, '#f2c2da');
    c.lineWidth = 1.5; line('M 28 65 L 27 68 M 33 65 L 32 68 M 68 65 L 67 68 M 73 65 L 72 68'); c.lineWidth = 2.8;
    heart(51, 65, .5, '#bd8d9e');
    line('M 51 66 Q 50 74 44 72 M 51 66 Q 54 74 59 71');
    // Four heart petals sit above the right ear.
    heart(80, 20, .7, '#efb5d5');
    c.save(); c.translate(82, 22); c.rotate(Math.PI / 2); heart(0, 0, .65, '#efb5d5'); c.restore();
    ellipse(81, 23, 3, 3, '#ffe8a3');
  }
  c.restore();
}
