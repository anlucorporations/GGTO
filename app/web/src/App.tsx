import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import Login from './pages/Login';
import Operacion from './pages/Operacion';
import Casos from './pages/Casos';
import Despacho from './pages/Despacho';
import Especiales from './pages/Especiales';
import Agenda from './pages/Agenda';
import Centrales from './pages/Centrales';
import Sectores from './pages/Sectores';
import Tecnicos from './pages/Tecnicos';
import Flota from './pages/Flota';
import Cuadrillas from './pages/Cuadrillas';
import Catalogos from './pages/Catalogos';
import Parametros from './pages/Parametros';
import Ayuda from './pages/Ayuda';
import Sistemas from './pages/Sistemas';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Operacion />} />
          {/* Rutas antiguas fusionadas en OPERACIÓN (UI 2, ciclo D-65). */}
          <Route path="ingesta" element={<Navigate to="/" replace />} />
          <Route path="monitoreo" element={<Navigate to="/" replace />} />
          <Route path="alertas" element={<Navigate to="/" replace />} />
          <Route path="casos" element={<Casos />} />
          <Route path="despacho" element={<Despacho />} />
          <Route path="especiales" element={<Especiales />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="central" element={<Centrales />} />
          <Route path="sectores" element={<Sectores />} />
          <Route path="tecnicos" element={<Tecnicos />} />
          <Route path="flota" element={<Flota />} />
          <Route path="cuadrillas" element={<Cuadrillas />} />
          <Route path="catalogos" element={<Catalogos />} />
          <Route path="parametros" element={<Parametros />} />
          <Route path="ayuda" element={<Ayuda />} />
          {/* SISTEMAS: solo Super Usuario (se filtra en el menú y en la página). */}
          <Route path="sistemas" element={<Sistemas />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
