import { describe, expect, it } from 'vitest';
import { hydrateSubstitutions } from './substitutionPhotos.js';

describe('substitutionPhotos', () => {
  it('hydrateSubstitutions toma fotos de cronología y alineación inicial', () => {
    const lineupHome = {
      players: [
        {
          name: 'Joshua Kimmich',
          shirtNumber: 6,
          photoUrl: '/player-photos/ger/joshua-kimmich.png',
        },
      ],
    };

    const timeline = [
      {
        type: 'substitution',
        side: 'home',
        minute: 70,
        playerOut: 'Joshua Kimmich',
        playerOutShirtNumber: 6,
        playerIn: 'Leroy Sané',
        playerInShirtNumber: 19,
        playerInPhotoUrl: '/player-photos/ger/leroy-sane.png',
      },
    ];

    const [sub] = hydrateSubstitutions(
      [
        {
          minute: 70,
          playerOut: 'Kimmich',
          playerIn: 'Sané',
          playerOutShirtNumber: 6,
          playerInShirtNumber: 19,
        },
      ],
      timeline,
      lineupHome,
      'home'
    );

    expect(sub.playerOutPhotoUrl).toContain('kimmich');
    expect(sub.playerInPhotoUrl).toContain('sane');
  });
});
