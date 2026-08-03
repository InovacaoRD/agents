import { describe, expect, test } from "bun:test";
import { ChatwootClient } from "@/modules/chatwoot/client";

const PUBLICO = "https://chatwoot.exemplo.com";
// https para o teste nao esbarrar na guarda anti-SSRF (que so libera http quando o
// deploy marca allowPrivateTargets); o que importa aqui e a troca de ORIGEM.
const INTERNO = "https://chatwoot-interno.exemplo.com";
const CAMINHO =
  "/rails/active_storage/blobs/redirect/abc--def/audio.ogg?disposition=inline";

function cliente(
  capturar: { url?: string; headers?: Record<string, string> },
  resposta: Response,
) {
  const fetchImpl = (async (u: string | URL, init?: RequestInit) => {
    capturar.url = String(u);
    capturar.headers = (init?.headers ?? {}) as Record<string, string>;
    return resposta;
  }) as unknown as typeof fetch;
  return new ChatwootClient(
    {
      baseUrl: INTERNO,
      accountId: 1,
      adminToken: "tok-admin",
      agentBotToken: "tok-bot",
    } as never,
    fetchImpl,
  );
}

const audio = () =>
  new Response(new Uint8Array([0x4f, 0x67, 0x67, 0x53]), {
    status: 200,
    headers: { "content-type": "audio/opus" },
  });

describe("download de anexo com o Chatwoot atrás de um proxy de acesso", () => {
  test("anexo anunciado no host público é buscado no host configurado", async () => {
    // O Chatwoot anuncia o anexo pela FRONTEND_URL; nós falamos com ele por um endereço interno.
    const capt: { url?: string; headers?: Record<string, string> } = {};
    await cliente(capt, audio()).downloadAttachment(`${PUBLICO}${CAMINHO}`);
    expect(capt.url).toBe(`${INTERNO}${CAMINHO}`);
    // O token assinado e a query TÊM de sobreviver à troca de origem.
    expect(capt.url).toContain("abc--def");
    expect(capt.url).toContain("disposition=inline");
  });

  test("trocando a origem, passamos a ser mesmo host — então o token admin vai junto", async () => {
    const capt: { url?: string; headers?: Record<string, string> } = {};
    await cliente(capt, audio()).downloadAttachment(`${PUBLICO}${CAMINHO}`);
    expect(JSON.stringify(capt.headers)).toContain("tok-admin");
  });

  test("host de terceiro (S3/CDN) NÃO é reescrito", async () => {
    // Reescrever aqui mandaria nosso token para outro domínio e buscaria um caminho inexistente.
    const capt: { url?: string; headers?: Record<string, string> } = {};
    const externo = "https://bucket.s3.amazonaws.com/x/y.ogg?sig=1";
    await cliente(capt, audio()).downloadAttachment(externo);
    expect(capt.url).toBe(externo);
    expect(JSON.stringify(capt.headers)).not.toContain("tok-admin");
  });

  test("página de login devolvida com 200 é recusada, não tratada como mídia", async () => {
    // O caso real: o proxy responde 200 + HTML de login. Sem esta guarda o HTML seguia para o
    // Whisper como se fosse áudio e voltava um 400 sem explicação.
    const login = new Response("<!DOCTYPE html><title>Sign in</title>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const capt: { url?: string } = {};
    await expect(
      cliente(capt, login).downloadAttachment(`${PUBLICO}${CAMINHO}`),
    ).rejects.toThrow();
  });

  test("caminho que não é de anexo do Chatwoot fica intacto", async () => {
    const capt: { url?: string } = {};
    const outro = "https://chatwoot.exemplo.com/api/v1/accounts/1/algo";
    await cliente(capt, audio()).downloadAttachment(outro);
    expect(capt.url).toBe(outro);
  });
});
