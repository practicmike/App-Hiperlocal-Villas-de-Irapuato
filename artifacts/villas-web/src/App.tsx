import { Route, Switch, Redirect } from "wouter";
import {
  useGetCreator,
  useGetMe,
  useGetSetupStatus,
  useGetMerchantMe,
  getGetMerchantMeQueryKey,
  getGetCreatorQueryKey,
  getGetMeQueryKey,
  getGetSetupStatusQueryKey,
} from "@workspace/api-client-react";
import { UniversePage } from "@/pages/UniversePage";
import { LandingPage, KeyLoginPage } from "@/pages/AccessPages";
import { AdminPage } from "@/pages/AdminPage";
import { NeedsSetup, SetupPage } from "@/pages/SetupPage";
import { MerchantHomePage, MerchantKeyPage, MemberPassPage } from "@/pages/MerchantPages";

export default function App() {
  return (
    <Switch>
      {/* Siempre accesibles, aunque el sitio no esté configurado. */}
      <Route path="/setup" component={SetupPage} />
      <Route path="/llave/:token">{(p) => <KeyLoginPage token={p.token} />}</Route>
      {/* Modo comercio y credencial: no cargan el universo, solo lo necesario en la caja. */}
      <Route path="/comercio/:token">{(p) => <MerchantKeyPage token={p.token} />}</Route>
      <Route path="/comercio" component={MerchantHomePage} />
      <Route path="/v/:code">{(p) => <MemberPassPage code={p.code} />}</Route>
      <Route>
        <Main />
      </Route>
    </Switch>
  );
}

function Main() {
  const setup = useGetSetupStatus({
    query: { queryKey: getGetSetupStatusQueryKey(), retry: false, staleTime: 60_000 },
  });
  const creator = useGetCreator({ query: { queryKey: getGetCreatorQueryKey(), staleTime: Infinity } });
  // 401 = sin sesión: se muestra la entrada, no es un error.
  const me = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 5 * 60_000 },
  });

  // App instalada abierta en el teléfono de un comercio (sin cuenta de vecino): directo al modo comercio.
  const fromApp = new URLSearchParams(window.location.search).get("fuente") === "app";
  const merchant = useGetMerchantMe({
    query: { queryKey: getGetMerchantMeQueryKey(), enabled: fromApp && me.isError, retry: false, staleTime: 60_000 },
  });

  if (setup.isLoading || creator.isLoading || (me.isLoading && !me.isError) || (fromApp && me.isError && merchant.isLoading)) {
    return <BootSplash />;
  }
  if (fromApp && !me.data && merchant.data) return <Redirect to="/comercio" replace />;
  // Sitio sin terminar de configurar o API que no responde: decir qué falta, no un error genérico.
  if (setup.isError || !creator.data) return <NeedsSetup problem={null} />;
  if (setup.data && (!setup.data.tablesReady || !setup.data.hasAdmin || setup.data.problem)) {
    return <NeedsSetup problem={setup.data.problem} />;
  }

  return (
    <Switch>
      <Route path="/panel">
        {me.data?.role === "admin" ? <AdminPage creator={creator.data} /> : <Redirect to="/" />}
      </Route>
      <Route path="/unirme">
        {me.data ? <Redirect to="/" /> : <LandingPage creator={creator.data} />}
      </Route>
      {/* Con llave: su universo. Sin llave: vista previa limitada del mismo universo. */}
      <Route>
        <UniversePage me={me.data ?? null} creator={creator.data} />
      </Route>
    </Switch>
  );
}

/** Mismo splash que index.html, para que no haya salto al montar React. */
function BootSplash() {
  return (
    <div className="grid h-full place-items-center" style={{ background: "radial-gradient(circle at 50% 45%, #1d2160 0%, #0b0d1f 62%)" }}>
      <div className="text-center">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="boot-pulse mx-auto h-24 w-24 rounded-[22px]" />
        <p className="mt-4 text-[22px] font-black tracking-wide">villas</p>
      </div>
    </div>
  );
}
