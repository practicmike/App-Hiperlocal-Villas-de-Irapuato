import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJoinWithInvite,
  useLoginWithKey,
  getGetMeQueryKey,
  type Creator,
} from "@workspace/api-client-react";
import { KeyRound, MessageCircle } from "lucide-react";
import { CreatorAvatar } from "@/components/CreatorSheet";
import { whatsappLink } from "@/lib/constellations";

const errorMessage = (err: unknown, fallback: string) => {
  const data = (err as { data?: { message?: string } } | null)?.data;
  return data?.message ?? fallback;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full overflow-y-auto">
      <div className="sky" aria-hidden />
      <main className="relative mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">{children}</main>
    </div>
  );
}

/** Para quien aún no tiene llave: quién hizo esto y cómo entrar. */
export function LandingPage({ creator }: { creator: Creator }) {
  const join = useJoinWithInvite();
  const [form, setForm] = useState({ code: "", name: "", phone: "", zone: "" });
  const firstName = creator.name.split(" ")[0] ?? creator.name;

  if (join.isSuccess) {
    return (
      <Shell>
        <h1 className="mb-3 text-3xl font-black">¡Listo, {form.name.split(" ")[0]}!</h1>
        <p className="mb-6 text-ink/90">
          Te invitó {join.data.invitedBy}. {firstName} te va a escribir por WhatsApp para presentarse y mandarte tu{" "}
          <b>llave personal</b>: un link que abre la guía en tu teléfono.
        </p>
        {creator.whatsapp && (
          <a
            href={whatsappLink(creator.whatsapp, `Hola ${firstName}, soy ${form.name}. Acabo de registrarme en la guía de Villas.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-black text-space"
          >
            <MessageCircle size={20} /> Avisarle a {firstName}
          </a>
        )}
      </Shell>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Shell>
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">Villas de Irapuato</p>
      <h1 className="mb-4 text-4xl font-black leading-tight">
        La guía de confianza, hecha por los vecinos.
      </h1>
      <p className="mb-8 text-ink/85">
        Encuentra casas, gente de confianza y comercios de Villas, muchas veces con el nombre del vecino que los recomienda.
        Sin scroll infinito: un solo cielo que se acerca y se aleja.
      </p>

      <div className="mb-8 flex items-center gap-4 rounded-2xl border border-white/10 bg-panel/70 p-4">
        <CreatorAvatar creator={creator} onClick={() => {}} />
        <p className="text-sm text-ink/90">
          <b>{creator.name}</b> hizo esta app y conoce en persona a cada vecino que entra.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate({
            data: { code: form.code, name: form.name, phone: form.phone, zone: form.zone || undefined },
          });
        }}
      >
        <h2 className="text-lg font-black">Tengo un código de invitación</h2>
        <Field label="Código" value={form.code} onChange={set("code")} placeholder="VILLAS-XXXXXX" autoCapitalize="characters" required />
        <Field label="Tu nombre" value={form.name} onChange={set("name")} autoComplete="name" required minLength={2} />
        <Field label="Tu WhatsApp (10 dígitos)" value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" required />
        <Field label="Privada o sección (opcional)" value={form.zone} onChange={set("zone")} />
        <p className="text-xs text-muted">
          Tu WhatsApp solo lo ve {firstName} para darte acceso. Nunca apareces en el mapa.
        </p>
        {join.isError && <p className="text-sm text-alert">{errorMessage(join.error, "No se pudo registrar.")}</p>}
        <button
          disabled={join.isPending}
          className="w-full rounded-2xl bg-primary py-3.5 font-black text-space disabled:opacity-50"
        >
          {join.isPending ? "Enviando…" : "Pedir mi llave"}
        </button>
      </form>

      {creator.whatsapp && (
        <a
          href={whatsappLink(creator.whatsapp, "Hola, me gustaría entrar a la guía de vecinos de Villas.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 text-center text-sm text-muted underline underline-offset-4"
        >
          ¿Sin código? Escríbele a {firstName}
        </a>
      )}
    </Shell>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-white/15 bg-space-2 px-4 py-3 text-[15px] outline-none focus:border-primary"
      />
    </label>
  );
}

/** /llave/:token — el link que el creador envía por WhatsApp. */
export function KeyLoginPage({ token }: { token: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const login = useLoginWithKey({
    mutation: {
      onSuccess: (me) => {
        qc.setQueryData(getGetMeQueryKey(), me);
        // Quita la llave de la barra de direcciones y del historial.
        navigate("/", { replace: true });
      },
    },
  });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    login.mutate({ data: { token } });
  }, [login, token]);

  return (
    <Shell>
      <div className="text-center">
        <KeyRound className="mx-auto mb-4 text-primary" size={40} />
        {login.isError ? (
          <>
            <h1 className="mb-2 text-2xl font-black">Esta llave ya no abre</h1>
            <p className="mb-6 text-ink/80">{errorMessage(login.error, "Pide una nueva al creador.")}</p>
            <a href="/" className="text-primary underline">Ir al inicio</a>
          </>
        ) : (
          <h1 className="text-2xl font-black">Abriendo Villas…</h1>
        )}
      </div>
    </Shell>
  );
}
