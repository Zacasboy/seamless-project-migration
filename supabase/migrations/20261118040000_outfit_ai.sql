-- Conjuntos (opção híbrida): fotografia gerada por IA a partir da composição, com verificação.
alter table public.editorial_outfits
  add column if not exists ai_image_url text check (ai_image_url is null or ai_image_url ~ '^https://\S+$'),
  add column if not exists ai_status text check (ai_status is null or ai_status in ('pendente','aprovado','rejeitado'));

-- O modelo pode devolver JPEG/WebP: o espaço de imagens passa a aceitá-los (continua público e limitado a 5 MB).
update storage.buckets
  set allowed_mime_types = array['image/png','image/jpeg','image/webp']
  where id = 'outfit-cutouts';

notify pgrst, 'reload schema';
