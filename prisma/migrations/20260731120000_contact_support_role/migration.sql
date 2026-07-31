-- Controle de acesso por contato (agentes internos, ex.: suporte de TI).
--
-- NULL = contato NÃO autorizado. O gate no webhook é fail-closed: sem papel, o agente não responde
-- e o modelo nem chega a ser invocado. Nullable e sem default de propósito — um contato existente
-- não deve virar autorizado por efeito colateral da migração.
--
-- A tabela `contacts` já está sob RLS (o init aplica por tabela, não por coluna), então a coluna
-- herda o isolamento por tenant sem política adicional.
ALTER TABLE "contacts" ADD COLUMN "support_role" TEXT;
