-- Lock down SECURITY DEFINER functions flagged by the Supabase security
-- advisor: none of these should be callable through the Data API's
-- /rest/v1/rpc endpoint (redeem_share_link is the one intentional RPC and
-- already has its own grants).

-- Trigger functions: only ever invoked by their triggers.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_fund() from public, anon, authenticated;

-- RLS helper predicates: policies evaluate these as the querying role, so
-- authenticated must keep execute (granted explicitly — on new projects the
-- implicit PUBLIC grant we revoke here was its only source). anon has no
-- table access, so its policies never run.
revoke execute on function public.is_fund_member(uuid) from public, anon;
revoke execute on function public.is_fund_owner(uuid) from public, anon;
revoke execute on function public.shares_fund_with(uuid) from public, anon;
grant execute on function public.is_fund_member(uuid) to authenticated;
grant execute on function public.is_fund_owner(uuid) to authenticated;
grant execute on function public.shares_fund_with(uuid) to authenticated;
