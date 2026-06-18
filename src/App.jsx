import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Login from './pages/Login';
import Admin from './pages/Admin';

// Componente para proteger rutas privadas
const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Layout temporal para el Dashboard
const MainLayout = ({ children }) => {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-surface border-b border-border p-4 flex justify-between items-center shadow-md z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">W</span>
          </div>
          <h1 className="text-xl font-bold text-white">CRM WhatsApp</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-sm">Hola, {user?.nombre || 'Usuario'}</span>
          <button 
            onClick={logout}
            className="text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-xl transition-all font-medium"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
           <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        </div>
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Rutas Privadas */}
        <Route path="/" element={
          <PrivateRoute>
            <MainLayout>
              <Admin />
            </MainLayout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
