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
  
  // Dummy data for chat history
  const [chats, setChats] = useState<ChatSession[]>([
    { id: '1', name: 'Chat actual' },
    { id: '2', name: 'Análisis de falla' },
    { id: '3', name: 'Consulta general' },
    { id: '4', name: 'Ayuda de configuración' }
  ]);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatName, setEditChatName] = useState('');
  const [activeChatId, setActiveChatId] = useState<string>('1');
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [isWaitingForBot, setIsWaitingForBot] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const socket = new WebSocket('wss://albertitechnology-agent-api.hf.space/ws/chat');
    ws.current = socket;
    
    socket.onopen = () => {
      console.log('Connected to agent-api WebSocket');
    };
    
    socket.onmessage = (event) => {
      setIsWaitingForBot(false);
      try {
        const data = JSON.parse(event.data);
        const text = data.response || data.error || event.data;
        setMessages(prev => [...prev, { sender: 'bot', text: String(text) }]);
      } catch (e) {
        setMessages(prev => [...prev, { sender: 'bot', text: event.data }]);
      }
    };
    
    socket.onerror = (error) => {
      setIsWaitingForBot(false);
      console.error('WebSocket error:', error);
    };
    
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 120 ? 'auto' : 'hidden';
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() && pendingAttachments.length === 0) return;
    
    const newAttachments = pendingAttachments.map(f => ({
      name: f.name,
      type: f.type,
      url: URL.createObjectURL(f)
    }));

    setMessages(prev => [...prev, { 
      sender: 'user', 
      text: input,
      attachments: newAttachments.length > 0 ? newAttachments : undefined
    }]);
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(input);
      setIsWaitingForBot(true);
    } else {
      console.warn("WebSocket is not connected");
    }
    
    setInput('');
    setPendingAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
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
    setMessages([{ sender: 'bot', text: `Cargando chat con ID: ${id}...` }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '14px', gap: '12px' }}>
      {/* Chat History Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#4d6684', fontWeight: 700 }}>Historial de chats</h4>
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
                  <span style={{ fontSize: '0.85rem', color: '#10243f', fontWeight: 500 }}>{chat.name}</span>
                )}
                
                {editingChatId !== chat.id && (
                  <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); startEditChat(chat); }}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#4d6684', padding: '2px', display: 'flex', alignItems: 'center' }}
                      title="Renombrar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button 
                      onClick={(e) => deleteChat(e, chat.id)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#e53e3e', padding: '2px', display: 'flex', alignItems: 'center' }}
                      title="Eliminar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
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
          <div style={{ margin: 'auto', color: '#4d6684', fontStyle: 'italic', fontSize: '0.86rem' }}>
            Inicia una conversación con la IA.
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
            padding: '12px 16px',
            borderRadius: '14px',
            display: 'flex',
            gap: '4px',
            alignItems: 'center'
          }}>
            <div style={{ width: '6px', height: '6px', background: '#339eea', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both' }}></div>
            <div style={{ width: '6px', height: '6px', background: '#339eea', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
            <div style={{ width: '6px', height: '6px', background: '#339eea', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
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
        {pendingAttachments.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(16,36,63,0.08)',
            background: '#f8fbff',
            overflowX: 'auto'
          }}>
            {pendingAttachments.map((file, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'white',
                border: '1px solid rgba(16,36,63,0.1)',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#4d6684',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                <button 
                  onClick={() => removeAttachment(idx)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', color: '#e53e3e' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 12px' }}>
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#4d6684',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '4px',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
            title="Adjuntar archivo"
            onMouseEnter={e => e.currentTarget.style.background = '#f0f5fa'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            multiple
            accept="image/jpeg,image/png,application/pdf,text/markdown,.md"
            onChange={handleFileSelect}
          />
          
          <textarea 
            ref={textareaRef}
            value={input} 
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
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
