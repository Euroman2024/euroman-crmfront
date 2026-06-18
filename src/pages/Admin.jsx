import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';

export default function Admin() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrs, setQrs] = useState({}); // Guardar los QRs por accountId

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

  if (loading) {
    return <div className="text-gray-400">Cargando cuentas...</div>;
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-white">Gestión de Cuentas WhatsApp</h2>
      
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
                </div>
              ) : qrs[account.id] ? (
                <div className="animate-fade-in flex flex-col items-center">
                  <img src={qrs[account.id]} alt="Código QR" className="w-48 h-48 rounded-lg shadow-md mb-3" />
                  <span className="text-xs text-gray-400">Escanea este código con tu WhatsApp</span>
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
    </div>
  );
}
