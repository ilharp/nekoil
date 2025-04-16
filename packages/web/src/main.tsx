// Must be a standalone file and import at top
import './preinit'

import '@sym-app/components/styles/layout/index.scss'
import '@sym-app/components/styles/theme-sym/index.scss'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
