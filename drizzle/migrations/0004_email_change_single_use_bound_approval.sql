ALTER TABLE public.email_change_requests ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
ALTER TABLE public.email_change_requests DROP CONSTRAINT IF EXISTS email_change_requests_status_check;
ALTER TABLE public.email_change_requests ADD CONSTRAINT email_change_requests_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled','completed'));

CREATE OR REPLACE FUNCTION public.guard_auth_email_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used uuid;
BEGIN
  -- Starting a change: needs an unused approval bound to the current email AND the exact new address.
  IF coalesce(NEW.email_change, '') <> '' AND NEW.email_change IS DISTINCT FROM OLD.email_change THEN
    IF NOT EXISTS (SELECT 1 FROM public.email_change_requests r
      WHERE r.user_id = NEW.id AND r.status = 'approved' AND r.consumed_at IS NULL
        AND lower(r.new_email) = lower(NEW.email_change)
        AND lower(coalesce(r.current_email,'')) = lower(coalesce(OLD.email,''))) THEN
      RAISE EXCEPTION 'Email change requires administrator approval' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Final swap: atomically consume exactly one matching approval (single use).
  IF OLD.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.email_change_requests r
       SET status = 'completed', consumed_at = now()
     WHERE r.id = (SELECT r2.id FROM public.email_change_requests r2
                    WHERE r2.user_id = NEW.id AND r2.status = 'approved' AND r2.consumed_at IS NULL
                      AND lower(r2.new_email) = lower(NEW.email)
                      AND lower(coalesce(r2.current_email,'')) = lower(OLD.email)
                    ORDER BY r2.reviewed_at DESC NULLS LAST LIMIT 1
                    FOR UPDATE)
    RETURNING r.id INTO used;
    IF used IS NULL THEN
      RAISE EXCEPTION 'Email change requires administrator approval' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_auth_email_change() FROM PUBLIC, anon, authenticated;