export enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
  STOP,
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface Player {
  position: Coordinates;
  direction: Direction;
  nextDirection: Direction;
  isMouthOpen: boolean;
}

export interface Ghost {
  id: number;
  position: Coordinates;
  initialPosition: Coordinates;
  direction: Direction;
  color: string;
  isFrightened: boolean;
}

export interface Projectile {
  id: number;
  position: Coordinates;
  direction: Direction;
}

export type GameStatus = 'PLAYING' | 'WON' | 'LOST' | 'PAUSED';