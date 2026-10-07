'use client';

import { useSyncExternalStore } from 'react';
import type { Meeting } from './types';
import { DEFAULT_AI, type AiSettings } from './ai';

// Tiny localStorage-backed store shared by every page. No backend, no account:
// meetings never leave the browser unless the user turns on the AI engine.

const MEETINGS_KEY = 'mm-meetings';
const SETTINGS_KEY = 'mm-settings';
const listeners = new Set<() => void>();
let meetingsCache: Meeting[] | null = null;
let settingsCache: AiSettings | null = null;

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode: keep working in memory
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === MEETINGS_KEY) meetingsCache = null;
    if (e.key === SETTINGS_KEY) settingsCache = null;
    l();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

const EMPTY: Meeting[] = [];

export function getMeetings(): Meeting[] {
  if (typeof window === 'undefined') return EMPTY;
  if (!meetingsCache) {
    const raw = read<unknown>(MEETINGS_KEY, []);
    meetingsCache = Array.isArray(raw) ? (raw.filter((m) => m && typeof m.id === 'string' && Array.isArray(m.segments)) as Meeting[]) : [];
  }
  return meetingsCache;
}

export function saveMeetings(list: Meeting[]) {
  meetingsCache = [...list].sort((a, b) => b.createdAt - a.createdAt);
  write(MEETINGS_KEY, meetingsCache);
  emit();
}

export function upsertMeeting(m: Meeting) {
  const list = getMeetings().filter((x) => x.id !== m.id);
  saveMeetings([m, ...list]);
}

export function deleteMeeting(id: string) {
  saveMeetings(getMeetings().filter((m) => m.id !== id));
}

export function getSettings(): AiSettings {
  if (typeof window === 'undefined') return DEFAULT_AI;
  if (!settingsCache) settingsCache = { ...DEFAULT_AI, ...read<Partial<AiSettings>>(SETTINGS_KEY, {}) };
  return settingsCache;
}

export function saveSettings(s: AiSettings) {
  settingsCache = s;
  write(SETTINGS_KEY, s);
  emit();
}

export function useMeetings() {
  return useSyncExternalStore(subscribe, getMeetings, () => EMPTY);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_AI);
}

export const newId = () => `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
