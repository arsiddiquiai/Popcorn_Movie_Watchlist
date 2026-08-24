/**
 * OpenAI adapter, via the Responses API (the current documented path for
 * function calling — verified against https://developers.openai.com live,
 * not recalled from training, since this API surface has moved more than
 * once). Raw fetch rather than the OpenAI SDK, matching how the rest of
 * server/ talks to TMDB and Resend — one fewer dependency, and this is a
 * single endpoint, not enough surface to justify a full SDK.
 */
import type { ModelAdapter, StructuredCallParams, StructuredCallResult } from './types.js'
import { AdapterError } from './types.js'

/** "gpt-5.6-luna" — OpenAI's current cheapest tier with function-calling
 *  support, the closest analogue to Haiku's role as the shared-key default. */
const DEFAULT_MODEL = 'gpt-5.6-luna'

interface ResponsesOutputItem {
  type: string
  name?: string
  arguments?: string
}
interface ResponsesBody {
  output?: ResponsesOutputItem[]
  error?: { message?: string }
}

export function createOpenAiAdapter(apiKey: string, modelPref?: string | null): ModelAdapter {
  const model = modelPref?.trim() || DEFAULT_MODEL

  return {
    provider: 'openai',
    async callForStructuredOutput<T>({ system, userContent, tool, maxTokens }: StructuredCallParams): Promise<StructuredCallResult<T>> {
      let response: Response
      try {
        response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            input: [
              { type: 'message', role: 'system', content: system },
              { type: 'message', role: 'user', content: userContent },
            ],
            tools: [
              {
                type: 'function',
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema,
                strict: true,
              },
            ],
            tool_choice: { type: 'function', name: tool.name },
            max_output_tokens: maxTokens ?? 4096,
          }),
        })
      } catch (err) {
        throw new AdapterError('OpenAI request failed to send.', 'network', err)
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ResponsesBody
        const message = body.error?.message ?? `HTTP ${response.status}`
        if (response.status === 401 || response.status === 403) throw new AdapterError(`OpenAI key rejected: ${message}`, 'auth')
        if (response.status === 429) throw new AdapterError(`OpenAI rate limited: ${message}`, 'rate_limit')
        throw new AdapterError(`OpenAI API error: ${message}`, 'unknown')
      }

      const body = (await response.json()) as ResponsesBody
      const call = body.output?.find((item) => item.type === 'function_call' && item.name === tool.name)
      if (!call?.arguments) throw new AdapterError('OpenAI returned no function call.', 'invalid_response')

      try {
        return { input: JSON.parse(call.arguments) as T }
      } catch (err) {
        throw new AdapterError('OpenAI returned unparseable function arguments.', 'invalid_response', err)
      }
    },
  }
}
