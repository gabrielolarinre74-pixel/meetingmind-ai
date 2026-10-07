import { describe, expect, it } from 'vitest';
import { meetingHealth } from '@/lib/health';
import type { Meeting } from '@/lib/types';

describe('meeting health', () => {
  const base: Meeting = {
    id: 'm', title: 'T', createdAt: 0, source: 'paste',
    segments: [{ speaker: 'Maya', text: 'a b c d e f g h' }, { speaker: 'Leo', text: 'a b c d e f' }, { speaker: 'Sara', text: 'a b c d e' }],
    analysis: {
      title: 'T', summary: '', keyPoints: [], topics: [], sentiment: 'neutral', followUpEmail: '', engine: 'demo', generatedAt: 0,
      decisions: ['Launch on the 15th'],
      actionItems: [{ id: '1', task: 'Draft plan', owner: 'Maya', due: 'Friday', done: false }],
      openQuestions: [],
    },
  };

  it('scores a well-run meeting as great', () => {
    const h = meetingHealth(base)!;
    expect(h.score).toBe(100);
    expect(h.grade).toBe('Great');
  });

  it('flags missing owners, dates, decisions and a dominant speaker', () => {
    const h = meetingHealth({
      ...base,
      segments: [{ speaker: 'Maya', text: 'word '.repeat(90) }, { speaker: 'Leo', text: 'ok' }, { speaker: 'Sara', text: 'sure' }],
      analysis: { ...base.analysis!, decisions: [], actionItems: [{ id: '1', task: 'Do it', done: false }], openQuestions: ['a', 'b', 'c', 'd'] },
    })!;
    expect(h.checks.filter((c) => !c.ok).map((c) => c.id).sort()).toEqual(['balance', 'dates', 'decisions', 'owners', 'questions']);
    expect(h.grade).toBe('Needs work');
  });
});
