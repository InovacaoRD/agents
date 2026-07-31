import { describe, expect, test } from "bun:test";
import {
  ACCESS_CONTROL_DEFAULTS,
  contactAccessAllowed,
  readAccessControlConfig,
} from "@/modules/access-control/settings";

describe("readAccessControlConfig", () => {
  test("returns defaults when absent, empty or malformed", () => {
    expect(readAccessControlConfig(undefined)).toEqual(ACCESS_CONTROL_DEFAULTS);
    expect(readAccessControlConfig({})).toEqual(ACCESS_CONTROL_DEFAULTS);
    expect(readAccessControlConfig({ accessControl: {} })).toEqual(
      ACCESS_CONTROL_DEFAULTS,
    );
    expect(readAccessControlConfig({ accessControl: "nope" })).toEqual(
      ACCESS_CONTROL_DEFAULTS,
    );
    expect(readAccessControlConfig(null)).toEqual(ACCESS_CONTROL_DEFAULTS);
  });

  test("is OFF by default — a customer-facing agent answers anyone", () => {
    expect(ACCESS_CONTROL_DEFAULTS.enabled).toBe(false);
  });

  test("reads enabled and clamps the refusal note", () => {
    expect(
      readAccessControlConfig({ accessControl: { enabled: true } }).enabled,
    ).toBe(true);
    const longa = "x".repeat(900);
    expect(
      readAccessControlConfig({ accessControl: { refusalNote: longa } })
        .refusalNote.length,
    ).toBe(500);
    // Tipo errado não derruba a configuração: cai no default.
    expect(
      readAccessControlConfig({ accessControl: { enabled: "sim" } }).enabled,
    ).toBe(false);
  });
});

describe("contactAccessAllowed", () => {
  const off = { enabled: false, refusalNote: "" };
  const on = { enabled: true, refusalNote: "" };

  test("disabled ⇒ everyone passes (BioCheck and other public agents)", () => {
    expect(contactAccessAllowed(off, null)).toBe(true);
    expect(contactAccessAllowed(off, undefined)).toBe(true);
    expect(contactAccessAllowed(off, "loja")).toBe(true);
  });

  test("enabled ⇒ FAIL-CLOSED: no role means no answer", () => {
    expect(contactAccessAllowed(on, null)).toBe(false);
    expect(contactAccessAllowed(on, undefined)).toBe(false);
    // String vazia ou só espaço não vale como autorização.
    expect(contactAccessAllowed(on, "")).toBe(false);
    expect(contactAccessAllowed(on, "   ")).toBe(false);
  });

  test("enabled ⇒ any non-empty role authorizes", () => {
    expect(contactAccessAllowed(on, "loja")).toBe(true);
    expect(contactAccessAllowed(on, "master")).toBe(true);
  });
});
