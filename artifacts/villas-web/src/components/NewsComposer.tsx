/**
 * Publicar la novedad del día ("Hoy en Villas"). Lo usa el comercio desde su
 * modo comercio y el creador desde el panel. Dura 24 h; publicar otra la reemplaza.
 */
import { useRef, useState } from "react";
import type { NewsItem } from "@workspace/api-client-react";
import { Camera, Sparkles } from "lucide-react";
import { shrinkPhoto, uploadPhoto } from "@/lib/photo";

export const hoursLeft = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));

export function NewsComposer({
  current,
  publish,
  photoPath,
  remove,
  onChange,
  examples = "Hoy hay pozole · Salió el pan de elote · 2x1 en lavado de edredones",
}: {
  current: NewsItem | null;
  publish: (text: string) => Promise<NewsItem>;
  photoPath: (id: string) => string;
  remove: () => Promise<unknown>;
  onChange: () => void;
  examples?: string;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const submit = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const item = await publish(text.trim());
      if (file) await uploadPhoto(photoPath(item.id), await shrinkPhoto(file));
      setText("");
      setFile(null);
      if (input.current) input.current.value = "";
      onChange();
    } catch (e) {
      setErr((e as { data?: { message?: string } }).data?.message ?? ((e as Error).message || "No se pudo publicar."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-[#c38cf3]/40 bg-panel p-4">
      <p className="flex items-center gap-2 font-black">
        <Sparkles size={18} className="text-ai" /> Hoy en Villas
      </p>
      <p className="mb-3 text-xs text-muted">Una novedad del día. Dura 24 horas y aparece en Novedades para que los vecinos la vean.</p>

      {current && (
        <div className="mb-3 flex gap-3 rounded-2xl bg-space-2/70 p-3">
          {current.photoUrl && <img src={`${base}${current.photoUrl}`} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">{current.text}</p>
            <p className="text-xs text-muted">Vigente · quedan {hoursLeft(current.expiresAt)} h</p>
          </div>
          <button
            type="button"
            onClick={() => void remove().then(onChange)}
            className="self-start rounded-full px-2 text-xs text-alert"
          >
            Quitar
          </button>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={140}
        rows={2}
        placeholder={examples}
        className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-ai"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold"
        >
          <Camera size={14} /> {file ? "Foto lista" : "Agregar foto"}
        </button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <span className="ml-auto text-[11px] text-muted">{text.length}/140</span>
        <button
          type="button"
          disabled={busy || text.trim().length < 3}
          onClick={() => void submit()}
          className="rounded-full bg-ai px-4 py-1.5 text-xs font-black text-space disabled:opacity-40"
        >
          {busy ? "Publicando…" : current ? "Publicar y reemplazar" : "Publicar"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-alert">{err}</p>}
    </div>
  );
}
