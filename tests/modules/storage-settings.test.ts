import { describe, expect, test } from "bun:test";
import { attachmentKey } from "@/modules/storage/service";
import {
  readStorageConfig,
  STORAGE_DEFAULTS,
  TTL_MAX_DAYS,
} from "@/modules/storage/settings";

// O agente é a segunda camada: sem opt-in dele, nada é armazenado.
const AGENTE_QUER = { storage: { enabled: true } };

describe("readStorageConfig", () => {
  const completo = {
    storage: {
      enabled: true,
      bucket: "rd-agents",
      endpoint: "https://conta.r2.cloudflarestorage.com",
      credentialRef: "vault:9",
      linkTtlDays: 7,
    },
  };

  test("desligado por padrão", () => {
    expect(readStorageConfig(undefined, AGENTE_QUER)).toEqual(STORAGE_DEFAULTS);
    expect(readStorageConfig({}, AGENTE_QUER)).toEqual(STORAGE_DEFAULTS);
    expect(STORAGE_DEFAULTS.enabled).toBe(false);
  });

  test("lê a configuração completa quando o agente opta", () => {
    const c = readStorageConfig(completo, AGENTE_QUER);
    expect(c.enabled).toBe(true);
    expect(c.bucket).toBe("rd-agents");
    expect(c.linkTtlDays).toBe(7);
  });

  test("infraestrutura pronta + agente SEM opt-in ⇒ não armazena", () => {
    // O caso que motivou a separação: um agente de atendimento ao cliente recebe foto de laudo e
    // não tem finalidade para o link — guardar seria retenção de dado sensível sem uso.
    expect(readStorageConfig(completo).enabled).toBe(false);
    expect(readStorageConfig(completo, {}).enabled).toBe(false);
    expect(
      readStorageConfig(completo, { storage: { enabled: false } }).enabled,
    ).toBe(false);
    // Ainda assim os dados de destino continuam legíveis (o tenant os guarda).
    expect(readStorageConfig(completo, {}).bucket).toBe("rd-agents");
  });

  test("config pela metade NÃO fica ligada (falharia a cada anexo)", () => {
    for (const faltando of ["bucket", "endpoint", "credentialRef"] as const) {
      const storage: Record<string, unknown> = { ...completo.storage };
      delete storage[faltando];
      expect(readStorageConfig({ storage }, AGENTE_QUER).enabled).toBe(false);
    }
  });

  test("TTL é limitado ao teto do S3 (7 dias) e ao piso de 1", () => {
    const alto = readStorageConfig({
      storage: { ...completo.storage, linkTtlDays: 365 },
    });
    expect(alto.linkTtlDays).toBe(TTL_MAX_DAYS);
    const baixo = readStorageConfig({
      storage: { ...completo.storage, linkTtlDays: 0 },
    });
    expect(baixo.linkTtlDays).toBe(1);
    const invalido = readStorageConfig({
      storage: { ...completo.storage, linkTtlDays: "muito" },
    });
    expect(invalido.linkTtlDays).toBe(STORAGE_DEFAULTS.linkTtlDays);
    // O default TEM de ser alcançável: se fosse maior que o teto, nunca valeria.
    expect(STORAGE_DEFAULTS.linkTtlDays).toBeLessThanOrEqual(TTL_MAX_DAYS);
  });
});

describe("attachmentKey", () => {
  test("segrega por tenant e identifica a origem", () => {
    expect(attachmentKey(7n, 42, 100, 3, "png")).toBe(
      "t7/conv-42/msg-100-att-3.png",
    );
  });

  test("sanitiza a extensão (nunca vira path traversal)", () => {
    // A extensão é sanitizada E limitada a 8 chars: "../../etc/passwd" perde as barras e é truncada.
    expect(attachmentKey(1n, 1, 1, 1, "../../etc/passwd")).toBe(
      "t1/conv-1/msg-1-att-1.etcpassw",
    );
    expect(attachmentKey(1n, 1, 1, 1, "")).toBe("t1/conv-1/msg-1-att-1.bin");
  });

  test("dois tenants nunca colidem na mesma chave", () => {
    expect(attachmentKey(1n, 5, 9, 2, "jpg")).not.toBe(
      attachmentKey(2n, 5, 9, 2, "jpg"),
    );
  });
});
