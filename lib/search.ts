import type { Meeting } from './types';

/** Ranked keyword search across titles, summaries, action items and transcripts. */
export function searchMeetings(meetings: Meeting[], query: string): { meeting: Meeting; snippet?: string }[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return meetings.map((meeting) => ({ meeting }));
  const results: { meeting: Meeting; score: number; snippet?: string }[] = [];
  for (const m of meetings) {
    const title = m.title.toLowerCase();
    const summary = (m.analysis?.summary || '').toLowerCase();
    const actions = (m.analysis?.actionItems || []).map((a) => a.task).join(' ').toLowerCase();
    const transcript = m.segments.map((s) => s.text).join(' ');
    const lower = transcript.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 5;
      if (summary.includes(t)) score += 3;
      if (actions.includes(t)) score += 3;
      score += Math.min(5, lower.split(t).length - 1);
    }
    if (!score) continue;
    const hit = lower.indexOf(terms[0]);
    const snippet = hit >= 0 ? `…${transcript.slice(Math.max(0, hit - 60), hit + 100).trim()}…` : undefined;
    results.push({ meeting: m, score, snippet });
  }
  return results.sort((a, b) => b.score - a.score);
}
