CREATE TABLE public.registry_config (
  id INTEGER NOT NULL PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contract_address TEXT,
  bootstrap_admin_wallet TEXT,
  chain_id INTEGER NOT NULL DEFAULT 11155111,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.registry_config TO service_role;
ALTER TABLE public.registry_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.registry_config (id) VALUES (1);

CREATE TABLE public.credentials (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_uid TEXT NOT NULL UNIQUE,
  student_address TEXT NOT NULL,
  student_name TEXT NOT NULL,
  issuer_address TEXT NOT NULL,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  merkle_root TEXT NOT NULL,
  signature TEXT NOT NULL,
  courses JSONB NOT NULL,
  anchor_tx TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credentials_student ON public.credentials (lower(student_address));
CREATE INDEX idx_credentials_issuer ON public.credentials (lower(issuer_address));
GRANT ALL ON public.credentials TO service_role;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.presentations (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code TEXT NOT NULL UNIQUE,
  credential_uid TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.presentations TO service_role;

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
UPDATE public.registry_config
SET bootstrap_admin_wallet = '0xE6d050879a7b698B64f75E7A466996668818679B'
WHERE id = 1;
