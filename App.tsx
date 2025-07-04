import React, { useState, useEffect, useCallback } from 'react';
import { GameBoard } from './components/GameBoard';
import { GameOverScreen } from './components/GameOverScreen';
import { Pacman } from './components/Pacman';
import { Ghost } from './components/Ghost';
import { Controls } from './components/Controls';
import { Projectile } from './components/Boomerang'; // The component is now Projectile, but file isn't renamed
import { TILE_SIZE, LEVELS, INITIAL_GHOSTS, GAME_SPEED_MS, POWER_UP_DURATION_MS, GHOST_EAT_SCORE, PROJECTILE_HIT_SCORE } from './constants';
import { Player, Ghost as GhostType, Coordinates, Direction, GameStatus, Projectile as ProjectileType } from './types';

const App: React.FC = () => {
  const [level, setLevel] = useState(1);
  const [player, setPlayer] = useState<Player | null>(null);
  const [ghosts, setGhosts] = useState<GhostType[]>([]);
  const [pellets, setPellets] = useState<Coordinates[]>([]);
  const [powerPellets, setPowerPellets] = useState<Coordinates[]>([]);
  const [score, setScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('PAUSED');
  const [totalPellets, setTotalPellets] = useState(0);
  const [powerUp, setPowerUp] = useState({ active: false, timer: 0 });
  const [projectiles, setProjectiles] = useState<ProjectileType[]>([]);

  const LAYOUT = LEVELS[level - 1];
  const GRID_WIDTH = LAYOUT[0].length;
  const GRID_HEIGHT = LAYOUT.length;

  const isWall = useCallback((pos: Coordinates) => {
    if (pos.x < 0 || pos.x >= GRID_WIDTH || pos.y < 0 || pos.y >= GRID_HEIGHT) {
      return true;
    }
    return LAYOUT[pos.y][pos.x] === 1;
  }, [LAYOUT, GRID_WIDTH, GRID_HEIGHT]);

  const initializeGame = useCallback(() => {
    const currentLayout = LEVELS[level - 1];
    let initialPlayer: Player | null = null;
    const initialGhosts: GhostType[] = [];
    const initialPellets: Coordinates[] = [];
    const initialPowerPellets: Coordinates[] = [];
    let ghostIndex = 0;

    currentLayout.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile === 2) initialPellets.push({ x, y });
        else if (tile === 5) initialPowerPellets.push({ x, y });
        else if (tile === 3) {
          initialPlayer = {
            position: { x, y },
            direction: Direction.STOP,
            nextDirection: Direction.STOP,
            isMouthOpen: true,
          };
        } else if (tile === 4 && ghostIndex < INITIAL_GHOSTS.length) {
          const ghostPosition = { x, y };
          initialGhosts.push({
            ...INITIAL_GHOSTS[ghostIndex],
            position: ghostPosition,
            initialPosition: ghostPosition,
            direction: Direction.UP,
            isFrightened: false,
          });
          ghostIndex++;
        }
      });
    });

    setPlayer(initialPlayer);
    setGhosts(initialGhosts);
    setPellets(initialPellets);
    setPowerPellets(initialPowerPellets);
    setTotalPellets(initialPellets.length + initialPowerPellets.length);
    if(level === 1) setScore(0);
    setGameStatus('PLAYING');
    setPowerUp({ active: false, timer: 0 });
    setProjectiles([]);
  }, [level]);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);
  
  const handleButtonA = useCallback(() => {
    if (gameStatus !== 'PLAYING' || !player || projectiles.length >= 3) return; // Limit projectiles

    const fireDirection = player.direction !== Direction.STOP ? player.direction : player.nextDirection;
    if (fireDirection === Direction.STOP) return;

    const newProjectile: ProjectileType = {
        id: Date.now() + Math.random(),
        position: player.position,
        direction: fireDirection,
    };
    setProjectiles(prev => [...prev, newProjectile]);
  }, [player, projectiles, gameStatus]);

  const handleDirectionChange = useCallback((direction: Direction) => {
    if (!player || gameStatus !== 'PLAYING') return;
    setPlayer(p => p ? { ...p, nextDirection: direction } : null);
  }, [player, gameStatus]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    if (!player) return;
    let newNextDirection: Direction | null = null;
    switch (e.key) {
      case 'ArrowUp': newNextDirection = Direction.UP; break;
      case 'ArrowDown': newNextDirection = Direction.DOWN; break;
      case 'ArrowLeft': newNextDirection = Direction.LEFT; break;
      case 'ArrowRight': newNextDirection = Direction.RIGHT; break;
      case ' ': handleButtonA(); break;
    }
    if (newNextDirection !== null) {
        handleDirectionChange(newNextDirection);
    }
  }, [player, handleDirectionChange, handleButtonA]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  const getNextPosition = (pos: Coordinates, dir: Direction): Coordinates => {
      let nextPos = {...pos};
      switch(dir) {
          case Direction.UP: nextPos.y--; break;
          case Direction.DOWN: nextPos.y++; break;
          case Direction.LEFT: nextPos.x--; break;
          case Direction.RIGHT: nextPos.x++; break;
      }
      // Tunnel logic
      if (nextPos.x < 0) nextPos.x = GRID_WIDTH - 1;
      if (nextPos.x >= GRID_WIDTH) nextPos.x = 0;
      return nextPos;
  }

  const gameLoop = useCallback(() => {
    if (gameStatus !== 'PLAYING' || !player) return;
    
    // 1. Calculate player's next state
    let playerDirection = player.direction;
    let nextPosForNextDir = getNextPosition(player.position, player.nextDirection);
    if (!isWall(nextPosForNextDir)) {
      playerDirection = player.nextDirection;
    }
    let nextPlayerPos = getNextPosition(player.position, playerDirection);
    if (isWall(nextPlayerPos)) {
      nextPlayerPos = player.position;
      playerDirection = Direction.STOP;
    }

    // 2. Calculate ghosts' next states
    let areGhostsFrightened = powerUp.active;
    let newGhosts = ghosts.map(ghost => {
      const validDirections: Direction[] = [];
      const directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
      const oppositeDirection = { [Direction.UP]: Direction.DOWN, [Direction.DOWN]: Direction.UP, [Direction.LEFT]: Direction.RIGHT, [Direction.RIGHT]: Direction.LEFT, [Direction.STOP]: Direction.STOP};
      
      directions.forEach(dir => { if (!isWall(getNextPosition(ghost.position, dir))) validDirections.push(dir); });
      
      let nextDir = ghost.direction;
      if (validDirections.length > 1 && validDirections.includes(oppositeDirection[ghost.direction])) {
         const index = validDirections.indexOf(oppositeDirection[ghost.direction]);
         if (index > -1) validDirections.splice(index, 1);
      }
      if (!validDirections.includes(nextDir) || (validDirections.length > 1 && Math.random() < 0.25)) {
          nextDir = validDirections[Math.floor(Math.random() * validDirections.length)];
      }
      const newPos = getNextPosition(ghost.position, nextDir);
      return { ...ghost, position: newPos, direction: nextDir, isFrightened: areGhostsFrightened };
    });

    let scoreUpdate = 0;
    
    // 3. Projectile Logic
    const updatedProjectiles = projectiles.map(p => ({
        ...p,
        position: getNextPosition(p.position, p.direction),
    }));

    const projectilesToRemove = new Set<number>();
    updatedProjectiles.forEach(proj => {
        if (projectilesToRemove.has(proj.id)) return;

        if (isWall(proj.position)) {
            projectilesToRemove.add(proj.id);
            return;
        }

        for (let i = 0; i < newGhosts.length; i++) {
            const ghost = newGhosts[i];
            if (proj.position.x === ghost.position.x && proj.position.y === ghost.position.y) {
                scoreUpdate += PROJECTILE_HIT_SCORE;
                newGhosts[i] = { ...ghost, position: ghost.initialPosition, isFrightened: false };
                projectilesToRemove.add(proj.id);
                break; 
            }
        }
    });
    const finalProjectiles = updatedProjectiles.filter(p => !projectilesToRemove.has(p.id));

    // 4. Collision Detection & Game Logic
    let gameIsLost = false;
    
    newGhosts.forEach(g => {
      if (g.position.x === nextPlayerPos.x && g.position.y === nextPlayerPos.y) {
        if (g.isFrightened) {
          scoreUpdate += GHOST_EAT_SCORE;
          newGhosts = newGhosts.map(ghostToUpdate => 
              ghostToUpdate.id === g.id 
                  ? { ...ghostToUpdate, position: ghostToUpdate.initialPosition, isFrightened: false } 
                  : ghostToUpdate
          );
        } else {
          gameIsLost = true;
        }
      }
    });

    if (gameIsLost) {
      setGameStatus('LOST');
      return;
    }

    // 5. Pellet & Power Pellet Logic
    let newPellets = [...pellets];
    const pelletIndex = newPellets.findIndex(p => p.x === nextPlayerPos.x && p.y === nextPlayerPos.y);
    if (pelletIndex !== -1) {
        newPellets.splice(pelletIndex, 1);
        scoreUpdate += 10;
    }

    let newPowerPellets = [...powerPellets];
    let newPowerUp = { ...powerUp };
    const powerPelletIndex = newPowerPellets.findIndex(p => p.x === nextPlayerPos.x && p.y === nextPlayerPos.y);
    if (powerPelletIndex !== -1) {
      newPowerPellets.splice(powerPelletIndex, 1);
      scoreUpdate += 50;
      newPowerUp = { active: true, timer: Math.floor(POWER_UP_DURATION_MS / GAME_SPEED_MS) };
      newGhosts = newGhosts.map(g => ({ ...g, isFrightened: true }));
    } else if (newPowerUp.active) {
      const newTimer = newPowerUp.timer - 1;
      if (newTimer <= 0) {
        newPowerUp = { active: false, timer: 0 };
        newGhosts = newGhosts.map(g => ({ ...g, isFrightened: false }));
      } else {
        newPowerUp = { ...newPowerUp, timer: newTimer };
      }
    }

    // 6. Update All States
    setScore(s => s + scoreUpdate);
    setPlayer({ ...player, position: nextPlayerPos, direction: playerDirection, isMouthOpen: !player.isMouthOpen });
    setGhosts(newGhosts);
    setPellets(newPellets);
    setPowerPellets(newPowerPellets);
    setPowerUp(newPowerUp);
    setProjectiles(finalProjectiles);

  }, [player, ghosts, pellets, powerPellets, gameStatus, isWall, powerUp, projectiles, GRID_HEIGHT, GRID_WIDTH]);

  useEffect(() => {
    if (gameStatus === 'PLAYING' && pellets.length === 0 && powerPellets.length === 0 && totalPellets > 0) {
      setGameStatus('WON');
    }
  }, [pellets, powerPellets, totalPellets, gameStatus]);

  useEffect(() => {
    if (gameStatus === 'PLAYING') {
        const interval = setInterval(gameLoop, GAME_SPEED_MS);
        return () => clearInterval(interval);
    }
  }, [gameStatus, gameLoop]);
  
  const handleNextLevel = useCallback(() => {
    if (level < LEVELS.length) {
      setLevel(l => l + 1);
    }
  }, [level]);

  const handleRestart = useCallback(() => {
    if (level !== 1) {
      setLevel(1);
    } else {
      initializeGame();
    }
  }, [level, initializeGame]);
  
  const handleButtonB = useCallback(() => {}, []);

  if (!player) return <div className="bg-black text-white flex justify-center items-center h-screen text-xl">Loading game...</div>;

  const appBg = level === 1 ? 'bg-black' : 'bg-green-900 bg-opacity-75';
  const boardBorder = level === 1 ? 'border-blue-600 shadow-blue-400/50' : 'border-green-600 shadow-green-400/50';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 ${appBg}`} style={{fontFamily: "'Press Start 2P', cursive"}}>
      <h1 className="text-4xl font-bold text-yellow-400 mb-2 tracking-wider">ROBO-CHOMP</h1>
      <div className="flex justify-between w-full text-lg mb-2" style={{maxWidth: GRID_WIDTH * TILE_SIZE}}>
        <span className="text-white">SCORE: <span className="text-yellow-300">{score}</span></span>
        <span className="text-white">LEVEL: <span className="text-yellow-300">{level}</span></span>
      </div>
      <div className={`relative border-4 shadow-lg ${boardBorder}`} style={{ width: GRID_WIDTH * TILE_SIZE, height: GRID_HEIGHT * TILE_SIZE }}>
        <GameBoard layout={LAYOUT} pellets={pellets} powerPellets={powerPellets} level={level} />
        <Pacman player={player} />
        {ghosts.map(ghost => <Ghost key={ghost.id} ghost={ghost} />)}
        {projectiles.map(p => <Projectile key={p.id} projectile={p} />)}
        {(gameStatus === 'WON' || gameStatus === 'LOST') && (
          <GameOverScreen 
            status={gameStatus} 
            onRestart={handleRestart} 
            onNextLevel={handleNextLevel}
            score={score}
            level={level}
            isLastLevel={level >= LEVELS.length}
            />
        )}
      </div>
       <div className="mt-4 text-gray-400 text-center text-sm">
        <p>Use <span className="font-bold text-yellow-300">ARROW KEYS</span> or on-screen controls.</p>
        <p>Press <span className="font-bold text-yellow-300">SPACE</span> or 'A' button to shoot.</p>
      </div>
      <Controls onDirectionChange={handleDirectionChange} onButtonA={handleButtonA} onButtonB={handleButtonB} />
    </div>
  );
};

export default App;