// Armazenamento de anexos (S3/R2), por tenant. Serve para dar a um sistema externo — um chamado de
// TI, por exemplo — acesso a uma imagem que chegou pelo WhatsApp, sem depender do Chatwoot (que fica
// atrás de autenticação) nem de o destino aceitar upload.
//
// Off por padrão: sem bucket configurado, nada é enviado e o comportamento é o de sempre.
//
// O link é SEMPRE assinado e expira. Um print de PDV costuma trazer dado de cliente (nome, itens,
// medicamento) — publicar isso num bucket aberto seria vazamento. O bucket deve ser privado; a
// assinatura é o que concede acesso, por tempo limitado.

export interface StorageConfig {
  enabled: boolean;
  bucket: string;
  endpoint: string;
  // Ref `vault:<id>` da entrada que guarda { accessKeyId, secretAccessKey }.
  credentialRef: string | null;
  // Validade do link assinado, em dias. O S3/R2 recusa assinatura acima de 7 dias, então esse é o
  // teto — técnico, não uma escolha de produto. Um chamado que demore mais que isso precisará de um
  // link novo (gerado sob demanda), e não de um link mais longo.
  linkTtlDays: number;
}

export const STORAGE_DEFAULTS: StorageConfig = {
  enabled: false,
  bucket: "",
  endpoint: "",
  credentialRef: null,
  // Igual ao teto: para um chamado, o mais longo possível é o mais útil.
  linkTtlDays: 7,
};

const TTL_MIN_DAYS = 1;
// Limite do S3/R2 para URL assinada: 7 dias. Acima disso a assinatura é recusada pelo serviço, então
// o teto é técnico, não uma escolha de produto.
export const TTL_MAX_DAYS = 7;

export function readStorageConfig(settings: unknown): StorageConfig {
  const s =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>).storage
      : undefined;
  if (!s || typeof s !== "object") return { ...STORAGE_DEFAULTS };
  const bag = s as Record<string, unknown>;
  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;
  const ttl =
    typeof bag.linkTtlDays === "number" && Number.isFinite(bag.linkTtlDays)
      ? Math.min(
          Math.max(Math.round(bag.linkTtlDays), TTL_MIN_DAYS),
          TTL_MAX_DAYS,
        )
      : STORAGE_DEFAULTS.linkTtlDays;
  const cfg: StorageConfig = {
    enabled:
      typeof bag.enabled === "boolean" ? bag.enabled : STORAGE_DEFAULTS.enabled,
    bucket: str(bag.bucket, STORAGE_DEFAULTS.bucket),
    endpoint: str(bag.endpoint, STORAGE_DEFAULTS.endpoint),
    credentialRef:
      typeof bag.credentialRef === "string" && bag.credentialRef.trim()
        ? bag.credentialRef.trim()
        : STORAGE_DEFAULTS.credentialRef,
    linkTtlDays: Math.min(ttl, TTL_MAX_DAYS),
  };
  // Config pela metade não vale: sem bucket/endpoint/credencial não há como enviar, e seguir como
  // "ligado" só produziria erro a cada anexo.
  if (!cfg.bucket || !cfg.endpoint || !cfg.credentialRef) cfg.enabled = false;
  return cfg;
}
