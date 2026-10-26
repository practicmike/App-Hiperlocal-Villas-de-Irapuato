import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

/**
 * Buscar hablando.
 * - Con IA encendida: el celular graba y el servidor transcribe con los nombres de
 *   Villas como pista (funciona igual en Android, iPhone y la app instalada).
 * - Sin IA: dictado del propio navegador, si lo tiene.
 * - Se detiene sola tras ~1.5 s de silencio, o al tocar otra vez.
 */
type State = "idle" | "listening" | "working";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const SpeechCtor = (): (new () => SpeechRec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const canRecord = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export function voiceAvailable(serverAi: boolean) {
  return (serverAi && canRecord()) || !!SpeechCtor();
}

const MAX_MS = 15_000;
const SILENCE_MS = 1500;

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export function VoiceButton({
  serverAi,
  onText,
  onPartial,
  onError,
  onListening,
  size = "sm",
}: {
  serverAi: boolean;
  /** "lg": el botón grande del inicio, para quien prefiere hablar a escribir. */
  size?: "sm" | "lg";
  onListening?: (listening: boolean) => void;
  onText: (text: string) => void;
  onPartial?: (text: string) => void;
  onError: (message: string | null) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const stopRef = useRef<() => void>(() => {});
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => () => cleanupRef.current(), []);
  useEffect(() => onListening?.(state === "listening"), [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (msg: string) => {
    setState("idle");
    onError(msg);
  };

  const startServer = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      fail("Necesito permiso del micrófono. Actívalo en los ajustes del navegador.");
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    // Detector de silencio: mide el volumen y corta cuando ya hablaste y te callas.
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let spoke = false;
    let quietSince = performance.now();
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (rms > 6) {
        spoke = true;
        quietSince = now;
      }
      if ((spoke && now - quietSince > SILENCE_MS) || now - t0 > MAX_MS || (!spoke && now - t0 > 6000)) {
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const release = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
    };
    cleanupRef.current = () => {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
      release();
    };
    const stop = () => {
      if (rec.state !== "inactive") rec.stop();
    };
    stopRef.current = stop;

    rec.onstop = async () => {
      release();
      if (!spoke) {
        fail("No te escuché. Toca el micrófono y habla cerca del celular.");
        return;
      }
      setState("working");
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || "audio/webm").split(";")[0] });
      try {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        const res = await fetch(`${base}/api/transcribe`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": blob.type },
          body: blob,
        });
        const data = (await res.json().catch(() => null)) as { text?: string; message?: string } | null;
        if (!res.ok) throw new Error(data?.message ?? "No pude entender el audio.");
        const text = (data?.text ?? "").trim();
        if (!text) throw new Error("No entendí. ¿Lo repites?");
        setState("idle");
        onText(text);
      } catch (e) {
        fail((e as Error).message || "No pude entender el audio.");
      }
    };

    rec.start(250);
    setState("listening");
    raf = requestAnimationFrame(tick);
  };

  const startBrowser = () => {
    const Ctor = SpeechCtor()!;
    const rec = new Ctor();
    rec.lang = "es-MX";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    let errored = false;
    rec.onresult = (e) => {
      let live = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0]!.transcript;
        else live += r[0]!.transcript;
      }
      onPartial?.((finalText + live).trim());
    };
    rec.onerror = (e) => {
      errored = true;
      fail(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Necesito permiso del micrófono. Actívalo en los ajustes del navegador."
          : e.error === "no-speech"
            ? "No te escuché. Toca el micrófono y habla cerca del celular."
            : "El dictado falló. Escríbelo, porfa.",
      );
    };
    rec.onend = () => {
      if (errored) return;
      setState("idle");
      const t = finalText.trim();
      if (t) onText(t);
    };
    stopRef.current = () => rec.stop();
    cleanupRef.current = () => {
      rec.onend = null;
      rec.abort();
    };
    rec.start();
    setState("listening");
  };

  const toggle = () => {
    if (state === "listening") {
      stopRef.current();
      return;
    }
    if (state === "working") return;
    onError(null);
    navigator.vibrate?.(15);
    if (serverAi && canRecord()) void startServer();
    else if (SpeechCtor()) startBrowser();
  };

  const label = state === "listening" ? "Dejar de escuchar" : state === "working" ? "Entendiendo lo que dijiste" : "Buscar con voz";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={state === "listening"}
      className={
        size === "lg"
          ? `relative grid h-20 w-20 shrink-0 place-items-center rounded-full shadow-[0_0_40px_#7d80d966] transition ${
              state === "listening" ? "bg-[#e38fc1] text-[#11143a]" : "bg-primary text-space"
            }`
          : `relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
              state === "listening" ? "bg-[#e38fc1] text-[#11143a]" : "text-muted hover:bg-white/10"
            }`
      }
    >
      {state === "listening" && <span className="absolute inset-1 animate-ping rounded-full bg-[#e38fc1]/40" aria-hidden />}
      {state === "working" ? (
        <Loader2 size={size === "lg" ? 30 : 18} className="animate-spin" />
      ) : state === "listening" ? (
        <Square size={size === "lg" ? 24 : 14} fill="currentColor" className="relative" />
      ) : (
        <Mic size={size === "lg" ? 32 : 18} />
      )}
    </button>
  );
}
