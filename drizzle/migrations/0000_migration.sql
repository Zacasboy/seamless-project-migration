create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id,role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id=auth.uid());

-- first user to sign up becomes admin
create or replace function public.handle_new_user_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.user_roles where role='admin') then insert into public.user_roles(user_id,role) values(new.id,'admin');
  else insert into public.user_roles(user_id,role) values(new.id,'user'); end if;
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users for each row execute function public.handle_new_user_role();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null, description text not null default '',
  price numeric(10,2) not null default 0, category text not null, gender text not null default 'unisex',
  image_key text, image_url text, meta_title text, meta_description text,
  supplier text, published boolean not null default true, created_at timestamptz not null default now());
grant select on public.products to anon, authenticated; grant insert,update,delete on public.products to authenticated; grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read published" on public.products for select using (published or public.has_role(auth.uid(),'admin'));
create policy "admin write" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.customers (id uuid primary key default gen_random_uuid(), name text not null, email text, country text, segment text not null default 'Novo', swot jsonb not null default '{}', pestel jsonb not null default '{}', notes text, created_at timestamptz not null default now());
create table public.suppliers (id uuid primary key default gen_random_uuid(), name text not null, website text, region text, specialty text, status text not null default 'Disponível', connected boolean not null default false, created_at timestamptz not null default now());
create table public.ad_channels (id uuid primary key default gen_random_uuid(), name text not null, platform text not null, status text not null default 'Pausado', budget numeric(10,2) not null default 0, created_at timestamptz not null default now());
do $$ declare t text; begin foreach t in array array['customers','suppliers','ad_channels'] loop
  execute format('grant select,insert,update,delete on public.%I to authenticated; grant all on public.%I to service_role; alter table public.%I enable row level security; create policy "admin all" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''));',t,t,t,t);
end loop; end $$;

create table public.page_views (id uuid primary key default gen_random_uuid(), path text not null, product_id uuid, referrer text, created_at timestamptz not null default now());
grant insert on public.page_views to anon, authenticated; grant select on public.page_views to authenticated; grant all on public.page_views to service_role;
alter table public.page_views enable row level security;
create policy "anyone logs view" on public.page_views for insert to anon, authenticated with check (length(path) < 300);
create policy "admin reads views" on public.page_views for select to authenticated using (public.has_role(auth.uid(),'admin'));

insert into public.products(slug,title,description,price,category,gender,image_key,meta_title,meta_description,supplier) values
('mala-ombro-monograma-bege','Mala de Ombro Monograma Bege','Mala de ombro em lona monograma bege com acabamentos em pele creme.',189,'Malas','mulher','p2','Mala de Ombro Monograma Bege | Pallessiani','Mala de ombro em lona monograma bege, elegante para o dia a dia.','CJDropshipping'),
('mala-ombro-monograma-preta','Mala de Ombro Monograma Preta','Mala compacta em monograma preto com alça em corrente dourada.',179,'Malas','mulher','p5','Mala Monograma Preta | Pallessiani','Mala compacta preta com corrente dourada.','Zendrop'),
('mala-ombro-bordeaux','Mala de Ombro Bordeaux','Pele envernizada cor vinho com ferragens douradas.',199,'Malas','mulher','p6','Mala Bordeaux | Pallessiani','Mala de ombro em pele cor vinho.','Spocket'),
('mala-corrente-perolas','Mala com Corrente e Pérolas','Mala preta monograma com corrente dourada e charm de pérolas.',219,'Malas','mulher','p12','Mala com Pérolas | Pallessiani','Mala preta com corrente dourada e charm de pérolas.','AliExpress'),
('mala-castanha-classica','Mala Castanha Clássica','Mala estruturada em pele castanha com fecho dourado.',249,'Malas','mulher','p13','Mala Castanha Clássica | Pallessiani','Mala estruturada em pele castanha.','Amazon'),
('tote-city-preta','Tote City Preta','Tote espaçosa em pele granulada preta, ideal para trabalho.',229,'Malas','mulher','p15','Tote City Preta | Pallessiani','Tote em pele preta para o dia a dia.','CJDropshipping'),
('mala-terri-castanha','Mala Terri Castanha','Mala de ombro monograma castanho com corrente.',189,'Malas','mulher','p16','Mala Terri Castanha | Pallessiani','Mala monograma castanho com corrente.','Zendrop'),
('mocassim-preto-envernizado','Mocassins Pretos Envernizados','Mocassins penny em pele envernizada preta.',139,'Calçado','homem','p8','Mocassins Pretos | Pallessiani','Mocassins penny em pele preta envernizada.','Spocket'),
('mocassim-minimal-preto','Mocassins Minimal Pretos','Mocassins de sola grossa em pele preta, estilo limpo.',149,'Calçado','homem','p18','Mocassins Minimal | Pallessiani','Mocassins pretos de sola grossa.','Printful'),
('mocassim-castanho-bege','Mocassins Castanho e Bege','Mocassins penny bicolores castanho e bege.',159,'Calçado','homem','p19','Mocassins Bicolores | Pallessiani','Mocassins castanho e bege.','Amazon'),
('mocassim-whitney-castanho','Mocassins Whitney Castanhos','Mocassins bicolores castanho e branco, clássico intemporal.',169,'Calçado','homem','p23','Mocassins Whitney | Pallessiani','Mocassins bicolores castanho e branco.','CJDropshipping'),
('mocassim-whitney-lug','Mocassins Whitney Sola Lug','Mocassins preto e branco com sola lug robusta.',179,'Calçado','mulher','p24','Mocassins Sola Lug | Pallessiani','Mocassins preto e branco com sola lug.','Zendrop'),
('conjunto-cinza-urbano','Conjunto Cinza Urbano','Casaco cinza, calças largas e boné — look completo.',229,'Conjuntos','homem','p1','Conjunto Cinza Urbano | Pallessiani','Look completo em tons de cinza.','AliExpress'),
('conjunto-branco-verao','Conjunto Branco de Verão','Camisa de linho branca, top e calções de alfaiataria.',149,'Conjuntos','mulher','p3','Conjunto Branco | Pallessiani','Look branco de verão.','Spocket'),
('conjunto-ganga-castanho','Conjunto Ganga e Castanho','Casaco castanho, top branco e ganga larga.',169,'Conjuntos','mulher','p7','Conjunto Ganga | Pallessiani','Casaco castanho com ganga larga.','Amazon'),
('conjunto-camisola-branca','Conjunto Camisola Branca','Camisola branca oversize com calças de ganga clara.',129,'Conjuntos','mulher','p9','Conjunto Camisola Branca | Pallessiani','Camisola branca e ganga clara.','CJDropshipping'),
('conjunto-pele-inverno','Conjunto Pele de Inverno','Blusão de pele castanho com calças cinza.',289,'Conjuntos','homem','p10','Conjunto Inverno | Pallessiani','Blusão de pele castanho para o inverno.','Zendrop'),
('conjunto-camisola-castanha','Conjunto Camisola Castanha','Camisola de malha castanha e calças largas cinza.',179,'Conjuntos','homem','p11','Conjunto Malha Castanha | Pallessiani','Camisola castanha com calças cinza.','Printful'),
('conjunto-malha-bordeaux','Conjunto Malha Bordeaux','Camisola de tranças bordeaux com ganga larga.',159,'Conjuntos','mulher','p14','Conjunto Bordeaux | Pallessiani','Camisola de tranças bordeaux.','AliExpress'),
('conjunto-camurca-castanho','Conjunto Camurça Castanho','Casaco de camurça castanho sobre gola alta preta.',249,'Conjuntos','homem','p17','Conjunto Camurça | Pallessiani','Casaco de camurça castanho.','Amazon'),
('conjunto-minimal-inverno','Conjunto Minimal de Inverno','Casaco castanho, camisola escura e calças cru.',269,'Conjuntos','homem','p20','Conjunto Minimal | Pallessiani','Look minimal de inverno.','Spocket'),
('conjunto-cargo-preto','Conjunto Cargo Preto','Top preto, casaco curto e calças cargo cinza.',149,'Conjuntos','mulher','p21','Conjunto Cargo | Pallessiani','Calças cargo com top preto.','CJDropshipping'),
('conjunto-gola-alta-classico','Conjunto Gola Alta Clássico','Gola alta preta, calças de alfaiataria e mini mala.',199,'Conjuntos','mulher','p22','Conjunto Clássico | Pallessiani','Gola alta preta com calças de alfaiataria.','Zendrop');

insert into public.suppliers(name,website,region,specialty,status,connected) values
('CJDropshipping','https://cjdropshipping.com','China / Global','Moda e acessórios','Disponível',true),
('Amazon','https://sellercentral.amazon.com','Global','Catálogo geral','Disponível',true),
('Zendrop','https://zendrop.com','EUA / China','Dropshipping rápido','Disponível',true),
('AliExpress','https://aliexpress.com','China','Catálogo geral','Disponível',true),
('Spocket','https://spocket.co','EUA / UE','Fornecedores europeus','Disponível',true),
('Printful','https://printful.com','Global','Impressão a pedido','Disponível',true),
('Printify','https://printify.com','Global','Impressão a pedido','Disponível',false),
('DSers','https://dsers.com','China','Integração AliExpress','Disponível',false),
('Modalyst','https://modalyst.co','EUA / UE','Marcas de moda','Disponível',false),
('SaleHoo','https://salehoo.com','Global','Diretório de fornecedores','Disponível',false),
('Doba','https://doba.com','EUA','Catálogo geral','Disponível',false),
('Wholesale2B','https://wholesale2b.com','EUA','Catálogo geral','Disponível',false),
('BrandsGateway','https://brandsgateway.com','UE','Moda de luxo','Disponível',false),
('Syncee','https://syncee.com','Global','Marketplace B2B','Disponível',false),
('Faire','https://faire.com','Global','Marcas independentes','Disponível',false),
('Alibaba','https://alibaba.com','China','Grosso','Disponível',false),
('Banggood','https://banggood.com','China','Catálogo geral','Indisponível',false),
('Shein Wholesale','https://sheinwholesale.com','China','Moda rápida','Disponível',false),
('Trendsi','https://trendsi.com','EUA','Moda feminina','Disponível',false),
('Bigbuy','https://bigbuy.eu','Espanha / UE','Stock europeu','Disponível',false),
('Inventory Source','https://inventorysource.com','EUA','Automação de stock','Disponível',false);

insert into public.ad_channels(name,platform,status,budget) values
('Instagram Shopping','Meta','Ativo',300),('Facebook Ads','Meta','Ativo',250),('Google Shopping','Google','Pausado',400),('TikTok Shop','TikTok','Pausado',200),('Pinterest Ads','Pinterest','Pausado',150);

insert into public.customers(name,email,country,segment,swot,pestel) values
('Exemplo — Ana Silva','ana@exemplo.pt','Portugal','Fiel','{"forcas":"Compra recorrente","fraquezas":"Sensível a preço","oportunidades":"Coleções de inverno","ameacas":"Concorrência fast-fashion"}','{"economico":"Rendimento médio","social":"Urbana, 25-34","tecnologico":"Compra por mobile"}'),
('Exemplo — Rui Costa','rui@exemplo.pt','Portugal','Novo','{"forcas":"Ticket alto","fraquezas":"Primeira compra","oportunidades":"Calçado","ameacas":"Baixa fidelização"}','{"economico":"Rendimento alto","social":"Profissional, 35-44"}');