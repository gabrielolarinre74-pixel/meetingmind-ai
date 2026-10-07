import { formatTime, segmentsToText } from './transcript';
import type { Meeting } from './types';

export function meetingToMarkdown(m: Meeting): string {
  const a = m.analysis;
  const out = [`# ${m.title}`, '', `_${new Date(m.createdAt).toLocaleString()}_`, ''];
  if (a) {
    out.push('## Summary', '', a.summary, '');
    if (a.keyPoints.length) out.push('## Key points', '', ...a.keyPoints.map((k) => `- ${k}`), '');
    if (a.decisions.length) out.push('## Decisions', '', ...a.decisions.map((d) => `- ${d}`), '');
    if (a.actionItems.length)
      out.push('## Action items', '', ...a.actionItems.map((i) => `- [${i.done ? 'x' : ' '}] ${i.task}${i.owner ? ` — **${i.owner}**` : ''}${i.due ? ` (due ${i.due})` : ''}`), '');
    if (a.openQuestions.length) out.push('## Open questions', '', ...a.openQuestions.map((q) => `- ${q}`), '');
  }
  out.push('## Transcript', '', segmentsToText(m.segments), '');
  return out.join('\n');
}

export { formatTime };
