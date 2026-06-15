import { describe, it, expect } from 'vitest';
import { resolvePredictionRemapAction } from '../src/services/predictionMatchLinkService.js';

describe('resolvePredictionRemapAction', () => {
  it('mueve cuando no hay predicción en destino', () => {
    expect(
      resolvePredictionRemapAction({
        sourceValuable: true,
        destValuable: false,
        destExists: false,
      })
    ).toBe('move');
  });

  it('fusiona y borra origen cuando destino es 0-0 automático', () => {
    expect(
      resolvePredictionRemapAction({
        sourceValuable: true,
        destValuable: false,
        destExists: true,
      })
    ).toBe('merge_and_delete_source');
  });

  it('borra origen cuando no es valiosa', () => {
    expect(
      resolvePredictionRemapAction({
        sourceValuable: false,
        destValuable: true,
        destExists: true,
      })
    ).toBe('delete_source');
  });

  it('marca conflicto cuando origen y destino son valiosas', () => {
    expect(
      resolvePredictionRemapAction({
        sourceValuable: true,
        destValuable: true,
        destExists: true,
      })
    ).toBe('conflict');
  });
});
