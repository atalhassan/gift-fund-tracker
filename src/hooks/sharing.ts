import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import type { FundShareLink, Role, ShareRole } from "../types";

/** localStorage key for a share token seen while signed out; redeemed
 * automatically after the next sign-in (including the return from an
 * email-confirmation link, where router state is lost). */
export const PENDING_JOIN_KEY = "pending_join_token";

export type MemberRow = {
  id: string;
  user_id: string;
  role: Role;
  profile: { display_name: string | null; email: string | null; phone: string | null } | null;
};

export function useMembers(fundId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["members", user?.id, fundId],
    enabled: !!user,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from("fund_members")
        .select("id, user_id, role, profile:profiles!fund_members_user_id_fkey(display_name, email, phone)")
        .eq("fund_id", fundId)
        .order("created_at");
      if (error) throw error;
      return data as unknown as MemberRow[];
    },
  });
}

export function useRemoveMember(fundId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("fund_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["members", user?.id, fundId] }),
  });
}

/** Owner-only by RLS: non-owners simply get an empty list. */
export function useShareLinks(fundId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["share-links", user?.id, fundId],
    enabled: !!user,
    queryFn: async (): Promise<FundShareLink[]> => {
      const { data, error } = await supabase
        .from("fund_share_links")
        .select("*")
        .eq("fund_id", fundId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Generated row types keep role as plain string; narrow to ShareRole.
      return data as unknown as FundShareLink[];
    },
  });
}

export function useCreateShareLink(fundId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { role: ShareRole; expiryDays: number | null; maxUses: number | null }) => {
      // token comes from the column default (gen_random_bytes in Postgres)
      const { data, error } = await supabase
        .from("fund_share_links")
        .insert({
          fund_id: fundId,
          created_by: user!.id,
          role: input.role,
          expires_at: input.expiryDays
            ? new Date(Date.now() + input.expiryDays * 86_400_000).toISOString()
            : null,
          max_uses: input.maxUses,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["share-links", user?.id, fundId] }),
  });
}

export function useRevokeShareLink(fundId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("fund_share_links")
        .update({ revoked: true })
        .eq("id", linkId);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["share-links", user?.id, fundId] }),
  });
}
