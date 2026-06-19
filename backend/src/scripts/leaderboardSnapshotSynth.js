import { goalDiffScore } from '../services/goalDiffStats.js';

function pointsFromBreakdown(breakdown, bonusPoint = 0) {
  return (
    (breakdown.winner ?? 0) +
    (breakdown.homeGoals ?? 0) +
    (breakdown.awayGoals ?? 0) +
    (breakdown.totalGoals ?? 0) +
    (bonusPoint ?? 0)
  );
}

/**
 * Construye breakdowns por partido que reproducen PA/GL/GV/GT/PB/Pts agregados.
 * Las predicciones resultantes son marcadores 0-0 con puntos asignados directamente.
 */
export function buildSnapshotBreakdowns({ pj, pa, gl, gv, gt, pb, pts }) {
  const slots = Array.from({ length: pj }, () => ({
    winner: 0,
    homeGoals: 0,
    awayGoals: 0,
    totalGoals: 0,
    bonusPoint: 0,
  }));

  for (let i = 0; i < pa && i < pj; i++) slots[i].winner = 3;
  for (let i = 0; i < gl && i < pj; i++) slots[i].homeGoals = 1;
  for (let i = 0; i < gv && i < pj; i++) slots[i].awayGoals = 1;
  for (let i = 0; i < gt && i < pj; i++) slots[i].totalGoals = 1;
  for (let i = pj - pb; i < pj && pb > 0; i++) slots[i].bonusPoint = 1;

  let current = slots.reduce((sum, s) => sum + pointsFromBreakdown(s, s.bonusPoint), 0);
  let guard = 0;

  while (current < pts && guard < pj * 8) {
    const idx = guard % pj;
    const slot = slots[idx];
    if (slot.totalGoals === 0) {
      slot.totalGoals = 1;
      current += 1;
    } else if (slot.awayGoals === 0) {
      slot.awayGoals = 1;
      current += 1;
    } else if (slot.homeGoals === 0) {
      slot.homeGoals = 1;
      current += 1;
    } else if (slot.winner === 0) {
      slot.winner = 3;
      current += 3;
    }
    guard += 1;
  }

  while (current > pts && guard < pj * 12) {
    const idx = pj - 1 - (guard % pj);
    const slot = slots[idx];
    if (slot.bonusPoint > 0) {
      slot.bonusPoint = 0;
      current -= 1;
    } else if (slot.totalGoals > 0) {
      slot.totalGoals = 0;
      current -= 1;
    } else if (slot.awayGoals > 0) {
      slot.awayGoals = 0;
      current -= 1;
    } else if (slot.homeGoals > 0) {
      slot.homeGoals = 0;
      current -= 1;
    } else if (slot.winner > 0) {
      slot.winner = 0;
      current -= 3;
    }
    guard += 1;
  }

  return slots;
}

/** Reparte difGl/difGv enteros para aproximar el Gdif mostrado en la tabla. */
export function distributeGoalDiffs(breakdowns, targetGdif) {
  const pj = breakdowns.length;
  if (pj <= 0) return breakdowns.map(() => ({ goalDiffHome: 0, goalDiffAway: 0 }));

  const target = targetGdif ?? 0;
  let best = null;

  for (const ratio of [1, 0.85, 1.15, 0.7, 1.3]) {
    const product = Math.max(1, Math.round(target * 4 * pj * pj * ratio));
    const side = Math.max(1, Math.round(Math.sqrt(product)));
    const difGl = side;
    const difGv = Math.max(1, Math.round(product / side));
    const err = Math.abs(goalDiffScore(difGl, difGv, pj) - target);
    if (!best || err < best.err) best = { difGl, difGv, err };
  }

  const diffs = breakdowns.map(() => ({ goalDiffHome: 0, goalDiffAway: 0 }));
  let remGl = best.difGl;
  let remGv = best.difGv;

  for (let i = 0; i < pj; i++) {
    const glShare = Math.ceil(remGl / (pj - i));
    const gvShare = Math.ceil(remGv / (pj - i));
    diffs[i].goalDiffHome = glShare;
    diffs[i].goalDiffAway = gvShare;
    remGl -= glShare;
    remGv -= gvShare;
  }

  return diffs;
}

export function aggregateFromBreakdowns(breakdowns, goalDiffs = []) {
  const stats = { pj: breakdowns.length, pa: 0, gl: 0, gv: 0, gt: 0, pb: 0, totalPoints: 0, difGl: 0, difGv: 0 };
  breakdowns.forEach((slot, index) => {
    if (slot.winner > 0) stats.pa += 1;
    if (slot.homeGoals > 0) stats.gl += 1;
    if (slot.awayGoals > 0) stats.gv += 1;
    if (slot.totalGoals > 0) stats.gt += 1;
    stats.pb += slot.bonusPoint ?? 0;
    stats.totalPoints += pointsFromBreakdown(slot, slot.bonusPoint);
    stats.difGl += goalDiffs[index]?.goalDiffHome ?? slot.goalDiffHome ?? 0;
    stats.difGv += goalDiffs[index]?.goalDiffAway ?? slot.goalDiffAway ?? 0;
  });
  return stats;
}

export function buildRecoveredPredictionDocs(userId, matchIds, snapshot, { predictionSource = 'admin' } = {}) {
  const breakdowns = buildSnapshotBreakdowns(snapshot);
  const goalDiffs = distributeGoalDiffs(breakdowns, snapshot.gdif);

  return matchIds.map((matchId, index) => {
    const slot = breakdowns[index];
    const gd = goalDiffs[index];
    const pointsEarned =
      (slot.winner ?? 0) + (slot.homeGoals ?? 0) + (slot.awayGoals ?? 0) + (slot.totalGoals ?? 0);

    return {
      userId,
      matchId,
      homeGoals: 0,
      awayGoals: 0,
      userSubmitted: true,
      pointsEarned,
      bonusPoint: slot.bonusPoint ?? 0,
      bonusReason: slot.bonusPoint ? 'recovered_snapshot' : null,
      pointsBreakdown: {
        winner: slot.winner ?? 0,
        homeGoals: slot.homeGoals ?? 0,
        awayGoals: slot.awayGoals ?? 0,
        totalGoals: slot.totalGoals ?? 0,
      },
      goalDiffHome: gd.goalDiffHome,
      goalDiffAway: gd.goalDiffAway,
      predictionSource,
      createdAt: new Date('2026-06-19T12:00:00.000Z'),
      updatedAt: new Date(),
    };
  });
}
