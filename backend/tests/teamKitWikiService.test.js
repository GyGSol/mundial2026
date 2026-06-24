import { describe, it, expect } from 'vitest';
import {
  parseHomeKitFromFileList,
  parseFootballKitTemplateFromWikitext,
  FIFA_TO_WIKI_TEAM_PAGE,
} from '../src/services/teamKitWikiService.js';

describe('teamKitWikiService', () => {
  it('FIFA_TO_WIKI_TEAM_PAGE incluye las 48 selecciones', () => {
    expect(Object.keys(FIFA_TO_WIKI_TEAM_PAGE).length).toBe(48);
    expect(FIFA_TO_WIKI_TEAM_PAGE.MAR).toBe('Morocco national football team');
  });

  it('parseHomeKitFromFileList elige kit local y empareja piezas', () => {
    const files = [
      { title: 'File:Kit body mrc26a.png', url: 'https://example.com/body-a.png' },
      { title: 'File:Kit body mrc26h.png', url: 'https://example.com/body-h.png' },
      { title: 'File:Kit left arm mrc26h.png', url: 'https://example.com/la-h.png' },
      { title: 'File:Kit right arm mrc26h.png', url: 'https://example.com/ra-h.png' },
      { title: 'File:Kit shorts mrc26h2.png', url: 'https://example.com/shorts-h.png' },
    ];

    const parsed = parseHomeKitFromFileList(files);
    expect(parsed?.token).toBe('mrc26h');
    expect(parsed?.parts.body).toBe('https://example.com/body-h.png');
    expect(parsed?.parts.leftArm).toBe('https://example.com/la-h.png');
    expect(parsed?.parts.rightArm).toBe('https://example.com/ra-h.png');
    expect(parsed?.parts.shorts).toBe('https://example.com/shorts-h.png');
  });

  it('parseHomeKitFromFileList tolera sufijo H mayúscula', () => {
    const files = [{ title: 'File:Kit body eng26H.png', url: 'https://example.com/eng.png' }];
    const parsed = parseHomeKitFromFileList(files);
    expect(parsed?.token).toBe('eng26H');
    expect(parsed?.parts.body).toBe('https://example.com/eng.png');
  });

  it('parseHomeKitFromFileList retorna null sin body local', () => {
    const files = [
      { title: 'File:Kit body arg26a.png', url: 'https://example.com/away.png' },
      { title: 'File:Flag of Argentina.svg', url: 'https://example.com/flag.svg' },
    ];
    expect(parseHomeKitFromFileList(files)).toBeNull();
  });

  it('parseFootballKitTemplateFromWikitext extrae pattern_b del template', () => {
    const wikitext = `
Some intro
{{Football kit
| pattern_b = Kit body esp24h.png
| pattern_la = Kit left arm esp24h.png
| pattern_ra = Kit right arm esp24h.png
| shorts = Kit shorts esp24h.png
}}
More text
`;
    const parsed = parseFootballKitTemplateFromWikitext(wikitext);
    expect(parsed?.bodyFile).toBe('Kit body esp24h.png');
    expect(parsed?.leftArmFile).toBe('Kit left arm esp24h.png');
    expect(parsed?.rightArmFile).toBe('Kit right arm esp24h.png');
    expect(parsed?.shortsFile).toBe('Kit shorts esp24h.png');
  });
});
