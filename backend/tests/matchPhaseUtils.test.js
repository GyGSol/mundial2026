import { describe, expect, it } from 'vitest';
import { enrichMatchPhaseFields, resolveKnockoutPhaseFromExternalId } from '../src/services/matchPhaseUtils.js';

describe('matchPhaseUtils', () => {
  it('resuelve fase por número de partido oficial', () => {
    expect(resolveKnockoutPhaseFromExternalId('73')?.key).toBe('round_of_32');
    expect(resolveKnockoutPhaseFromExternalId('90')?.key).toBe('round_of_16');
    expect(resolveKnockoutPhaseFromExternalId('104')?.key).toBe('final');
  });

  it('marca partidos de grupos sin fase eliminatoria', () => {
    const fields = enrichMatchPhaseFields({ externalId: '12', type: 'group', group: 'A' });
    expect(fields.isKnockout).toBe(false);
    expect(fields.knockoutPhaseKey).toBeNull();
  });

  it('marca dieciseisavos por externalId aunque falte type', () => {
    const fields = enrichMatchPhaseFields({ externalId: '75', type: 'r32' });
    expect(fields.isKnockout).toBe(true);
    expect(fields.knockoutPhase).toBe('Dieciseisavos de final');
    expect(fields.knockoutPhaseKey).toBe('round_of_32');
  });

  it('prioriza externalId oficial sobre type incorrecto del sync', () => {
    const fields = enrichMatchPhaseFields({ externalId: '80', type: 'final' });
    expect(fields.isKnockout).toBe(true);
    expect(fields.knockoutPhase).toBe('Dieciseisavos de final');
    expect(fields.knockoutPhaseKey).toBe('round_of_32');
  });

  it('resuelve octavos por externalId 90', () => {
    const fields = enrichMatchPhaseFields({ externalId: '90', type: 'r32' });
    expect(fields.knockoutPhase).toBe('Octavos de final');
    expect(fields.knockoutPhaseKey).toBe('round_of_16');
  });
});
