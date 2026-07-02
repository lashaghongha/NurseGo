import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chat.service';
import { signalRService } from '../services/signalr.service';
import { useApp } from '../context/AppContext';

export default function OrderChat({ orderId }) {
  const { currentUser, userRole } = useApp();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const scrollBoxRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;
    chatService.getMessages(orderId).then(setMessages).catch(() => {});
    // SignalR — order room-ში შესვლა, რომ მომხმარებლის მესიჯი real-time მოვიდეს
    signalRService.joinOrder(orderId).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    const handler = (msg) => {
      setMessages(prev => {
        // Replace optimistic duplicate (temp id = Date.now(), real ids are small integers)
        const optIdx = prev.findIndex(m => m.id > 1_000_000_000_000 && m.text === msg.text && m.senderRole === msg.senderRole);
        if (optIdx !== -1) {
          const next = [...prev];
          next[optIdx] = msg;
          return next;
        }
        return [...prev, msg];
      });
      if (!open) setUnread(u => u + 1);
    };
    signalRService.on('NewChatMessage', handler);
    return () => signalRService.off('NewChatMessage', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        if (scrollBoxRef.current) {
          scrollBoxRef.current.scrollTop = scrollBoxRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [open, messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    const msgText = text.trim();
    const tempId = Date.now();
    setSending(true);
    setText('');
    setMessages(prev => [...prev, {
      id: tempId,
      text: msgText,
      senderRole: myRole,
      senderName: 'მე',
      sentAt: new Date().toISOString(),
    }]);
    try {
      await chatService.send(orderId, msgText);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(msgText);
    }
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const myRole = userRole === 'nurse' ? 'Nurse' : 'Customer';

  return (
    <div style={{ marginTop: 12 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: open ? '#0ea5e9' : 'white',
          color: open ? 'white' : '#0ea5e9',
          border: '2px solid #0ea5e9',
          borderRadius: 10, padding: '8px 16px',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', width: '100%', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        💬 {open ? 'ჩატის დახურვა' : 'მიწერე'}
        {unread > 0 && (
          <span style={{
            background: '#dc2626', color: 'white', borderRadius: 10,
            fontSize: 11, fontWeight: 800, padding: '1px 7px',
          }}>{unread}</span>
        )}
      </button>

      {/* Chat box */}
      {open && (
        <div style={{
          border: '1.5px solid #e2e8f0', borderRadius: 12, marginTop: 8,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          background: '#f8fafc',
        }}>
          {/* Messages */}
          <div ref={scrollBoxRef} style={{ height: 240, overflowY: 'auto', padding: '12px 12px 4px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>
                შეტყობინება ჯერ არ არის
              </div>
            )}
            {messages.map((m, i) => {
              const isMe = m.senderRole === myRole;
              return (
                <div key={m.id || i} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                    {isMe ? 'მე' : m.senderName}
                  </div>
                  <div style={{
                    background: isMe ? '#0ea5e9' : 'white',
                    color: isMe ? 'white' : '#1e293b',
                    borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '8px 12px', fontSize: 14, maxWidth: '80%',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>
                    {new Date(m.sentAt).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            display: 'flex', gap: 8, padding: '8px 10px',
            borderTop: '1px solid #e2e8f0', background: 'white',
          }}>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="შეტყობინება..."
              style={{
                flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 8,
                padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              style={{
                background: '#0ea5e9', color: 'white', border: 'none',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                fontSize: 18, opacity: (!text.trim() || sending) ? 0.5 : 1,
              }}
            >➤</button>
          </div>
        </div>
      )}
    </div>
  );
}
