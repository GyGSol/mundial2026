import { describe, it, expect } from 'vitest';
import {
  normalizeTopicKey,
  isValidTopic,
  formatThreadResponse,
  AI_TOPIC_TYPES,
} from '../src/services/aiConsultationService.js';

describe('aiConsultationService', () => {
  describe('normalizeTopicKey', () => {
    it('normaliza grupo a mayúsculas', () => {
      expect(normalizeTopicKey('group', 'a')).toBe('A');
    });

    it('fija clave de 16avos', () => {
      expect(normalizeTopicKey('round_of_16', 'anything')).toBe('round_of_16');
    });

    it('conserva matchId', () => {
      expect(normalizeTopicKey('match', 'abc123')).toBe('abc123');
    });
  });

  describe('isValidTopic', () => {
    it('acepta tipos válidos', () => {
      expect(AI_TOPIC_TYPES).toEqual(['match', 'group', 'round_of_16']);
      expect(isValidTopic('match', '507f1f77bcf86cd799439011')).toBe(true);
      expect(isValidTopic('group', 'H')).toBe(true);
      expect(isValidTopic('round_of_16', 'round_of_16')).toBe(true);
    });

    it('rechaza grupo inválido', () => {
      expect(isValidTopic('group', 'Z')).toBe(false);
      expect(isValidTopic('unknown', 'A')).toBe(false);
    });
  });

  describe('formatThreadResponse', () => {
    it('serializa mensajes con fecha', () => {
      const createdAt = new Date('2026-06-10T12:00:00.000Z');
      const formatted = formatThreadResponse({
        _id: 'thread1',
        topicType: 'group',
        topicKey: 'A',
        title: 'Grupo A',
        initialInsight: null,
        messages: [
          {
            _id: 'm1',
            role: 'user',
            content: '¿Quién pasa?',
            createdAt,
          },
        ],
        updatedAt: createdAt,
        createdAt,
      });

      expect(formatted.title).toBe('Grupo A');
      expect(formatted.messages[0]).toMatchObject({
        role: 'user',
        content: '¿Quién pasa?',
        createdAt,
      });
    });
  });
});
