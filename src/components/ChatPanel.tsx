import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Attachment {
  name: string;
  type: string;
  url: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  attachments?: Attachment[];
}

interface ChatSession {
  id: string;
  name: string;
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor = "#e53e3e",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      onClick={onCancel}
      style={{ zIndex: 110 }}
    >
      <div className="absolute inset-0 bg-[#10243f66] backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-[28px] shadow-xl border border-[#10243f14] max-w-md w-[90%] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 pt-5 pb-3 border-b border-[#10243f14]">
          <h3 className="text-lg font-bold m-0" style={{ color: "#339eea" }}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="text-[#4d6684] hover:text-[#10243f] transition p-1 rounded-full hover:bg-[#dff1ff]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="px-7 py-5">
          <p className="text-[#4d6684] text-sm m-0 leading-relaxed">
            {message}
          </p>
        </div>
        <div className="flex gap-3 justify-end px-7 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-semibold text-xs border border-[#10243f14] text-[#4d6684] bg-[#f8fbff] hover:bg-[#eef8ff] transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl font-semibold text-xs text-white transition hover:opacity-90"
            style={{ background: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChatSession {
  id: string;
  name: string;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatName, setEditChatName] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [isWaitingForBot, setIsWaitingForBot] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userId = typeof window !== 'undefined' 
    ? parseInt(localStorage.getItem('user_id') || '1', 10) 
    : 1;

  const fetchConversations = async () => {
    try {
      const res = await fetch(`https://albertitechnology-agent-api.hf.space/chat/conversations?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        const mappedChats = data.map((c: any) => ({ id: String(c.id), name: c.title }));
        setChats(mappedChats);
        return mappedChats;
      }
    } catch (e) {
      console.error("Error fetching conversations:", e);
    }
    return null;
  };

  useEffect(() => {
    fetchConversations().then(loadedChats => {
      if (loadedChats && loadedChats.length > 0) {
        setActiveChatId(loadedChats[0].id);
      }
    });
  }, [userId]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      setMessages([{ sender: 'bot', text: 'Cargando mensajes...' }]);
      try {
        const res = await fetch(`https://albertitechnology-agent-api.hf.space/chat/conversations/${activeChatId}/messages?user_id=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.map((m: any) => ({
            sender: m.role === 'user' ? 'user' : 'bot',
            text: m.content
          })));
        } else {
          setMessages([{ sender: 'bot', text: 'Error al cargar los mensajes.' }]);
        }
      } catch (e) {
        setMessages([{ sender: 'bot', text: 'Error de conexión al cargar los mensajes.' }]);
      }
    };
    loadMessages();
  }, [activeChatId, userId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      if (!input) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
        return;
      }
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 120 ? 'auto' : 'hidden';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() && pendingAttachments.length === 0) return;
    
    const newAttachments = pendingAttachments.map(f => ({
      name: f.name,
      type: f.type,
      url: URL.createObjectURL(f)
    }));

    const messageText = input;
    setMessages(prev => [...prev, { 
      sender: 'user', 
      text: messageText,
      attachments: newAttachments.length > 0 ? newAttachments : undefined
    }]);
    
    setInput('');
    setPendingAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
    
    setIsWaitingForBot(true);
    
    try {
      const res = await fetch("https://albertitechnology-agent-api.hf.space/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          conversation_id: activeChatId ? parseInt(activeChatId, 10) : null,
          text: messageText,
          model: "Qwen/Qwen2.5-72B-Instruct",
          context_k: 8
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { sender: 'bot', text: data.response }]);
        
        if (!activeChatId && data.conversation_id) {
          setActiveChatId(String(data.conversation_id));
          fetchConversations();
        }
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: "Hubo un error del servidor." }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { sender: 'bot', text: "Hubo un error de conexión." }]);
    } finally {
      setIsWaitingForBot(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setPendingAttachments(prev => [...prev, ...filesArray]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startEditChat = (chat: ChatSession) => {
    setEditingChatId(chat.id);
    setEditChatName(chat.name);
  };

  const saveEditChat = (id: string) => {
    if (editChatName.trim()) {
      setChats(prev => prev.map(c => c.id === id ? { ...c, name: editChatName.trim() } : c));
    }
    setEditingChatId(null);
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChatToDelete(id);
  };

  const confirmDeleteChat = () => {
    if (chatToDelete) {
      setChats(prev => prev.filter(c => c.id !== chatToDelete));
      if (activeChatId === chatToDelete) {
        setActiveChatId('');
        setMessages([]);
      }
      setChatToDelete(null);
    }
  };

  const selectChat = (id: string) => {
    if (activeChatId === id) return;
    setActiveChatId(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '14px', gap: '12px' }}>
      {/* Chat History Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#4d6684', fontWeight: 700 }}>Historial de chats</h4>
          <button 
            onClick={() => setActiveChatId(null)}
            style={{ border: '1px solid #339eea', background: 'transparent', color: '#339eea', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Iniciar nueva conversación"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nuevo Chat
          </button>
        </div>
        <div 
          className="custom-scrollbar"
          style={{ 
            display: 'flex', 
            gap: '8px', 
            overflowX: 'auto', 
            paddingBottom: '4px' 
          }}
        >
          {chats.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: '#8898aa', fontStyle: 'italic' }}>No hay chats anteriores.</div>
          ) : (
            chats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => selectChat(chat.id)}
                style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeChatId === chat.id ? '#eef8ff' : 'white',
                border: activeChatId === chat.id ? '1px solid #339eea' : '1px solid rgba(16,36,63,0.1)',
                padding: '6px 10px',
                borderRadius: '12px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(16,36,63,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                {editingChatId === chat.id ? (
                  <input 
                    autoFocus
                    value={editChatName}
                    onChange={e => setEditChatName(e.target.value)}
                    onBlur={() => saveEditChat(chat.id)}
                    onKeyDown={e => e.key === 'Enter' && saveEditChat(chat.id)}
                    style={{
                      border: '1px solid #339eea',
                      outline: 'none',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      fontSize: '0.8rem',
                      width: '120px'
                    }}
                  />
                ) : (
                  <span 
                    style={{ 
                      fontSize: '0.85rem', 
                      color: '#10243f', 
                      fontWeight: 500,
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'inline-block',
                      verticalAlign: 'middle'
                    }} 
                    title={chat.name}
                  >
                    {chat.name}
                  </span>
                )}
              </div>
            ))
          )}

        </div>
      </div>

      <div style={{
        flex: 1, 
        overflowY: 'auto', 
        border: '1px solid rgba(16,36,63,0.16)', 
        borderRadius: '18px', 
        background: '#f9fcff',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center opacity-70 p-2 h-full w-full" style={{ margin: 'auto' }}>
            <div className="text-[#9ca3af] mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </div>
            <span className="text-[#6b7280] text-[0.9rem] italic m-0">Inicia una conversación con nuestro asistente de IA.</span>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} style={{ 
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              background: msg.sender === 'user' ? 'linear-gradient(135deg, #339eea, #0d5a91)' : '#eef8ff',
              color: msg.sender === 'user' ? '#fff' : '#10243f',
              padding: '10px 14px',
              borderRadius: '14px',
              maxWidth: '80%',
              fontSize: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {msg.text && (
                <div style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({node, ...props}) => <p style={{ margin: '0 0 8px 0', display: 'inline-block' }} {...props} />,
                      ul: ({node, ...props}) => <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px', listStyleType: 'disc' }} {...props} />,
                      ol: ({node, ...props}) => <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px', listStyleType: 'decimal' }} {...props} />,
                      li: ({node, ...props}) => <li style={{ marginBottom: '4px' }} {...props} />,
                      strong: ({node, ...props}) => <strong style={{ fontWeight: 'bold' }} {...props} />,
                      a: ({node, ...props}) => <a style={{ color: '#339eea', textDecoration: 'underline' }} {...props} />
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
              {msg.attachments && msg.attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: msg.text ? '4px' : '0' }}>
                  {msg.attachments.map((att, i) => (
                    <div key={i} style={{ 
                      background: msg.sender === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(16,36,63,0.05)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {att.type.includes('image') ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      )}
                      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {isWaitingForBot && (
          <div style={{ 
            alignSelf: 'flex-start',
            background: '#eef8ff',
            color: '#10243f',
            padding: '14px 18px',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '320px',
          }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <div style={{ width: '6px', height: '6px', background: '#339eea', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both' }}></div>
              <div style={{ width: '6px', height: '6px', background: '#339eea', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
              <div style={{ width: '6px', height: '6px', background: '#339eea', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
            </div>
            <span style={{
              fontSize: '0.78rem',
              color: '#5a7a9a',
              fontStyle: 'italic',
              lineHeight: 1.4,
            }}>
              La respuesta tomará unos minutos. Estamos consultando nuestra fuente de documentos.
            </span>
            <style>{`
              @keyframes typing {
                0%, 80%, 100% { transform: scale(0.4); opacity: 0.5; }
                40% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: '1px solid rgba(16,36,63,0.16)',
        background: 'white',
        maxHeight: '30%',
        boxShadow: '0 2px 8px rgba(16,36,63,0.04)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 12px' }}>
          
          <textarea 
            ref={textareaRef}
            value={input} 
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            rows={1}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: 'none',
              outline: 'none',
              fontSize: '0.9rem',
              resize: 'none',
              background: 'transparent',
              minHeight: '24px',
              maxHeight: '120px',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              overflowY: 'hidden'
            }}
          />
          
          <button 
            onClick={handleSend}
            disabled={!input.trim() && pendingAttachments.length === 0}
            style={{
              padding: '8px',
              borderRadius: '50%',
              border: 'none',
              background: (!input.trim() && pendingAttachments.length === 0) ? '#e2e8f0' : 'linear-gradient(135deg, #339eea, #0d5a91)',
              color: 'white',
              cursor: (!input.trim() && pendingAttachments.length === 0) ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '8px',
              transition: 'all 0.2s',
              transform: (!input.trim() && pendingAttachments.length === 0) ? 'none' : 'translateY(-1px)',
              boxShadow: (!input.trim() && pendingAttachments.length === 0) ? 'none' : '0 4px 10px rgba(51, 158, 234, 0.3)',
              flexShrink: 0
            }}
            title="Enviar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-2px', marginTop: '1px' }}>
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
      
      {chatToDelete && (
        <ConfirmModal
          title="Eliminar chat"
          message="¿Estás seguro de que deseas eliminar este chat de tu historial? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={confirmDeleteChat}
          onCancel={() => setChatToDelete(null)}
        />
      )}
    </div>
  );
}
