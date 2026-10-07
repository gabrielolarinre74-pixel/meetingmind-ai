import { describe, expect, it } from 'vitest';
import { estimateDuration, formatTime, parseTime, parseTranscript, speakerStats } from '@/lib/transcript';

describe('parseTranscript', () => {
  it('parses "Name: text" lines with timestamps', () => {
    const s = parseTranscript('[00:05] Maya: Hello there.\n[01:10] Daniel: Hi Maya.\nStill Daniel speaking.');
    expect(s).toEqual([
      { speaker: 'Maya', time: 5, text: 'Hello there.' },
      { speaker: 'Daniel', time: 70, text: 'Hi Maya. Still Daniel speaking.' },
    ]);
  });

  it('parses WebVTT with voice tags and merges same-speaker cues', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
<v Ana Lopez>Welcome everyone.</v>

00:00:03.500 --> 00:00:05.000
<v Ana Lopez>Let's start.</v>

00:00:06.000 --> 00:00:08.000
<v Ben>Thanks Ana.</v>`;
    const s = parseTranscript(vtt);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ speaker: 'Ana Lopez', time: 1, text: "Welcome everyone. Let's start." });
    expect(s[1].speaker).toBe('Ben');
  });

  it('parses SRT with "Name:" prefixes', () => {
    const srt = `1\n00:00:01,000 --> 00:00:02,000\nTom: First point.\n\n2\n00:01:00,000 --> 00:01:02,000\nJo: Second point.`;
    const s = parseTranscript(srt);
    expect(s.map((x) => x.speaker)).toEqual(['Tom', 'Jo']);
    expect(s[1].time).toBe(60);
  });

  it('keeps plain notes as paragraphs', () => {
    expect(parseTranscript('Just a note.\nAnother line.')).toEqual([{ text: 'Just a note.' }, { text: 'Another line.' }]);
  });
});

describe('helpers', () => {
  it('formats and parses times', () => {
    expect(parseTime('01:02:03')).toBe(3723);
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3723)).toBe('1:02:03');
  });
  it('computes speaker share', () => {
    const st = speakerStats([{ speaker: 'A', text: 'one two three' }, { speaker: 'B', text: 'one' }]);
    expect(st[0]).toMatchObject({ speaker: 'A', words: 3, share: 0.75 });
  });
  it('estimates duration from words when there are no timestamps', () => {
    expect(estimateDuration([{ text: Array(300).fill('word').join(' ') }])).toBe(120);
  });
});
