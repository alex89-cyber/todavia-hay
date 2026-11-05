-- Preserve an immutable snapshot of each completed cash-up.
alter table days
add column if not exists cash_up jsonb;

comment on column days.cash_up is
'Historical snapshot of the cash-up generated when the business day closes';

create index if not exists days_business_closed_idx
on days (business_id, closed_at desc)
where closed_at is not null;