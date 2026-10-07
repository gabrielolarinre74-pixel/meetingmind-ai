import toast from 'react-hot-toast';
import { analyzeOffline } from './analyze';
import { analyzeWithAI, validateAi } from './ai';
import { getSettings, newId, upsertMeeting } from './store';
import { estimateDuration } from './transcript';
import type { Analysis, Meeting, MeetingSource, Segment } from './types';

/** Analyse with the selected engine. Falls back to the offline engine if the AI call fails. */
export async function runAnalysis(segments: Segment[]): Promise<Analysis> {
  const s = getSettings();
  if (s.engine === 'ai' && !validateAi(s)) {
    try {
      return await analyzeWithAI(segments, s);
    } catch (e) {
      toast.error(`${(e as Error).message} Used the offline engine instead.`);
    }
  }
  return analyzeOffline(segments, { senderName: s.yourName || 'Me' });
}

export async function createMeeting(segments: Segment[], source: MeetingSource, opts: { title?: string; durationSec?: number } = {}): Promise<Meeting> {
  const analysis = await runAnalysis(segments);
  const meeting: Meeting = {
    id: newId(),
    title: opts.title?.trim() || analysis.title,
    createdAt: Date.now(),
    durationSec: opts.durationSec || estimateDuration(segments),
    source,
    segments,
    analysis,
  };
  upsertMeeting(meeting);
  return meeting;
}
