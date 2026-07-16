-- Dashboard cards show when a fund was last touched; expose it from the
-- balances view (max transaction created_at, null for funds with no
-- transactions yet).
create or replace view public.fund_balances
  with (security_invoker = true)
as
select
  fund_id,
  coalesce(sum(case when type = 'credit'  then amount else 0 end), 0) as total_credit,
  coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as total_expense,
  coalesce(sum(case when type = 'credit'  then amount else -amount end), 0) as balance,
  max(created_at) as last_activity
from public.transactions
group by fund_id;
