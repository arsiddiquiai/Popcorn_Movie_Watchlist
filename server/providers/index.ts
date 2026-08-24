import { createAnthropicAdapter } from './anthropic.js'
import { createGeminiAdapter } from './gemini.js'
import { createOpenAiAdapter } from './openai.js'
import type { ModelAdapter, ProviderName } from './types.js'

export { AdapterError } from './types.js'
export type { ModelAdapter, ProviderName, StructuredCallParams, StructuredCallResult, ToolSchema } from './types.js'

export function createAdapter(provider: ProviderName, apiKey: string, modelPref?: string | null): ModelAdapter {
  switch (provider) {
    case 'anthropic':
      return createAnthropicAdapter(apiKey, modelPref)
    case 'openai':
      return createOpenAiAdapter(apiKey, modelPref)
    case 'gemini':
      return createGeminiAdapter(apiKey, modelPref)
  }
}
