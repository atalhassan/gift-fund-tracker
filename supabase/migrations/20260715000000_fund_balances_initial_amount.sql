-- The spending bar measures what's left against the fund's *opening* amount
-- rather than against every credit ever added, so that topping up a
-- near-empty fund refills the bar instead of moving the goalpost. The legacy
-- port turned each fund's starting_balance into exactly this: a credit dated
-- just before the fund's first real transaction.
--
-- Ordered by occurred_at (the user-entered date the port back-dated) with
-- created_at breaking ties inside a single day. null for a fund whose credits
-- are all still ahead of it -- the UI reads that as "no bar to draw".
create or replace view public.fund_balances
  with (security_invoker = true)
as
select
  fund_id,
  coalesce(sum(case when type = 'credit'  then amount else 0 end), 0) as total_credit,
  coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as total_expense,
  coalesce(sum(case when type = 'credit'  then amount else -amount end), 0) as balance,
  max(created_at) as last_activity,
  (array_agg(amount order by occurred_at, created_at)
     filter (where type = 'credit'))[1] as initial_amount
from public.transactions
group by fund_id;
