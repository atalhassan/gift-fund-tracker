import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import type { Fund, FundBalance, Role } from "../types";

export type FundWithBalance = Fund & {
  balance: FundBalance | null;
  role: Role;
  isOwner: boolean;
  /** Read-only member: sees everything, logs nothing (enforced by RLS). */
  isViewer: boolean;
};

function withRole(fund: Fund, balance: FundBalance | null, userId: string, memberRole: Role | undefined): FundWithBalance {
  const role: Role = fund.owner_id === userId ? "owner" : memberRole ?? "collaborator";
  return { ...fund, balance, role, isOwner: role === "owner", isViewer: role === "viewer" };
}

/** All funds the user can access (RLS scopes the reads), with balances and
 * the caller's role. The user_id filter on fund_members is semantic, not a
 * redundant RLS mirror: members see the whole roster, and we want only the
 * caller's own rows here. */
export function useFunds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["funds", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FundWithBalance[]> => {
      const [funds, balances, memberships] = await Promise.all([
        supabase.from("funds").select("*"),
        supabase.from("fund_balances").select("*"),
        supabase.from("fund_members").select("fund_id, role").eq("user_id", user!.id),
      ]);
      if (funds.error) throw funds.error;
      if (balances.error) throw balances.error;
      if (memberships.error) throw memberships.error;
      const byFund = new Map(balances.data.map((b) => [b.fund_id, b]));
      const roleByFund = new Map(memberships.data.map((m) => [m.fund_id, m.role as Role]));
      return funds.data.map((f) =>
        withRole(f, byFund.get(f.id) ?? null, user!.id, roleByFund.get(f.id))
      );
    },
  });
}

export function useFund(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fund", user?.id, id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<FundWithBalance | null> => {
      const [fund, balance, membership] = await Promise.all([
        supabase.from("funds").select("*").eq("id", id!).maybeSingle(),
        supabase.from("fund_balances").select("*").eq("fund_id", id!).maybeSingle(),
        supabase
          .from("fund_members")
          .select("role")
          .eq("fund_id", id!)
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);
      if (fund.error) throw fund.error;
      if (balance.error) throw balance.error;
      if (membership.error) throw membership.error;
      if (!fund.data) return null;
      return withRole(fund.data, balance.data, user!.id, membership.data?.role as Role | undefined);
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
