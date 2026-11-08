import { useEffect, useRef, useState } from "react";
import { useAdminKpis, type AdminKpi } from "@workspace/api-client-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

/**
 * Pestaña KPIs del panel. Arriba un tablero con todos los indicadores (tocar uno
 * te lleva a su tarjeta) y una barra fija de secciones para brincar entre ellas.
 * Los números y metas vienen calculados del servidor (lib/kpis.ts).
 */
const STATUS_COLOR: Record<AdminKpi["status"], string> = {
  good: "#50e3c2",
  warn: "#e6c882",
  bad: "#ffabab",
  none: "#a6abd6",
};
const STATUS_TEXT: Record<AdminKpi["status"], string> = {
  good: "En meta",
  warn: "Cerca",
  bad: "Lejos de la meta",
  none: "Sin meta",
};

const anchor = (id: string) => `kpi-${id}`;

function scrollTo(id: string) {
  document.getElementById(anchor(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function KpiPanel() {
  const { data } = useAdminKpis();
  const [active, setActive] = useState<string | null>(null);
  const observed = useRef<IntersectionObserver | null>(null);

  // Marca en la barra la sección que estás viendo.
  useEffect(() => {
    if (!data) return;
    observed.current?.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.getAttribute("data-section"));
      },
      { rootMargin: "-170px 0px -55% 0px" },
    );
    data.sections.forEach((s) => {
      const el = document.getElementById(anchor(s.id));
      if (el) io.observe(el);
    });
    observed.current = io;
    return () => io.disconnect();
  }, [data]);

  // La barra de secciones sigue a la sección activa (en celular no caben todas).
  useEffect(() => {
    // Solo se mueve la barra (no scrollIntoView, que frenaría el desplazamiento de la página).
    const chip = active ? document.getElementById(`kpi-chip-${active}`) : null;
    const bar = chip?.parentElement;
    if (chip && bar) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
  }, [active]);

  if (!data) return <p className="text-sm text-muted">Calculando…</p>;

  return (
    <div className="space-y-6">
      <nav
        aria-label="Secciones de KPIs"
        className="sticky top-[calc(env(safe-area-inset-top)+92px)] z-[5] -mx-4 flex gap-1.5 overflow-x-auto border-b border-white/10 bg-space/95 px-4 py-2 backdrop-blur"
      >
        {data.sections.map((s) => (
          <button
            key={s.id}
            id={`kpi-chip-${s.id}`}
            onClick={() => {
              setActive(s.id);
              scrollTo(s.id);
            }}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
              active === s.id ? "border-primary bg-primary/20 text-ink" : "border-white/15 text-muted"
            }`}
          >
            {s.title}
          </button>
        ))}
      </nav>

      <section aria-label="Tablero" className="rounded-2xl bg-panel p-3">
        <p className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-muted">Tablero · últimos 30 días</p>
        <ul className="divide-y divide-white/5">
          {data.sections.flatMap((s) =>
            s.kpis.map((k) => (
              <li key={k.id}>
                <button onClick={() => scrollTo(k.id)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left active:bg-white/5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[k.status] }} aria-label={STATUS_TEXT[k.status]} />
                  <span className="flex-1 text-sm">{k.label}</span>
                  <span className="text-sm font-black tabular-nums" style={{ color: k.status === "none" ? undefined : STATUS_COLOR[k.status] }}>
                    {k.display}
                  </span>
                  <TrendIcon k={k} />
                </button>
              </li>
            )),
          )}
        </ul>
      </section>

      {data.sections.map((s) => (
        <section key={s.id} id={anchor(s.id)} data-section={s.id} className="scroll-mt-44 space-y-3">
          <header>
            <h2 className="text-lg font-black">{s.title}</h2>
            <p className="text-sm text-muted">{s.question}</p>
          </header>
          {s.kpis.map((k) => (
            <KpiCard key={k.id} k={k} />
          ))}
          {s.id === "negocios" && data.idlePlaces.length > 0 && (
            <div className="rounded-2xl border border-alert/30 bg-alert/5 p-4">
              <p className="text-sm font-black">Sin movimiento en 30 días</p>
              <p className="mb-2 text-xs text-muted">Visítalos antes de que se desanimen.</p>
              <p className="text-sm">{data.idlePlaces.join(" · ")}</p>
            </div>
          )}
          {s.note && <p className="px-1 text-xs text-muted">{s.note}</p>}
        </section>
      ))}
    </div>
  );
}

function TrendIcon({ k }: { k: AdminKpi }) {
  if (k.trend === "none") return <span className="w-4" />;
  const color = k.trendGood == null ? "#a6abd6" : k.trendGood ? "#50e3c2" : "#ffabab";
  const Icon = k.trend === "up" ? ArrowUpRight : k.trend === "down" ? ArrowDownRight : ArrowRight;
  return <Icon size={16} style={{ color }} aria-label={k.trend === "flat" ? "Igual" : k.trend === "up" ? "Subió" : "Bajó"} />;
}

function KpiCard({ k }: { k: AdminKpi }) {
  const color = STATUS_COLOR[k.status];
  return (
    <article id={anchor(k.id)} className="scroll-mt-44 rounded-2xl border-l-4 bg-panel p-4" style={{ borderLeftColor: color }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold">{k.label}</p>
        {k.status !== "none" && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${color}22`, color }}>
            {STATUS_TEXT[k.status]}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-3xl font-black tabular-nums" style={{ color: k.status === "none" ? undefined : color }}>
          {k.display}
        </p>
        {k.previousDisplay != null && (
          <p className="flex items-center gap-1 text-xs text-muted">
            <TrendIcon k={k} /> antes {k.previousDisplay}
          </p>
        )}
      </div>
      {k.detail && <p className="text-xs text-muted">{k.detail}</p>}
      {k.targetLabel && <p className="mt-1 text-xs font-bold text-muted">{k.targetLabel}</p>}
      <p className="mt-2 border-t border-white/5 pt-2 text-xs text-muted">{k.why}</p>
    </article>
  );
}
