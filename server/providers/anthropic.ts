import Anthropic from '@anthropic-ai/sdk'
import type { ModelAdapter, StructuredCallParams, StructuredCallResult } from './types.js'
import { AdapterError } from './types.js'

/** Same default as the shared-key path elsewhere in this file's sibling
 *  (api/ai.ts's MODEL const) — Haiku for cost control when the user hasn't
 *  expressed a preference. Kept as a separate constant rather than importing
 *  api/ai.ts's, since this module has to stay import-clean for both api/ and
 *  netlify/functions/ to use identically. */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export function createAnthropicAdapter(apiKey: string, modelPref?: string | null): ModelAdapter {
  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 0 })
  const model = modelPref?.trim() || DEFAULT_MODEL

  return {
    provider: 'anthropic',
    async callForStructuredOutput<T>({ system, userContent, tool, maxTokens }: StructuredCallParams): Promise<StructuredCallResult<T>> {
      let response
      try {
        response = await client.messages.create({
          model,
          max_tokens: maxTokens ?? 4096,
          system,
          tools: [tool],
          tool_choice: { type: 'any' },
          messages: [{ role: 'user', content: userContent }],
        })
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) throw new AdapterError('Anthropic rate limited.', 'rate_limit', err)
        if (err instanceof Anthropic.AuthenticationError) throw new AdapterError('Anthropic key rejected.', 'auth', err)
        if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AdapterError('Anthropic timed out.', 'network', err)
        if (err instanceof Anthropic.APIError) throw new AdapterError(`Anthropic API error: ${err.message}`, 'unknown', err)
        throw new AdapterError('Anthropic request failed.', 'network', err)
      }

      if (response.stop_reason === 'refusal') {
        throw new AdapterError('Claude declined the request.', 'refused')
      }
      const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
      if (!toolUse) throw new AdapterError('Claude returned no tool call.', 'invalid_response')

      return { input: toolUse.input as T }
    },
  }
}
