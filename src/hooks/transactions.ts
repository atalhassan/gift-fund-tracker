import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { todayISO } from "../format";
import type { TxType } from "../types";

export const PAGE_SIZE = 20;

export type TxFilters = {
  type: TxType | "all";
  from: string; // "" = no lower bound (yyyy-mm-dd)
  to: string;
};

export const NO_FILTERS: TxFilters = { type: "all", from: "", to: "" };

export type TxRow = {
  id: string;
  fund_id: string;
  created_by: string;
  type: TxType;
  amount: number;
  description: string | null;
  category: string | null;
  occurred_at: string;
  created_at: string | null;
  author: { display_name: string | null } | null;
};

const TX_SELECT = "*, author:profiles!transactions_created_by_fkey(display_name)";

/** Newest-first, paginated, server-side filtered. */
export function useTransactions(fundId: string, filters: TxFilters) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["txs", user?.id, fundId, filters],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<TxRow[]> => {
      let q = supabase
        .from("transactions")
        .select(TX_SELECT)
        .eq("fund_id", fundId)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (filters.type !== "all") q = q.eq("type", filters.type);
      if (filters.from) q = q.gte("occurred_at", filters.from);
      if (filters.to) q = q.lte("occurred_at", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as TxRow[];
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
  });
}

/** No occurred_at: entries are stamped with the day they're logged. The column
 * still defaults to current_date, but that resolves in the database's timezone
 * (UTC) — sending the client's own today keeps a late-evening entry in UTC+3
 * from landing on the wrong day. */
export type TxInput = {
  type: TxType;
  amount: number;
  description: string;
};

/** Everything a transaction change must refresh besides the list itself:
 * balances on the dashboard and the fund detail header. */
function invalidateTxSideEffects(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["funds"] });
  qc.invalidateQueries({ queryKey: ["fund"] });
}

/** Optimistic add: the row appears in the list immediately and is rolled
 * back if Postgres rejects it (e.g. RLS denies a collaborator credit). */
export function useAddTx(fundId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listKey = ["txs", user?.id, fundId];

  return useMutation({
    mutationFn: async (input: TxInput) => {
      const { error } = await supabase.from("transactions").insert({
        fund_id: fundId,
        created_by: user!.id,
        type: input.type,
        amount: input.amount,
        description: input.description || null,
        occurred_at: todayISO(),
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: listKey });
      const snapshots = qc.getQueriesData<InfiniteData<TxRow[]>>({ queryKey: listKey });
      const optimistic: TxRow = {
        id: `optimistic-${Date.now()}`,
        fund_id: fundId,
        created_by: user!.id,
        type: input.type,
        amount: input.amount,
        description: input.description || null,
        category: null,
        occurred_at: todayISO(),
        created_at: new Date().toISOString(),
        author: null,
      };
      for (const [key, data] of snapshots) {
        if (!data?.pages.length) continue;
        qc.setQueryData<InfiniteData<TxRow[]>>(key, {
          ...data,
          pages: [[optimistic, ...data.pages[0]], ...data.pages.slice(1)],
        });
      }
      return { snapshots };
    },
    onError: (_err, _input, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listKey });
      invalidateTxSideEffects(qc);
    },
  });
}

export function useUpdateTx(fundId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    // occurred_at is not editable: the entry date is whatever day it was
    // logged, and there is no date field to change it with.
    mutationFn: async (input: { id: string } & Omit<TxInput, "type">) => {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          amount: input.amount,
          description: input.description || null,
        })
        .eq("id", input.id)
        .select("id");
      if (error) throw error;
      // RLS silently filters rows the caller may not edit: 0 rows = denied.
      if (!data.length) throw new Error("You can't edit this transaction.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["txs", user?.id, fundId] });
      invalidateTxSideEffects(qc);
    },
  });
}

export function useDeleteTx(fundId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["txs", user?.id, fundId] });
      invalidateTxSideEffects(qc);
    },
  });
}
