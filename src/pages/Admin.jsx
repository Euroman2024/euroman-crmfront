import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';

export default function Admin() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrs, setQrs] = useState({}); // Guardar los QRs por accountId
  const [showModal, setShowModal] = useState(false);
  const [accountToLogout, setAccountToLogout] = useState(null);

  // Cargar cuentas iniciales
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data } = await api.get('/whatsapp-accounts');
        setAccounts(data);
      } catch (error) {
        console.error("Error al cargar cuentas:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  // Conectar Sockets
  useEffect(() => {
    // URL del backend desde variables de entorno
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');

    // Escuchar cuando se genera un QR
    socket.on('qr_generated', ({ accountId, qr }) => {
      setQrs(prev => ({ ...prev, [accountId]: qr }));
    });

    // Escuchar errores de seguridad (números duplicados/incorrectos)
    socket.on('auth_error', ({ accountId, message }) => {
      alert(`⚠️ ALERTA DE SEGURIDAD:\n\n${message}`);
    });

    // Escuchar cambios de estado (conectado, desconectado)
    socket.on('status_changed', ({ accountId, status }) => {
      setAccounts(prev => prev.map(acc => 
        acc.id === accountId ? { ...acc, estado: status } : acc
      ));
      // Si se conectó, borramos el QR de la pantalla
      if (status === 'conectado') {
        setQrs(prev => {
          const newQrs = { ...prev };
          delete newQrs[accountId];
          return newQrs;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCreateAccount = async () => {
    const nombre = window.prompt("Ingresa el nombre para la nueva línea (Ej. Ventas 5):");
    if (!nombre || !nombre.trim()) return;
    try {
      const { data } = await api.post('/whatsapp-accounts', { nombre: nombre.trim() });
      setAccounts(prev => [data, ...prev]);
    } catch (error) {
      console.error(error);
      alert("Error al crear la cuenta.");
    }
  };

  const confirmLogout = (id) => {
    setAccountToLogout(id);
    setShowModal(true);
  };

  const executeLogout = async () => {
    if (!accountToLogout) return;
    const id = accountToLogout;
    setShowModal(false);
    setAccountToLogout(null);
    try {
      await api.post(`/whatsapp-accounts/${id}/logout`);
    } catch (error) {
      console.error(error);
      alert("Error al intentar cerrar la sesión.");
    }
  };

  if (loading) {
    return <div className="text-gray-400">Cargando cuentas...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-white">Gestión de Líneas Euroman CRM</h2>
        <button 
          onClick={handleCreateAccount}
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Vincular Nueva Línea
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(account => (
          <div key={account.id} className="bg-surface border border-border p-6 rounded-2xl shadow-xl flex flex-col items-center text-center">
            
            <h3 className="text-xl font-semibold text-white mb-2">{account.nombre}</h3>
            
            <div className={`px-3 py-1 rounded-full text-xs font-bold mb-6 ${
              account.estado === 'conectado' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {account.estado.toUpperCase()}
            </div>

            {/* Zona de QR */}
            <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[250px] bg-background/50 rounded-xl border border-white/5 p-4 relative">
              {account.estado === 'conectado' ? (
                <div className="flex flex-col items-center text-green-400">
                  <svg className="w-16 h-16 mb-2 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Cuenta Sincronizada</span>
                  <button 
                    onClick={() => confirmLogout(account.id)}
                    className="mt-6 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    Cerrar Sesión de Línea
                  </button>
                </div>
              ) : qrs[account.id] ? (
                <div className="animate-fade-in flex flex-col items-center">
                  <img src={qrs[account.id]} alt="Código QR" className="w-48 h-48 rounded-lg shadow-md mb-3" />
                  <span className="text-xs text-gray-400">Escanea este código con tu celular</span>
                </div>
              ) : (
                <div className="text-gray-500 flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                  <span className="text-sm">Generando QR...</span>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Modal Profesional de Confirmación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <h3 className="text-xl font-bold text-white">Cerrar Sesión</h3>
            </div>
            <p className="text-gray-300 mb-8 leading-relaxed">
              ¿Estás seguro de que deseas desconectar esta línea de Euroman CRM? Tendrás que escanear un nuevo código QR para volver a vincular el dispositivo.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => { setShowModal(false); setAccountToLogout(null); }}
                className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-gray-300 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executeLogout}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-red-500/20"
              >
                Sí, desconectar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
