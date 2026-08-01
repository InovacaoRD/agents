import { describe, expect, test } from "bun:test";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { buildNativeTools } from "@/graph/tools/native";
import type { ChatwootClient } from "@/modules/chatwoot/client";

// Contato armazenado + captura do que a ferramenta grava, sem banco real: runScopedOn recebe um
// "db" falso cujo findUnique/updateMany apenas registram.
function cenario(atual: {
  name?: string | null;
  branch?: string | null;
  position?: string | null;
}) {
  const gravado: Record<string, unknown>[] = [];
  const chatwoot: Array<[string, unknown]> = [];
  const db = {
    contact: {
      findUnique: async () => ({
        name: atual.name ?? null,
        branch: atual.branch ?? null,
        position: atual.position ?? null,
        chatwootContactId: 77,
      }),
      updateMany: async (a: { data: Record<string, unknown> }) => {
        gravado.push(a.data);
        return { count: 1 };
      },
    },
  };
  const tx = {
    ...db,
    $executeRaw: async () => 0,
    $executeRawUnsafe: async () => 0,
  };
  // runScopedOn faz base.$extends(...).$transaction(...), então o duplo é preciso nessa forma.
  const base = {
    $extends: () => ({
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    }),
  } as never;
  const client = {
    setContactCustomAttributes: async (id: number, attrs: unknown) => {
      chatwoot.push(["attrs", { id, attrs }]);
      return {};
    },
    setContactName: async (id: number, name: string) => {
      chatwoot.push(["name", { id, name }]);
      return {};
    },
  } as unknown as ChatwootClient;
  const tools = buildNativeTools({
    client,
    conversationId: 1,
    base,
    tenantId: 1n,
    contactDbId: 5n,
  });
  const t = tools.find(
    (x: StructuredToolInterface) => x.name === "remember_contact_info",
  );
  if (!t) throw new Error("ferramenta não registrada");
  return { tool: t, gravado, chatwoot };
}

describe("remember_contact_info", () => {
  test("preenche o que está vazio", async () => {
    const c = cenario({ name: null, branch: null, position: null });
    const r = (await c.tool.invoke({
      name: "Camila Braz",
      branch: "14",
      position: "balconista",
    })) as string;
    expect(c.gravado[0]).toEqual({
      name: "Camila Braz",
      branch: "14",
      position: "balconista",
    });
    expect(r).toContain("Saved");
  });

  test("NÃO sobrescreve o que o operador já cadastrou", async () => {
    // A loja cadastrada é garantia de origem do chamado; trocá-la pelo que a pessoa disse na
    // conversa devolveria essa garantia a um palpite do modelo.
    const c = cenario({
      name: "Camila Braz",
      branch: "14",
      position: "gerente",
    });
    const r = (await c.tool.invoke({
      name: "Outra Pessoa",
      branch: "99",
      position: "diretor",
    })) as string;
    expect(c.gravado).toHaveLength(0);
    expect(c.chatwoot).toHaveLength(0);
    expect(r).toContain("already filled in");
  });

  test("preenche só os campos vazios, preservando os demais", async () => {
    const c = cenario({ name: null, branch: "14", position: null });
    await c.tool.invoke({ name: "Camila", branch: "99", position: "caixa" });
    expect(c.gravado[0]).toEqual({ name: "Camila", position: "caixa" });
    expect(c.gravado[0]).not.toHaveProperty("branch");
  });

  test("nome que é só o telefone conta como vazio", async () => {
    // O contato criado a partir de uma mensagem nasce nomeado com o próprio número.
    const c = cenario({ name: "556992737023" });
    await c.tool.invoke({ name: "Camila Braz" });
    expect(c.gravado[0]).toEqual({ name: "Camila Braz" });
  });

  test("NUNCA aceita papel/acesso, nem como campo extra", async () => {
    // A regra que sustenta o gate: se o modelo pudesse gravar o papel, bastaria a pessoa pedir
    // para se autorizar.
    const c = cenario({ name: null });
    await c.tool.invoke({
      name: "Alguém",
      papel: "raiz",
      supportRole: "raiz",
    } as never);
    expect(c.gravado[0]).toEqual({ name: "Alguém" });
    expect(JSON.stringify(c.gravado)).not.toContain("raiz");
    expect(JSON.stringify(c.chatwoot)).not.toContain("papel");
  });

  test("espelha no Chatwoot (senão o próximo webhook apaga)", async () => {
    const c = cenario({});
    await c.tool.invoke({ name: "Ana", branch: "7", position: "caixa" });
    const attrs = c.chatwoot.find(([k]) => k === "attrs");
    expect(attrs?.[1]).toEqual({
      id: 77,
      attrs: { loja: "7", cargo: "caixa" },
    });
    expect(c.chatwoot.find(([k]) => k === "name")?.[1]).toEqual({
      id: 77,
      name: "Ana",
    });
  });

  test("valor em branco não vira cadastro", async () => {
    const c = cenario({});
    const r = (await c.tool.invoke({ name: "   ", branch: "" })) as string;
    expect(c.gravado).toHaveLength(0);
    expect(r).toContain("Nothing to save");
  });
});
