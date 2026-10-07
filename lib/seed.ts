import { analyzeOffline } from './analyze';
import { SAMPLE_TRANSCRIPTS } from './samples';
import { estimateDuration, parseTranscript } from './transcript';
import type { Meeting } from './types';

export function sampleMeetings(now = Date.now()): Meeting[] {
  return SAMPLE_TRANSCRIPTS.map((s, i) => {
    const segments = parseTranscript(s.text);
    const analysis = analyzeOffline(segments, { senderName: 'Me' });
    return {
      id: `sample-${i + 1}`,
      title: s.title,
      createdAt: now - (2 + i * 14) * 3600 * 1000,
      durationSec: estimateDuration(segments),
      source: 'sample',
      segments,
      analysis: { ...analysis, title: s.title },
      tags: ['sample'],
    };
  });
}
