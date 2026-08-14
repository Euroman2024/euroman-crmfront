import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Chat from './pages/Chat';

// Componente para proteger rutas privadas
const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Componente para proteger rutas solo para administradores
const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  return user?.rol === 'admin' ? children : <Navigate to="/" />;
};

// Layout temporal para el Dashboard
const MainLayout = ({ children }) => {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  
  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      <header className="bg-surface border-b border-border p-2 md:p-4 flex flex-wrap md:flex-nowrap justify-between items-center shadow-md z-20 gap-2">
        <div className="flex items-center gap-2 md:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs md:text-base">W</span>
            </div>
            <h1 className="text-base md:text-xl font-bold text-white mr-2 md:mr-4 truncate">CRM</h1>
          </div>
          
          <nav className="flex gap-1 md:gap-2">
            <Link to="/" className={`px-2 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-colors ${location.pathname === '/' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              Chat
            </Link>
            {user?.rol === 'admin' && (
              <Link to="/admin" className={`px-2 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-colors ${location.pathname === '/admin' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                Cuentas QR
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-gray-300 text-xs md:text-sm hidden sm:inline">Hola, {user?.nombre || 'Usuario'} <span className="text-[10px] md:text-xs px-1 md:px-2 py-0.5 ml-1 md:ml-2 bg-primary/20 text-primary rounded-md">{user?.rol || ''}</span></span>
          <button 
            onClick={logout}
            className="text-xs md:text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 px-3 md:px-4 py-1.5 md:py-2 rounded-xl transition-all font-medium"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1 relative flex flex-col overflow-hidden">
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
              <Chat />
            </MainLayout>
          </PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute>
            <AdminRoute>
              <MainLayout>
                <Admin />
              </MainLayout>
            </AdminRoute>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
