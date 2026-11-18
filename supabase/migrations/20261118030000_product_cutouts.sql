-- Fotografias sem fundo para toda a loja e imagem final dos conjuntos.
-- products.photo_cutouts: { "<fotografia original>": "<recorte PNG>" | "fundo" }. As originais ficam intactas.
alter table public.products
  add column if not exists photo_cutouts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(photo_cutouts) = 'object');

-- Imagem final do conjunto (PNG 1200×1500) e fundo "loja" (igual ao fundo das fotografias).
alter table public.editorial_outfits
  add column if not exists cover_url text check (cover_url is null or cover_url ~ '^https://\S+$');
alter table public.editorial_outfits drop constraint if exists editorial_outfits_background_check;
alter table public.editorial_outfits add constraint editorial_outfits_background_check
  check (background in ('loja','cinza','papel','areia','linho','marmore','madeira','chocolate'));

notify pgrst, 'reload schema';
