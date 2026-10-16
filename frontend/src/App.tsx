import { Navigate, Route, Routes } from 'react-router';
import Marco from './componentes/Marco';
import Caja from './paginas/Caja';
import Ingreso from './paginas/Ingreso';

export default function App() {
  return (
    <Routes>
      <Route path="/ingresar" element={<Ingreso />} />
      {/* Todo lo que está dentro de <Marco> exige haber ingresado */}
      <Route element={<Marco />}>
        <Route path="/" element={<Caja />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
