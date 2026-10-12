/**
 * Detect an explicit "remember this" command in a chat message and pull out the
 * fact to store. Lets the user teach ONE things in passing —
 *   "תזכור שאני אוהב קפה"  → "אני אוהב קפה"
 *   "remember that I hate mornings" → "I hate mornings"
 * Returns the fact (trimmed) or null when the message isn't a remember command.
 */
export function extractRememberFact(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  // Hebrew: תזכור / תזכרי / זכור / זכרי [לי] [ש]…
  const he = t.match(/^(?:תזכור|תזכרי|זכור|זכרי)(?:\s+לי)?\s+ש?(.+)/);
  if (he && he[1]) return he[1].trim().replace(/[.!]+$/, '').trim() || null;
  // English: remember [that] …
  const en = t.match(/^remember\s+(?:that\s+)?(.+)/i);
  if (en && en[1]) return en[1].trim().replace(/[.!]+$/, '').trim() || null;
  return null;
}
