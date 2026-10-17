import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Imported before App so component stylesheets land after the base layer and
// can override it predictably.
import './styles/global.css'
import App from './App'
import DesignGallery from './components/DesignGallery'

const prospectPage = /^\/designs(?:\/|$)/.test(window.location.pathname)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {prospectPage ? <DesignGallery /> : <App />}
  </StrictMode>,
)
