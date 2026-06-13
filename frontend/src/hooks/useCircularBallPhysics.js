import { useEffect, useRef } from 'react';

const BALL_SIZE_RATIO = 0.44;
const SPEED_PX_PER_SEC = 195;
const RESTITUTION = 0.985;
const MAX_SUBSTEP_SEC = 1 / 120;
const SQUASH_DECAY = 9;

function randomVelocity(speed) {
  const angle = Math.random() * Math.PI * 2;
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function resolveCircleCollision(state, arenaRadius, ballRadius) {
  const maxDist = Math.max(arenaRadius - ballRadius, 1);
  const dist = Math.hypot(state.x, state.y);

  if (dist <= maxDist || dist === 0) return false;

  const nx = state.x / dist;
  const ny = state.y / dist;

  state.x = nx * maxDist;
  state.y = ny * maxDist;

  const dot = state.vx * nx + state.vy * ny;
  if (dot > 0) {
    state.vx -= (1 + RESTITUTION) * dot * nx;
    state.vy -= (1 + RESTITUTION) * dot * ny;
  }

  const speed = Math.hypot(state.vx, state.vy) || SPEED_PX_PER_SEC;
  state.vx = (state.vx / speed) * SPEED_PX_PER_SEC;
  state.vy = (state.vy / speed) * SPEED_PX_PER_SEC;

  state.squashNormalX = nx;
  state.squashNormalY = ny;
  state.squash = 1;

  return true;
}

function applyTransform(ballEl, state, ballRadius, frameDt) {
  const squash = state.squash;
  const nx = state.squashNormalX;
  const ny = state.squashNormalY;
  const impactAngle = (Math.atan2(ny, nx) * 180) / Math.PI + 90;
  const stretch = 1 + squash * 0.22;
  const compress = 1 - squash * 0.18;

  ballEl.style.transform = [
    `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px))`,
    `rotate(${state.spin}deg)`,
    squash > 0.01 ? `rotate(${impactAngle}deg) scale(${stretch}, ${compress}) rotate(${-impactAngle}deg)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  state.squash = Math.max(0, state.squash - SQUASH_DECAY * frameDt);
}

/**
 * Simula una pelota con velocidad constante rebotando elásticamente en un círculo.
 */
export function useCircularBallPhysics(arenaRef, ballRef, { enabled = true } = {}) {
  const rafRef = useRef(0);

  useEffect(() => {
    const arenaEl = arenaRef.current;
    const ballEl = ballRef.current;
    if (!arenaEl || !ballEl || !enabled) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      ballEl.style.transform = 'translate(-50%, -50%)';
      return undefined;
    }

    let arenaRadius = 0;
    let ballRadius = 0;

    const measure = () => {
      const rect = arenaEl.getBoundingClientRect();
      arenaRadius = Math.min(rect.width, rect.height) / 2;
      ballRadius = arenaRadius * (BALL_SIZE_RATIO / 2);
    };

    measure();

    const state = {
      x: arenaRadius * 0.2,
      y: -arenaRadius * 0.25,
      spin: 0,
      squash: 0,
      squashNormalX: 0,
      squashNormalY: 1,
      ...randomVelocity(SPEED_PX_PER_SEC),
    };

    let lastTime = performance.now();

    const tick = (now) => {
      measure();

      const frameDt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      let remaining = frameDt;
      while (remaining > 0) {
        const step = Math.min(remaining, MAX_SUBSTEP_SEC);
        const prevX = state.x;
        const prevY = state.y;

        state.x += state.vx * step;
        state.y += state.vy * step;
        resolveCircleCollision(state, arenaRadius, ballRadius);

        const travel = Math.hypot(state.x - prevX, state.y - prevY);
        state.spin += (travel / ballRadius) * (180 / Math.PI);

        remaining -= step;
      }

      applyTransform(ballEl, state, ballRadius, frameDt);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const observer = new ResizeObserver(measure);
    observer.observe(arenaEl);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [arenaRef, ballRef, enabled]);
}
