import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import { pedirAlmacenamientoPersistente } from './lib/almacenamiento'
import ProveedorSesion from './lib/sesion'
import './index.css'

void pedirAlmacenamientoPersistente()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProveedorSesion>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ProveedorSesion>
  </StrictMode>,
)
