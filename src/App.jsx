import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SistemaProvider } from './context/SistemaContext'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Causas from './pages/Causas'
import Prospectos from './pages/Prospectos'
import Audiencias from './pages/Audiencias'
import Calendario from './pages/Calendario'
import Plazos from './pages/Plazos'
import PJUD from './pages/PJUD'
import SIAU from './pages/SIAU'
import RevisionCausas from './pages/RevisionCausas'
import Tareas from './pages/Tareas'
import Reuniones from './pages/Reuniones'
import Documentos from './pages/Documentos'
import Gastos from './pages/Gastos'
import Apuntes from './pages/Apuntes'
import Configuracion from './pages/Configuracion'

export default function App() {
  return (
    <SistemaProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index              element={<Dashboard />} />
          <Route path="clientes"   element={<Clientes />} />
          <Route path="causas"     element={<Causas />} />
          <Route path="prospectos" element={<Prospectos />} />
          <Route path="audiencias" element={<Audiencias />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="plazos"     element={<Plazos />} />
          <Route path="pjud"       element={<PJUD />} />
          <Route path="siau"       element={<SIAU />} />
          <Route path="revision"   element={<RevisionCausas />} />
          <Route path="tareas"     element={<Tareas />} />
          <Route path="reuniones"  element={<Reuniones />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="gastos"     element={<Gastos />} />
          <Route path="apuntes"    element={<Apuntes />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </SistemaProvider>
  )
}
