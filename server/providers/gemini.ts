/**
 * Google Gemini adapter, via generateContent's function-calling REST API —
 * verified against https://ai.google.dev live docs, not recalled from
 * training.
 */
import type { ModelAdapter, StructuredCallParams, StructuredCallResult } from './types.ts'
import { AdapterError } from './types.ts'

/** "gemini-3.6-flash" — confirmed against the live API, not docs: an initial
 *  doc-sourced guess of "gemini-3.7-flash" turned out to be wrong, and
 *  gemini-2.5-flash/gemini-2.0-flash both actively 400 with "no longer
 *  available ... use models/gemini-3.6-flash" — the API's own error message
 *  is a more reliable source than a documentation fetch that can drift out
 *  of sync with what's actually deployed. */
const DEFAULT_MODEL = 'gemini-3.6-flash'

interface FunctionCallPart {
  functionCall?: { name: string; args: unknown }
}
interface GenerateContentBody {
  candidates?: { content?: { parts?: FunctionCallPart[] } }[]
  error?: { message?: string }
}

/**
 * Gemini's function-declaration `parameters` field accepts only a SUBSET of
 * JSON Schema (its own OpenAPI-3.0-derived subset) — `additionalProperties`
 * is not a recognized field there, even though every tool schema in this
 * codebase sets it (`input_schema` is written for Anthropic, which is a
 * standard JSON Schema consumer). Sending it produces a hard 400:
 * `"Unknown name \"additionalProperties\" ... Cannot find field."` —
 * confirmed against the live API, not assumed from docs. Strips it
 * recursively, since it can appear at any nesting level (e.g. inside an
 * array-of-objects `items` schema), not just at the top.
 */
function stripAdditionalProperties(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripAdditionalProperties)
  if (schema !== null && typeof schema === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(schema)) {
      if (key === 'additionalProperties') continue
      out[key] = stripAdditionalProperties(value)
    }
    return out
  }
  return schema
}

export function createGeminiAdapter(apiKey: string, modelPref?: string | null): ModelAdapter {
  const model = modelPref?.trim() || DEFAULT_MODEL

  return {
    provider: 'gemini',
    async callForStructuredOutput<T>({ system, userContent, tool, maxTokens }: StructuredCallParams): Promise<StructuredCallResult<T>> {
      const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            tools: [
              {
                functionDeclarations: [
                  {
                    name: tool.name,
                    description: tool.description,
                    parameters: stripAdditionalProperties(tool.input_schema),
                  },
                ],
              },
            ],
            toolConfig: {
              functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [tool.name] },
            },
            generationConfig: { maxOutputTokens: maxTokens ?? 4096 },
          }),
        })
      } catch (err) {
        throw new AdapterError('Gemini request failed to send.', 'network', err)
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as GenerateContentBody
        const message = body.error?.message ?? `HTTP ${response.status}`
        // Gemini's API-key errors surface as 400 (invalid argument) as often
        // as 401/403, so 400 is treated as a possible auth failure too —
        // being over-broad here only costs an unnecessary fallback attempt,
        // never a missed real failure.
        if ([400, 401, 403].includes(response.status)) throw new AdapterError(`Gemini key rejected: ${message}`, 'auth')
        if (response.status === 429) throw new AdapterError(`Gemini rate limited: ${message}`, 'rate_limit')
        throw new AdapterError(`Gemini API error: ${message}`, 'unknown')
      }

      const body = (await response.json()) as GenerateContentBody
      const call = body.candidates?.[0]?.content?.parts?.find((p) => p.functionCall?.name === tool.name)?.functionCall
      if (!call) throw new AdapterError('Gemini returned no function call.', 'invalid_response')

      return { input: call.args as T }
    },
  }
}
