import { resolveStadiumTimezone } from './stadiumTimezones.js';

export function formatStadiumForClient(stadium) {
  if (!stadium) return null;

  const raw = stadium.raw && typeof stadium.raw === 'object' ? stadium.raw : {};
  const timezone =
    stadium.timezone || resolveStadiumTimezone(stadium) || null;

  return {
    externalId: stadium.externalId,
    nameEn: stadium.nameEn || null,
    nameFa: stadium.nameFa || null,
    fifaName: raw.fifa_name ?? raw.fifaName ?? raw.name_fifa ?? null,
    city: stadium.city || null,
    country: stadium.country || null,
    timezone,
    capacity: stadium.capacity > 0 ? stadium.capacity : null,
  };
}
