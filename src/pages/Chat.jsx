import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Chat() {
  const [conversaciones, setConversaciones] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');

  // Cargar lista de conversaciones al iniciar
  useEffect(() => {
    const fetchConversaciones = async () => {
      try {
        const { data } = await api.get('/conversaciones');
        setConversaciones(data);
      } catch (error) {
        console.error("Error al cargar chats:", error);
      } finally {
        setLoadingChats(false);
      }
    };
    fetchConversaciones();
  }, []);

  // Cargar mensajes cuando se selecciona un chat
  useEffect(() => {
    if (!activeChatId) return;

    const fetchMensajes = async () => {
      setLoadingMessages(true);
      try {
        const { data } = await api.get(`/conversaciones/${activeChatId}/mensajes`);
        setMensajes(data);
      } catch (error) {
        console.error("Error al cargar mensajes:", error);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMensajes();
  }, [activeChatId]);

  const activeChat = conversaciones.find(c => c.id === activeChatId);

  return (
    <div className="flex h-[calc(100vh-100px)] w-full bg-surface border border-border rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
      
      {/* SIDEBAR IZQUIERDO: Lista de Chats */}
      <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-border bg-background/50 flex flex-col">
        <div className="p-4 border-b border-border bg-surface/50">
          <h3 className="font-bold text-white text-lg">Bandeja de Entrada</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="p-4 text-center text-gray-400">Cargando chats...</div>
          ) : conversaciones.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No hay chats activos.</div>
          ) : (
            conversaciones.map((conv) => {
              const isActive = conv.id === activeChatId;
              const lastMessage = conv.mensajes?.[0]?.contenido || '...';
              
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveChatId(conv.id)}
                  className={`w-full text-left p-4 border-b border-border hover:bg-white/5 transition-colors flex items-start gap-3
                    ${isActive ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}
                  `}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg shadow-sm">
                    {conv.contacto.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold text-white truncate">{conv.contacto.nombre}</h4>
                      <span className="text-xs text-gray-400">
                        {conv.estado === 'nuevo' ? '🔵' : '✔️'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate">{lastMessage}</p>
                    <span className="text-xs text-primary mt-1 block">Línea: {conv.whatsappAccount.nombre}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ÁREA CENTRAL: Chat Activo */}
      <div className="flex-1 flex flex-col bg-background/20 relative">
        {activeChat ? (
          <>
            {/* Cabecera del Chat */}
            <div className="p-4 border-b border-border bg-surface/80 backdrop-blur-md flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center font-bold">
                    {activeChat.contacto.nombre.charAt(0).toUpperCase()}
                 </div>
                 <div>
                   <h3 className="font-bold text-white leading-tight">{activeChat.contacto.nombre}</h3>
                   <span className="text-xs text-green-400">+{activeChat.contacto.telefono}</span>
                 </div>
              </div>
              <div className="text-sm px-3 py-1 bg-surface border border-border rounded-full text-gray-300">
                Línea: {activeChat.whatsappAccount.nombre}
              </div>
            </div>

            {/* Historial de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="text-center text-gray-500 mt-10">Cargando mensajes...</div>
              ) : mensajes.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">No hay mensajes.</div>
              ) : (
                mensajes.map((msg) => {
                  const isOut = msg.tipo === 'outgoing';
                  return (
                    <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                        isOut 
                          ? 'bg-primary text-white rounded-br-none' 
                          : 'bg-surface border border-border text-gray-100 rounded-bl-none'
                      }`}>
                        <p className="text-sm">{msg.contenido}</p>
                        <span className="text-[10px] opacity-60 mt-1 block text-right">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input de Envio (Maquetación) */}
            <div className="p-4 bg-surface/50 border-t border-border">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); /* Para el Dia 7 */ }}>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                />
                <button type="submit" className="bg-primary hover:bg-primary/90 text-white p-3 rounded-xl transition-colors flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <svg className="w-20 h-20 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg">Selecciona una conversación para empezar a chatear</p>
          </div>
        )}
      </div>

    </div>
  );
}
