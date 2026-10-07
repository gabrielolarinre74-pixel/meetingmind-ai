import type { ActionItem, Analysis, Segment } from './types';
import { estimateDuration, speakerStats } from './transcript';

// ---------------------------------------------------------------------------
// Offline meeting analyzer ("demo engine").
// Pure TypeScript, no network: finds decisions, action items (with owner and
// due date), open questions, topics and key points, then writes a recap email.
// ---------------------------------------------------------------------------

const STOP = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both
but by can could did do does doing down during each few for from further had has have having he her here hers herself
him himself his how i if in into is it its itself just let lets me more most my myself no nor not now of off on once
only or other our ours ourselves out over own same she should so some such than that thats the their theirs them
themselves then there these they this those through to too under until up very was we were what when where which while
who whom why will with would you your yours yourself yourselves yeah yes okay ok right like um uh know think going
get got really actually maybe well thing things lot gonna wanna sure great good one two also need needs want make
sounds sound im ive youre were well ill dont didnt cant wont thats lets just kind sort mean stuff much many way still
first second three four five six seven eight nine ten twelve monday tuesday wednesday thursday friday saturday sunday month quarter today tomorrow week next last time call meeting everyone guys hi hello thanks thank bye morning afternoon`.split(/\s+/),
);

export interface Sentence {
  text: string;
  speaker?: string;
  index: number;
}

export function toSentences(segments: Segment[]): Sentence[] {
  const out: Sentence[] = [];
  for (const seg of segments) {
    const parts = seg.text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
    for (const p of parts) out.push({ text: p, speaker: seg.speaker, index: out.length });
  }
  return out;
}

function words(text: string): string[] {
  return (text.toLowerCase().replace(/[’']/g, '').match(/[a-z][a-z0-9-]+/g) || []).filter((w) => !STOP.has(w) && w.length > 2);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
// verbs that make poor topic phrases when they start a bigram ("send pricing")
const VERBS = new Set('simple send offer make take check review follow prepare share set draft collect pick use create update add ask book call email write record'.split(' '));

/** Most characteristic phrases: frequent bigrams first, then unigrams. */
export function extractTopics(sentences: Sentence[], max = 5, exclude: string[] = []): string[] {
  const ex = new Set(exclude.flatMap((e) => e.toLowerCase().split(/\s+/)));
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  for (const s of sentences) {
    const w = words(s.text).filter((x) => !ex.has(x));
    w.forEach((x, i) => {
      uni.set(x, (uni.get(x) || 0) + 1);
      if (i < w.length - 1) {
        const pair = `${x} ${w[i + 1]}`;
        bi.set(pair, (bi.get(pair) || 0) + 1);
      }
    });
  }
  const topics: string[] = [];
  const used = new Set<string>();
  for (const [pair, n] of [...bi.entries()].sort((a, b) => b[1] - a[1])) {
    if (n < 2 || topics.length >= Math.ceil(max / 2)) break;
    if (VERBS.has(pair.split(' ')[0])) continue;
    // "booking page" and "single booking" are the same topic
    if (pair.split(' ').some((p) => used.has(p))) continue;
    topics.push(pair);
    pair.split(' ').forEach((p) => used.add(p));
  }
  for (const [w, n] of [...uni.entries()].sort((a, b) => b[1] - a[1])) {
    if (topics.length >= max) break;
    if (n < 2 || used.has(w) || w.length < 4 || VERBS.has(w)) continue;
    topics.push(w);
    used.add(w);
  }
  return topics;
}

const DECISION =
  /\b(we(?:'ve| have)? decided|decision is|(?:we |all )?agreed|let'?s go with|we'?ll go with|we(?:'re| are) going (?:with|to go with)|settled on|approved|final answer|locked in|confirmed that|it'?s decided)\b/i;

const DAY = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
const DUE = new RegExp(
  `\\b(today|tonight|tomorrow|end of (?:the )?(?:day|week|month)|eod|eow|this week|next week|(?:by|on|before|until) (?:next )?${DAY}|(?:next )?${DAY}|\\d{1,2}(?:st|nd|rd|th)? (?:of )?${MONTH}|${MONTH} \\d{1,2}(?:st|nd|rd|th)?)\\b`,
  'i',
);

export function findDue(text: string): string | undefined {
  const m = text.match(DUE);
  if (!m) return undefined;
  const d = m[1].replace(/^(by|on|before|until) /i, '').toLowerCase().replace(/\beod\b/, 'end of day').replace(/\beow\b/, 'end of week');
  return cap(d).replace(new RegExp(`\\b(${DAY}|${MONTH})\\b`, 'gi'), (w) => cap(w));
}

const SELF = /\b(I'?ll|I will|I'?m going to|I (?:also |really |still |just )?(?:need to|should|have to|must)|I can (?:take|do|handle|send|share|prepare|draft|set up|book|follow)|I'?ll take|leave it with me|I'?m on it|let me)\b/i;
const TEAM = /\b(we need to|we should|we have to|we must|let'?s|someone (?:needs|has) to|action item:?|to-?do:?|next step is|next steps? (?:are|is))\b/i;
const ASSIGN = /^(?:(?:ok(?:ay)?|so|and|also|great)[,\s]+)*([A-Z][a-z]+)[,:]?\s+(?:can you|could you|would you|please|you(?:'ll| will)|will you)\b/;
const THIRD = /\b([A-Z][a-z]+) (?:will|is going to|is gonna|to)\s+(?:send|share|prepare|draft|update|set up|book|follow|create|review|call|email|fix|finish|deliver|check|write|build|design|organi[sz]e)/;

function cleanTask(text: string): string {
  let t = text
    .replace(/^(?:(?:ok(?:ay)?|so|and|also|great|alright|perfect|cool|right|then)[,\s]+)+/i, '')
    .replace(/^[A-Z][a-z]+[,:]\s+(?=can|could|would|please|will)/, '')
    .replace(/^(?:can you|could you|would you|will you)\s+(?:please\s+)?/i, '')
    .replace(/^please\s+/i, '')
    .replace(/^(?:yes|yeah|sure|ok(?:ay)?)[,.!\s]+/i, '')
    .replace(/^(?:maybe|perhaps|also|I think|honestly)[,\s]+/i, '')
    .replace(/^(?:I'?ll|I will|I'?m going to|I (?:also |really |still |just )?(?:need to|should|have to|must)|I can|let me|we need to|we should|we have to|we must|let'?s|someone needs to|action item:?|to-?do:?)\s+/i, '')
    .replace(/^[A-Z][a-z]+ (?:will|is going to|is gonna)\s+/, '')
    .replace(/\s*\?+$/, '')
    .replace(/[.!]+$/, '')
    .trim();
  t = t.replace(/\b(?:by|on|before) (?:the )?(?:end of (?:the )?(?:day|week)|tomorrow|today|next week|this week|(?:next )?(?:monday|tuesday|wednesday|thursday|friday))$/i, '').trim();
  return cap(t);
}

export function similarity(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter);
}

export function extractActionItems(sentences: Sentence[], speakers: string[]): ActionItem[] {
  const items: ActionItem[] = [];
  const seen = new Set<string>();
  const known = new Set(speakers.map((s) => s.split(' ')[0]));
  for (const s of sentences) {
    let owner: string | undefined;
    let matched = false;
    const assign = s.text.match(ASSIGN);
    const third = s.text.match(THIRD);
    if (assign && (known.size === 0 || known.has(assign[1]))) {
      owner = speakers.find((sp) => sp.startsWith(assign[1])) || assign[1];
      matched = true;
    } else if (third && (known.has(third[1]) || known.size === 0)) {
      owner = speakers.find((sp) => sp.startsWith(third[1])) || third[1];
      matched = true;
    } else if (SELF.test(s.text) && !/\?$/.test(s.text)) {
      owner = s.speaker;
      matched = true;
    } else if (TEAM.test(s.text) && !/\?$/.test(s.text) && !DECISION.test(s.text)) {
      owner = undefined;
      matched = true;
    }
    if (!matched) continue;
    const task = cleanTask(s.text);
    if (task.split(' ').length < 3 || task.length > 180) continue;
    if (/^(?:think|guess|mean|know|see|agree|hope|be honest)\b/i.test(task)) continue;
    // "I can do that next week" has no concrete task on its own
    if (/^(?:do|handle|take|try) (?:that|it|this)\b/i.test(task)) continue;
    const key = task.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    // "I'll send it along with two case studies" adds detail to the owner's previous task
    const prevOwn = [...items].reverse().find((i) => i.owner === owner);
    if (owner && prevOwn && /^\w+ (?:it|them|that)\b/i.test(task)) {
      const rest = task.replace(/^\w+ (?:it|them|that)\s*/i, '').replace(/^(?:by|on|before) \w+\s*/i, '').trim();
      if (rest) prevOwn.task = `${prevOwn.task.replace(/ as well$/, '')}, ${rest}`;
      prevOwn.due = prevOwn.due || findDue(s.text);
      continue;
    }
    // "Priya, can you send the mockups by Friday?" + "Yes, I'll send the mockups by Friday" is one task
    const dup = items.find((i) => i.owner === owner && similarity(i.task, task) >= 0.4);
    if (dup) {
      if (task.length > dup.task.length) dup.task = task;
      dup.due = dup.due || findDue(s.text);
      continue;
    }
    items.push({ id: `ai-${items.length + 1}-${key.replace(/\W+/g, '').slice(0, 8)}`, task, owner, due: findDue(s.text), done: false });
  }
  return items.slice(0, 12);
}

export function extractDecisions(sentences: Sentence[]): string[] {
  return [...new Set(sentences.filter((s) => DECISION.test(s.text) && !/\?$/.test(s.text)).map((s) => cap(s.text.replace(/^(?:(?:ok(?:ay)?|so|great|alright|perfect)[,\s]+)+/i, ''))))].slice(0, 8);
}

const REQUEST = /\b(can you|could you|would you|will you)\b/i;

export function extractQuestions(sentences: Sentence[]): string[] {
  return sentences
    .filter((s) => s.text.endsWith('?') && !REQUEST.test(s.text) && words(s.text).length >= 3)
    .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
    .slice(0, 6);
}

/** Frequency-based sentence ranking (a light TextRank alternative). */
export function keySentences(sentences: Sentence[], max = 4): Sentence[] {
  const freq = new Map<string, number>();
  for (const s of sentences) for (const w of words(s.text)) freq.set(w, (freq.get(w) || 0) + 1);
  const scored = sentences
    .filter((s) => s.text.split(' ').length >= 7 && !s.text.endsWith('?'))
    .map((s) => {
      const w = words(s.text);
      const score = w.reduce((n, x) => n + (freq.get(x) || 0), 0) / Math.sqrt(w.length + 1);
      return { s, score: score + (DECISION.test(s.text) ? 2 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.s);
  return scored.sort((a, b) => a.index - b.index);
}

const TENSE = /\b(concern(?:ed)?|worried|risk|delay(?:ed)?|problem|issue|frustrat\w*|behind|blocker|blocked|over budget|unhappy|complain\w*|late|urgent)\b/gi;
const POSITIVE = /\b(great|excited|happy|love|good news|ahead|win|excellent|perfect|amazing|awesome|on track|well done)\b/gi;

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function minutes(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return `${m}-minute`;
}

export function buildFollowUpEmail(a: Pick<Analysis, 'title' | 'decisions' | 'actionItems' | 'openQuestions'>, senderName = 'Me'): string {
  const lines = [`Subject: Recap: ${a.title}`, '', 'Hi all,', '', 'Thanks for your time today. Here is a quick recap so we are all on the same page.'];
  if (a.decisions.length) lines.push('', 'What we decided:', ...a.decisions.map((d) => `- ${d}`));
  if (a.actionItems.length)
    lines.push('', 'Next steps:', ...a.actionItems.map((i) => `- ${i.task}${i.owner || i.due ? ` (${[i.owner, i.due].filter(Boolean).join(', ')})` : ''}`));
  if (a.openQuestions.length) lines.push('', 'Still open:', ...a.openQuestions.map((q) => `- ${q.replace(/^[^:]+:\s*/, '')}`));
  lines.push('', 'Let me know if I missed anything.', '', 'Best,', senderName);
  return lines.join('\n');
}

export function analyzeOffline(segments: Segment[], opts: { senderName?: string } = {}): Analysis {
  const sentences = toSentences(segments);
  const stats = speakerStats(segments);
  const speakers = stats.map((s) => s.speaker);
  const topics = extractTopics(sentences, 5, speakers);
  const decisions = extractDecisions(sentences);
  const actionItems = extractActionItems(sentences, speakers);
  const openQuestions = extractQuestions(sentences);
  const keyPoints = keySentences(sentences).map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text));

  const all = segments.map((s) => s.text).join(' ');
  const tense = (all.match(TENSE) || []).length;
  const pos = (all.match(POSITIVE) || []).length;
  const sentiment: Analysis['sentiment'] = tense > pos + 1 ? 'tense' : pos > tense ? 'positive' : 'neutral';

  const title = topics.length
    ? `${titleCase(topics[0])}${topics[1] ? ` & ${titleCase(topics[1])}` : ''} ${speakers.length > 1 ? 'meeting' : 'note'}`
    : speakers.length > 1 ? 'Team meeting' : 'Voice note';

  const owners = [...new Set(actionItems.map((i) => i.owner).filter(Boolean))] as string[];
  const who = speakers.length > 1 ? `between ${listJoin(speakers)}` : speakers[0] ? `by ${speakers[0]}` : '';
  const summary = [
    `A ${minutes(estimateDuration(segments))} ${speakers.length > 1 ? 'conversation' : 'note'} ${who}`.replace(/\s+$/, '') +
      (topics.length ? ` covering ${listJoin(topics.slice(0, 3))}.` : '.'),
    decisions.length ? `${decisions.length} decision${decisions.length > 1 ? 's were' : ' was'} made.` : 'No firm decisions were recorded.',
    actionItems.length
      ? `${actionItems.length} action item${actionItems.length > 1 ? 's' : ''} came out of it${owners.length ? `, owned by ${listJoin(owners)}` : ''}.`
      : '',
    openQuestions.length ? `${openQuestions.length} question${openQuestions.length > 1 ? 's remain' : ' remains'} open.` : '',
    sentiment === 'tense' ? 'The tone suggests some concerns or risks worth following up on.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const base = { title, decisions, actionItems, openQuestions };
  return {
    ...base,
    summary,
    keyPoints,
    topics,
    sentiment,
    followUpEmail: buildFollowUpEmail(base, opts.senderName),
    engine: 'demo',
    generatedAt: Date.now(),
  };
}
