import { getSupabase } from "./supabase";

// ── Hold-to-record → Whisper transcription ──────────────────────────────────
/** Send recorded audio to the `stt` edge function, get back the transcript. */
export async function transcribeAudio(blob: Blob): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke("stt", { body: blob });
    if (error) return null;
    const t = (data as { text?: string } | null)?.text;
    return typeof t === "string" ? t.trim() : null;
  } catch {
    return null;
  }
}

// ── Tap-to-talk → live realtime conversation (OpenAI Realtime over WebRTC) ───
export interface RealtimeHandle {
  stop: () => void;
}

/**
 * Open a live, spoken conversation with ONE: mint an ephemeral token via the
 * `realtime-token` edge function, then connect the browser mic ⇄ model audio
 * directly to OpenAI over WebRTC. Returns a handle to end the call, or null if
 * realtime/mic isn't available (caller degrades gracefully).
 */
export async function startRealtime(opts: {
  instructions?: string;
  onUserText?: (t: string) => void;
  onAssistantText?: (t: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}): Promise<RealtimeHandle | null> {
  const client = getSupabase();
  if (!client) return null;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  try {
    const { data, error } = await client.functions.invoke("realtime-token", {
      body: { instructions: opts.instructions },
    });
    if (error) return null;
    const secret = (data as { secret?: string } | null)?.secret;
    const model = (data as { model?: string } | null)?.model ?? "gpt-realtime";
    if (!secret) return null;

    const pc = new RTCPeerConnection();
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
    };

    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getTracks().forEach((t) => pc.addTrack(t, mic));

    const dc = pc.createDataChannel("oai-events");
    dc.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        const t = m?.transcript;
        if (!t) return;
        if (m.type?.includes("input_audio_transcription")) opts.onUserText?.(t);
        else if (m.type?.includes("transcript")) opts.onAssistantText?.(t);
      } catch {
        /* non-JSON event */
      }
    };

    const stopMic = () => mic.getTracks().forEach((t) => t.stop());
    const stop = () => {
      try {
        dc.close();
      } catch {
        /* ignore */
      }
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      stopMic();
      audioEl.srcObject = null;
      opts.onClose?.();
    };
    pc.onconnectionstatechange = () => {
      if (["closed", "failed", "disconnected"].includes(pc.connectionState)) stop();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const exchange = async (url: string) =>
      fetch(`${url}?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/sdp" },
      });
    // GA endpoint first, then the older path.
    let resp = await exchange("https://api.openai.com/v1/realtime/calls");
    if (!resp.ok) resp = await exchange("https://api.openai.com/v1/realtime");
    if (!resp.ok) {
      stop();
      return null;
    }
    await pc.setRemoteDescription({ type: "answer", sdp: await resp.text() });
    opts.onOpen?.();
    return { stop };
  } catch {
    return null;
  }
}
