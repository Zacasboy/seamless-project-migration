-- Ligações a fornecedores por API: id externo, variantes com stock e verificação no checkout.
-- Só acrescenta colunas, índices e funções; não apaga dados.

alter table public.product_supplier_links add column if not exists external_product_id text;
alter table public.product_supplier_links add column if not exists external_variants jsonb not null default '[]'::jsonb;
alter table public.product_supplier_links add column if not exists last_error text check (last_error is null or length(last_error) <= 500);
create unique index if not exists product_supplier_links_external_idx
  on public.product_supplier_links (supplier_id, external_product_id)
  where external_product_id is not null;

-- Chave técnica dos fornecedores com API.
update public.suppliers set provider_key = 'cj' where provider_key is null and name = 'CJDropshipping';
update public.suppliers set provider_key = 'bigbuy' where provider_key is null and name = 'Bigbuy';
update public.suppliers set provider_key = 'printful' where provider_key is null and name = 'Printful';
update public.suppliers set provider_key = 'brandsgateway' where provider_key is null and name = 'BrandsGateway';

-- Para o checkout: devolve só o necessário para confirmar stock no fornecedor
-- (sem custos nem dados do fornecedor), e só de produtos publicados.
create or replace function public.order_supplier_refs(_product_ids uuid[])
returns table (product_id uuid, provider_key text, external_product_id text, external_variants jsonb)
language sql stable security definer set search_path = public
as $$
  select l.product_id, s.provider_key, l.external_product_id,
         coalesce((select jsonb_agg(jsonb_build_object('id', v->>'id', 'size', v->>'size', 'color', v->>'color'))
                   from jsonb_array_elements(l.external_variants) v), '[]'::jsonb)
  from public.product_supplier_links l
  join public.suppliers s on s.id = l.supplier_id
  join public.products p on p.id = l.product_id and p.published
  where l.product_id = any(_product_ids[1:20])
    and s.provider_key is not null and l.external_product_id is not null
$$;
revoke all on function public.order_supplier_refs(uuid[]) from public, anon;
grant execute on function public.order_supplier_refs(uuid[]) to authenticated;
