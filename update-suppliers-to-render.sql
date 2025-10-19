-- ========================================
-- Atualizar Suppliers para Modo Render
-- ========================================
-- Este script ativa o modo "render" (Firecrawl) para todos os fornecedores
-- que estão a ser bloqueados em modo HTTP.
--
-- Execute isto no SQL Editor do Supabase

-- Atualizar Continente para modo render
UPDATE suppliers
SET mode = 'render'
WHERE name = 'Continente';

-- Atualizar Rádio Popular para modo render (já funcionou com fallback)
UPDATE suppliers
SET mode = 'render'
WHERE name = 'Rádio Popular';

-- Atualizar FNAC para modo render
UPDATE suppliers
SET mode = 'render'
WHERE name = 'FNAC';

-- Verificar configuração atual
SELECT
    name,
    mode,
    enabled,
    base_url
FROM suppliers
ORDER BY name;
