/**
 * Default selective-disclosure fields + their localized labels.
 *
 * Selective disclosure is ONE's trust core: a *permissioned representative* that
 * shares only what you allow and asks before the rest — the opposite of an agent
 * that signs in AS you with your full credentials. These defaults give every new
 * user a sensible starting policy they can tune in the ONE profile.
 */

import type { DisclosureField } from '../../core/mvp/types';

/** System-field key → localized label. User-added fields store a literal label. */
export const SYSTEM_DISCLOSURE_LABELS: Record<string, { he: string; en: string }> = {
  name: { he: 'שם', en: 'Name' },
  city: { he: 'עיר', en: 'City' },
  phone: { he: 'טלפון', en: 'Phone' },
  email: { he: 'אימייל', en: 'Email' },
  age: { he: 'גיל', en: 'Age' },
  id_number: { he: 'תעודת זהות', en: 'ID number' },
  payment: { he: 'אמצעי תשלום', en: 'Payment method' },
};

/**
 * Starting disclosure policy. Values are empty until the user fills them; the
 * tiers encode a safe default — identity basics are open, contact details are
 * ask-first, and sensitive identifiers are private out of the box.
 */
export const DEFAULT_DISCLOSURE: DisclosureField[] = [
  { id: 'disc_name', key: 'name', tier: 'open', system: true },
  { id: 'disc_city', key: 'city', tier: 'open', system: true },
  { id: 'disc_phone', key: 'phone', tier: 'ask', system: true },
  { id: 'disc_email', key: 'email', tier: 'ask', system: true },
  { id: 'disc_age', key: 'age', tier: 'ask', system: true },
  { id: 'disc_id', key: 'id_number', tier: 'private', system: true },
  { id: 'disc_payment', key: 'payment', tier: 'private', system: true },
];

/** Resolve a field's display label in the active language. */
export function disclosureLabel(field: DisclosureField, he: boolean): string {
  if (field.key && SYSTEM_DISCLOSURE_LABELS[field.key]) {
    return he ? SYSTEM_DISCLOSURE_LABELS[field.key].he : SYSTEM_DISCLOSURE_LABELS[field.key].en;
  }
  return field.label ?? '';
}

/**
 * The facts ONE may represent freely — the 'open' tier with a filled value,
 * as "label: value" strings. This is what we thread into the AI context so ONE
 * can speak/draft on the user's behalf without inventing details and without
 * ever touching 'ask' (needs approval) or 'private' (never) fields.
 */
export function openDisclosureStrings(
  fields: DisclosureField[] | undefined,
  he: boolean,
): string[] {
  return (fields ?? [])
    .filter((d) => d.tier === 'open' && d.value && d.value.trim())
    .map((d) => `${disclosureLabel(d, he)}: ${d.value!.trim()}`);
}
