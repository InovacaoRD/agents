-- Cargo/função do contato (gerente, assistente, farmacêutico, TI...).
--
-- SEPARADO de support_role de propósito: aquele é NÍVEL DE ACESSO (decide quem o agente atende),
-- este é QUEM a pessoa é (informativo, para calibrar linguagem e enriquecer um chamado). Misturar
-- os dois faria uma mudança de cargo alterar acesso sem querer.
ALTER TABLE "contacts" ADD COLUMN "position" TEXT;
