import type { Segment } from './types';

const TIME = /(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?/;

export function parseTime(t: string): number {
  const parts = t.replace(',', '.').split(':').map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function formatTime(sec?: number): string {
  if (sec === undefined || Number.isNaN(sec)) return '';
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}

/** WebVTT and SRT subtitles (Zoom, Teams, Google Meet and YouTube exports). */
function parseCaptions(raw: string): Segment[] {
  const blocks = raw.replace(/\r/g, '').split(/\n\s*\n/);
  const out: Segment[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;
    const start = lines[timeIdx].split('-->')[0].trim();
    let text = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    let speaker: string | undefined;
    const v = lines.slice(timeIdx + 1).join(' ').match(/<v\s+([^>]+)>/);
    if (v) speaker = v[1].trim();
    const named = text.match(/^([A-Z][\w.'-]*(?: [A-Z][\w.'-]*){0,2}):\s+(.*)$/);
    if (!speaker && named) {
      speaker = named[1];
      text = named[2];
    }
    const prev = out[out.length - 1];
    // merge consecutive captions from the same speaker
    if (prev && prev.speaker === speaker && prev.text.length < 400) prev.text = `${prev.text} ${text}`;
    else out.push({ speaker, time: parseTime(start), text });
  }
  return out;
}

/**
 * Turn any transcript text into segments. Supports:
 *  - WebVTT / SRT files
 *  - "Name: text" lines, optionally prefixed with [00:01:23] or (1:23)
 *  - plain paragraphs (no speakers)
 */
export function parseTranscript(raw: string): Segment[] {
  const text = raw.trim();
  if (!text) return [];
  if (/^WEBVTT/.test(text) || /\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->/.test(text)) return parseCaptions(text);

  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const re = new RegExp(`^[\\[(]?(${TIME.source})?[\\])]?\\s*(?:-\\s*)?([A-Z][\\w.'-]*(?: [A-Z][\\w.'-]*){0,2})?:\\s*(.+)$`);
  const out: Segment[] = [];
  let speakerLines = 0;
  for (const line of lines) {
    const m = line.match(re);
    // m[1] = timestamp, m[2] = speaker, m[3] = text
    if (m && m[3] && (m[2] || m[1])) {
      speakerLines++;
      out.push({ speaker: m[2], time: m[1] ? parseTime(m[1]) : undefined, text: m[3].trim() });
    } else if (out.length && speakerLines) {
      out[out.length - 1].text += ` ${line}`;
    } else {
      out.push({ text: line });
    }
  }
  return out;
}

export function segmentsToText(segments: Segment[]): string {
  return segments
    .map((s) => `${s.time !== undefined ? `[${formatTime(s.time)}] ` : ''}${s.speaker ? `${s.speaker}: ` : ''}${s.text}`)
    .join('\n');
}

export interface SpeakerStat {
  speaker: string;
  words: number;
  share: number;
  turns: number;
}

export function speakerStats(segments: Segment[]): SpeakerStat[] {
  const map = new Map<string, { words: number; turns: number }>();
  let total = 0;
  for (const s of segments) {
    if (!s.speaker) continue;
    const words = s.text.split(/\s+/).filter(Boolean).length;
    total += words;
    const cur = map.get(s.speaker) || { words: 0, turns: 0 };
    cur.words += words;
    cur.turns += 1;
    map.set(s.speaker, cur);
  }
  return [...map.entries()]
    .map(([speaker, v]) => ({ speaker, ...v, share: total ? v.words / total : 0 }))
    .sort((a, b) => b.words - a.words);
}

export function wordCount(segments: Segment[]): number {
  return segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
}

/** ~150 spoken words per minute when no timestamps exist */
export function estimateDuration(segments: Segment[]): number {
  const last = [...segments].reverse().find((s) => s.time !== undefined);
  if (last?.time) return last.time + 15;
  return Math.round((wordCount(segments) / 150) * 60);
}
