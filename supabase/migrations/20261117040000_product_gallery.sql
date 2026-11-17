-- Galeria de fotografias do produto (ordenada; a primeira é a principal e fica também em image_url).
-- Só acrescenta a coluna; produtos sem galeria continuam a usar image_url.
alter table public.products add column if not exists gallery text[] not null default '{}';
alter table public.products drop constraint if exists products_gallery_https;
alter table public.products add constraint products_gallery_https check (
  cardinality(gallery) <= 20
  and (cardinality(gallery) = 0 or array_to_string(gallery, ' ') ~ '^https://\S+( https://\S+)*$')
);
notify pgrst, 'reload schema';
