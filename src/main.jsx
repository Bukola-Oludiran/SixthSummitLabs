import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

// Imported before App so component stylesheets land after the base layer and
// can override it predictably.
import './styles/global.css'
import App from './App'
import DesignGallery from './components/DesignGallery'

const CrmApp = lazy(() => import('./crm/CrmApp'))
const staffPage = /^\/crm(?:\/|$)/.test(window.location.pathname)
const prospectPage = /^\/designs(?:\/|$)/.test(window.location.pathname)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div role="status" style={{ padding: 32 }}>Loading workspace…</div>}>{staffPage ? <CrmApp /> : prospectPage ? <DesignGallery /> : <App />}</Suspense>
  </StrictMode>,
)
