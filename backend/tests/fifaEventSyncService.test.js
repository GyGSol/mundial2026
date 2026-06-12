import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIFA_REPORT_STATS_VERSION } from '../src/services/fifaReportPdfService.js';

vi.mock('../src/services/fifaReportPdfService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchFifaReportStats: vi.fn(),
  };
});

import { fetchFifaReportStats } from '../src/services/fifaReportPdfService.js';
import {
  needsFifaReportRefresh,
  syncFifaReportForFinishedMatch,
} from '../src/services/fifaEventSyncService.js';

describe('needsFifaReportRefresh', () => {
  it('requiere refresh si no hay reporte', () => {
    expect(needsFifaReportRefresh({ raw: {} })).toBe(true);
  });

  it('requiere refresh si statsVersion está desactualizada', () => {
    expect(
      needsFifaReportRefresh({
        raw: { fifaReportStats: { statsVersion: FIFA_REPORT_STATS_VERSION - 1 } },
      })
    ).toBe(true);
  });

  it('no requiere refresh con statsVersion actual', () => {
    expect(
      needsFifaReportRefresh({
        raw: { fifaReportStats: { statsVersion: FIFA_REPORT_STATS_VERSION } },
      })
    ).toBe(false);
  });
});

describe('syncFifaReportForFinishedMatch', () => {
  const homeTeam = { nameEn: 'South Korea', fifaCode: 'KOR' };
  const awayTeam = { nameEn: 'Czech Republic', fifaCode: 'CZE' };

  beforeEach(() => {
    vi.mocked(fetchFifaReportStats).mockReset();
  });

  it('no intenta fetch en partidos en vivo', async () => {
    const result = await syncFifaReportForFinishedMatch(
      { status: 'live', externalId: '2', raw: {} },
      homeTeam,
      awayTeam
    );

    expect(result).toBeNull();
    expect(fetchFifaReportStats).not.toHaveBeenCalled();
  });

  it('intenta fetch en partidos finalizados aunque no haya fifaEntry ni timeline', async () => {
    const report = {
      home: { possession: 55 },
      away: { possession: 45 },
      statsVersion: FIFA_REPORT_STATS_VERSION,
    };
    vi.mocked(fetchFifaReportStats).mockResolvedValue(report);

    const result = await syncFifaReportForFinishedMatch(
      { status: 'finished', externalId: '2', raw: {} },
      homeTeam,
      awayTeam,
      null
    );

    expect(fetchFifaReportStats).toHaveBeenCalledWith(
      expect.objectContaining({
        matchNumber: 2,
        homeFifaCode: 'KOR',
        awayFifaCode: 'CZE',
      })
    );
    expect(result).toEqual(report);
  });

  it('no reintenta si ya hay reporte con versión actual', async () => {
    const result = await syncFifaReportForFinishedMatch(
      {
        status: 'finished',
        externalId: '2',
        raw: { fifaReportStats: { statsVersion: FIFA_REPORT_STATS_VERSION } },
      },
      homeTeam,
      awayTeam
    );

    expect(result).toBeNull();
    expect(fetchFifaReportStats).not.toHaveBeenCalled();
  });
});
