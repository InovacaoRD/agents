import type { PrismaClient } from "@/../generated/prisma/client";
import logger from "@/api/lib/logger";
import basePrisma from "@/api/lib/prisma";
import { runScopedOn } from "@/lib/tenancy";
import type { TenantContext } from "@/lib/tenancy/context";
import { tryResolveVaultSecret } from "@/modules/vault/service";
import type { StorageConfig } from "./settings";

// Envio de anexo para S3/R2 + link assinado. Usa o cliente S3 nativo do Bun (sem dependência nova);
// o R2 é S3-compatível, então o mesmo caminho serve para ambos.
//
// Best-effort por construção: um upload que falha NÃO pode derrubar o atendimento. O chamador
// registra e segue sem link — a conversa continua, o chamado é aberto, só não leva a imagem.

function sysCtx(tenantId: bigint): TenantContext {
  return { tenantId, userId: null, role: "TENANT_ADMIN" };
}

interface StorageCredential {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface UploadParams {
  tenantId: bigint;
  cfg: StorageConfig;
  key: string;
  bytes: ArrayBuffer | Uint8Array;
  contentType: string;
  base?: PrismaClient;
}

// Chave determinística e segregada por tenant: o prefixo evita que dois tenants colidam no mesmo
// bucket, e o formato deixa claro na listagem de onde cada objeto veio.
export function attachmentKey(
  tenantId: bigint,
  conversationId: number,
  messageId: number,
  attachmentId: number,
  ext: string,
): string {
  const e = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return `t${tenantId}/conv-${conversationId}/msg-${messageId}-att-${attachmentId}.${e}`;
}

// Sobe o objeto e devolve uma URL assinada, ou null quando o armazenamento não está configurado ou
// o envio falha. NUNCA lança: o chamador está no caminho de uma conversa em andamento.
export async function uploadAndSign(
  params: UploadParams,
): Promise<string | null> {
  const { cfg } = params;
  if (!cfg.enabled || !cfg.credentialRef) return null;
  const base = params.base ?? basePrisma;

  try {
    const cred = await runScopedOn(base, sysCtx(params.tenantId), (db) =>
      tryResolveVaultSecret<StorageCredential>(db, cfg.credentialRef as string),
    );
    if (!cred?.accessKeyId || !cred?.secretAccessKey) {
      logger.warn(
        "storage: credencial %s ausente ou incompleta",
        cfg.credentialRef,
      );
      return null;
    }

    const client = new Bun.S3Client({
      accessKeyId: cred.accessKeyId,
      secretAccessKey: cred.secretAccessKey,
      endpoint: cfg.endpoint,
      bucket: cfg.bucket,
    });

    await client.write(params.key, params.bytes as never, {
      type: params.contentType,
    });

    // O S3/R2 limita a assinatura a 7 dias; readStorageConfig já aplica o teto.
    const expiresIn = cfg.linkTtlDays * 24 * 60 * 60;
    return client.presign(params.key, { expiresIn, method: "GET" });
  } catch (err) {
    logger.warn({ err }, "storage: upload falhou; seguindo sem link");
    return null;
  }
}
