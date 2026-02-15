/**
 * Local rule-based compiler: notes → ProcessFields + summary.
 * No OpenAI. Deterministic heuristics only.
 */

import type { OneProcess, ProcessEvent, ProcessFields } from './types';
import { LENS_LABELS } from './types';

const MAX_NOTES = 10;

function extractLinesWithPrefix(messages: { text: string }[], prefixes: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = messages.length - 1; i >= 0 && out.length < 20; i--) {
    const lines = messages[i].text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const lower = line.toLowerCase();
      for (const p of prefixes) {
        if (lower.startsWith(p) || lower.includes(` ${p}`)) {
          const rest = line.replace(new RegExp(`^.*${p}\\s*:?\\s*`, 'i'), '').trim();
          if (rest && !seen.has(rest)) {
            seen.add(rest);
            out.unshift(rest);
          }
          break;
        }
      }
      if (lower.startsWith('- ') || /^\d+\.\s/.test(line)) {
        const rest = line.replace(/^[-]\s*|\d+\.\s*/, '').trim();
        if (rest && !seen.has(rest)) {
          seen.add(rest);
          out.unshift(rest);
        }
      }
    }
  }
  return out.slice(0, 10);
}

function extractConstraints(messages: { text: string }[]): string[] {
  const out: string[] = [];
  const patterns = [/\$\d+/, /₪\d+/, /\d+\s*(days?|hours?|weeks?|months?)/i, /budget\s*:?\s*\S+/i];
  const seen = new Set<string>();
  const last = messages.slice(-MAX_NOTES);
  for (const m of last) {
    for (const p of patterns) {
      const match = m.text.match(p);
      if (match && match[0] && !seen.has(match[0])) {
        seen.add(match[0]);
        out.push(match[0].trim());
      }
    }
    if (/\bbudget\b/i.test(m.text)) {
      const snippet = m.text.slice(Math.max(0, m.text.toLowerCase().indexOf('budget')), m.text.length).split(/[.\n]/)[0];
      if (snippet && !seen.has(snippet)) {
        seen.add(snippet);
        out.push(snippet.trim());
      }
    }
  }
  return out.slice(0, 8);
}

function extractRisks(messages: { text: string }[]): string[] {
  const out: string[] = [];
  const keywords = ['risk', 'problem', 'blocked', 'warning', 'concern'];
  const last = messages.slice(-MAX_NOTES);
  const seen = new Set<string>();
  for (const m of last) {
    const lower = m.text.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const sentence = m.text.split(/[.\n]/).find((s) => s.toLowerCase().includes(kw));
        if (sentence && !seen.has(sentence.trim())) {
          seen.add(sentence.trim());
          out.push(sentence.trim().slice(0, 120));
        }
        break;
      }
    }
  }
  return out.slice(0, 5);
}

function buildContext(messages: { text: string }[]): string {
  const last = messages.slice(-MAX_NOTES).map((m) => m.text.trim()).filter(Boolean);
  if (last.length === 0) return '';
  const joined = last.join(' ').replace(/\s+/g, ' ');
  return joined.length > 300 ? joined.slice(0, 297) + '...' : joined;
}

export function compileProcess(process: OneProcess): OneProcess {
  const notes = process.messages.filter((m) => m.sender === 'user').slice(-MAX_NOTES);
  const existing = process.fields ?? {};

  const nextSteps = extractLinesWithPrefix(notes, ['next:', 'todo:', 'next ', 'todo ']);
  const constraints = extractConstraints(notes);
  const risks = extractRisks(notes);
  const context = buildContext(notes);

  const fields: ProcessFields = {
    ...existing,
    context: context || existing.context,
    nextSteps: nextSteps.length > 0 ? nextSteps : existing.nextSteps,
    constraints: constraints.length > 0 ? constraints : existing.constraints,
    risks: risks.length > 0 ? risks : existing.risks,
  };
  if (process.fields?.goal) fields.goal = process.fields.goal;
  if (process.fields?.outcome) fields.outcome = process.fields.outcome;
  if (process.fields?.resources && process.fields.resources.length) fields.resources = process.fields.resources;

  const firstNext = fields.nextSteps?.[0];
  const goalPart = fields.goal ?? process.title;
  const summary =
    firstNext || goalPart
      ? `${LENS_LABELS[process.lens]} • ${process.status} • ${firstNext || goalPart}`
      : `${LENS_LABELS[process.lens]} • ${process.status} • ${process.title}`;

  const compileEv: ProcessEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(),
    type: 'compile',
    payload: { summary: summary.slice(0, 80) },
  };

  return {
    ...process,
    summary,
    fields,
    timeline: [...(process.timeline ?? []), compileEv],
  };
}
