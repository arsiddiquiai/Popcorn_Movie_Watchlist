import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const rootElement = document.getElementById('root')!

// A thrown error inside the ./App import chain (e.g. missing Supabase env
// vars) happens at module-evaluation time, before React ever renders — it
// won't hit an error boundary, and in this Vite setup it doesn't trigger
// the dev error overlay either, so it would otherwise leave a silent blank
// page. Loading App dynamically inside a try/catch lets us surface it.
try {
  const { default: App } = await import('./App.tsx')
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg);color:var(--text);font-family:var(--font-ui);text-align:center;">
      <div style="max-width:520px;">
        <h1 style="margin:0 0 12px;font-size:20px;">Popcorn failed to start</h1>
        <p style="margin:0;color:var(--muted);font-size:14px;">${message}</p>
      </div>
    </div>
  `
  throw error
}
