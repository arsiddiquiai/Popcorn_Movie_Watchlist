/**
 * Provider-agnostic "structured output" contract.
 *
 * Scope note: this covers exactly the pattern api/ai.ts's callClaudeForTool
 * already used for pick/bridge/taste — one system prompt, one user message,
 * ONE forced tool call, parsed JSON back. Every existing call site in this
 * codebase already passes a single-element tools array (tool_choice: "any"
 * over one tool IS a forced call), so this interface doesn't need to support
 * choosing between multiple tools or a multi-turn loop.
 *
 * mode: assistant is deliberately OUT of scope and stays Anthropic-only. Its
 * tool_choice: "auto" multi-turn loop (search -> discover -> add, with the
 * model free to reply with plain text at any point) is a materially
 * different shape across providers — forcing it into this same interface
 * would either weaken the interface for everyone else or require a second,
 * much more complex adapter contract this task wasn't scoped for. Flagged
 * here rather than silently narrowing the brief's "each mode's Claude-shaped
 * logic" to only the three modes that actually share one shape.
 */

/** Matches the {name, description, strict, input_schema} shape every tool
 *  constant in api/ai.ts already uses (recommendTool, bridgeCandidatesTool,
 *  personalityTool, ...) — Anthropic's tool format is standard JSON Schema
 *  under input_schema, so it doubles as the provider-neutral shape here.
 *  Zero changes needed to any existing tool definition. */
export interface ToolSchema {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
    additionalProperties: false
  }
}

export interface StructuredCallParams {
  system: string
  userContent: string
  tool: ToolSchema
  maxTokens?: number
}

export interface StructuredCallResult<T> {
  input: T
}

export type ProviderName = 'anthropic' | 'openai' | 'gemini'

/**
 * Thrown by every adapter on ANY failure — auth, rate limit, network, a
 * malformed response, the model declining to call the tool. Callers (the
 * fallback-to-shared-key logic in api/ai.ts) catch this one type regardless
 * of which provider actually failed, rather than needing to know each
 * provider's own SDK/error shape.
 */
export type AdapterErrorKind = 'auth' | 'rate_limit' | 'network' | 'invalid_response' | 'refused' | 'unknown'

export class AdapterError extends Error {
  /** Best-effort classification, for logging only — fallback behavior below
   *  treats every AdapterError identically per the brief ("if the user's
   *  chosen provider/key fails ... fall back", no failure-type distinction
   *  was asked for). */
  kind: AdapterErrorKind
  cause?: unknown

  constructor(message: string, kind: AdapterErrorKind, cause?: unknown) {
    super(message)
    this.name = 'AdapterError'
    this.kind = kind
    this.cause = cause
  }
}

export interface ModelAdapter {
  readonly provider: ProviderName
  callForStructuredOutput<T>(params: StructuredCallParams): Promise<StructuredCallResult<T>>
}
