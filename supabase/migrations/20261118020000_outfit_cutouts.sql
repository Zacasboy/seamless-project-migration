-- Espaço público para os recortes (PNG sem fundo) usados nos quadros dos conjuntos.
-- Escrita só pelo servidor (service role, depois de confirmar que o utilizador é administrador);
-- leitura pública pelo endereço do ficheiro. Sem políticas extra em storage.objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outfit-cutouts', 'outfit-cutouts', true, 5242880, array['image/png'])
on conflict (id) do nothing;
