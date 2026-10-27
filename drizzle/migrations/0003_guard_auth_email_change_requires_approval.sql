CREATE OR REPLACE FUNCTION public.guard_auth_email_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Starting an email change (pending address) requires an approved request.
  IF coalesce(NEW.email_change, '') <> '' AND NEW.email_change IS DISTINCT FROM OLD.email_change THEN
    IF NOT EXISTS (SELECT 1 FROM public.email_change_requests r
      WHERE r.user_id = NEW.id AND r.status = 'approved' AND lower(r.new_email) = lower(NEW.email_change)) THEN
      RAISE EXCEPTION 'Email change requires administrator approval' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Final email swap also requires an approved request.
  IF OLD.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
    IF NOT EXISTS (SELECT 1 FROM public.email_change_requests r
      WHERE r.user_id = NEW.id AND r.status = 'approved' AND lower(r.new_email) = lower(NEW.email)) THEN
      RAISE EXCEPTION 'Email change requires administrator approval' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_auth_email_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_email_change_approval ON auth.users;
CREATE TRIGGER guard_email_change_approval BEFORE UPDATE OF email, email_change ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_auth_email_change();