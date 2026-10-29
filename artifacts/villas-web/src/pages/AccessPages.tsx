import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRequestAccess,
  useLoginWithKey,
  useGetCreator,
  getGetCreatorQueryKey,
  getGetMeQueryKey,
  type Creator,
} from "@workspace/api-client-react";
import { KeyRound, MessageCircle } from "lucide-react";
import { CreatorAvatar } from "@/components/CreatorSheet";
import { whatsappLink } from "@/lib/constellations";

export const errorMessage = (err: unknown, fallback: string) => {
  const data = (err as { data?: { message?: string } } | null)?.data;
  return data?.message ?? fallback;
};

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full overflow-y-auto">
      <div className="sky" aria-hidden />
      <main className="relative mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">{children}</main>
    </div>
  );
}

/**
 * Para quien aún no entra: qué es y cómo pedir entrar. Sin códigos ni llaves:
 * deja nombre y WhatsApp, y el creador lo conoce en persona y le muestra su QR.
 */
export function LandingPage({ creator }: { creator: Creator }) {
  const request = useRequestAccess();
  const [form, setForm] = useState({ name: "", phone: "", zone: "" });
  const firstName = creator.name.split(" ")[0] ?? creator.name;

  if (request.isSuccess) {
    return (
      <Shell>
        <h1 className="mb-3 text-3xl font-black">¡Listo, {form.name.split(" ")[0]}!</h1>
        <p className="mb-6 text-ink/90">
          {firstName} te va a buscar para conocerte. Cuando se vean, te enseña un código QR en su teléfono: lo escaneas con tu
          cámara y ya estás dentro.
        </p>
        <Link href="/" className="block rounded-2xl bg-primary py-3.5 text-center font-black text-space">
          Mientras, ver la guía
        </Link>
      </Shell>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Shell>
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">OrbiTú Villas</p>
      <h1 className="mb-4 text-4xl font-black leading-tight">
        La guía de confianza, hecha por los vecinos.
      </h1>
      <p className="mb-8 text-ink/85">
        Encuentra casas, gente de confianza y comercios de Villas, muchas veces con el nombre del vecino que los recomienda.
        Sin scroll infinito: preguntas qué necesitas y ves qué te queda cerca.
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
          request.mutate({ data: { name: form.name, phone: form.phone, zone: form.zone || null } });
        }}
      >
        <h2 className="text-lg font-black">Quiero entrar</h2>
        <Field label="Tu nombre" value={form.name} onChange={set("name")} autoComplete="name" required minLength={2} maxLength={80} />
        <Field label="Tu WhatsApp (10 dígitos)" value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" required />
        <Field label="Privada o sección (opcional)" value={form.zone} onChange={set("zone")} maxLength={80} />
        <p className="text-xs text-muted">Tu WhatsApp solo lo ve {firstName}, para contactarte y darte de alta.</p>
        {request.isError && <p className="text-sm text-alert">{errorMessage(request.error, "No se pudo enviar. Intenta otra vez.")}</p>}
        <button
          disabled={request.isPending}
          className="w-full rounded-2xl bg-primary py-3.5 font-black text-space disabled:opacity-50"
        >
          {request.isPending ? "Enviando…" : "Enviar"}
        </button>
      </form>

      <Link href="/" className="mt-6 block text-center text-sm font-bold text-primary underline underline-offset-4">
        Primero quiero ver la guía
      </Link>
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
  const creator = useGetCreator({ query: { queryKey: getGetCreatorQueryKey(), staleTime: Infinity } });
  const creatorFirst = creator.data?.name.split(" ")[0] ?? "el creador";
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
            <h1 className="mb-2 text-2xl font-black">Este acceso ya no abre</h1>
            <p className="mb-6 text-ink/80">
              {errorMessage(login.error, "Pide una nueva al creador.").replace("al creador", `a ${creatorFirst}`)}
            </p>
            {creator.data?.whatsapp && (
              <a
                href={whatsappLink(creator.data.whatsapp, `Hola ${creatorFirst}, mi acceso a OrbiTú Villas ya no abre. ¿Me das uno nuevo?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-space"
              >
                <MessageCircle size={18} /> Pedir acceso nuevo a {creatorFirst}
              </a>
            )}
            <a href="/" className="block text-sm text-muted underline">Ir al inicio</a>
          </>
        ) : (
          <h1 className="text-2xl font-black">Abriendo OrbiTú Villas…</h1>
        )}
      </div>
    </Shell>
  );
}
