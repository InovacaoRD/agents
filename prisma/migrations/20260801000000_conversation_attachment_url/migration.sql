-- Link assinado do último anexo enviado ao armazenamento externo (S3/R2).
--
-- Guardado na conversa (e não só passado adiante) porque o consumidor é uma FERRAMENTA disparada
-- depois — abrir chamado pode acontecer várias mensagens após a foto chegar. Exposto como campo
-- fixo às ferramentas, de modo que o modelo não precise (nem consiga) forjar a URL.
ALTER TABLE "conversations" ADD COLUMN "last_attachment_url" TEXT;
