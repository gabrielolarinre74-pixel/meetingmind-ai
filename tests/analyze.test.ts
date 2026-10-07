import { describe, expect, it } from 'vitest';
import { analyzeOffline, extractActionItems, extractDecisions, findDue, toSentences } from '@/lib/analyze';
import { safeJson, validateAi, DEFAULT_AI, AnalysisSchema } from '@/lib/ai';
import { parseTranscript } from '@/lib/transcript';
import { SAMPLE_TRANSCRIPTS } from '@/lib/samples';

const kickoff = analyzeOffline(parseTranscript(SAMPLE_TRANSCRIPTS[0].text), { senderName: 'Maya' });

describe('offline analyzer', () => {
  it('finds decisions', () => {
    expect(kickoff.decisions.join(' ')).toMatch(/single booking page/);
    expect(kickoff.decisions.join(' ')).toMatch(/Stripe/);
  });

  it('extracts action items with owners and due dates', () => {
    const mockups = kickoff.actionItems.find((a) => /mockups/i.test(a.task));
    expect(mockups).toMatchObject({ owner: 'Priya', due: 'Friday' });
    const timeline = kickoff.actionItems.find((a) => /timeline/i.test(a.task));
    expect(timeline).toMatchObject({ owner: 'Maya', due: 'Tomorrow' });
    // the request and the confirmation are merged into one task
    expect(kickoff.actionItems.filter((a) => /send .*mockups/i.test(a.task) && a.owner === 'Priya')).toHaveLength(1);
  });

  it('lists open questions but not requests', () => {
    expect(kickoff.openQuestions.some((q) => /launch/.test(q))).toBe(true);
    expect(kickoff.openQuestions.some((q) => /can you/i.test(q))).toBe(false);
  });

  it('writes a recap email', () => {
    expect(kickoff.followUpEmail).toMatch(/^Subject: Recap:/);
    expect(kickoff.followUpEmail).toMatch(/Next steps:/);
    expect(kickoff.followUpEmail.trim().endsWith('Maya')).toBe(true);
  });

  it('does not use speaker names as topics', () => {
    expect(kickoff.topics.map((t) => t.toLowerCase())).not.toContain('maya');
  });

  it('handles empty input', () => {
    const a = analyzeOffline([]);
    expect(a.actionItems).toEqual([]);
    expect(a.title).toBe('Voice note');
  });
});

describe('rules', () => {
  it('detects due dates', () => {
    expect(findDue('send it by next Friday please')).toBe('Next Friday');
    expect(findDue('done by EOD')).toBe('End of day');
    expect(findDue('ship on 3rd of March')).toBe('3rd of March');
    expect(findDue('no date here')).toBeUndefined();
  });

  it('assigns owners from "Name, can you..." and self-commitments', () => {
    const items = extractActionItems(
      toSentences([
        { speaker: 'Ana', text: 'Ben, can you update the pricing page by Monday?' },
        { speaker: 'Ben', text: "Sure. I'll also email the client." },
      ]),
      ['Ana', 'Ben'],
    );
    expect(items).toEqual([
      expect.objectContaining({ task: 'Update the pricing page', owner: 'Ben', due: 'Monday' }),
      expect.objectContaining({ task: 'Also email the client', owner: 'Ben' }),
    ]);
  });

  it('does not treat questions as decisions', () => {
    expect(extractDecisions(toSentences([{ text: 'Have we decided on the logo?' }]))).toEqual([]);
  });
});

describe('AI helpers', () => {
  it('parses fenced JSON', () => {
    expect(safeJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(safeJson('Here you go: {"a":2} thanks')).toEqual({ a: 2 });
    expect(safeJson('nope')).toBeNull();
  });
  it('validates AI output', () => {
    const ok = AnalysisSchema.safeParse({ title: 'T', summary: 'S', actionItems: [{ task: 'Do it', owner: null }], sentiment: 'weird' });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.sentiment).toBe('neutral');
    expect(AnalysisSchema.safeParse({ title: '', summary: 'S' }).success).toBe(false);
  });
  it('validates settings', () => {
    expect(validateAi(DEFAULT_AI)).toBeNull();
    expect(validateAi({ ...DEFAULT_AI, engine: 'ai' })).toMatch(/API key/);
    expect(validateAi({ ...DEFAULT_AI, engine: 'ai', apiKey: 'k', baseUrl: 'http://x.com' })).toMatch(/https/);
  });
});
