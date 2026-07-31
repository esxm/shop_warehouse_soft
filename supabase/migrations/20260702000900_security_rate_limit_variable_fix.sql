do $migration$
declare
  original_definition text;
  revised_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.consume_auth_rate_limit(text,text)'::regprocedure
  )
  into original_definition;

  revised_definition := pg_catalog.replace(
    original_definition,
    'current_time',
    'request_time'
  );

  if revised_definition <> original_definition then
    execute revised_definition;
  end if;
end;
$migration$;
