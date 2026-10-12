import { Route, Switch, Redirect } from "wouter";
import {
  useGetCreator,
  useGetMe,
  getGetCreatorQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { UniversePage } from "@/pages/UniversePage";
import { LandingPage, KeyLoginPage } from "@/pages/AccessPages";
import { AdminPage } from "@/pages/AdminPage";

export default function App() {
  const creator = useGetCreator({ query: { queryKey: getGetCreatorQueryKey(), staleTime: Infinity } });
  // 401 = sin sesión: se muestra la entrada, no es un error.
  const me = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 5 * 60_000 },
  });

  if (creator.isLoading || (me.isLoading && !me.isError)) {
    return <div className="grid h-full place-items-center text-sm text-muted">Villas…</div>;
  }
  if (!creator.data) {
    return <div className="grid h-full place-items-center p-6 text-center text-sm text-alert">No pude conectar. Revisa tu conexión e inténtalo de nuevo.</div>;
  }

  return (
    <Switch>
      <Route path="/llave/:token">{(p) => <KeyLoginPage token={p.token} />}</Route>
      <Route path="/panel">
        {me.data?.role === "admin" ? <AdminPage creator={creator.data} /> : <Redirect to="/" />}
      </Route>
      <Route>
        {me.data ? <UniversePage me={me.data} creator={creator.data} /> : <LandingPage creator={creator.data} />}
      </Route>
    </Switch>
  );
}
