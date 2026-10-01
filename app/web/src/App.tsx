import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import RutaGestion from './components/RutaGestion';
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
import Perfil from './pages/Perfil';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Operacion />} />
          {/* Rutas antiguas fusionadas en OPERACIÓN: ahora seleccionan la
              pestaña correspondiente (ciclo D-72). */}
          <Route path="panel" element={<Navigate to="/" replace />} />
          <Route path="ingesta" element={<Navigate to="/?pestana=ingesta" replace />} />
          <Route path="monitoreo" element={<Navigate to="/?pestana=monitoreo" replace />} />
          <Route path="alertas" element={<Navigate to="/?pestana=alertas" replace />} />
          <Route path="casos" element={<Casos />} />
          <Route path="especiales" element={<Especiales />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="ayuda" element={<Ayuda />} />
          {/* Perfil y Cuenta para todos los roles (D-72). */}
          <Route path="perfil" element={<Perfil />} />
          {/* SISTEMAS: solo Super Usuario (se filtra en el menú y en la página). */}
          <Route path="sistemas" element={<Sistemas />} />
          {/* DESPACHO y CONFIGURACIÓN: no disponibles para el rol TÉCNICO (D-72). */}
          <Route element={<RutaGestion />}>
            <Route path="despacho" element={<Despacho />} />
            <Route path="central" element={<Centrales />} />
            <Route path="sectores" element={<Sectores />} />
            <Route path="tecnicos" element={<Tecnicos />} />
            <Route path="flota" element={<Flota />} />
            <Route path="cuadrillas" element={<Cuadrillas />} />
            <Route path="catalogos" element={<Catalogos />} />
            <Route path="parametros" element={<Parametros />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
