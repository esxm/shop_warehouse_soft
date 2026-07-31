begin;

create or replace function private.parse_optional_stock_unit_cost(
  target_value text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_value text := nullif(
    pg_catalog.replace(pg_catalog.btrim(target_value), ',', '.'),
    ''
  );
  parsed_value numeric;
begin
  if normalized_value is null then
    return null;
  end if;

  if normalized_value !~ '^(0|[1-9][0-9]{0,9})([.][0-9]{1,8})?$' then
    raise exception 'Unit cost must be non-negative with at most eight decimals'
      using errcode = '22023';
  end if;

  parsed_value := normalized_value::numeric;

  if parsed_value > 9999999999.99999999 then
    raise exception 'Unit cost is too large'
      using errcode = '22003';
  end if;

  return round(parsed_value, 8);
end;
$$;

comment on function private.parse_optional_stock_unit_cost(text) is
  'Parses manual or weighted stock unit cost with the ledger''s eight-decimal precision.';

commit;
