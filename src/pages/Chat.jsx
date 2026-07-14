import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import EmojiPicker from 'emoji-picker-react';

const formatPhoneNumber = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'Sin número';

  let countryCode = '';
  let remaining = digits;

  if (digits.length > 10) {
    countryCode = digits.slice(0, digits.length - 10);
    remaining = digits.slice(countryCode.length);
  }

  const groups = [];
  while (remaining.length > 0) {
    if (remaining.length > 4) {
      groups.push(remaining.slice(0, 3));
      remaining = remaining.slice(3);
    } else {
      groups.push(remaining);
      remaining = '';
    }
  }

  return `${countryCode ? `+${countryCode} ` : ''}${groups.join(' ')}`.trim();
};

const getContactDisplayName = (contacto) => {
  const name = contacto?.nombre?.trim();
  const isUnknown = name ? /^(desconocido|unknown)$/i.test(name) : false;
  if (name && !isUnknown) return name;
  return formatPhoneNumber(contacto?.telefono?.split('@')[0] || contacto?.telefono || '');
};

export default function Chat() {
  const [conversaciones, setConversaciones] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const activeChatIdRef = useRef(activeChatId);
  const [mensajes, setMensajes] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);

  // Mantener la referencia actualizada para los sockets
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const fileInputRef = useRef(null);
  
  const messagesEndRef = useRef(null);

  // Auto-scroll al final de los mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Cargar lista de conversaciones
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

  // Cargar mensajes del chat activo
  useEffect(() => {
    if (!activeChatId) return;

    const fetchMensajes = async () => {
      setLoadingMessages(true);
      try {
        const { data } = await api.get(`/conversaciones/${activeChatId}/mensajes`);
        setMensajes(data);
        setTimeout(scrollToBottom, 100);
        // Actualizar el estado local a leido
        setConversaciones(prev => prev.map(c => c.id === activeChatId ? { ...c, estado: 'leido' } : c));
      } catch (error) {
        console.error("Error al cargar mensajes:", error);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMensajes();
  }, [activeChatId]);

  // Manejo de tecla ESC para cerrar ventanas o deseleccionar chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (replyingTo) {
          setReplyingTo(null);
        } else {
          setActiveChatId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEmojiPicker, replyingTo]);

  // Sockets para Tiempo Real
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');

    const handleIncoming = (payload) => {
      const { conversacionId, mensaje } = payload;
      
      // 1. Si es el chat abierto, agregar el mensaje a la vista
      if (activeChatIdRef.current === conversacionId) {
        setMensajes(prev => {
          const newMessages = [...prev, mensaje];
          return newMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        setTimeout(scrollToBottom, 100);
      }

      // 2. Mover la conversación arriba en la lista y actualizar el "snippet"
      setConversaciones(prev => {
        const idx = prev.findIndex(c => c.id === conversacionId);
        if (idx !== -1) {
          const updated = [...prev];
          const currentPreview = updated[idx].mensajes?.[0];
          
          // Solo actualizar preview y subir en la lista si el mensaje es más nuevo
          if (!currentPreview || new Date(mensaje.createdAt) >= new Date(currentPreview.createdAt)) {
            updated[idx].mensajes = [mensaje];
            updated[idx].updatedAt = mensaje.createdAt;
            if (mensaje.tipo === 'incoming' && activeChatIdRef.current !== conversacionId) {
              updated[idx].estado = 'nuevo';
            }
            const [moved] = updated.splice(idx, 1);
            return [moved, ...updated];
          }
          return updated;
        } else {
          // Si es un chat totalmente nuevo, lo agregamos arriba
          return [{
            id: conversacionId,
            contacto: payload.contacto,
            whatsappAccount: { id: payload.whatsappAccountId, nombre: 'Línea', estado: 'conectado' },
            estado: payload.mensaje.tipo === 'incoming' ? 'nuevo' : 'leido',
            mensajes: [mensaje],
            updatedAt: mensaje.createdAt
          }, ...prev];
        }
      });
    };

    socket.on('new_message', handleIncoming);    // Mensaje del cliente
    socket.on('message_sent', handleIncoming);   // Mensaje nuestro enviado (quizás por otro vendedor)

    return () => {
      socket.off('new_message', handleIncoming);
      socket.off('message_sent', handleIncoming);
      socket.disconnect();
    };
  }, [activeChatId]);

  // Enviar mensaje
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId || sending) return;

    const payload = {
      conversacionId: activeChatId,
      contenido: inputText
    };
    
    if (replyingTo) {
      payload.quotedMessageId = replyingTo.id;
    }

    setSending(true);

    try {
      await api.post('/messages/send', payload);
      // Limpiamos el texto y la respuesta
      setInputText('');
      setReplyingTo(null);
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      alert("Error al enviar el mensaje. Verifica si el número está conectado.");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;

    setSending(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversacionId', activeChatId);
    
    // Si queremos enviar texto junto con la imagen
    if (inputText.trim()) {
      formData.append('contenido', inputText);
      setInputText('');
    }
    
    if (replyingTo) {
      formData.append('quotedMessageId', replyingTo.id);
      setReplyingTo(null);
    }

    try {
      await api.post('/messages/send-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (error) {
      console.error("Error al enviar archivo:", error);
      alert("Error al enviar el archivo.");
    } finally {
      setSending(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const activeChat = conversaciones.find(c => c.id === activeChatId);

  const filteredConversaciones = conversaciones.filter(c => {
    if (!searchTerm) return true;
    const displayName = getContactDisplayName(c.contacto).toLowerCase();
    const displayPhone = formatPhoneNumber(c.contacto.telefono?.split('@')[0] || c.contacto.telefono || '').toLowerCase();
    const matchName = displayName.includes(searchTerm.toLowerCase());
    const matchPhone = displayPhone.includes(searchTerm.toLowerCase());
    return matchName || matchPhone;
  });

  const handleEmojiClick = (emojiObject) => {
    setInputText(prev => prev + emojiObject.emoji);
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden animate-fade-in">
      
      {/* SIDEBAR IZQUIERDO */}
      <div className="w-[30%] min-w-[350px] max-w-[420px] border-r border-border bg-background flex flex-col z-10">
        
        {/* Cabecera del Sidebar */}
        <div className="h-16 px-4 bg-surface flex items-center justify-end border-b border-border">
          <div className="flex items-center gap-4 text-gray-400">
             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.072 1.761a10.05 10.05 0 00-9.303 5.65.977.977 0 00.324 1.273l.204.144a.984.984 0 01.353 1.052l-.209.67c-.204.642.167 1.3.82 1.455l.894.21a.992.992 0 01.737.838l.142.748c.112.585.69 1.002 1.282.93l.89-.108a.984.984 0 011.02.592l.33 0.72c.264.577.97.808 1.543.518l.836-.425a.984.984 0 011.233.197l.55.55c.44.44 1.15.43 1.58-.024l.504-.53a.984.984 0 011.22-.244l.8.44c.56.31 1.25.1 1.52-.47l.3-.64a.984.984 0 011-.56l.83.1a1 1 0 001.07-.86l.08-.7a.984.984 0 01.68-.86l.8-.25c.61-.19.98-.82.84-1.44l-.16-.76a.984.984 0 01.27-1l.6-.6c.45-.45.54-1.16.2-1.72l-.46-.77a.984.984 0 01.03-1.16l.46-.72c.38-.59.27-1.37-.24-1.84l-.64-.58a.984.984 0 01-.26-1.13l.25-.8c.2-.62-.17-1.3-.8-1.46l-.8-.2a.984.984 0 01-.7-.87l-.1-.85c-.06-.6-.62-1.03-1.22-.97l-.84.1a.984.984 0 01-1.04-.63l-.3-.72c-.26-.6-.99-.82-1.57-.5l-.78.43a.984.984 0 01-1.24-.22l-.5-.54c-.45-.48-1.2-.48-1.65-.01l-.48.5a.984.984 0 01-1.23.23l-.75-.4c-.58-.3-1.3-.08-1.58.5l-.27.56a.984.984 0 01-1 .54l-.8-.1c-.6-.08-1.13.3-1.2.9z" /></svg>
             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 1.664-.596 1.664-1.629V4.821c-.001-1.032-.632-1.646-1.664-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/></svg>
             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7a2 2 0 10-.001-4.001A2 2 0 0012 7zm0 2a2 2 0 10-.001 3.999A2 2 0 0012 9zm0 6a2 2 0 10-.001 3.999A2 2 0 0012 15z"/></svg>
          </div>
        </div>

        {/* Barra de Búsqueda */}
        <div className="p-2 border-b border-border flex items-center bg-background">
           <div className="flex-1 bg-surface rounded-lg flex items-center px-4 py-1.5 gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.604 0a3.601 3.601 0 110-7.202 3.601 3.601 0 010 7.202z"/></svg>
              <input 
                type="text" 
                placeholder="Busca un chat o número" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent flex-1 text-sm text-[#e9edef] focus:outline-none placeholder-gray-400" 
              />
           </div>
        </div>

        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="p-4 text-center text-gray-400">Cargando chats...</div>
          ) : filteredConversaciones.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No hay chats activos.</div>
          ) : (
            filteredConversaciones.map((conv) => {
              const isActive = conv.id === activeChatId;
              const lastMessageData = conv.mensajes?.[0];
              const contactoNombre = getContactDisplayName(conv.contacto);
              let lastMessage = lastMessageData?.contenido || '...';
              
              if (lastMessageData?.tipo === 'outgoing') {
                lastMessage = `Tú: ${lastMessage}`;
              }
              
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveChatId(conv.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-3 transition-colors hover:bg-hover cursor-pointer
                    ${isActive ? 'bg-hover' : ''}
                    ${conv.whatsappAccount?.estado !== 'conectado' ? 'opacity-50' : ''}
                  `}
                >
                  <div className="w-12 h-12 bg-gray-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xl overflow-hidden">
                    {conv.contacto.fotoPerfilUrl ? (
                      <img src={conv.contacto.fotoPerfilUrl} alt={contactoNombre} className="w-full h-full object-cover" />
                    ) : (
                      contactoNombre.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden border-b border-border/50 pb-3 -mb-3 pt-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className={`text-[16px] truncate ${conv.estado === 'nuevo' ? 'text-white font-semibold' : 'text-[#e9edef]'}`}>
                        {contactoNombre}
                      </h4>
                      <span className={`text-[12px] whitespace-nowrap ml-2 ${conv.estado === 'nuevo' ? 'text-primary font-semibold' : 'text-gray-400'}`}>
                        {lastMessageData ? new Date(lastMessageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`text-sm truncate flex-1 ${conv.estado === 'nuevo' ? 'text-white font-semibold' : 'text-gray-400'}`}>
                        {lastMessage}
                      </p>
                      {conv.estado === 'nuevo' && (
                        <span className="min-w-[20px] h-[20px] px-1.5 bg-primary rounded-full text-background text-[11px] font-bold flex items-center justify-center ml-2">
                          1
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ÁREA CENTRAL */}
      <div className="flex-1 flex flex-col relative bg-[#0b141a]">
        
        {/* Capa del Fondo Doodle */}
        <div className="absolute inset-0 bg-wa-doodle z-0"></div>

        {activeChat ? (
          <>
            {/* Cabecera del Chat */}
            <div className="h-16 px-4 bg-surface border-l border-border flex justify-between items-center z-10 w-full">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                    {activeChat.contacto.fotoPerfilUrl ? (
                      <img src={activeChat.contacto.fotoPerfilUrl} alt={getContactDisplayName(activeChat.contacto)} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold">{getContactDisplayName(activeChat.contacto).charAt(0).toUpperCase()}</span>
                    )}
                 </div>
                 <div className="flex flex-col">
                   <h3 className="font-semibold text-[#e9edef] text-[16px]">{getContactDisplayName(activeChat.contacto)}</h3>
                   <span className="text-[13px] text-gray-400">
                     {formatPhoneNumber(activeChat.contacto.telefono?.split('@')[0] || activeChat.contacto.telefono || '')} • Línea: {activeChat.whatsappAccount?.nombre || 'Desconocida'}
                   </span>
                 </div>
              </div>
              <div className="flex gap-4 text-gray-400">
                 <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2.1 4.6-4.6 4.6z"/></svg>
                 <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7a2 2 0 10-.001-4.001A2 2 0 0012 7zm0 2a2 2 0 10-.001 3.999A2 2 0 0012 9zm0 6a2 2 0 10-.001 3.999A2 2 0 0012 15z"/></svg>
              </div>
            </div>

            {/* Historial de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 md:px-[5%] lg:px-[10%] space-y-2 z-10 flex flex-col">
              {loadingMessages ? (
                <div className="text-center text-gray-500 mt-10">Cargando mensajes...</div>
              ) : mensajes.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">No hay mensajes.</div>
              ) : (
                mensajes.map((msg) => {
                  const isOutgoing = msg.tipo === 'outgoing';
                  return (
                    <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`relative max-w-[85%] md:max-w-[70%] px-2.5 py-1.5 rounded-lg shadow-sm ${
                        isOutgoing 
                          ? 'bg-bubble-out text-[#e9edef] rounded-tr-none' 
                          : 'bg-bubble-in text-[#e9edef] rounded-tl-none'
                      }`}>
                        {/* Botón Flotante para Responder */}
                        <button 
                          onClick={() => setReplyingTo(msg)}
                          className={`absolute top-1 ${isOutgoing ? 'left-[-35px]' : 'right-[-35px]'} opacity-0 group-hover:opacity-100 transition-opacity bg-surface p-1.5 rounded-full text-gray-400 hover:text-white shadow-md z-10`}
                          title="Responder a este mensaje"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        </button>

                        {/* Triangulito simulado */}
                        <div className={`absolute top-0 w-2 h-3 ${isOutgoing ? '-right-2 text-bubble-out' : '-left-2 text-bubble-in'}`}>
                           <svg viewBox="0 0 8 13" width="8" height="13"><path opacity=".13" fill="#0000000" d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"></path><path fill="currentColor" d="M1.533 2.568L8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"></path></svg>
                        </div>
                        
                        {msg.archivoUrl && msg.mimetype?.startsWith('image/') && (
                          <img src={`${import.meta.env.VITE_API_URL.replace('/api','')}${msg.archivoUrl}`} alt="Adjunto" className="max-w-full rounded-md mb-1" />
                        )}
                        {msg.archivoUrl && msg.mimetype?.startsWith('audio/') && (
                          <audio src={`${import.meta.env.VITE_API_URL.replace('/api','')}${msg.archivoUrl}`} controls className="max-w-full mb-1 h-10" />
                        )}
                        {msg.archivoUrl && msg.mimetype?.startsWith('video/') && (
                          <video src={`${import.meta.env.VITE_API_URL.replace('/api','')}${msg.archivoUrl}`} controls className="max-w-full rounded-md mb-1" />
                        )}
                        {msg.archivoUrl && !msg.mimetype?.startsWith('image/') && !msg.mimetype?.startsWith('audio/') && !msg.mimetype?.startsWith('video/') && (
                          <a href={`${import.meta.env.VITE_API_URL.replace('/api','')}${msg.archivoUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded-lg mb-1 text-sm hover:bg-black/30 transition-colors text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Descargar Archivo
                          </a>
                        )}

                        {/* Visualizar mensaje citado si existe */}
                        {msg.quotedContenido && (
                          <div className={`mb-1 p-1.5 rounded-md text-[13px] border-l-4 opacity-90
                            ${isOutgoing ? 'bg-black/10 border-[#103629] text-[#e9edef]' : 'bg-black/5 border-primary text-[#e9edef]'}
                          `}>
                            <p className={`font-semibold text-xs mb-0.5 ${isOutgoing ? 'text-[#103629]' : 'text-primary'}`}>
                              Mensaje Citado
                            </p>
                            <p className="truncate opacity-80">{msg.quotedContenido}</p>
                          </div>
                        )}

                        <p className="text-[14.5px] whitespace-pre-wrap leading-relaxed pr-10">{msg.contenido}</p>
                        <span className="text-[11px] text-gray-400 absolute bottom-1.5 right-2 leading-none">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOutgoing && (
                             <svg className="inline-block w-[15px] h-[15px] ml-1 text-gray-400" fill="currentColor" viewBox="0 0 16 15"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              {/* Elemento invisible para forzar el auto-scroll */}
              <div ref={messagesEndRef} />
            </div>

            {/* Recuadro de Citar Mensaje (Preview) */}
            {replyingTo && (
              <div className="absolute bottom-16 left-0 w-full bg-surface/95 backdrop-blur border-t border-border p-3 flex items-center justify-between z-20">
                <div className="flex-1 bg-background border-l-4 border-primary rounded-r p-2 ml-14 mr-4">
                  <p className="text-primary text-xs font-bold mb-1">
                    {replyingTo.tipo === 'outgoing' ? 'Tú' : getContactDisplayName(activeChat.contacto || {})}
                  </p>
                  <p className="text-gray-400 text-xs truncate max-w-full">
                    {replyingTo.contenido || (replyingTo.archivoUrl ? 'Archivo adjunto' : '')}
                  </p>
                </div>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="p-2 text-gray-400 hover:text-white mr-4"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}

            {/* Input de Envío */}
            <div className="h-16 px-4 bg-surface flex items-center gap-4 z-10 w-full relative">
              {activeChat.whatsappAccount?.estado === 'conectado' ? (
                <>
                  {showEmojiPicker && (
                    <div className="absolute bottom-16 left-4 z-50">
                      <EmojiPicker 
                        theme="dark" 
                        onEmojiClick={handleEmojiClick}
                        autoFocusSearch={false}
                      />
                    </div>
                  )}
                  <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`${showEmojiPicker ? 'text-primary' : 'text-gray-400'} hover:text-white transition-colors`}
                  >
                     <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363-1.108s-.669 1.959-5.051 1.959c-3.379 0-5.353-1.959-5.353-1.959s5.897-1.15 10.404 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z"/></svg>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    disabled={sending}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                     <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 003.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.817 2.267-.699 3.23.262.5.501.802 1.1.849 1.685.051.573-.156 1.111-.589 1.543l-9.547 9.549a3.97 3.97 0 01-2.829 1.171 3.975 3.975 0 01-2.83-1.173 3.973 3.973 0 01-1.172-2.828c0-1.071.415-2.076 1.172-2.83l7.209-7.211c.157-.157.264-.579.028-.814L11.5 4.36a.572.572 0 00-.834.018l-7.205 7.207a5.577 5.577 0 00-1.645 3.971z"/></svg>
                  </button>
                  <form className="flex-1" onSubmit={handleSend}>
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={sending ? "Enviando..." : "Escribe un mensaje"}
                      disabled={sending}
                      className="w-full bg-hover rounded-lg px-4 py-2.5 text-[15px] text-[#e9edef] focus:outline-none placeholder-gray-400 disabled:opacity-50"
                    />
                  </form>
                  {inputText.trim() ? (
                    <button 
                      onClick={handleSend}
                      disabled={sending}
                      className="text-gray-400 hover:text-white p-2 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                    </button>
                  ) : (
                    <button className="text-gray-400 hover:text-white p-2 transition-colors">
                       <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2.002z"/></svg>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#e9edef] bg-[#182229] py-3 rounded-lg text-[14px]">
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  Línea Desconectada. Modo Lectura Activo.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-surface z-10 border-l border-border">
            <svg className="w-32 h-32 mb-6 text-[#2a3942]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.93.55 3.73 1.48 5.25L2 22l4.87-1.44C8.36 21.46 10.12 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2v-2zm1-3.5c-.83 0-1.5-.67-1.5-1.5S11.17 9.5 12 9.5c1.38 0 2 1 2 2 0 1.5-2 2-2 3.5h-2c0-2.5 2-3.5 2-5 0-2.21-1.79-4-4-4S6 7.79 6 10h2c0-1.1.9-2 2-2s2 .9 2 2c0 1.5-2 2-2 3.5z"/>
            </svg>
            <h1 className="text-3xl font-light text-[#e9edef] mb-3">Euroman CRM</h1>
            <p className="text-sm text-gray-400">Selecciona un chat de la lista izquierda o espera a recibir mensajes.</p>
          </div>
        )}
      </div>

    </div>
  );
}
