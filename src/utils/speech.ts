/**
 * speech — thin wrapper over the browser's Web Speech API (SpeechRecognition).
 *
 * Per product direction we transcribe with the on-device BROWSER recognizer
 * for now — NOT GPT/Whisper. On the web build this gives live interim + final
 * text straight from the mic. On native (Expo Go) the API doesn't exist, so
 * `isSpeechSupported()` returns false and `createSpeechRecognizer()` returns
 * null; callers keep their expo-av audio recording for the visual/timer and
 * simply get no transcript until a native STT lib is added in a dev build.
 */

export interface SpeechRecognizer {
  start: () => void;
  stop: () => void;
}

interface SpeechOptions {
  /** BCP-47 language tag, e.g. 'he-IL' or 'en-US'. */
  lang?: string;
  /** Fires with the running transcript. `isFinal` flips true on a settled phrase. */
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (err: unknown) => void;
  onEnd?: () => void;
}

/** True only where the Web Speech API is present (web / browser). */
export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Build a recognizer, or null when unsupported (native). The recognizer runs
 * continuously with interim results so the caller can stream the text into an
 * input field as the user speaks.
 */
export function createSpeechRecognizer(opts: SpeechOptions): SpeechRecognizer | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as
    | (new () => any)
    | undefined;
  if (!SR) return null;

  const rec: any = new SR();
  rec.lang = opts.lang ?? 'he-IL';
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (event: any) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const chunk = r[0]?.transcript ?? '';
      if (r.isFinal) final += chunk;
      else interim += chunk;
    }
    if (final.trim()) opts.onResult(final, true);
    else if (interim.trim()) opts.onResult(interim, false);
  };
  rec.onerror = (e: unknown) => opts.onError?.(e);
  rec.onend = () => opts.onEnd?.();

  return {
    start: () => {
      try {
        rec.start();
      } catch {
        /* start() throws if already running — safe to ignore */
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* no-op */
      }
    },
  };
}
