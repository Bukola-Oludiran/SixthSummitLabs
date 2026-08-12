import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Imported before App so component stylesheets land after the base layer and
// can override it predictably.
import './styles/global.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
