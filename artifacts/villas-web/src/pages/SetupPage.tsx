import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSetupStatus,
  useRunSetup,
  getGetSetupStatusQueryKey,
  type SetupStatus,
} from "@workspace/api-client-react";
import { CheckCircle2, CircleAlert, Copy, KeyRound, Wrench } from "lucide-react";

const apiMessage = (err: unknown, fallback: string) =>
  (err as { data?: { message?: string } } | null)?.data?.message ?? fallback;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full overflow-y-auto">
      <div className="sky" aria-hidden />
      <main className="relative mx-auto max-w-md px-6 py-10">{children}</main>
    </div>
  );
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex gap-3">
      {ok ? (
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-confianza" />
      ) : (
        <CircleAlert size={20} className="mt-0.5 shrink-0 text-casas" />
      )}
      <span>
        <span className={ok ? "text-ink" : "font-bold text-ink"}>{label}</span>
        {!ok && hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </li>
  );
}

function Checklist({ s }: { s: SetupStatus }) {
  return (
    <ul className="space-y-3 rounded-2xl bg-panel/80 p-4 text-sm">
      <Check ok={s.databaseConfigured} label="Base de datos conectada a Vercel" hint="Vercel → Storage → Neon → Connect. Crea DATABASE_URL sola." />
      <Check ok={s.databaseReachable} label="La base responde" hint="Revisa que DATABASE_URL sea la URL de Neon con -pooler." />
      <Check ok={s.setupEnabled} label="Clave de configuración (SETUP_TOKEN)" hint="Vercel → Settings → Environment Variables. Mínimo 16 caracteres." />
      <Check ok={s.tablesReady} label="Tablas creadas" hint="Se crean al enviar el formulario de abajo." />
      <Check ok={s.hasAdmin} label="Tu cuenta de creador" hint="Se crea al enviar el formulario de abajo." />
    </ul>
  );
}

export function SetupPage() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const status = useGetSetupStatus({ query: { queryKey: getGetSetupStatusQueryKey(), retry: false } });
  const [form, setForm] = useState({ token: "", name: "", phone: "" });
  const setup = useRunSetup({
    mutation: { onSuccess: () => void qc.invalidateQueries({ queryKey: getGetSetupStatusQueryKey() }) },
  });
  const s = status.data;
  const canSubmit = s?.databaseConfigured && s.databaseReachable && s.setupEnabled;

  if (setup.isSuccess) {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}llave/${setup.data.token}`;
    return (
      <Shell>
        <KeyRound size={36} className="mb-4 text-primary" />
        <h1 className="mb-2 text-3xl font-black">Listo, {setup.data.name.split(" ")[0]}</h1>
        <p className="mb-4 text-ink/85">
          Esta es tu <b>llave personal de creador</b>. Guárdala (por ejemplo, mándatela a ti mismo por WhatsApp). Si la pierdes,
          vuelve a esta página y genera otra: la anterior deja de servir.
        </p>
        <p className="mb-4 break-all rounded-xl bg-space-2 p-3 font-mono text-xs">{link}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate(`/llave/${setup.data.token}`)} className="rounded-2xl bg-primary px-5 py-3 font-black text-space">
            Entrar ahora
          </button>
          <button onClick={() => void navigator.clipboard?.writeText(link)} className="flex items-center gap-2 rounded-2xl border border-white/20 px-5 py-3 font-bold">
            <Copy size={16} /> Copiar
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Wrench size={32} className="mb-3 text-primary" />
      <h1 className="mb-2 text-3xl font-black">Configuración inicial</h1>
      <p className="mb-6 text-sm text-ink/80">Solo la primera vez, o si perdiste tu llave de creador.</p>

      {status.isLoading && <p className="text-sm text-muted">Revisando el servidor…</p>}
      {status.isError && (
        <p className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm">
          La API no respondió. Revisa que el despliegue incluya <code>vercel.json</code> y la carpeta <code>api/</code>.
        </p>
      )}
      {s && <Checklist s={s} />}

      {s && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setup.mutate({ data: form });
          }}
        >
          {s.hasAdmin && (
            <p className="rounded-xl bg-primary/10 p-3 text-xs text-ink/85">
              Ya existe una cuenta de creador. Enviar el formulario con el mismo WhatsApp genera una llave nueva y anula la anterior.
            </p>
          )}
          <Field label="Clave de configuración (SETUP_TOKEN)" type="password" autoComplete="off" value={form.token} onChange={(v) => setForm({ ...form, token: v })} />
          <Field label="Tu nombre" autoComplete="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Tu WhatsApp (10 dígitos)" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          {setup.isError && <p className="text-sm text-alert">{apiMessage(setup.error, "No se pudo completar la configuración.")}</p>}
          <button
            disabled={!canSubmit || setup.isPending}
            className="w-full rounded-2xl bg-primary py-3.5 font-black text-space disabled:opacity-40"
          >
            {setup.isPending ? "Creando tablas y cuenta…" : "Configurar"}
          </button>
          {!canSubmit && <p className="text-center text-xs text-muted">Completa primero los pasos marcados en amarillo.</p>}
        </form>
      )}
      <Link href="/" className="mt-8 block text-center text-sm text-muted underline underline-offset-4">
        Ir al inicio
      </Link>
    </Shell>
  );
}

function Field({
  label,
  onChange,
  ...props
}: { label: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <input
        {...props}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-xl border border-white/15 bg-space-2 px-4 py-3 text-[15px] outline-none focus:border-primary"
      />
    </label>
  );
}

/** Lo que ve cualquiera mientras el sitio no está configurado. */
export function NeedsSetup({ problem }: { problem: string | null }) {
  return (
    <Shell>
      <Wrench size={32} className="mb-3 text-casas" />
      <h1 className="mb-3 text-2xl font-black">Estamos terminando de instalar Villas</h1>
      <p className="mb-6 text-sm text-ink/85">
        {problem ?? "La API no respondió. Si acabas de desplegar, revisa que la rama incluya vercel.json y la carpeta api/."}
      </p>
      <Link href="/setup" className="inline-block rounded-2xl bg-primary px-5 py-3 font-black text-space">
        Ir a configuración
      </Link>
    </Shell>
  );
}
