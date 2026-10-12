import { Route, Switch, Redirect } from "wouter";
import {
  useGetCreator,
  useGetMe,
  useGetSetupStatus,
  getGetCreatorQueryKey,
  getGetMeQueryKey,
  getGetSetupStatusQueryKey,
} from "@workspace/api-client-react";
import { UniversePage } from "@/pages/UniversePage";
import { LandingPage, KeyLoginPage } from "@/pages/AccessPages";
import { AdminPage } from "@/pages/AdminPage";
import { NeedsSetup, SetupPage } from "@/pages/SetupPage";

export default function App() {
  return (
    <Switch>
      {/* Siempre accesibles, aunque el sitio no esté configurado. */}
      <Route path="/setup" component={SetupPage} />
      <Route path="/llave/:token">{(p) => <KeyLoginPage token={p.token} />}</Route>
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

  if (setup.isLoading || creator.isLoading || (me.isLoading && !me.isError)) {
    return <div className="grid h-full place-items-center text-sm text-muted">Villas…</div>;
  }
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
      <Route>
        {me.data ? <UniversePage me={me.data} creator={creator.data} /> : <LandingPage creator={creator.data} />}
      </Route>
    </Switch>
  );
}
