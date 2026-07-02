import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { buildFubolsCupQualificationEmailContent } from '../src/services/emailService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';
import { User } from '../src/models/User.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { FubolsCupTournament } from '../src/models/FubolsCupTournament.js';
import { listFubolsCupQualificationRecipients } from '../src/services/fubolsCupQualificationEmailService.js';

const mongoUri = getTestMongoUri();

describe('fubolsCupQualificationEmail', () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('buildFubolsCupQualificationEmailContent incluye titular grande y link', () => {
    const { subject, text, html } = buildFubolsCupQualificationEmailContent({
      name: 'Ana',
      groupName: 'Family Pro',
      cupUrl: 'https://app.test/mundial?tab=fubols-cup&groupId=abc',
    });

    expect(subject).toMatch(/clasificado/i);
    expect(text).toContain('Estás clasificado a la Copa Fubols');
    expect(html).toContain('Estás clasificado');
    expect(html).toContain('Family Pro');
    expect(html).toContain('https://app.test/mundial?tab=fubols-cup&amp;groupId=abc');
  });

  it('listFubolsCupQualificationRecipients omite usuarios que ya recibieron mail', async () => {
    const suffix = Date.now();
    const group = await CompetitionGroup.create({ name: `Cup mail test ${suffix}` });
    const qualified = await User.create({
      name: 'Clasificado',
      email: `cup-qualified-${suffix}@test.com`,
      passwordHash: 'hash',
      activeCompetitionGroupId: group._id,
    });
    await User.create({
      name: 'Ya avisado',
      email: `cup-sent-${suffix}@test.com`,
      passwordHash: 'hash',
      activeCompetitionGroupId: group._id,
      fubolsCupQualificationEmailSentAt: new Date(),
    });

    await FubolsCupTournament.create({
      groupId: group._id,
      status: 'running',
      seeds: [
        { userId: qualified._id, seedRank: 1, tournamentPointsAtSeed: 100 },
        { userId: new mongoose.Types.ObjectId(), seedRank: 2, tournamentPointsAtSeed: 90 },
        { userId: new mongoose.Types.ObjectId(), seedRank: 3, tournamentPointsAtSeed: 80 },
        { userId: new mongoose.Types.ObjectId(), seedRank: 4, tournamentPointsAtSeed: 70 },
        { userId: new mongoose.Types.ObjectId(), seedRank: 5, tournamentPointsAtSeed: 60 },
        { userId: new mongoose.Types.ObjectId(), seedRank: 6, tournamentPointsAtSeed: 50 },
        { userId: new mongoose.Types.ObjectId(), seedRank: 7, tournamentPointsAtSeed: 40 },
        { userId: new mongoose.Types.ObjectId(), seedRank: 8, tournamentPointsAtSeed: 30 },
      ],
      rounds: [],
    });

    const recipients = await listFubolsCupQualificationRecipients();
    const emails = recipients.map((r) => r.email);

    expect(emails).toContain(`cup-qualified-${suffix}@test.com`);
    expect(emails).not.toContain(`cup-sent-${suffix}@test.com`);

    await FubolsCupTournament.deleteMany({ groupId: group._id });
    await User.deleteMany({ email: { $regex: `cup-.*-${suffix}@test.com` } });
    await CompetitionGroup.deleteOne({ _id: group._id });
  });
});
