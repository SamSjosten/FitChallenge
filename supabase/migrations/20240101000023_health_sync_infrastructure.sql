-- supabase/migrations/023_health_sync_infrastructure.sql
-- =============================================================================
-- Health Sync Infrastructure
-- =============================================================================
-- Creates tables for tracking health provider connections and sync operations.
-- Supports HealthKit (iOS) and GoogleFit (Android) with audit trail.
-- =============================================================================

-- =============================================================================
-- HEALTH SYNC LOGS (Audit Trail)
-- =============================================================================
-- Records each sync operation for debugging and user transparency.
-- Tracks processed/inserted/deduplicated counts for monitoring.

CREATE TABLE IF NOT EXISTS public.health_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('healthkit', 'googlefit')),
  sync_type text NOT NULL CHECK (sync_type IN ('background', 'manual', 'initial')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'failed', 'partial')),
  records_processed integer DEFAULT 0,
  records_inserted integer DEFAULT 0,
  records_deduplicated integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_health_sync_user 
  ON public.health_sync_logs(user_id);
CREATE INDEX idx_health_sync_user_provider 
  ON public.health_sync_logs(user_id, provider, started_at DESC);
CREATE INDEX idx_health_sync_status 
  ON public.health_sync_logs(status) WHERE status = 'in_progress';

-- RLS Policies
ALTER TABLE public.health_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
ON public.health_sync_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync logs"
ON public.health_sync_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync logs"
ON public.health_sync_logs FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- HEALTH PROVIDER CONNECTIONS
-- =============================================================================
-- Tracks which health providers a user has connected.
-- Stores permissions granted and last sync time.

CREATE TABLE IF NOT EXISTS public.health_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('healthkit', 'googlefit')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  permissions_granted jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One connection per provider per user
  UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX idx_health_connections_user 
  ON public.health_connections(user_id);
CREATE INDEX idx_health_connections_active 
  ON public.health_connections(user_id, is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.health_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own health connections"
ON public.health_connections FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER health_connections_updated_at 
  BEFORE UPDATE ON public.health_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get active health connection for a user
CREATE OR REPLACE FUNCTION public.get_health_connection(
  p_provider text
)
RETURNS TABLE (
  id uuid,
  provider text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  permissions_granted jsonb,
  is_active boolean
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT 
    hc.id,
    hc.provider,
    hc.connected_at,
    hc.last_sync_at,
    hc.permissions_granted,
    hc.is_active
  FROM public.health_connections hc
  WHERE hc.user_id = auth.uid()
    AND hc.provider = p_provider
  LIMIT 1;
$$;

-- Update last sync time
CREATE OR REPLACE FUNCTION public.update_health_last_sync(
  p_provider text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.health_connections
  SET last_sync_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid()
    AND provider = p_provider
    AND is_active = true;
END;
$$;

-- Connect health provider
CREATE OR REPLACE FUNCTION public.connect_health_provider(
  p_provider text,
  p_permissions jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_connection_id uuid;
BEGIN
  INSERT INTO public.health_connections (
    user_id,
    provider,
    permissions_granted,
    is_active
  ) VALUES (
    auth.uid(),
    p_provider,
    p_permissions,
    true
  )
  ON CONFLICT (user_id, provider) DO UPDATE SET
    is_active = true,
    permissions_granted = p_permissions,
    disconnected_at = NULL,
    updated_at = now()
  RETURNING id INTO v_connection_id;
  
  RETURN v_connection_id;
END;
$$;

-- Disconnect health provider
CREATE OR REPLACE FUNCTION public.disconnect_health_provider(
  p_provider text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.health_connections
  SET is_active = false,
      disconnected_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid()
    AND provider = p_provider;
END;
$$;