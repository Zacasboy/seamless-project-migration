-- Conjuntos como composições (flat-lay): fotografia escolhida e posição de cada peça; fundo do quadro.
-- Só acrescenta colunas; não altera dados.
alter table public.editorial_outfit_items
  add column if not exists image_url text check (image_url is null or image_url ~ '^https://\S+$'),
  add column if not exists layout jsonb;
alter table public.editorial_outfits
  add column if not exists background text not null default 'cinza' check (background in ('cinza','papel','areia','linho','marmore','madeira','chocolate')),
  add column if not exists gender text check (gender is null or gender in ('mulher','homem','unisex')),
  add column if not exists palette text check (palette is null or length(palette) <= 60);
notify pgrst, 'reload schema';
