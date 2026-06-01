import { describe, it, expect } from 'vitest';
import {
  createCompetitionGroup,
  listCompetitionGroups,
} from '../src/services/competitionGroupService.js';

describe('competitionGroupService', () => {
  it('valida nombre obligatorio', async () => {
    await expect(createCompetitionGroup({ name: '  ' })).rejects.toMatchObject({
      message: 'El nombre del grupo es obligatorio',
    });
  });

  it('expone listCompetitionGroups como función', () => {
    expect(typeof listCompetitionGroups).toBe('function');
  });
});
