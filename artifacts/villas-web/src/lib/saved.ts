import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMySaved,
  getGetMySavedQueryKey,
  useSavePlace,
  useUnsavePlace,
  type SavedPlaces,
} from "@workspace/api-client-react";

/**
 * Guardados del vecino (se guardan en el servidor: sobreviven a reinstalar la app
 * y en iPhone la app instalada y Safari no comparten almacenamiento).
 * El cambio se ve al instante y se deshace solo si el servidor falla.
 */
export function useSaved(enabled: boolean) {
  const qc = useQueryClient();
  const key = getGetMySavedQueryKey();
  const { data } = useGetMySaved({ query: { queryKey: key, enabled, staleTime: 60_000 } });
  const ids = useMemo(() => data?.placeIds ?? [], [data]);
  const set = useMemo(() => new Set(ids), [ids]);

  const optimistic = (id: string, on: boolean) => {
    const prev = qc.getQueryData<SavedPlaces>(key);
    const list = prev?.placeIds ?? [];
    qc.setQueryData<SavedPlaces>(key, { placeIds: on ? [id, ...list.filter((x) => x !== id)] : list.filter((x) => x !== id) });
    return { prev };
  };
  const rollback = (_e: unknown, _v: unknown, ctx?: { prev?: SavedPlaces }) => qc.setQueryData(key, ctx?.prev);
  const save = useSavePlace({
    mutation: { onMutate: ({ id }) => optimistic(id, true), onError: rollback },
  });
  const unsave = useUnsavePlace({
    mutation: { onMutate: ({ id }) => optimistic(id, false), onError: rollback },
  });

  return {
    ids,
    has: (id: string) => set.has(id),
    toggle: (id: string) => (set.has(id) ? unsave.mutate({ id }) : save.mutate({ id })),
  };
}
