/**
 * Modo comercio: el teléfono del negocio registra visitas de vecinos.
 * El comercio no instala nada: apunta la cámara normal de su celular al QR
 * de la credencial y el link abre aquí, ya con su sesión de comercio.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMerchantLogin,
  useGetMerchantMe,
  getGetMerchantMeQueryKey,
  useMerchantLookupMember,
  getMerchantLookupMemberQueryKey,
  useMerchantRecordVisit,
  type VisitResult,
} from "@workspace/api-client-react";
import { Camera, Check, Gift, Store, Star } from "lucide-react";
import { Shell, errorMessage } from "@/pages/AccessPages";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "short", hour: "2-digit", minute: "2-digit" });

function useMerchant() {
  return useGetMerchantMe({ query: { queryKey: getGetMerchantMeQueryKey(), retry: false, staleTime: 15_000 } });
}

/** /comercio/<token>: abre el modo comercio en este teléfono y quita el token de la barra. */
export function MerchantKeyPage({ token }: { token: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const login = useMerchantLogin({
    mutation: {
      onSuccess: (m) => {
        qc.setQueryData(getGetMerchantMeQueryKey(), m);
        navigate("/comercio", { replace: true });
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
        <Store className="mx-auto mb-4 text-confianza" size={40} />
        {login.isError ? (
          <>
            <h1 className="mb-2 text-2xl font-black">Este link ya no abre</h1>
            <p className="text-ink/80">{errorMessage(login.error, "Pide uno nuevo al creador.")}</p>
          </>
        ) : (
          <h1 className="text-2xl font-black">Abriendo modo comercio…</h1>
        )}
      </div>
    </Shell>
  );
}

/** /comercio: la pantalla de la caja. */
export function MerchantHomePage() {
  const [, navigate] = useLocation();
  const { data: m, isLoading, isError } = useMerchant();
  const [code, setCode] = useState("");

  if (isLoading) return <Shell><p className="text-center text-muted">Cargando…</p></Shell>;
  if (isError || !m) return <NoMerchant />;

  return (
    <Shell>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-confianza">Modo comercio</p>
      <h1 className="mb-5 text-3xl font-black leading-tight">{m.placeName}</h1>

      <div className="mb-4 rounded-3xl border border-confianza/40 bg-panel p-5">
        <Camera className="mb-2 text-confianza" size={28} />
        <p className="text-lg font-black">Escanea la credencial del vecino</p>
        <p className="mt-1 text-sm text-ink/80">
          Abre la cámara normal de tu celular y apunta al código QR que te enseña el vecino. Toca el link que aparece y confirma la visita.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
            if (c.length >= 4) navigate(`/v/${c}`);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="O escribe su código"
            autoCapitalize="characters"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-space-2 px-3 py-2.5 font-mono text-sm uppercase tracking-widest outline-none placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-confianza"
          />
          <button className="rounded-xl bg-confianza px-4 text-sm font-black text-space">Buscar</button>
        </form>
      </div>

      {m.welcomeOffer && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-[#E6C882]/10 p-3 text-sm text-[#E6C882]">
          <Gift size={18} className="shrink-0" />
          <span>
            Tu regalo de bienvenida: <b>{m.welcomeOffer}</b>
          </span>
        </p>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Hoy" value={m.todayVisits} />
        <Stat label="Visitas" value={m.totalVisits} />
        <Stat label="Vecinos" value={m.neighbors} />
      </div>

      {m.recent.length > 0 && (
        <div className="rounded-2xl bg-panel/70 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Últimas visitas</p>
          <ul className="space-y-1.5 text-sm">
            {m.recent.map((v, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {v.firstName}
                  {v.welcomeApplied && <span className="text-[#E6C882]"> · regalo</span>}
                </span>
                <span className="text-muted">{fmtTime(v.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-6 text-center text-xs text-muted">
        Tip: agrega esta página a la pantalla de inicio de tu celular para abrirla rápido.
      </p>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-panel p-3">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function NoMerchant() {
  return (
    <Shell>
      <div className="text-center">
        <Store className="mx-auto mb-4 text-muted" size={40} />
        <h1 className="mb-2 text-2xl font-black">Este teléfono no tiene el modo comercio</h1>
        <p className="mb-6 text-ink/80">Abre el link de comercio que te mandó el creador por WhatsApp.</p>
        <Link href="/" className="text-sm text-muted underline">Ir al universo de Villas</Link>
      </div>
    </Shell>
  );
}

/**
 * /v/<código>: lo que abre el QR de la credencial.
 * En el teléfono de un comercio: confirmar la visita. En cualquier otro: qué es esto.
 */
export function MemberPassPage({ code }: { code: string }) {
  const merchant = useMerchant();
  if (merchant.isLoading) return <Shell><p className="text-center text-muted">Cargando…</p></Shell>;
  if (merchant.isError || !merchant.data) {
    return (
      <Shell>
        <div className="text-center">
          <Star className="mx-auto mb-4 text-me" size={40} fill="currentColor" />
          <h1 className="mb-2 text-2xl font-black">Credencial de vecino de Villas</h1>
          <p className="mb-6 text-ink/80">
            Los comercios de Villas la escanean para encender su estrella en el cielo del vecino y darle su regalo de bienvenida.
          </p>
          <Link href="/" className="inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-space">
            Ver el universo de Villas
          </Link>
        </div>
      </Shell>
    );
  }
  return <ConfirmVisit code={code} placeName={merchant.data.placeName} />;
}

function ConfirmVisit({ code, placeName }: { code: string; placeName: string }) {
  const qc = useQueryClient();
  const lookup = useMerchantLookupMember(code, {
    query: { queryKey: getMerchantLookupMemberQueryKey(code), retry: false, staleTime: 0 },
  });
  const [done, setDone] = useState<VisitResult | null>(null);
  const record = useMerchantRecordVisit({
    mutation: {
      onSuccess: (r) => {
        setDone(r);
        void qc.invalidateQueries({ queryKey: getGetMerchantMeQueryKey() });
      },
    },
  });

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-confianza text-space">
            <Check size={44} strokeWidth={3} />
          </div>
          {done.duplicate ? (
            <>
              <h1 className="mb-2 text-2xl font-black">Ya estaba registrada</h1>
              <p className="mb-6 text-ink/80">La visita de {done.firstName} ya se contó hace poco. No se suma dos veces.</p>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-2xl font-black">Estrella encendida para {done.firstName}</h1>
              <p className="mb-4 text-ink/80">
                {done.visitsHere === 1 ? "Es su primera visita a " : `Lleva ${done.visitsHere} visitas en `}
                {placeName}.
              </p>
              {done.welcomeApplied && done.welcomeOffer && (
                <p className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-[#E6C882]/15 p-4 text-lg font-black text-[#E6C882]">
                  <Gift size={22} className="shrink-0" /> <span>Aplica: {done.welcomeOffer}</span>
                </p>
              )}
            </>
          )}
          <Link href="/comercio" className="inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-space">
            Listo, escanear otro
          </Link>
        </div>
      </Shell>
    );
  }

  if (lookup.isLoading) return <Shell><p className="text-center text-muted">Buscando credencial…</p></Shell>;
  if (lookup.isError || !lookup.data) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-black">Credencial no válida</h1>
          <p className="mb-6 text-ink/80">{errorMessage(lookup.error, "Revisa el código e inténtalo de nuevo.")}</p>
          <Link href="/comercio" className="text-sm text-muted underline">Volver</Link>
        </div>
      </Shell>
    );
  }

  const m = lookup.data;
  return (
    <Shell>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-confianza">{placeName}</p>
      <h1 className="mb-1 text-3xl font-black">{m.firstName}</h1>
      <p className="mb-5 text-ink/80">
        {m.visitsHere === 0 ? "Primera visita a tu comercio." : `Ha venido ${m.visitsHere} ${m.visitsHere === 1 ? "vez" : "veces"}.`}
      </p>
      {m.welcomeOffer && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl bg-[#E6C882]/15 p-4 font-black text-[#E6C882]">
          <Gift size={20} className="shrink-0" /> <span>Al confirmar, aplica: {m.welcomeOffer}</span>
        </p>
      )}
      {m.recentlyRecorded && (
        <p className="mb-5 rounded-2xl bg-panel p-3 text-sm text-muted">
          Ya registraste una visita de {m.firstName} hace menos de 2 horas; no se sumará otra.
        </p>
      )}
      {record.isError && <p className="mb-3 text-sm text-alert">{errorMessage(record.error, "No se pudo registrar. Inténtalo de nuevo.")}</p>}
      <button
        onClick={() => record.mutate({ data: { code } })}
        disabled={record.isPending}
        className="w-full rounded-2xl bg-confianza py-4 text-lg font-black text-space active:scale-[0.98] disabled:opacity-60"
      >
        {record.isPending ? "Registrando…" : "Confirmar visita"}
      </button>
      <Link href="/comercio" className="mt-4 block text-center text-sm text-muted">
        Cancelar
      </Link>
    </Shell>
  );
}
