/** Count contact entries, so staying inside a ghost costs only one charge. */
export function rainbowContacts<T>(remaining: number, previous: Set<T>, contacts: Set<T>): { remaining: number; contacts: Set<T>; protected: boolean } {
  const entered = [...contacts].filter(contact => !previous.has(contact)).length;
  return { remaining: Math.max(0, remaining - entered), contacts, protected: remaining > 0 };
}

interface EnemySituation {
  direction: -1 | 1;
  chase: boolean;
  grounded: boolean;
  wallLeft: boolean;
  wallRight: boolean;
  floorAhead: boolean;
  targetDx?: number;
  targetDy?: number;
  targetVx: number;
  targetRainbow: boolean;
  threatDx?: number;
  canJump: boolean;
}

export function decideEnemy(s: EnemySituation): { direction: -1 | 1; jump: boolean } {
  let direction = s.direction;
  const nearby = s.targetDx !== undefined && Math.abs(s.targetDx) < 240;
  if (nearby && (s.chase || s.targetRainbow)) {
    const predicted = s.targetDx! + s.targetVx * 0.22;
    if (Math.abs(predicted) > 12) direction = predicted < 0 ? -1 : 1;
    if (s.targetRainbow) direction = direction === 1 ? -1 : 1;
  }
  // Floor probe belongs to the current direction. Recheck on the next decision after turning.
  if (s.grounded && !s.floorAhead && direction === s.direction && !(s.chase && !s.targetRainbow && (s.targetDy ?? 0) > 40)) direction = direction === 1 ? -1 : 1;
  if (s.wallLeft) direction = 1;
  if (s.wallRight) direction = -1;
  const dodge = s.threatDx !== undefined && Math.abs(s.threatDx) < 100;
  const climb = nearby && s.chase && !s.targetRainbow && (s.targetDy ?? 0) < -45 && Math.abs(s.targetDx!) <= 100;
  return { direction, jump: s.grounded && s.canJump && (dodge || climb) };
}

export function bossDamage(element?: 'water' | 'fire' | 'lightning'): number {
  return element === 'fire' ? 3 : element === 'lightning' ? 2 : 1;
}

export function bossPhase(hp: number, maxHp: number): 1 | 2 {
  return hp <= maxHp / 2 ? 2 : 1;
}

export function canClearStage(hasBoss: boolean, bossHp: number, enemiesDefeated: boolean, pickupsCollected: boolean): boolean {
  return hasBoss ? bossHp <= 0 : enemiesDefeated && pickupsCollected;
}
