import { describe, expect, test } from "bun:test";
import { cadastroFromAttributes } from "@/modules/chatwoot/mirror";
import { normalizeChatwootEvent } from "@/modules/chatwoot/normalize";

describe("cadastro vindo da tela de contato do Chatwoot", () => {
  test("lê papel, loja e cargo", () => {
    expect(
      cadastroFromAttributes({
        papel: "loja",
        loja: "15",
        cargo: "balconista",
      }),
    ).toEqual({ supportRole: "loja", branch: "15", position: "balconista" });
  });

  test("SEM atributos no payload não mexe em nada", () => {
    // O caso perigoso: uma entrega magra não pode ser lida como "limparam o cadastro" — isso
    // revogaria o acesso de todas as lojas de uma vez, silenciosamente.
    expect(cadastroFromAttributes(undefined)).toBeUndefined();
  });

  test("atributos presentes mas vazios REVOGAM (é assim que se tira acesso)", () => {
    expect(cadastroFromAttributes({})).toEqual({
      supportRole: null,
      branch: null,
      position: null,
    });
    expect(cadastroFromAttributes({ papel: "  ", loja: "11" })).toEqual({
      supportRole: null,
      branch: "11",
      position: null,
    });
  });

  test("valor não-textual não vira papel", () => {
    // Um papel que não seja texto/número é lixo; virar string ("true", "[object Object]") poderia
    // passar no gate, que só exige "string não vazia".
    expect(cadastroFromAttributes({ papel: true })?.supportRole).toBeNull();
    expect(cadastroFromAttributes({ papel: { a: 1 } })?.supportRole).toBeNull();
    expect(cadastroFromAttributes({ papel: ["loja"] })?.supportRole).toBeNull();
    // Número é aceito: a loja é digitada como 15 com frequência.
    expect(cadastroFromAttributes({ loja: 15 })?.branch).toBe("15");
  });

  test("valor absurdamente longo é truncado", () => {
    expect(
      cadastroFromAttributes({ cargo: "x".repeat(500) })?.position,
    ).toHaveLength(120);
  });
});

describe("normalização traz os atributos do webhook", () => {
  const evento = (sender: Record<string, unknown>) =>
    normalizeChatwootEvent({
      event: "message_created",
      id: 1,
      conversation: { id: 10, display_id: 10, meta: { sender } },
      meta: { sender },
    } as never);

  test("custom_attributes chegam ao contato normalizado", () => {
    const n = evento({
      id: 7,
      name: "Ana",
      custom_attributes: { papel: "loja" },
    });
    expect(n?.contact?.customAttributes).toEqual({ papel: "loja" });
  });

  test("sem custom_attributes o campo fica ausente, não vazio", () => {
    const n = evento({ id: 7, name: "Ana" });
    expect(n?.contact?.customAttributes).toBeUndefined();
    expect(
      cadastroFromAttributes(n?.contact?.customAttributes),
    ).toBeUndefined();
  });
});
