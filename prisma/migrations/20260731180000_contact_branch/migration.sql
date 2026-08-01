-- Unidade/filial do contato, cadastrada pelo operador.
--
-- Existe para que um campo de ORIGEM (a loja de um chamado de suporte) venha do cadastro e não do
-- que o modelo entendeu da conversa — mesma razão pela qual o telefone do solicitante é fixo.
-- Nullable: sem cadastro, o agente pergunta, como faria de qualquer forma.
ALTER TABLE "contacts" ADD COLUMN "branch" TEXT;
