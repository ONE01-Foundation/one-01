# ONE — Privacy Policy

**Last updated:** 2026-06-23
**Effective:** First user release

This Privacy Policy describes how ONE01 Foundation ("we", "us") collects,
uses, and shares information when you use the ONE mobile and web application
(the "Service").

---

## 1. Information we collect

### 1.1 What you give us directly

- **Account details** — email address (and optionally name) when you create
  an account, or the OAuth identifier from Apple or Google if you sign in
  with those providers.
- **Process content** — anything you type into ONE: intentions, updates,
  uploaded files, notes you record inside a Process.
- **Identity settings** — the labels and types of the identities you create
  (Personal / Business / Family / Custom) and which one is active.

### 1.2 What we collect automatically

- **Device & session metadata** — operating system, app version, locale,
  approximate region (from IP), and crash reports. We do NOT collect a
  persistent device advertising identifier.
- **Usage telemetry** — which screens you open and when, with no message
  content. Used to improve the product, never sold.

### 1.3 What we DON'T collect

- Contact lists, calendar entries, location, photos, microphone audio,
  health data — UNLESS you explicitly connect a specific account
  (Calendar, Email, etc.). Even then, we only access what's needed for the
  Process you're working on, and you can disconnect at any time.

---

## 2. How AI processing works

ONE is an AI-mediated product. When you talk to ONE:

1. Your message and the immediate Process context are sent to an LLM
   provider (currently OpenAI) over an encrypted connection.
2. The provider returns a response which we render to you.
3. **We do not allow the LLM provider to train on your messages.** This is
   contractually enforced via the OpenAI Enterprise Data Processing Addendum.
4. We retain the conversation locally in your account so ONE can remember
   context across sessions. You can delete it at any time from Settings.

---

## 3. How we use the information

| Purpose | Lawful basis (GDPR) |
|---------|---------------------|
| Provide the Service (run AI, sync your Processes across devices) | Contract |
| Improve the product (anonymous usage analytics, crash reports) | Legitimate interest |
| Communicate service announcements | Legitimate interest |
| Comply with legal obligations | Legal obligation |

We do not sell your data. We do not run third-party advertising.

---

## 4. Who we share with

- **OpenAI** (LLM processing) — message and context for each AI turn.
- **Supabase** (database + auth host) — your account and Process data,
  stored at rest with row-level security.
- **Cloudflare** (CDN, web hosting) — static assets only.
- **Apple / Google** — if you sign in with their identity provider.
- **Law enforcement** — only when legally compelled by a valid order in a
  jurisdiction we operate in.

We never share with advertisers, brokers, or analytics vendors that build
profiles for marketing.

---

## 5. Where data is stored

- Primary: Supabase EU region (Ireland) for users with billing addresses
  in the EU/UK. US region (Virginia) otherwise.
- AI processing: OpenAI US infrastructure. We are working on EU-region
  inference for EU users.

---

## 6. Your rights

You can, at any time:

- **Access** your data — Settings → Export your data (returns a JSON file
  with every Process, message, and metadata).
- **Delete** your account and all associated data — Settings → Delete account.
  Deletion is permanent and cannot be undone. We delete within 30 days
  except where law requires retention.
- **Correct** information — edit directly in the app, or contact us.
- **Object** to processing — email us; we'll discuss.

To exercise any right: <mailto:privacy@one01.io>.

EU/UK users: you have the right to lodge a complaint with your local data
protection authority.

---

## 7. Children

ONE is not directed to children under 13 (or under 16 in the EU). We do
not knowingly collect data from children. If you believe we have, contact us
and we will delete it.

---

## 8. Security

- All traffic between your device and our infrastructure is encrypted with
  TLS 1.3.
- Data at rest in Supabase is encrypted (AES-256).
- We run security reviews on every significant release.
- No security is perfect. If you discover a vulnerability, please report
  it to <mailto:security@one01.io>.

---

## 9. Retention

- Active accounts: data retained for the lifetime of the account.
- After deletion: removed from primary storage within 30 days, from
  encrypted backups within 90 days.
- Aggregated, anonymised analytics may be retained longer.

---

## 10. Changes

If we make material changes to this Policy, we'll notify you in-app and by
email at least 14 days before they take effect.

---

## 11. Contact

**Data Controller:** ONE01 Foundation
**Email:** <mailto:privacy@one01.io>
**General contact:** <mailto:hello@one01.io>

---

*This policy is provided in good faith but is not a substitute for legal
advice. Before publishing in production, please have it reviewed by counsel
in your jurisdiction(s).*
