export interface Segment {
  speaker?: string;
  /** seconds from the start, when known */
  time?: number;
  text: string;
}

export interface ActionItem {
  id: string;
  task: string;
  owner?: string;
  due?: string;
  done: boolean;
}

export interface Analysis {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  openQuestions: string[];
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'tense';
  followUpEmail: string;
  engine: 'demo' | 'ai';
  generatedAt: number;
}

export type MeetingSource = 'live' | 'audio' | 'upload' | 'paste' | 'sample';

export interface Meeting {
  id: string;
  title: string;
  createdAt: number;
  durationSec?: number;
  source: MeetingSource;
  segments: Segment[];
  analysis?: Analysis;
  tags?: string[];
}
