import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import type { Fund, FundBalance } from "../types";

export type FundWithBalance = Fund & {
  balance: FundBalance | null;
  isOwner: boolean;
};

/** All funds the user can access (RLS scopes the reads), with balances and
 * ownership. Role comes from funds.owner_id — no membership query needed. */
export function useFunds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["funds", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FundWithBalance[]> => {
      const [funds, balances] = await Promise.all([
        supabase.from("funds").select("*"),
        supabase.from("fund_balances").select("*"),
      ]);
      if (funds.error) throw funds.error;
      if (balances.error) throw balances.error;
      const byFund = new Map(balances.data.map((b) => [b.fund_id, b]));
      return funds.data.map((f) => ({
        ...f,
        balance: byFund.get(f.id) ?? null,
        isOwner: f.owner_id === user!.id,
      }));
    },
  });
}

export function useFund(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fund", user?.id, id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<FundWithBalance | null> => {
      const [fund, balance] = await Promise.all([
        supabase.from("funds").select("*").eq("id", id!).maybeSingle(),
        supabase.from("fund_balances").select("*").eq("fund_id", id!).maybeSingle(),
      ]);
      if (fund.error) throw fund.error;
      if (balance.error) throw balance.error;
      if (!fund.data) return null;
      return {
        ...fund.data,
        balance: balance.data,
        isOwner: fund.data.owner_id === user!.id,
      };
    },
  });
}

export function useCreateFund() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description: string; currency: string }) => {
      // owner_id must be set explicitly: the insert policy checks it against
      // auth.uid() and the column has no default.
      const { data, error } = await supabase
        .from("funds")
        .insert({
          name: input.name,
          description: input.description || null,
          currency: input.currency,
          owner_id: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funds"] }),
  });
}

export function useUpdateFund(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from("funds")
        .update({ name: input.name, description: input.description || null })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funds"] });
      qc.invalidateQueries({ queryKey: ["fund"] });
    },
  });
}

export function useDeleteFund(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("funds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funds"] });
      qc.removeQueries({ queryKey: ["fund"] });
    },
  });
}
