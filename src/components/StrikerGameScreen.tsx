import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Flame,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { Language } from '../types/dealkoro';
import { strikerAudio } from '../utils/strikerGameAudio';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';
type DifficultyId = 'rookie' | 'pro' | 'legend';

interface StrikerGameScreenProps {
  language: Language;
  onExit: () => void;
}

interface HudSnapshot {
  score: number;
  bestScore: number;
  round: number;
  goals: number;
  roundTarget: number;
  timeLeft: number;
  lives: number;
  combo: number;
  dashReady: boolean;
  dashRatio: number;
  lastEventText: string;
}

interface DifficultyConfig {
  id: DifficultyId;
  labelEn: string;
  labelBn: string;
  descEn: string;
  descBn: string;
  defenderSpeed: number;
  keeperSpeed: number;
  windupDuration: number;
  scoreMult: number;
}

const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'rookie',
    labelEn: 'Rookie',
    labelBn: 'রুকি',
    descEn: 'Balanced pace · Wider shooting lanes',
    descBn: 'সহজ গতি · প্রশস্ত শুটিং অ্যাঙ্গেল',
    defenderSpeed: 145,
    keeperSpeed: 180,
    windupDuration: 0.56,
    scoreMult: 1,
  },
  {
    id: 'pro',
    labelEn: 'Pro',
    labelBn: 'প্রো',
    descEn: 'Faster sweepers · Tighter keeper',
    descBn: 'দ্রুত ডিফেন্ডার · চতুর গোলকিপার',
    defenderSpeed: 185,
    keeperSpeed: 235,
    windupDuration: 0.44,
    scoreMult: 1.35,
  },
  {
    id: 'legend',
    labelEn: 'Legend',
    labelBn: 'লিজেন্ড',
    descEn: 'Relentless press · Maximum score bonus',
    descBn: 'তীব্র প্রেসিং · সর্বোচ্চ স্কোর বোনাস',
    defenderSpeed: 222,
    keeperSpeed: 285,
    windupDuration: 0.34,
    scoreMult: 1.75,
  },
];

const ARENA_W = 960;
const ARENA_H = 600;
const PITCH_X = 64;
const PITCH_Y = 56;
const PITCH_W = ARENA_W - 128; // 832
const PITCH_H = ARENA_H - 112; // 488
const GOAL_TOP = ARENA_H / 2 - 92;
const GOAL_BOTTOM = ARENA_H / 2 + 92;
const GOAL_LINE_X = PITCH_X + PITCH_W; // 896
const GOAL_DEPTH = 38;
const BEST_SCORE_KEY = 'dealkoro_striker_best_v1';

interface DefenderEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  state: 'chase' | 'windup' | 'lunge' | 'recover';
  stateTimer: number;
  lungeDirX: number;
  lungeDirY: number;
  flashTimer: number;
  scaleX: number;
  scaleY: number;
}

interface OrbEntity {
  active: boolean;
  x: number;
  y: number;
  pulse: number;
}

interface TargetRing {
  y: number;
  radius: number;
  hitCooldown: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface AfterImage {
  x: number;
  y: number;
  alpha: number;
}

interface SimulationWorld {
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  playerRadius: number;
  aimX: number;
  aimY: number;
  dashTimer: number;
  dashCooldown: number;
  invulnTimer: number;
  playerFlash: number;
  playerScaleX: number;
  playerScaleY: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  ballRadius: number;
  ballPossessed: boolean;
  ballSpin: number;
  ballFlash: number;
  ballScaleX: number;
  ballScaleY: number;
  pickupLockTimer: number;
  keeperY: number;
  keeperVy: number;
  keeperRadius: number;
  keeperFlash: number;
  keeperDiveTimer: number;
  defenders: DefenderEntity[];
  orb: OrbEntity;
  orbSpawnTimer: number;
  targets: TargetRing[];
  particles: Particle[];
  afterImages: AfterImage[];
  score: number;
  bestScore: number;
  round: number;
  goalsInRound: number;
  roundTarget: number;
  timeLeft: number;
  lives: number;
  combo: number;
  comboTimer: number;
  hitstopTimer: number;
  shakeMag: number;
  goalBannerTimer: number;
  lastEventText: string;
  titleCameraPhase: number;
  roundShots: number;
  roundTopCorners: number;
}

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(Math.floor(score)));
  } catch {
    // Ignore storage quota errors
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function createParticlePool(): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < 160; i += 1) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 4,
      color: '#10B981',
    });
  }
  return pool;
}

function createDefendersForRound(round: number): DefenderEntity[] {
  const count = clamp(2 + Math.floor((round - 1) / 2), 2, 5);
  const defs: DefenderEntity[] = [];
  for (let i = 0; i < count; i += 1) {
    const laneY = PITCH_Y + ((i + 1) / (count + 1)) * PITCH_H;
    const laneX = PITCH_X + PITCH_W * (0.48 + (i % 2) * 0.18);
    defs.push({
      id: i + 1,
      x: laneX,
      y: laneY,
      vx: 0,
      vy: 0,
      radius: 17,
      state: 'chase',
      stateTimer: 0.4 + i * 0.25,
      lungeDirX: -1,
      lungeDirY: 0,
      flashTimer: 0,
      scaleX: 1,
      scaleY: 1,
    });
  }
  return defs;
}

function createWorld(round = 1, carryScore = 0, carryLives = 3, bestScore = loadBestScore()): SimulationWorld {
  const roundTarget = clamp(2 + Math.floor((round - 1) / 2), 2, 5);
  return {
    playerX: PITCH_X + 130,
    playerY: ARENA_H / 2,
    playerVx: 0,
    playerVy: 0,
    playerRadius: 17,
    aimX: GOAL_LINE_X,
    aimY: ARENA_H / 2,
    dashTimer: 0,
    dashCooldown: 0,
    invulnTimer: 0.8,
    playerFlash: 0,
    playerScaleX: 1,
    playerScaleY: 1,
    ballX: PITCH_X + 162,
    ballY: ARENA_H / 2,
    ballVx: 0,
    ballVy: 0,
    ballRadius: 10,
    ballPossessed: true,
    ballSpin: 0,
    ballFlash: 0,
    ballScaleX: 1,
    ballScaleY: 1,
    pickupLockTimer: 0,
    keeperY: ARENA_H / 2,
    keeperVy: 0,
    keeperRadius: 19,
    keeperFlash: 0,
    keeperDiveTimer: 0,
    defenders: createDefendersForRound(round),
    orb: { active: false, x: ARENA_W * 0.55, y: ARENA_H * 0.5, pulse: 0 },
    orbSpawnTimer: 3.5,
    targets: [
      { y: GOAL_TOP + 26, radius: 18, hitCooldown: 0 },
      { y: GOAL_BOTTOM - 26, radius: 18, hitCooldown: 0 },
    ],
    particles: createParticlePool(),
    afterImages: [],
    score: carryScore,
    bestScore: Math.max(bestScore, carryScore),
    round,
    goalsInRound: 0,
    roundTarget,
    timeLeft: 45,
    lives: carryLives,
    combo: 0,
    comboTimer: 0,
    hitstopTimer: 0,
    shakeMag: 0,
    goalBannerTimer: 0,
    lastEventText: '',
    titleCameraPhase: 0,
    roundShots: 0,
    roundTopCorners: 0,
  };
}

export function StrikerGameScreen({ language, onExit }: StrikerGameScreenProps) {
  const isBn = language === 'bn';

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('pro');
  const [muted, setMuted] = useState<boolean>(() => strikerAudio.isMuted());
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    score: 0,
    bestScore: loadBestScore(),
    round: 1,
    goals: 0,
    roundTarget: 2,
    timeLeft: 45,
    lives: 3,
    combo: 0,
    dashReady: true,
    dashRatio: 1,
    lastEventText: '',
  }));
  const [roundStats, setRoundStats] = useState({
    goals: 0,
    timeBonus: 0,
    topCorners: 0,
    shots: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<SimulationWorld>(createWorld(1, 0, 3));
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const difficultyRef = useRef<DifficultyConfig>(DIFFICULTIES[1]);

  // Held vs justPressed input buffer
  const keysHeldRef = useRef<Set<string>>(new Set());
  const shootBufferRef = useRef<number>(0);
  const dashBufferRef = useRef<number>(0);
  const pointerArenaRef = useRef<{ x: number; y: number; active: boolean }>({
    x: GOAL_LINE_X,
    y: ARENA_H / 2,
    active: false,
  });
  const touchMoveRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const viewportScaleRef = useRef<{ scale: number; offsetX: number; offsetY: number }>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const found = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[1];
    difficultyRef.current = found;
  }, [difficultyId]);

  const syncHudSnapshot = useCallback((w: SimulationWorld) => {
    setHud((prev) => {
      const nextTime = Math.ceil(Math.max(0, w.timeLeft));
      const nextDashReady = w.dashCooldown <= 0;
      const nextDashRatio = clamp(1 - w.dashCooldown / 2.2, 0, 1);
      if (
        prev.score === w.score &&
        prev.bestScore === w.bestScore &&
        prev.round === w.round &&
        prev.goals === w.goalsInRound &&
        prev.roundTarget === w.roundTarget &&
        prev.timeLeft === nextTime &&
        prev.lives === w.lives &&
        prev.combo === w.combo &&
        prev.dashReady === nextDashReady &&
        Math.abs(prev.dashRatio - nextDashRatio) < 0.05 &&
        prev.lastEventText === w.lastEventText
      ) {
        return prev;
      }
      return {
        score: w.score,
        bestScore: w.bestScore,
        round: w.round,
        goals: w.goalsInRound,
        roundTarget: w.roundTarget,
        timeLeft: nextTime,
        lives: w.lives,
        combo: w.combo,
        dashReady: nextDashReady,
        dashRatio: nextDashRatio,
        lastEventText: w.lastEventText,
      };
    });
  }, []);

  const clearInputs = useCallback(() => {
    keysHeldRef.current.clear();
    shootBufferRef.current = 0;
    dashBufferRef.current = 0;
    touchMoveRef.current = { dx: 0, dy: 0 };
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = strikerAudio.toggleMute();
    setMuted(next);
  }, []);

  const startNewGame = useCallback(() => {
    clearInputs();
    const fresh = createWorld(1, 0, 3, loadBestScore());
    worldRef.current = fresh;
    syncHudSnapshot(fresh);
    setGameState('PLAYING');
    strikerAudio.playWhistle();
  }, [clearInputs, syncHudSnapshot]);

  const advanceToNextRound = useCallback(() => {
    clearInputs();
    const cur = worldRef.current;
    const nextWorld = createWorld(
      cur.round + 1,
      cur.score,
      Math.min(3, cur.lives + 1),
      cur.bestScore
    );
    worldRef.current = nextWorld;
    syncHudSnapshot(nextWorld);
    setGameState('PLAYING');
    strikerAudio.playWhistle();
  }, [clearInputs, syncHudSnapshot]);

  // Keyboard & Blur Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const activeState = gameStateRef.current;

      if (code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (activeState === 'PLAYING') {
          e.preventDefault();
          clearInputs();
          setGameState('PAUSED');
          return;
        }
        if (activeState === 'PAUSED') {
          e.preventDefault();
          clearInputs();
          setGameState('PLAYING');
          return;
        }
      }

      if (code === 'Enter' || code === 'Space') {
        if (activeState === 'TITLE_MENU') {
          e.preventDefault();
          startNewGame();
          return;
        }
        if (activeState === 'ROUND_SUMMARY') {
          e.preventDefault();
          advanceToNextRound();
          return;
        }
        if (activeState === 'GAME_OVER') {
          e.preventDefault();
          startNewGame();
          return;
        }
      }

      if (activeState !== 'PLAYING') return;

      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      const wasHeld = keysHeldRef.current.has(code);
      keysHeldRef.current.add(code);

      if (!wasHeld) {
        if (code === 'Space' || code === 'KeyJ') {
          shootBufferRef.current = 0.15;
        }
        if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK' || code === 'KeyE') {
          dashBufferRef.current = 0.15;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const onBlur = () => {
      clearInputs();
      if (gameStateRef.current === 'PLAYING') {
        setGameState('PAUSED');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [advanceToNextRound, clearInputs, handleToggleMute, startNewGame]);

  // Main 60fps Canvas Loop + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let widthCss = container.clientWidth || window.innerWidth;
    let heightCss = container.clientHeight || window.innerHeight;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      widthCss = Math.max(320, rect.width);
      heightCss = Math.max(240, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(widthCss * dpr);
      canvas.height = Math.floor(heightCss * dpr);
      const scale = Math.min(widthCss / ARENA_W, heightCss / ARENA_H);
      viewportScaleRef.current = {
        scale,
        offsetX: (widthCss - ARENA_W * scale) / 2,
        offsetY: (heightCss - ARENA_H * scale) / 2,
      };
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);

    const spawnBurst = (
      w: SimulationWorld,
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 190
    ) => {
      let spawned = 0;
      for (let i = 0; i < w.particles.length && spawned < count; i += 1) {
        const p = w.particles[i];
        if (!p.active) {
          const angle = Math.random() * Math.PI * 2;
          const mag = speed * (0.35 + Math.random() * 0.75);
          p.active = true;
          p.x = x;
          p.y = y;
          p.vx = Math.cos(angle) * mag;
          p.vy = Math.sin(angle) * mag;
          p.maxLife = 0.25 + Math.random() * 0.35;
          p.life = p.maxLife;
          p.size = 2.5 + Math.random() * 4.5;
          p.color = color;
          spawned += 1;
        }
      }
    };

    const resetPositionsAfterGoalOrTackle = (w: SimulationWorld) => {
      w.playerX = PITCH_X + 135;
      w.playerY = ARENA_H / 2;
      w.playerVx = 0;
      w.playerVy = 0;
      w.ballX = w.playerX + 28;
      w.ballY = w.playerY;
      w.ballVx = 0;
      w.ballVy = 0;
      w.ballPossessed = true;
      w.invulnTimer = 1.1;
      w.keeperY = ARENA_H / 2;
      w.keeperVy = 0;
      w.defenders.forEach((def, idx) => {
        const laneY = PITCH_Y + ((idx + 1) / (w.defenders.length + 1)) * PITCH_H;
        const laneX = PITCH_X + PITCH_W * (0.5 + (idx % 2) * 0.16);
        def.x = laneX;
        def.y = laneY;
        def.vx = 0;
        def.vy = 0;
        def.state = 'chase';
        def.stateTimer = 0.5 + idx * 0.2;
      });
    };

    const stepParticles = (w: SimulationWorld, dt: number) => {
      for (let i = 0; i < w.particles.length; i += 1) {
        const p = w.particles[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.08, dt);
        p.vy *= Math.pow(0.08, dt);
      }

      for (let i = w.afterImages.length - 1; i >= 0; i -= 1) {
        w.afterImages[i].alpha -= dt * 3.4;
        if (w.afterImages[i].alpha <= 0) {
          w.afterImages.splice(i, 1);
        }
      }
    };

    const updateSimulation = (dt: number) => {
      const w = worldRef.current;
      const diff = difficultyRef.current;
      const stateNow = gameStateRef.current;

      if (stateNow === 'TITLE_MENU') {
        w.titleCameraPhase += dt * 0.7;
        stepParticles(w, dt);
        return;
      }

      if (stateNow !== 'PLAYING') {
        return;
      }

      // Hitstop freeze frames for crisp impact feel
      if (w.hitstopTimer > 0) {
        w.hitstopTimer = Math.max(0, w.hitstopTimer - dt);
        w.shakeMag = Math.max(0, w.shakeMag - dt * 28);
        stepParticles(w, dt);
        return;
      }

      // Timers & spring recovery
      w.timeLeft -= dt;
      w.dashTimer = Math.max(0, w.dashTimer - dt);
      w.dashCooldown = Math.max(0, w.dashCooldown - dt);
      w.invulnTimer = Math.max(0, w.invulnTimer - dt);
      w.playerFlash = Math.max(0, w.playerFlash - dt);
      w.ballFlash = Math.max(0, w.ballFlash - dt);
      w.keeperFlash = Math.max(0, w.keeperFlash - dt);
      w.keeperDiveTimer = Math.max(0, w.keeperDiveTimer - dt);
      w.pickupLockTimer = Math.max(0, w.pickupLockTimer - dt);
      w.goalBannerTimer = Math.max(0, w.goalBannerTimer - dt);
      w.shakeMag = Math.max(0, w.shakeMag - dt * 34);
      shootBufferRef.current = Math.max(0, shootBufferRef.current - dt);
      dashBufferRef.current = Math.max(0, dashBufferRef.current - dt);

      w.playerScaleX = lerp(w.playerScaleX, 1, Math.min(1, dt * 16));
      w.playerScaleY = lerp(w.playerScaleY, 1, Math.min(1, dt * 16));
      w.ballScaleX = lerp(w.ballScaleX, 1, Math.min(1, dt * 14));
      w.ballScaleY = lerp(w.ballScaleY, 1, Math.min(1, dt * 14));

      if (w.combo > 0) {
        w.comboTimer -= dt;
        if (w.comboTimer <= 0) {
          w.combo = 0;
        }
      }

      for (const tgt of w.targets) {
        tgt.hitCooldown = Math.max(0, tgt.hitCooldown - dt);
      }

      // Check time expiration
      if (w.timeLeft <= 0) {
        w.timeLeft = 0;
        if (w.score > w.bestScore) {
          w.bestScore = w.score;
          saveBestScore(w.bestScore);
        }
        clearInputs();
        syncHudSnapshot(w);
        strikerAudio.playGameOver();
        setGameState('GAME_OVER');
        return;
      }

      // Movement vector from keyboard + touch stick
      const keys = keysHeldRef.current;
      let moveX = touchMoveRef.current.dx;
      let moveY = touchMoveRef.current.dy;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;

      const moveLen = Math.hypot(moveX, moveY);
      if (moveLen > 1) {
        moveX /= moveLen;
        moveY /= moveLen;
      }

      // Skill Dash trigger
      if (dashBufferRef.current > 0 && w.dashCooldown <= 0) {
        dashBufferRef.current = 0;
        w.dashTimer = 0.22;
        w.dashCooldown = 2.2;
        w.invulnTimer = Math.max(w.invulnTimer, 0.28);
        const dirX = moveLen > 0.1 ? moveX : 1;
        const dirY = moveLen > 0.1 ? moveY : 0;
        w.playerVx = dirX * 560;
        w.playerVy = dirY * 560;
        w.playerScaleX = 1.32;
        w.playerScaleY = 0.74;
        spawnBurst(w, w.playerX, w.playerY, '#38BDF8', 12, 160);
        strikerAudio.playDash();
      }

      if (w.dashTimer > 0) {
        if (Math.random() < 0.7) {
          w.afterImages.push({ x: w.playerX, y: w.playerY, alpha: 0.55 });
        }
      } else {
        const maxSpeed = w.ballPossessed ? 255 : 292;
        w.playerVx = lerp(w.playerVx, moveX * maxSpeed, Math.min(1, dt * 14));
        w.playerVy = lerp(w.playerVy, moveY * maxSpeed, Math.min(1, dt * 14));
      }

      w.playerX = clamp(
        w.playerX + w.playerVx * dt,
        PITCH_X + w.playerRadius + 4,
        GOAL_LINE_X - w.playerRadius - 12
      );
      w.playerY = clamp(
        w.playerY + w.playerVy * dt,
        PITCH_Y + w.playerRadius + 4,
        PITCH_Y + PITCH_H - w.playerRadius - 4
      );

      // Update aim target
      if (pointerArenaRef.current.active) {
        w.aimX = pointerArenaRef.current.x;
        w.aimY = pointerArenaRef.current.y;
      } else {
        w.aimX = GOAL_LINE_X + 12;
        w.aimY = clamp(
          w.playerY + moveY * 110,
          GOAL_TOP + 18,
          GOAL_BOTTOM - 18
        );
      }

      // Ball possession / Shoot trigger
      const distPlayerBall = Math.hypot(w.ballX - w.playerX, w.ballY - w.playerY);
      if (!w.ballPossessed && w.pickupLockTimer <= 0 && distPlayerBall < w.playerRadius + w.ballRadius + 14) {
        w.ballPossessed = true;
        w.ballScaleX = 1.18;
        w.ballScaleY = 0.86;
      }

      const aimDx = w.aimX - w.playerX;
      const aimDy = w.aimY - w.playerY;
      const aimLen = Math.hypot(aimDx, aimDy) || 1;
      const aimUx = aimDx / aimLen;
      const aimUy = aimDy / aimLen;

      if (w.ballPossessed) {
        const dribbleDist = w.playerRadius + w.ballRadius + 5;
        w.ballX = w.playerX + aimUx * dribbleDist;
        w.ballY = w.playerY + aimUy * dribbleDist;
        w.ballVx = w.playerVx;
        w.ballVy = w.playerVy;
      }

      // Shoot if buffered
      if (shootBufferRef.current > 0 && (w.ballPossessed || distPlayerBall < 48)) {
        shootBufferRef.current = 0;
        w.ballPossessed = false;
        w.pickupLockTimer = 0.24;
        const shotSpeed = 685 + w.round * 14;
        w.ballVx = aimUx * shotSpeed;
        w.ballVy = aimUy * shotSpeed;
        w.ballScaleX = 1.38;
        w.ballScaleY = 0.72;
        w.playerScaleX = 1.24;
        w.playerScaleY = 0.8;
        w.ballFlash = 0.1;
        w.shakeMag = Math.max(w.shakeMag, 4.5);
        w.roundShots += 1;
        spawnBurst(w, w.ballX, w.ballY, '#F8FAFC', 10, 170);
        strikerAudio.playKick(1.1);
      }

      // Ball Physics (when loose)
      if (!w.ballPossessed) {
        w.ballX += w.ballVx * dt;
        w.ballY += w.ballVy * dt;
        w.ballSpin += Math.hypot(w.ballVx, w.ballVy) * dt * 0.04;
        const friction = Math.pow(0.45, dt);
        w.ballVx *= friction;
        w.ballVy *= friction;

        // Top & Bottom touchlines
        if (w.ballY - w.ballRadius < PITCH_Y) {
          w.ballY = PITCH_Y + w.ballRadius;
          w.ballVy = Math.abs(w.ballVy) * 0.78;
        } else if (w.ballY + w.ballRadius > PITCH_Y + PITCH_H) {
          w.ballY = PITCH_Y + PITCH_H - w.ballRadius;
          w.ballVy = -Math.abs(w.ballVy) * 0.78;
        }

        // Left endline bounce
        if (w.ballX - w.ballRadius < PITCH_X) {
          w.ballX = PITCH_X + w.ballRadius;
          w.ballVx = Math.abs(w.ballVx) * 0.75;
        }

        // Goal posts & Right endline / Goal check
        const postRadius = 7;
        for (const postY of [GOAL_TOP, GOAL_BOTTOM]) {
          const pdx = w.ballX - GOAL_LINE_X;
          const pdy = w.ballY - postY;
          const pDist = Math.hypot(pdx, pdy);
          if (pDist < w.ballRadius + postRadius && pDist > 0.001) {
            const nx = pdx / pDist;
            const ny = pdy / pDist;
            w.ballX = GOAL_LINE_X + nx * (w.ballRadius + postRadius + 1);
            w.ballY = postY + ny * (w.ballRadius + postRadius + 1);
            const dot = w.ballVx * nx + w.ballVy * ny;
            w.ballVx = (w.ballVx - 2 * dot * nx) * 0.85;
            w.ballVy = (w.ballVy - 2 * dot * ny) * 0.85;
            w.hitstopTimer = 0.04;
            w.shakeMag = 9;
            w.ballFlash = 0.14;
            spawnBurst(w, GOAL_LINE_X, postY, '#F59E0B', 14, 230);
            strikerAudio.playPostClang();
          }
        }

        const inGoalMouth = w.ballY > GOAL_TOP + 6 && w.ballY < GOAL_BOTTOM - 6;
        if (!inGoalMouth && w.ballX + w.ballRadius > GOAL_LINE_X) {
          w.ballX = GOAL_LINE_X - w.ballRadius;
          w.ballVx = -Math.abs(w.ballVx) * 0.72;
        }

        // Top-Corner Sniper Targets inside goal box
        if (w.ballX > GOAL_LINE_X - 8 && inGoalMouth) {
          for (const tgt of w.targets) {
            if (tgt.hitCooldown <= 0 && Math.abs(w.ballY - tgt.y) < tgt.radius + w.ballRadius) {
              tgt.hitCooldown = 1.5;
              w.roundTopCorners += 1;
              w.score += Math.round(150 * diff.scoreMult);
              w.lastEventText = isBn ? 'টপ কর্নার স্নাইপ! +১৫০' : 'TOP CORNER SNIPE! +150';
              spawnBurst(w, GOAL_LINE_X + 16, tgt.y, '#FBBF24', 18, 250);
            }
          }
        }

        // GOAL SCORED!
        if (inGoalMouth && w.ballX > GOAL_LINE_X + 12) {
          w.goalsInRound += 1;
          w.combo += 1;
          w.comboTimer = 8.5;
          const baseGoalPts = 250 + (w.combo - 1) * 90;
          const pts = Math.round(baseGoalPts * diff.scoreMult);
          w.score += pts;
          if (w.score > w.bestScore) {
            w.bestScore = w.score;
            saveBestScore(w.bestScore);
          }
          w.hitstopTimer = 0.065;
          w.shakeMag = 12;
          w.goalBannerTimer = 1.4;
          if (!w.lastEventText) {
            w.lastEventText = isBn
              ? `গোল! +${pts} (${w.combo}x কম্বো)`
              : `GOAL! +${pts} (${w.combo}x COMBO)`;
          }
          spawnBurst(w, GOAL_LINE_X + 18, w.ballY, '#10B981', 26, 280);
          spawnBurst(w, GOAL_LINE_X + 18, w.ballY, '#F59E0B', 14, 230);
          strikerAudio.playGoal(w.combo);

          // Check Round Complete
          if (w.goalsInRound >= w.roundTarget) {
            const timeBonus = Math.round(w.timeLeft * 12 * diff.scoreMult);
            w.score += timeBonus;
            if (w.score > w.bestScore) {
              w.bestScore = w.score;
              saveBestScore(w.bestScore);
            }
            setRoundStats({
              goals: w.goalsInRound,
              timeBonus,
              topCorners: w.roundTopCorners,
              shots: w.roundShots,
            });
            clearInputs();
            syncHudSnapshot(w);
            strikerAudio.playRoundClear();
            setGameState('ROUND_SUMMARY');
            return;
          }

          resetPositionsAfterGoalOrTackle(w);
        }
      }

      // Pitch Energy Orbs
      if (!w.orb.active) {
        w.orbSpawnTimer -= dt;
        if (w.orbSpawnTimer <= 0) {
          w.orb = {
            active: true,
            x: PITCH_X + 180 + Math.random() * (PITCH_W - 340),
            y: PITCH_Y + 75 + Math.random() * (PITCH_H - 150),
            pulse: 0,
          };
          w.orbSpawnTimer = 6.5;
        }
      } else {
        w.orb.pulse += dt * 4.5;
        if (Math.hypot(w.playerX - w.orb.x, w.playerY - w.orb.y) < w.playerRadius + 16) {
          w.orb.active = false;
          w.dashCooldown = 0;
          w.score += Math.round(60 * diff.scoreMult);
          if (w.score > w.bestScore) {
            w.bestScore = w.score;
            saveBestScore(w.bestScore);
          }
          w.lastEventText = isBn ? 'বোনাস এনার্জি! +৬০' : 'ENERGY BOOST! +60';
          spawnBurst(w, w.orb.x, w.orb.y, '#38BDF8', 16, 200);
          strikerAudio.playPickup();
        }
      }

      // Goalkeeper AI + Shot Blocking
      const keeperX = GOAL_LINE_X - 18;
      const trackY =
        !w.ballPossessed && w.ballVx > 80
          ? clamp(
              w.ballY + (w.ballVy / Math.max(1, w.ballVx)) * (keeperX - w.ballX),
              GOAL_TOP + 22,
              GOAL_BOTTOM - 22
            )
          : clamp(w.ballY * 0.65 + (ARENA_H / 2) * 0.35, GOAL_TOP + 22, GOAL_BOTTOM - 22);

      const kSpeed = diff.keeperSpeed + w.round * 12;
      const kDiff = trackY - w.keeperY;
      if (Math.abs(kDiff) > 3) {
        w.keeperVy = clamp(kDiff * 6.5, -kSpeed, kSpeed);
        w.keeperY += w.keeperVy * dt;
      }

      if (!w.ballPossessed) {
        const kDist = Math.hypot(w.ballX - keeperX, w.ballY - w.keeperY);
        if (kDist < w.ballRadius + w.keeperRadius && kDist > 0.001) {
          const nx = (w.ballX - keeperX) / kDist;
          const ny = (w.ballY - w.keeperY) / kDist;
          w.ballX = keeperX + nx * (w.ballRadius + w.keeperRadius + 2);
          w.ballY = w.keeperY + ny * (w.ballRadius + w.keeperRadius + 2);
          w.ballVx = -Math.max(280, Math.abs(w.ballVx) * 0.65);
          w.ballVy = ny * 260 + (Math.random() - 0.5) * 90;
          w.keeperFlash = 0.16;
          w.keeperDiveTimer = 0.28;
          w.hitstopTimer = 0.035;
          w.shakeMag = 7;
          w.lastEventText = isBn ? 'গোলকিপারের সেভ!' : 'KEEPER SAVE!';
          spawnBurst(w, keeperX, w.keeperY, '#F59E0B', 14, 210);
          strikerAudio.playKick(0.95);
        }
      }

      // Sweeper Defender AI (Chase -> Windup Telegraph -> Lunge -> Recover)
      for (const def of w.defenders) {
        def.flashTimer = Math.max(0, def.flashTimer - dt);
        def.scaleX = lerp(def.scaleX, 1, Math.min(1, dt * 14));
        def.scaleY = lerp(def.scaleY, 1, Math.min(1, dt * 14));

        const targetX = w.ballPossessed ? w.playerX : w.ballX;
        const targetY = w.ballPossessed ? w.playerY : w.ballY;
        const dx = targetX - def.x;
        const dy = targetY - def.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = diff.defenderSpeed + (w.round - 1) * 10;

        if (def.state === 'chase') {
          def.vx = lerp(def.vx, (dx / dist) * speed, Math.min(1, dt * 8));
          def.vy = lerp(def.vy, (dy / dist) * speed, Math.min(1, dt * 8));
          def.x += def.vx * dt;
          def.y += def.vy * dt;
          def.stateTimer -= dt;
          if (dist < 135 && def.stateTimer <= 0) {
            def.state = 'windup';
            def.stateTimer = diff.windupDuration;
            def.lungeDirX = dx / dist;
            def.lungeDirY = dy / dist;
            def.vx = 0;
            def.vy = 0;
            def.scaleX = 0.82;
            def.scaleY = 1.2;
          }
        } else if (def.state === 'windup') {
          def.stateTimer -= dt;
          if (def.stateTimer <= 0) {
            def.state = 'lunge';
            def.stateTimer = 0.28;
            def.vx = def.lungeDirX * (speed * 2.35);
            def.vy = def.lungeDirY * (speed * 2.35);
            def.scaleX = 1.3;
            def.scaleY = 0.76;
          }
        } else if (def.state === 'lunge') {
          def.x += def.vx * dt;
          def.y += def.vy * dt;
          def.stateTimer -= dt;
          if (def.stateTimer <= 0) {
            def.state = 'recover';
            def.stateTimer = 0.65;
          }
        } else {
          // recover
          def.vx *= Math.pow(0.1, dt);
          def.vy *= Math.pow(0.1, dt);
          def.stateTimer -= dt;
          if (def.stateTimer <= 0) {
            def.state = 'chase';
            def.stateTimer = 0.9;
          }
        }

        def.x = clamp(def.x, PITCH_X + 24, GOAL_LINE_X - 42);
        def.y = clamp(def.y, PITCH_Y + 24, PITCH_Y + PITCH_H - 24);

        // Defender tackles striker
        const pDist = Math.hypot(def.x - w.playerX, def.y - w.playerY);
        if (pDist < def.radius + w.playerRadius - 2) {
          if (w.dashTimer > 0) {
            // Player dashed cleanly past defender -> stun defender & award skill dodge
            if (def.state !== 'recover') {
              def.state = 'recover';
              def.stateTimer = 1.1;
              def.flashTimer = 0.16;
              w.score += Math.round(40 * diff.scoreMult);
              w.lastEventText = isBn ? 'স্কিল ডজ! +৪০' : 'SKILL DODGE! +40';
              spawnBurst(w, def.x, def.y, '#38BDF8', 12, 190);
            }
          } else if (w.invulnTimer <= 0) {
            w.lives -= 1;
            w.combo = 0;
            w.playerFlash = 0.25;
            w.hitstopTimer = 0.05;
            w.shakeMag = 11;
            w.lastEventText = isBn ? 'ট্যাকল হয়েছে!' : 'TACKLED!';
            spawnBurst(w, w.playerX, w.playerY, '#EF4444', 20, 240);
            strikerAudio.playTackle();

            if (w.lives <= 0) {
              if (w.score > w.bestScore) {
                w.bestScore = w.score;
                saveBestScore(w.bestScore);
              }
              clearInputs();
              syncHudSnapshot(w);
              strikerAudio.playGameOver();
              setGameState('GAME_OVER');
              return;
            }
            resetPositionsAfterGoalOrTackle(w);
          }
        }
      }

      stepParticles(w, dt);
      syncHudSnapshot(w);
    };

    const drawArena = () => {
      const w = worldRef.current;
      const stateNow = gameStateRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Stadium dark surround background (never plain flat white/black)
      const bgGrad = ctx.createRadialGradient(
        widthCss * 0.5,
        heightCss * 0.5,
        80,
        widthCss * 0.5,
        heightCss * 0.5,
        Math.max(widthCss, heightCss) * 0.75
      );
      bgGrad.addColorStop(0, '#0B2F20');
      bgGrad.addColorStop(1, '#04120C');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const { scale, offsetX, offsetY } = viewportScaleRef.current;
      const shakeX = w.shakeMag > 0 ? (Math.random() - 0.5) * w.shakeMag * 2 : 0;
      const shakeY = w.shakeMag > 0 ? (Math.random() - 0.5) * w.shakeMag * 2 : 0;
      const titlePanX = stateNow === 'TITLE_MENU' ? Math.sin(w.titleCameraPhase) * 26 : 0;
      const titlePanY = stateNow === 'TITLE_MENU' ? Math.cos(w.titleCameraPhase * 0.7) * 12 : 0;

      ctx.translate(offsetX + (shakeX + titlePanX) * scale, offsetY + (shakeY + titlePanY) * scale);
      ctx.scale(scale, scale);

      // Stadium Floodlight Glow Corners
      for (const [fx, fy] of [
        [24, 24],
        [ARENA_W - 24, 24],
        [24, ARENA_H - 24],
        [ARENA_W - 24, ARENA_H - 24],
      ]) {
        const fl = ctx.createRadialGradient(fx, fy, 4, fx, fy, 260);
        fl.addColorStop(0, 'rgba(167, 243, 208, 0.16)');
        fl.addColorStop(1, 'rgba(167, 243, 208, 0)');
        ctx.fillStyle = fl;
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      }

      // Pitch Mowed Turf Stripes
      const stripeCount = 10;
      const stripeW = PITCH_W / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? '#0F5E3C' : '#136B45';
        ctx.fillRect(PITCH_X + i * stripeW, PITCH_Y, stripeW + 0.5, PITCH_H);
      }

      // Crisp Pitch Chalk Lines
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.72)';
      ctx.lineWidth = 3;
      ctx.strokeRect(PITCH_X, PITCH_Y, PITCH_W, PITCH_H);

      // Halfway Line & Center Circle
      const midX = PITCH_X + PITCH_W * 0.42;
      ctx.beginPath();
      ctx.moveTo(midX, PITCH_Y);
      ctx.lineTo(midX, PITCH_Y + PITCH_H);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(midX, ARENA_H / 2, 68, 0, Math.PI * 2);
      ctx.stroke();

      // Penalty Box & 6-Yard Box
      const penW = 148;
      const penH = 296;
      ctx.strokeRect(GOAL_LINE_X - penW, ARENA_H / 2 - penH / 2, penW, penH);
      ctx.strokeRect(GOAL_LINE_X - 58, ARENA_H / 2 - 118, 58, 236);

      // Goal Net Box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
      ctx.fillRect(GOAL_LINE_X, GOAL_TOP, GOAL_DEPTH, GOAL_BOTTOM - GOAL_TOP);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 1;
      for (let nx = GOAL_LINE_X + 8; nx < GOAL_LINE_X + GOAL_DEPTH; nx += 10) {
        ctx.beginPath();
        ctx.moveTo(nx, GOAL_TOP);
        ctx.lineTo(nx, GOAL_BOTTOM);
        ctx.stroke();
      }
      for (let ny = GOAL_TOP + 12; ny < GOAL_BOTTOM; ny += 14) {
        ctx.beginPath();
        ctx.moveTo(GOAL_LINE_X, ny);
        ctx.lineTo(GOAL_LINE_X + GOAL_DEPTH, ny);
        ctx.stroke();
      }

      // Goal Frame & Posts
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(GOAL_LINE_X, GOAL_TOP);
      ctx.lineTo(GOAL_LINE_X + GOAL_DEPTH, GOAL_TOP);
      ctx.lineTo(GOAL_LINE_X + GOAL_DEPTH, GOAL_BOTTOM);
      ctx.lineTo(GOAL_LINE_X, GOAL_BOTTOM);
      ctx.stroke();

      for (const py of [GOAL_TOP, GOAL_BOTTOM]) {
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(GOAL_LINE_X, py, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Top-Corner Sniper Targets
      for (const tgt of w.targets) {
        const ready = tgt.hitCooldown <= 0;
        ctx.save();
        ctx.strokeStyle = ready ? '#FBBF24' : 'rgba(251, 191, 36, 0.25)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(GOAL_LINE_X + 16, tgt.y, tgt.radius, 0, Math.PI * 2);
        ctx.stroke();
        if (ready) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.fill();
        }
        ctx.restore();
      }

      // Pitch Energy Orb
      if (w.orb.active) {
        const pulseScale = 1 + Math.sin(w.orb.pulse) * 0.16;
        ctx.save();
        ctx.translate(w.orb.x, w.orb.y);
        ctx.scale(pulseScale, pulseScale);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-2.5, -2.5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Aim Sightline when playing
      if (stateNow === 'PLAYING' && w.ballPossessed) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(w.ballX, w.ballY);
        ctx.lineTo(w.aimX, w.aimY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w.aimX, w.aimY, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Dash Afterimages
      for (const ghost of w.afterImages) {
        ctx.fillStyle = `rgba(56, 189, 248, ${ghost.alpha * 0.55})`;
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, w.playerRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sweeper Defenders + Tackle Windup Telegraph
      for (const def of w.defenders) {
        if (def.state === 'windup') {
          const angle = Math.atan2(def.lungeDirY, def.lungeDirX);
          ctx.save();
          ctx.translate(def.x, def.y);
          ctx.rotate(angle);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(96, -24);
          ctx.lineTo(96, 24);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(def.x, def.y);
        ctx.scale(def.scaleX, def.scaleY);

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(0, def.radius - 2, def.radius * 0.9, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle =
          def.flashTimer > 0
            ? '#FFFFFF'
            : def.state === 'windup'
            ? '#F59E0B'
            : def.state === 'recover'
            ? '#64748B'
            : '#DC2626';
        ctx.beginPath();
        ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FEF2F2';
        ctx.stroke();

        // Jersey number
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(def.id + 3), 0, 1);
        ctx.restore();
      }

      // Goalkeeper
      const keeperX = GOAL_LINE_X - 18;
      ctx.save();
      ctx.translate(keeperX, w.keeperY);
      ctx.scale(w.keeperDiveTimer > 0 ? 0.85 : 1, w.keeperDiveTimer > 0 ? 1.25 : 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, w.keeperRadius - 2, w.keeperRadius * 0.9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = w.keeperFlash > 0 ? '#FFFFFF' : '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, w.keeperRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFBEB';
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GK', 0, 1);
      ctx.restore();

      // Player Striker
      ctx.save();
      ctx.translate(w.playerX, w.playerY);
      ctx.scale(w.playerScaleX, w.playerScaleY);
      if (w.invulnTimer > 0 && Math.floor(w.invulnTimer * 14) % 2 === 0) {
        ctx.globalAlpha = 0.65;
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(0, w.playerRadius - 1, w.playerRadius, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = w.playerFlash > 0 ? '#EF4444' : w.dashTimer > 0 ? '#38BDF8' : '#2563EB';
      ctx.beginPath();
      ctx.arc(0, 0, w.playerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('10', 0, 1);
      ctx.restore();

      // Football
      ctx.save();
      ctx.translate(w.ballX, w.ballY);
      ctx.scale(w.ballScaleX, w.ballScaleY);
      ctx.rotate(w.ballSpin);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, w.ballRadius - 1, w.ballRadius, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = w.ballFlash > 0 ? '#FEF08A' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, w.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pooled Particles
      for (let i = 0; i < w.particles.length; i += 1) {
        const p = w.particles[i];
        if (!p.active) continue;
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Floating Impact Callout Banner inside pitch top
      if (w.goalBannerTimer > 0 && w.lastEventText) {
        ctx.save();
        ctx.globalAlpha = clamp(w.goalBannerTimer, 0, 1);
        ctx.fillStyle = 'rgba(4, 18, 12, 0.88)';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        const bw = 270;
        const bh = 38;
        const bx = ARENA_W / 2 - bw / 2;
        const by = PITCH_Y + 14;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ECFDF5';
        ctx.font = '800 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(w.lastEventText, ARENA_W / 2, by + bh / 2);
        ctx.restore();
      }

      ctx.restore();
    };

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      updateSimulation(dt);
      drawArena();
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [clearInputs, isBn, syncHudSnapshot]);

  const mapPointerToArena = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = viewportScaleRef.current;
    const ax = clamp((clientX - rect.left - offsetX) / scale, 0, ARENA_W);
    const ay = clamp((clientY - rect.top - offsetY) / scale, 0, ARENA_H);
    pointerArenaRef.current = { x: ax, y: ay, active: true };
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#04120C] text-slate-100 select-none overflow-hidden flex flex-col"
      role="application"
      aria-label="Striker Arena Game"
    >
      {/* Full-Viewport Game Canvas */}
      <div ref={containerRef} className="relative flex-1 w-full h-full">
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => mapPointerToArena(e.clientX, e.clientY)}
          onPointerDown={(e) => {
            if (gameState !== 'PLAYING') return;
            mapPointerToArena(e.clientX, e.clientY);
            shootBufferRef.current = 0.16;
          }}
          className="block w-full h-full touch-none cursor-crosshair"
        />

        {/* Active Gameplay HUD (No backdrop-filter over canvas, pointer-events-none except buttons) */}
        {gameState === 'PLAYING' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-2 sm:gap-3 bg-[#04120C]/90 border border-emerald-800/70 rounded-xl px-3.5 py-2 text-xs font-bold tabular-nums shadow-md">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Trophy className="w-3.5 h-3.5" />
                <span>
                  {isBn ? 'রাউন্ড' : 'ROUND'} {hud.round}
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <div>
                <span className="text-slate-400 mr-1">{isBn ? 'গোল' : 'GOALS'}:</span>
                <span className="text-white">
                  {hud.goals}/{hud.roundTarget}
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <div>
                <span className="text-slate-400 mr-1">{isBn ? 'স্কোর' : 'SCORE'}:</span>
                <span className="text-amber-300">{hud.score.toLocaleString('en-US')}</span>
              </div>
              {hud.combo > 1 && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-sky-400 inline-flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    {hud.combo}x
                  </span>
                </>
              )}
              <span className="text-slate-600">|</span>
              <div className={hud.timeLeft <= 10 ? 'text-red-400' : 'text-slate-100'}>
                {hud.timeLeft}s
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1" aria-label={`Lives ${hud.lives}`}>
                {[1, 2, 3].map((idx) => (
                  <Heart
                    key={idx}
                    className={`w-3.5 h-3.5 ${
                      idx <= hud.lives ? 'text-red-500 fill-red-500' : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <div
                className={`hidden sm:inline-flex items-center gap-1 ${
                  hud.dashReady ? 'text-sky-400' : 'text-slate-500'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{hud.dashReady ? (isBn ? 'ড্যাশ রেডি' : 'DASH READY') : '...'}</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-[#04120C]/90 border border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-200 transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearInputs();
                  setGameState('PAUSED');
                }}
                aria-label="Pause game"
                className="min-w-[40px] min-h-[40px] px-3 rounded-xl bg-[#04120C]/90 border border-slate-700 hover:border-slate-500 flex items-center gap-1.5 text-xs font-bold text-slate-100 transition-colors"
              >
                <Pause className="w-4 h-4" />
                <span className="hidden sm:inline">{isBn ? 'বিরতি' : 'Pause'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Touch Fallback Controls on Mobile Viewports */}
        {gameState === 'PLAYING' && (
          <div className="pointer-events-none sm:hidden absolute inset-x-0 bottom-4 px-4 flex items-end justify-between">
            <div className="pointer-events-auto grid grid-cols-3 gap-1.5 w-32">
              <div />
              <button
                type="button"
                onPointerDown={() => {
                  touchMoveRef.current = { dx: 0, dy: -1 };
                }}
                onPointerUp={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                onPointerLeave={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                className="h-10 rounded-lg bg-[#04120C]/85 border border-slate-700 text-xs font-bold"
              >
                ▲
              </button>
              <div />
              <button
                type="button"
                onPointerDown={() => {
                  touchMoveRef.current = { dx: -1, dy: 0 };
                }}
                onPointerUp={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                onPointerLeave={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                className="h-10 rounded-lg bg-[#04120C]/85 border border-slate-700 text-xs font-bold"
              >
                ◀
              </button>
              <button
                type="button"
                onPointerDown={() => {
                  touchMoveRef.current = { dx: 0, dy: 1 };
                }}
                onPointerUp={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                onPointerLeave={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                className="h-10 rounded-lg bg-[#04120C]/85 border border-slate-700 text-xs font-bold"
              >
                ▼
              </button>
              <button
                type="button"
                onPointerDown={() => {
                  touchMoveRef.current = { dx: 1, dy: 0 };
                }}
                onPointerUp={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                onPointerLeave={() => {
                  touchMoveRef.current = { dx: 0, dy: 0 };
                }}
                className="h-10 rounded-lg bg-[#04120C]/85 border border-slate-700 text-xs font-bold"
              >
                ▶
              </button>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onPointerDown={() => {
                  dashBufferRef.current = 0.16;
                }}
                className="h-12 px-4 rounded-xl bg-sky-600/90 text-white text-xs font-extrabold border border-sky-400"
              >
                DASH
              </button>
              <button
                type="button"
                onPointerDown={() => {
                  shootBufferRef.current = 0.16;
                }}
                className="h-12 px-5 rounded-xl bg-emerald-600/95 text-white text-xs font-extrabold border border-emerald-400"
              >
                SHOOT
              </button>
            </div>
          </div>
        )}

        {/* TITLE MENU OVERLAY (Live Animated Stadium Pitch Behind It) */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-[#04120C]/70 via-[#04120C]/55 to-[#04120C]/85">
            <div className="w-full max-w-lg bg-[#071A12]/95 border border-emerald-800/80 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onExit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{isBn ? 'DEALKORO-তে ফিরুন' : 'Back to DEALKORO'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-300 tabular-nums">
                    {isBn ? 'সেরা স্কোর' : 'BEST'}: {hud.bestScore.toLocaleString('en-US')}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                    className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-200"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bespoke SVG Game Title Lockup */}
              <div className="flex flex-col items-center text-center space-y-2">
                <svg
                  viewBox="0 0 360 88"
                  className="w-72 sm:w-80 h-auto"
                  role="img"
                  aria-label="Striker Arena"
                >
                  <defs>
                    <linearGradient id="strikerGold" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34D399" />
                      <stop offset="55%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#38BDF8" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M28 18 L52 10 L76 18 L70 54 L52 72 L34 54 Z"
                    fill="#0F5E3C"
                    stroke="#34D399"
                    strokeWidth="2.5"
                  />
                  <circle cx="52" cy="39" r="12" fill="#FFFFFF" stroke="#04120C" strokeWidth="2.5" />
                  <circle cx="52" cy="39" r="4" fill="#04120C" />
                  <text
                    x="94"
                    y="45"
                    fill="#F8FAFC"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontWeight="900"
                    fontSize="30"
                    letterSpacing="2"
                  >
                    STRIKER
                  </text>
                  <text
                    x="95"
                    y="69"
                    fill="url(#strikerGold)"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontWeight="800"
                    fontSize="16"
                    letterSpacing="6"
                  >
                    ARENA
                  </text>
                </svg>
                <p className="text-xs text-slate-300">
                  {isBn
                    ? 'ডিফেন্ডার ও গোলকিপারকে ফাঁকি দিয়ে টপ-কর্নারে গোল করুন।'
                    : 'Dash past sweeping defenders, snipe top corners, and beat the clock.'}
                </p>
              </div>

              {/* Difficulty Selector */}
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((diff) => {
                  const active = difficultyId === diff.id;
                  return (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() => setDifficultyId(diff.id)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        active
                          ? 'bg-emerald-950/80 border-emerald-400 text-white'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-extrabold">
                        {isBn ? diff.labelBn : diff.labelEn}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {isBn ? diff.descBn : diff.descEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={startNewGame}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{isBn ? 'খেলা শুরু করুন (Enter)' : 'Kick Off (Enter)'}</span>
              </button>

              <p className="text-center text-[11px] text-slate-400 tracking-wide">
                WASD / Arrows Move · Space / Click Shoot · Shift Dash · Esc Pause · M Mute
              </p>
            </div>
          </div>
        )}

        {/* PAUSED OVERLAY */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#04120C]/80">
            <div className="w-full max-w-sm bg-[#071A12] border border-slate-700 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <h2 className="text-xl font-extrabold text-white">
                {isBn ? 'খেলা বিরতিতে আছে' : 'Match Paused'}
              </h2>
              <div className="text-xs text-slate-300 tabular-nums">
                {isBn ? 'রাউন্ড' : 'Round'} {hud.round} · {isBn ? 'স্কোর' : 'Score'}:{' '}
                {hud.score.toLocaleString('en-US')}
              </div>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    clearInputs();
                    setGameState('PLAYING');
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>{isBn ? 'চালিয়ে যান (Esc)' : 'Resume Match (Esc)'}</span>
                </button>
                <button
                  type="button"
                  onClick={startNewGame}
                  className="w-full min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isBn ? 'নতুন করে শুরু করুন' : 'Restart Match'}</span>
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="w-full min-h-[42px] rounded-xl bg-transparent border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold text-xs"
                >
                  {isBn ? 'DEALKORO-তে ফিরে যান' : 'Exit to DEALKORO'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ROUND SUMMARY OVERLAY */}
        {gameState === 'ROUND_SUMMARY' && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#04120C]/80">
            <div className="w-full max-w-md bg-[#071A12] border border-emerald-700 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <div className="text-xs font-extrabold tracking-widest text-emerald-400 uppercase">
                {isBn ? `রাউন্ড ${hud.round} সম্পন্ন` : `Round ${hud.round} Cleared`}
              </div>
              <h2 className="text-2xl font-black text-white tabular-nums">
                {hud.score.toLocaleString('en-US')} PTS
              </h2>
              <div className="grid grid-cols-3 gap-2 text-xs bg-slate-900/80 border border-slate-800 rounded-xl p-3 tabular-nums">
                <div>
                  <div className="text-slate-400">{isBn ? 'গোল' : 'Goals'}</div>
                  <div className="font-extrabold text-white mt-0.5">{roundStats.goals}</div>
                </div>
                <div>
                  <div className="text-slate-400">{isBn ? 'টাইম বোনাস' : 'Time Bonus'}</div>
                  <div className="font-extrabold text-emerald-400 mt-0.5">
                    +{roundStats.timeBonus}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">{isBn ? 'স্নাইপ' : 'Top Corners'}</div>
                  <div className="font-extrabold text-amber-400 mt-0.5">
                    {roundStats.topCorners}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={advanceToNextRound}
                className="w-full min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm inline-flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>
                  {isBn
                    ? `রাউন্ড ${hud.round + 1} শুরু করুন (Enter)`
                    : `Start Round ${hud.round + 1} (Enter)`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#04120C]/85">
            <div className="w-full max-w-md bg-[#071A12] border border-red-800/80 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
              <div className="space-y-1">
                <div className="text-xs font-extrabold tracking-widest text-red-400 uppercase">
                  {isBn ? 'ম্যাচ সমাপ্ত' : 'Full Time'}
                </div>
                <h2 className="text-2xl font-black text-white">
                  {isBn ? 'গেম ওভার' : 'Match Over'}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4 tabular-nums">
                <div>
                  <div className="text-xs text-slate-400">{isBn ? 'চূড়ান্ত স্কোর' : 'Final Score'}</div>
                  <div className="text-xl font-black text-amber-300 mt-0.5">
                    {hud.score.toLocaleString('en-US')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">{isBn ? 'সেরা স্কোর' : 'Best Score'}</div>
                  <div className="text-xl font-black text-emerald-400 mt-0.5">
                    {hud.bestScore.toLocaleString('en-US')}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={startNewGame}
                  className="w-full min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isBn ? 'আবার খেলুন (Enter)' : 'Play Again (Enter)'}</span>
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold text-xs"
                >
                  {isBn ? 'DEALKORO-তে ফিরে যান' : 'Exit to DEALKORO'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
