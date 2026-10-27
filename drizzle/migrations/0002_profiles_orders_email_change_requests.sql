-- Profiles: one row per auth user. Clients may only update phone (column-level grant).
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (phone) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "own profile phone update" ON public.profiles;
CREATE POLICY "own profile phone update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_profile_phone() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := btrim(NEW.phone);
    IF NEW.phone = '' THEN NEW.phone := NULL;
    ELSIF NEW.phone !~ '^\+?[0-9 ()-]{6,20}$' THEN
      RAISE EXCEPTION 'Número de telemóvel inválido';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_validate_phone ON public.profiles;
CREATE TRIGGER profiles_validate_phone BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_phone();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, left(NEW.raw_user_meta_data->>'full_name', 120))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Keep profile email mirrored from the auth account (changes only via approved flow).
CREATE OR REPLACE FUNCTION public.handle_user_email_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_user_email_sync() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_sync();

INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users ON CONFLICT (id) DO NOTHING;

-- Orders: read-only for owners; writes only by admins / trusted server code.
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  size text,
  color text
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);
REVOKE ALL ON public.orders, public.order_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders, public.order_items TO authenticated;
GRANT ALL ON public.orders, public.order_items TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own orders read" ON public.orders;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "admin manages orders" ON public.orders;
CREATE POLICY "admin manages orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "own order items read" ON public.order_items;
CREATE POLICY "own order items read" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin manages order items" ON public.order_items;
CREATE POLICY "admin manages order items" ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Email change requests
CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_email text,
  new_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_change_one_pending
  ON public.email_change_requests(user_id) WHERE status = 'pending';
REVOKE ALL ON public.email_change_requests FROM anon, authenticated;
GRANT SELECT ON public.email_change_requests TO authenticated;
GRANT INSERT (new_email) ON public.email_change_requests TO authenticated;
GRANT ALL ON public.email_change_requests TO service_role;
ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own email requests read" ON public.email_change_requests;
CREATE POLICY "own email requests read" ON public.email_change_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "own email request create" ON public.email_change_requests;
CREATE POLICY "own email request create" ON public.email_change_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL);

-- Server-side enforcement: fill owner/current email, validate the new address.
CREATE OR REPLACE FUNCTION public.prepare_email_change_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão necessária'; END IF;
  SELECT email INTO cur FROM auth.users WHERE id = auth.uid();
  NEW.user_id := auth.uid();
  NEW.current_email := cur;
  NEW.status := 'pending';
  NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.review_note := NULL;
  NEW.new_email := lower(btrim(NEW.new_email));
  IF length(NEW.new_email) > 254 OR NEW.new_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Endereço de email inválido';
  END IF;
  IF NEW.new_email = lower(coalesce(cur, '')) THEN
    RAISE EXCEPTION 'O novo email é igual ao atual';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.prepare_email_change_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS email_change_prepare ON public.email_change_requests;
CREATE TRIGGER email_change_prepare BEFORE INSERT ON public.email_change_requests
  FOR EACH ROW WHEN (current_user IN ('authenticated','anon'))
  EXECUTE FUNCTION public.prepare_email_change_request();

-- Users may cancel their own pending request.
CREATE OR REPLACE FUNCTION public.cancel_my_email_change_request(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.email_change_requests SET status = 'cancelled'
  WHERE id = _id AND user_id = auth.uid() AND status = 'pending';
END $$;
REVOKE EXECUTE ON FUNCTION public.cancel_my_email_change_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_email_change_request(uuid) TO authenticated;