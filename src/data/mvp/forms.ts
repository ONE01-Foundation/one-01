/**
 * forms — ONE's structured-detail-collection tool. Detects a "collect my
 * details" intent and builds a FormRun ONE shows in the thread. On submit the
 * widget writes the values back (a note on the process, and any `discKey` field
 * into "What ONE knows about you"), so the form feeds ONE's representation.
 *
 * Adding a template = a new FormDef with a `match` regex + fields.
 */
import type { FormRun, FormField } from '../../core/mvp/types';

interface FormFieldDef {
  id: string;
  label: (he: boolean) => string;
  placeholder?: (he: boolean) => string;
  kind?: 'text' | 'number';
  /** Saves onto the matching disclosure fact on submit. */
  discKey?: string;
}

interface FormDef {
  id: string;
  title: (he: boolean) => string;
  match: RegExp;
  fields: FormFieldDef[];
}

const CONTACT: FormDef = {
  id: 'contact',
  title: (he) => (he ? 'פרטי קשר' : 'Contact details'),
  match: /פרטי קשר|פרטים ליצירת קשר|פרטי התקשרות|השאר(ת)? פרטים|contact details|contact info|collect my( contact)? details/i,
  fields: [
    { id: 'name', label: (he) => (he ? 'שם מלא' : 'Full name'), placeholder: (he) => (he ? 'השם שלך' : 'Your name'), discKey: 'name' },
    { id: 'phone', label: (he) => (he ? 'טלפון' : 'Phone'), placeholder: () => '05X-XXXXXXX', kind: 'number', discKey: 'phone' },
    { id: 'email', label: (he) => (he ? 'אימייל' : 'Email'), placeholder: () => 'name@mail.com', discKey: 'email' },
  ],
};

const ADDRESS: FormDef = {
  id: 'address',
  title: (he) => (he ? 'כתובת' : 'Address'),
  match: /הכנס(ת)? כתובת|מלא(ת)? כתובת|הכתובת שלי|טופס כתובת|address form|shipping address|delivery address|enter (your )?address/i,
  fields: [
    { id: 'street', label: (he) => (he ? 'רחוב ומספר' : 'Street & number'), placeholder: (he) => (he ? 'הרצל 10' : '10 Main St') },
    { id: 'city', label: (he) => (he ? 'עיר' : 'City'), discKey: 'city' },
    { id: 'zip', label: (he) => (he ? 'מיקוד' : 'Zip code'), kind: 'number' },
  ],
};

// A generic fallback when ONE is asked for "a form" with no clear template.
const GENERIC: FormDef = {
  id: 'details',
  title: (he) => (he ? 'פרטים' : 'Details'),
  match: /טופס|למלא פרטים|מלא(ת)? פרטים|איסוף פרטים|fill in (my |your )?details|collect details|intake form/i,
  fields: [
    { id: 'name', label: (he) => (he ? 'שם מלא' : 'Full name'), discKey: 'name' },
    { id: 'phone', label: (he) => (he ? 'טלפון' : 'Phone'), kind: 'number', discKey: 'phone' },
  ],
};

// More specific templates first; GENERIC catches the bare "form" ask.
const FORMS: FormDef[] = [CONTACT, ADDRESS, GENERIC];

/** Does this message ask ONE to collect structured details? */
export function formForText(text: string): FormDef | null {
  return FORMS.find((f) => f.match.test(text)) ?? null;
}

export function buildFormRun(def: FormDef, unitId: string | undefined, lang: 'en' | 'he'): FormRun {
  const he = lang === 'he';
  const fields: FormField[] = def.fields.map((f) => ({
    id: f.id,
    label: f.label(he),
    placeholder: f.placeholder?.(he),
    kind: f.kind,
    value: '',
    discKey: f.discKey,
  }));
  return { id: `form_${Date.now()}`, unitId, title: def.title(he), fields };
}
