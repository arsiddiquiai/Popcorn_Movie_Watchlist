import { createAnthropicAdapter } from './anthropic.ts'
import { createGeminiAdapter } from './gemini.ts'
import { createOpenAiAdapter } from './openai.ts'
import type { ModelAdapter, ProviderName } from './types.ts'

export { AdapterError } from './types.ts'
export type { ModelAdapter, ProviderName, StructuredCallParams, StructuredCallResult, ToolSchema } from './types.ts'

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
