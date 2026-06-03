import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { videoService } from '../services/video.service';
import { nursesService } from '../services/nurses.service';
import toast from 'react-hot-toast';
import './VideoConsultPage.css';

// Agora client — singleton
const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
AgoraRTC.setLogLevel(4); // მხოლოდ error-ები

export default function VideoConsultPage() {
  const navigate = useNavigate();
  const [nurses, setNurses] = useState([]);
  const [loadingNurses, setLoadingNurses] = useState(true);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [callState, setCallState] = useState(null); // null | 'waiting' | 'in_call' | 'ended'
  const [timer, setTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [messages, setMessages] = useState([
    { from: 'nurse', text: 'გამარჯობა! როგორ დაგეხმარო?' }
  ]);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [networkQuality, setNetworkQuality] = useState(null);
  const [callMode, setCallMode] = useState('video'); // 'video' | 'audio'

  const localVideoRef = useRef(null);
  const localTrackRef = useRef({ audio: null, video: null });
  const timerRef = useRef(null);

  // ——— DB-დან ექთნები ———
  useEffect(() => {
    nursesService.getAll({ status: 'Active' })
      .then(data => setNurses(data.map(n => ({
        id: n.id,
        name: n.name,
        avatar: '👩‍⚕️',
        spec: (n.services || '').split(',')[0]?.trim() || 'ზოგადი მოვლა',
        rating: Number(n.rating || 0).toFixed(1),
        districts: n.districts || n.district || '',
        totalOrders: n.totalOrders || 0,
        wait: '~5 წთ',
        price: 25,
      }))))
      .catch(() => {})
      .finally(() => setLoadingNurses(false));
  }, []);

  // ——— Timer ———
  useEffect(() => {
    if (callState === 'in_call') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  // ——— Agora event handlers ———
  useEffect(() => {
    const handleUserPublished = async (user, mediaType) => {
      await agoraClient.subscribe(user, mediaType);
      if (mediaType === 'video') {
        setRemoteUsers(prev => {
          if (prev.find(u => u.uid === user.uid)) return prev;
          return [...prev, user];
        });
        setTimeout(() => {
          user.videoTrack?.play(`remote-video-${user.uid}`);
        }, 100);
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    };

    const handleUserUnpublished = (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    };

    const handleUserLeft = (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      toast('ექთანი გათიშვა', { icon: '⚠️' });
    };

    const handleNetworkQuality = (stats) => {
      setNetworkQuality(stats.uplinkNetworkQuality);
    };

    agoraClient.on('user-published', handleUserPublished);
    agoraClient.on('user-unpublished', handleUserUnpublished);
    agoraClient.on('user-left', handleUserLeft);
    agoraClient.on('network-quality', handleNetworkQuality);

    return () => {
      agoraClient.off('user-published', handleUserPublished);
      agoraClient.off('user-unpublished', handleUserUnpublished);
      agoraClient.off('user-left', handleUserLeft);
      agoraClient.off('network-quality', handleNetworkQuality);
    };
  }, []);

  // ——— Start Call ———
  const startCall = useCallback(async (nurse, mode = 'video') => {
    setSelectedNurse(nurse);
    setCallMode(mode);
    setCallState('waiting');

    try {
      const channelName = `nursego-consult-${nurse.id}-${Date.now()}`;
      const { token, appId } = await videoService.getToken(channelName, 0);
      await agoraClient.join(appId, channelName, token, null);

      if (mode === 'audio') {
        // ხმოვანი ზარი — მხოლოდ მიკროფონი
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTrackRef.current = { audio: audioTrack, video: null };
        await agoraClient.publish([audioTrack]);
      } else {
        // ვიდეო ზარი — კამერა + მიკროფონი
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTrackRef.current = { audio: audioTrack, video: videoTrack };
        videoTrack.play('local-video');
        await agoraClient.publish([audioTrack, videoTrack]);
      }

      setCallState('in_call');
      toast.success(`${nurse.name}-თან კავშირი დამყარდა!`);

    } catch (err) {
      console.error('Agora error:', err);
      if (err.message?.includes('PERMISSION_DENIED') || err.name === 'NotAllowedError') {
        toast.error('მიკროფონის წვდომა უარყოფილია. გთხოვ, ნებართვა მიეცი ბრაუზერს.');
      } else {
        toast.error('კავშირი ვერ დამყარდა. ცადე თავიდან.');
      }
      setCallState(null);
      setSelectedNurse(null);
    }
  }, []);

  // ——— End Call ———
  const endCall = useCallback(async () => {
    try {
      localTrackRef.current.audio?.close();
      localTrackRef.current.video?.close();
      await agoraClient.leave();
    } catch (e) { /* უგულებელყო */ }

    localTrackRef.current = { audio: null, video: null };
    setRemoteUsers([]);
    setCallState('ended');
  }, []);

  // ——— Toggle Mute ———
  const toggleMute = useCallback(async () => {
    const audio = localTrackRef.current.audio;
    if (!audio) return;
    await audio.setMuted(!isMuted);
    setIsMuted(m => !m);
  }, [isMuted]);

  // ——— Toggle Camera ———
  const toggleCamera = useCallback(async () => {
    const video = localTrackRef.current.video;
    if (!video) return;
    await video.setMuted(!isCamOff);
    setIsCamOff(c => !c);
  }, [isCamOff]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    setMessages(prev => [...prev, { from: 'me', text: chatMsg }]);
    setChatMsg('');
    setTimeout(() => {
      setMessages(prev => [...prev, { from: 'nurse', text: 'კარგი, გავითვალისწინებ.' }]);
    }, 1500);
  };

  const netQualityLabel = ['', '🟢 შესანიშნავი', '🟢 კარგი', '🟡 საშუალო', '🟠 სუსტი', '🔴 ცუდი', '⚫ —'][networkQuality] || '';

  // ——— ENDED SCREEN ———
  if (callState === 'ended') {
    return (
      <div className="video-page">
        <div className="container">
          <div className="call-ended-card">
            <div className="ce-icon">✅</div>
            <h2>კონსულტაცია დასრულდა</h2>
            <p className="ce-nurse">{selectedNurse?.name}</p>
            <div className="ce-stats">
              <div className="ces-item"><span>⏱</span> ხანგრძლივობა: <strong>{formatTime(timer)}</strong></div>
              <div className="ces-item"><span>💰</span> გადახდა: <strong>{selectedNurse?.price}₾</strong></div>
            </div>
            <div className="ce-actions">
              <button className="btn btn-primary" onClick={() => navigate('/order')}>🏠 სახლში გამოძახება</button>
              <button className="btn btn-outline" onClick={() => { setCallState(null); setSelectedNurse(null); setTimer(0); }}>
                🔄 ახალი კონსულტაცია
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ——— IN CALL SCREEN ———
  if (callState === 'waiting' || callState === 'in_call') {
    return (
      <div className="video-call-screen">
        {/* Remote video / audio */}
        <div className="remote-video">
          {callMode === 'audio' ? (
            // ხმოვანი ზარი — კამერის გარეშე
            <div className="connecting-screen">
              <div className="conn-avatar" style={{ fontSize: 80 }}>📞</div>
              <div className="conn-name">{selectedNurse?.name}</div>
              <div className="conn-status">
                {callState === 'waiting' ? '🔄 დაკავშირება...' : '🎤 ხმოვანი ზარი მიმდინარეობს'}
              </div>
              {callState === 'waiting' && <div className="conn-dots"><span /><span /><span /></div>}
              {callState === 'in_call' && (
                <div style={{ display:'flex', gap:6, marginTop:16 }}>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="audio-bar" style={{ animationDelay:`${i*0.15}s` }} />
                  ))}
                </div>
              )}
            </div>
          ) : callState === 'waiting' || remoteUsers.length === 0 ? (
            <div className="connecting-screen">
              <div className="conn-avatar pulse">{selectedNurse?.avatar}</div>
              <div className="conn-name">{selectedNurse?.name}</div>
              <div className="conn-status">
                {callState === 'waiting' ? '🔄 დაკავშირება...' : '⏳ ექთანი უერთდება...'}
              </div>
              <div className="conn-dots"><span /><span /><span /></div>
            </div>
          ) : (
            remoteUsers.map(user => (
              <div key={user.uid} id={`remote-video-${user.uid}`} className="remote-video-el" />
            ))
          )}
        </div>

        {/* Local video (მხოლოდ ვიდეო რეჟიმში) */}
        {callMode === 'video' && (
        <div className="local-video-wrap">
          {isCamOff ? (
            <div className="cam-off-placeholder">📷 გამორთ.</div>
          ) : (
            <div id="local-video" className="local-video" />
          )}
        </div>
        )}

        {/* Timer */}
        {callState === 'in_call' && (
          <div className="call-timer">
            {formatTime(timer)}
            {netQualityLabel && <span className="net-quality"> · {netQualityLabel}</span>}
          </div>
        )}

        {/* Chat */}
        {chatOpen && (
          <div className="chat-panel">
            <div className="chat-header">
              <span>💬 ჩატი</span>
              <button onClick={() => setChatOpen(false)}>✕</button>
            </div>
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.from === 'me' ? 'mine' : 'theirs'}`}>{m.text}</div>
              ))}
            </div>
            <form className="chat-input-row" onSubmit={sendMessage}>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="შეტყობინება..." className="chat-input" />
              <button type="submit" className="btn btn-primary btn-sm">→</button>
            </form>
          </div>
        )}

        {/* Controls */}
        <div className="call-controls">
          <button className={`ctrl-btn ${isMuted ? 'active-ctrl' : ''}`} onClick={toggleMute} title="მიკროფონი">
            {isMuted ? '🔇' : '🎤'}
          </button>
          {callMode === 'video' && (
            <button className={`ctrl-btn ${isCamOff ? 'active-ctrl' : ''}`} onClick={toggleCamera} title="კამერა">
              {isCamOff ? '📷' : '📸'}
            </button>
          )}
          <button className="ctrl-btn" onClick={() => setChatOpen(o => !o)} title="ჩატი">💬</button>
          <button className="ctrl-btn end-call" onClick={endCall} title="გათიშვა">📵</button>
        </div>

        {/* Nurse info chip */}
        <div className="nurse-chip">
          {selectedNurse?.avatar} {selectedNurse?.name}
        </div>
      </div>
    );
  }

  // ——— MAIN PAGE ———
  return (
    <div className="video-page">
      <div className="container">
        <div className="vc-hero">
          <h1 className="page-title">🎥 ვიდეოკონსულტაცია</h1>
          <p className="page-subtitle">
            დაუკავშირდი სერტიფიცირებულ ექთანს ვიდეოზე — სახლიდან გაუსვლელად
          </p>
          <div className="vc-features">
            <div className="vcf-item">⚡ მომენტალური კავშირი</div>
            <div className="vcf-item">🔒 E2E დაშიფრული (Agora)</div>
            <div className="vcf-item">💰 25₾ / სეანსი</div>
            <div className="vcf-item">⏱ 20 წუთი</div>
          </div>
        </div>

        <div className="vc-tech-note">
          <span>⚙️</span>
          <div>
            <strong>Agora.io WebRTC</strong> — პირდაპირ ბრაუზერში, ჩამოტვირთვა არ სჭირდება.
            პირველად ბრაუზერი ითხოვს კამერის/მიკროფონის ნებართვას — უბრალოდ დაეთანხმე.
          </div>
        </div>

        <h2 style={{ marginBottom: 20 }}>ახლა ონლაინ ექთნები</h2>
        <div className="nurses-online-grid">
          {loadingNurses ? (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px 0', color:'var(--gray)' }}>
              ⏳ იტვირთება...
            </div>
          ) : nurses.length === 0 ? (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>😔</div>
              <p style={{ color:'var(--gray)' }}>ამჟამად ონლაინ ექთანი არ არის</p>
            </div>
          ) : nurses.map(nurse => (
            <div key={nurse.id} className="online-nurse-card">
              <div className="onc-top">
                <div className="onc-avatar">{nurse.avatar}</div>
                <div className="online-dot pulse" />
              </div>
              <h3 className="onc-name">{nurse.name}</h3>
              <div className="onc-spec">{nurse.spec}</div>
              <div className="onc-rating">⭐ {nurse.rating}</div>
              {nurse.districts && (
                <div style={{ fontSize:12, color:'var(--gray)', marginBottom:4 }}>
                  📍 {nurse.districts.split(',').slice(0,2).join(', ')}
                </div>
              )}
              <div className="onc-wait">⏳ {nurse.wait} მოლოდინი</div>
              <div className="onc-price">{nurse.price}₾ / სეანსი</div>
              <div className="onc-call-btns">
                <button className="btn btn-primary onc-btn" onClick={() => startCall(nurse, 'video')}>
                  📹 ვიდეო
                </button>
                <button className="btn btn-outline onc-btn" onClick={() => startCall(nurse, 'audio')}>
                  📞 ხმოვანი
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="vc-how">
          <h2 style={{ fontSize: 22, marginBottom: 24 }}>როგორ მუშაობს?</h2>
          <div className="grid-3">
            {[
              { icon: '👆', title: 'აირჩიე ექთანი', desc: 'ნახე ვინ არის ონლაინ და დააჭირე "ვიდეოზე დაკავშირება"' },
              { icon: '🎥', title: 'ბრაუზერი — მზად', desc: 'ერთხელ "Allow" — კამერა და მიკროფონი ჩაირთვება. App-ის გადმოწერა არ სჭირდება.' },
              { icon: '💬', title: 'ისაუბრე + ჩაწერე', desc: 'ვიდეოზე ისაუბრე, ჩატში ჩაწერე, ზარი დაამთავრე — გადახდა ავტომატური.' },
            ].map((s, i) => (
              <div key={i} className="how-card">
                <div className="how-icon">{s.icon}</div>
                <div className="how-title">{s.title}</div>
                <div className="how-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
