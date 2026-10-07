import { speakerStats } from './transcript';
import type { Meeting } from './types';

// ---------------------------------------------------------------------------
// Meeting health: a short checklist of what makes a meeting useful afterwards.
// Clear decisions, owners and dates for every task, and balanced talk time.
// ---------------------------------------------------------------------------

export interface HealthCheck {
  id: 'decisions' | 'owners' | 'dates' | 'balance' | 'questions';
  ok: boolean;
  label: string;
  detail: string;
}

export interface Health {
  /** 0-100, share of passed checks */
  score: number;
  grade: 'Great' | 'Good' | 'Needs work';
  checks: HealthCheck[];
}

export function meetingHealth(m: Meeting): Health | null {
  const a = m.analysis;
  if (!a) return null;
  const checks: HealthCheck[] = [];
  const tasks = a.actionItems;

  checks.push(a.decisions.length
    ? { id: 'decisions', ok: true, label: 'Decisions recorded', detail: `${a.decisions.length} decision${a.decisions.length === 1 ? '' : 's'} captured.` }
    : { id: 'decisions', ok: false, label: 'No clear decision', detail: 'Nothing was explicitly agreed. Confirm the outcome in the follow-up email.' });

  if (tasks.length) {
    const noOwner = tasks.filter((t) => !t.owner).length;
    checks.push(noOwner
      ? { id: 'owners', ok: false, label: `${noOwner} task${noOwner === 1 ? '' : 's'} without an owner`, detail: 'Tasks without a name attached rarely get done. Assign someone.' }
      : { id: 'owners', ok: true, label: 'Every task has an owner', detail: `${tasks.length} task${tasks.length === 1 ? '' : 's'}, all assigned.` });
    const noDate = tasks.filter((t) => !t.due).length;
    checks.push(noDate
      ? { id: 'dates', ok: false, label: `${noDate} task${noDate === 1 ? '' : 's'} without a due date`, detail: 'Add a date so the task can go on a calendar.' }
      : { id: 'dates', ok: true, label: 'Every task has a due date', detail: 'All next steps can be scheduled.' });
  } else {
    checks.push({ id: 'owners', ok: false, label: 'No next steps', detail: 'No action items were found. Add at least one next step.' });
  }

  const stats = speakerStats(m.segments);
  if (stats.length >= 2) {
    const top = stats[0];
    const limit = stats.length === 2 ? 0.75 : 0.6;
    checks.push(top.share > limit
      ? { id: 'balance', ok: false, label: `${top.speaker} spoke ${Math.round(top.share * 100)}% of the time`, detail: 'One voice dominated. Invite input from the others next time.' }
      : { id: 'balance', ok: true, label: 'Balanced conversation', detail: `${stats.length} people took part, and nobody dominated.` });
  }

  const q = a.openQuestions.length;
  checks.push(q > 3
    ? { id: 'questions', ok: false, label: `${q} questions left open`, detail: 'Several questions had no answer. Assign someone to follow up.' }
    : { id: 'questions', ok: true, label: q ? `${q} open question${q === 1 ? '' : 's'}` : 'No loose ends', detail: q ? 'A manageable number to follow up on.' : 'Every question raised was answered.' });

  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, grade: score >= 80 ? 'Great' : score >= 50 ? 'Good' : 'Needs work', checks };
}
