// Per-agent access control, read from the free-form `agent.settings.accessControl` bag (same pattern
// as debounce/tts). OFF by default: a customer-facing agent (BioCheck) answers anyone, while an
// internal one (IT support) only answers contacts an operator explicitly authorized.
//
// The gate is FAIL-CLOSED and runs in the webhook, BEFORE the model is invoked (see
// `contactAccessAllowed` in this module, called from chatwoot/webhook.ts). Authorization is never a
// prompt instruction or a tool the model may choose to call — an unknown contact is simply not
// answered, and the model never sees the message.

export interface AccessControlConfig {
  // When true, only contacts with a non-null `Contact.supportRole` are answered.
  enabled: boolean;
  // Optional private note posted on the conversation when a contact is refused, so an operator
  // browsing Chatwoot sees WHY the bot stayed silent. Empty = stay fully silent.
  refusalNote: string;
}

export const ACCESS_CONTROL_DEFAULTS: AccessControlConfig = {
  enabled: false,
  refusalNote: "",
};

const NOTE_MAX = 500;

export function readAccessControlConfig(
  settings: unknown,
): AccessControlConfig {
  const a =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>).accessControl
      : undefined;
  if (!a || typeof a !== "object") return { ...ACCESS_CONTROL_DEFAULTS };
  const bag = a as Record<string, unknown>;
  return {
    enabled:
      typeof bag.enabled === "boolean"
        ? bag.enabled
        : ACCESS_CONTROL_DEFAULTS.enabled,
    refusalNote:
      typeof bag.refusalNote === "string"
        ? bag.refusalNote.slice(0, NOTE_MAX)
        : ACCESS_CONTROL_DEFAULTS.refusalNote,
  };
}

// The authorization decision itself: pure, so it is trivially testable and has no way to "ask" a
// model. `supportRole` comes from the DB row (RLS-scoped), never from the webhook payload — a caller
// cannot claim a role by crafting a message.
export function contactAccessAllowed(
  cfg: AccessControlConfig,
  supportRole: string | null | undefined,
): boolean {
  if (!cfg.enabled) return true;
  return typeof supportRole === "string" && supportRole.trim().length > 0;
}
