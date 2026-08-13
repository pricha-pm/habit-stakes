-- Make money stakes optional: a habit can be tracked purely for
-- consistency, with no friend or dollar amount attached. If a stake is
-- set, both stake_amount and owed_to must be present -- half a stake
-- isn't a valid state. The existing `stake_amount > 0` check already
-- passes on NULL (Postgres CHECK constraints only fail on an explicit
-- false, not on NULL), so it doesn't need to be touched.

alter table habits alter column stake_amount drop not null;
alter table habits alter column owed_to drop not null;

alter table habits add constraint habits_stake_pair_check
  check ((stake_amount is null) = (owed_to is null));
