import { describe, expect, test } from "bun:test";
import { parseChatwootMessages } from "@/modules/chatwoot/messages";

describe("quem enviou a mensagem", () => {
  test("resposta digitada no app do WhatsApp vem SEM autor", () => {
    // É o sinal de que um humano assumiu por fora do painel — metade das respostas desta conta.
    const [m] = parseChatwootMessages({
      payload: [{ id: 1, content: "pelo RDControle", message_type: 1 }],
    });
    expect(m?.senderType).toBeNull();
    expect(m?.senderId).toBeNull();
  });

  test("mensagem do robô traz agent_bot e o id", () => {
    const [m] = parseChatwootMessages({
      payload: [
        {
          id: 1,
          content: "Opa!",
          message_type: 1,
          sender: { type: "agent_bot", id: 2 },
        },
      ],
    });
    expect(m?.senderType).toBe("agent_bot");
    expect(m?.senderId).toBe(2);
  });

  test("aceita o formato plano e normaliza maiúsculas", () => {
    // O payload usa "AgentBot"/"User" numa forma e "agent_bot"/"user" noutra.
    const [a] = parseChatwootMessages({
      payload: [
        { id: 1, message_type: 1, sender_type: "AgentBot", sender_id: 7 },
      ],
    });
    expect(a?.senderType).toBe("agent_bot");
    expect(a?.senderId).toBe(7);

    const [b] = parseChatwootMessages({
      payload: [{ id: 1, message_type: 1, sender_type: "User", sender_id: 3 }],
    });
    expect(b?.senderType).toBe("user");
  });

  test("mensagem do cliente vem como contact", () => {
    const [m] = parseChatwootMessages({
      payload: [
        { id: 1, message_type: 0, sender: { type: "contact", id: 43 } },
      ],
    });
    expect(m?.senderType).toBe("contact");
  });

  test("o caso real: robô responde, técnico responde pelo celular depois", () => {
    // Reproduz a conversa da Damaris (03/08). Varrendo de trás para frente, a última mensagem
    // ENVIADA não é do robô — logo, humano assumiu e o robô deve calar.
    const rows = parseChatwootMessages({
      payload: [
        { id: 1, message_type: 0, sender: { type: "contact", id: 43 } },
        { id: 2, message_type: 1, sender: { type: "agent_bot", id: 2 } },
        { id: 3, message_type: 1 },
      ],
    });
    const ultimaEnviada = [...rows]
      .reverse()
      .find((m) => m.messageType === "outgoing" && !m.private);
    expect(ultimaEnviada?.id).toBe(3);
    expect(ultimaEnviada?.senderType).toBeNull();
  });
});
