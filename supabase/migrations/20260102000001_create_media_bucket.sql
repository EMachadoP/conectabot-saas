-- 1. Criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media-files',
  'media-files',
  true,
  52428800, -- 50MB
  ARRAY['audio/ogg', 'audio/mpeg', 'audio/mp4', 'video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política de Leitura Pública
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access to media files') THEN
        CREATE POLICY "Public read access to media files" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'media-files');
    END IF;
END $$;

-- 3. Política para Autenticados (Upload)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload media') THEN
        CREATE POLICY "Authenticated users can upload media"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'media-files');
    END IF;
END $$;

-- 4. Política para Service Role (Edge Functions)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can upload media') THEN
        CREATE POLICY "Service role can upload media"
        ON storage.objects FOR INSERT
        TO service_role
        WITH CHECK (bucket_id = 'media-files');
    END IF;
END $$;