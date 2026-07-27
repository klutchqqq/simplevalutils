import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useMultiplayer } from '../hooks/useMultiplayer';

const PICK_SEQUENCE = [
  'Right', 'Left', 'Left', 'Right', 'Right', 
  'Left', 'Left', 'Right', 'Right', 'Left'
];
const BAN_SEQUENCE = ['Left', 'Right', 'Left', 'Right'];

let activePingAudios = [];

const playSound = (soundFile, instances = 1) => {
  if (soundFile === '5secsleftping.mp3') activePingAudios = [];
  for (let i = 0; i < instances; i++) {
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/${soundFile}`);
    audio.play().catch(e => console.error("Audio play failed:", e));
    if (soundFile === '5secsleftping.mp3') {
       activePingAudios.push(audio);
    }
  }
};

const stopPingAudio = () => {
  activePingAudios.forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  activePingAudios = [];
};

let bgAudio = null;

const playBGM = () => {
  if (!bgAudio) {
    bgAudio = new Audio(`${import.meta.env.BASE_URL}audio/selectingbackgroundaudio.mp3`);
    bgAudio.loop = true;
    bgAudio.volume = 0.5;
  }
  bgAudio.play().catch(e => console.error(e));
};

const stopBGM = () => {
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.currentTime = 0;
  }
};

const Draft = () => {
  const { t } = useLanguage();
  const [agents, setAgents] = useState([]);
  const multiplayer = useMultiplayer();
  const [phase, setPhase] = useState('setup');
  const [isPaused, setIsPaused] = useState(false);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  
  const [leftBans, setLeftBans] = useState([]);
  const [rightBans, setRightBans] = useState([]);
  const [leftPicks, setLeftPicks] = useState([]);
  const [rightPicks, setRightPicks] = useState([]);

  const [roleFilter, setRoleFilter] = useState('ALL');
  const [tentativeAgent, setTentativeAgent] = useState(null);
  
  const [teamAName, setTeamAName] = useState('TEAM A');
  const [teamBName, setTeamBName] = useState('TEAM B');

  useEffect(() => {
    fetch('./data/agents.json')
      .then(res => res.json())
      .then(data => setAgents(data))
      .catch(err => console.error("Failed to fetch agents", err));
  }, []);

  const advanceTurn = () => {
    if (phase === 'bans') {
      if (currentTurnIndex + 1 < BAN_SEQUENCE.length) {
        setCurrentTurnIndex(prev => prev + 1);
      } else {
        setPhase('picks');
        setCurrentTurnIndex(0);

        playSound('agentpickphase.mp3');
      }
    } else if (phase === 'picks') {
      if (currentTurnIndex + 1 < PICK_SEQUENCE.length) {
        setCurrentTurnIndex(prev => prev + 1);
      } else {
        setPhase('finished');
        playSound('concluded.mp3');
      }
    }
  };

  const lockInSelection = (forceAgentId = null) => {
    stopPingAudio();
    playSound('picksound.mp3');
    let finalAgentToLock = forceAgentId ? agents.find(a => a.id === forceAgentId) : tentativeAgent;

    // Handle timer expiration without a selection
    if (!finalAgentToLock && timeLeft === 0) {
       if (phase === 'picks') {
         const currentTeamPicks = PICK_SEQUENCE[currentTurnIndex] === 'Left' ? leftPicks : rightPicks;
         const requiredRoles = ['Controller', 'Duelist', 'Initiator', 'Sentinel'];
         const currentRoles = currentTeamPicks.filter(p => p !== null).map(p => p.role);
         const missingRoles = requiredRoles.filter(r => !currentRoles.includes(r));
         
         const availableAgents = agents.filter(a => {
           const isBanned = leftBans.includes(a.id) || rightBans.includes(a.id);
           const isPicked = leftPicks.some(p => p && p.id === a.id) || rightPicks.some(p => p && p.id === a.id);
           return !isBanned && !isPicked;
         });
         
         let fallbackPool = availableAgents;
         if (missingRoles.length > 0) {
           const candidates = availableAgents.filter(a => missingRoles.includes(a.role));
           if (candidates.length > 0) fallbackPool = candidates;
         }
         
         if (fallbackPool.length > 0) {
           finalAgentToLock = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
         }
       }
       // For bans, if finalAgentToLock is null, it just results in a missed ban
    }

    if (phase === 'bans') {
      const currentTeam = BAN_SEQUENCE[currentTurnIndex];
      if (currentTeam === 'Left') {
        setLeftBans(prev => [...prev, finalAgentToLock ? finalAgentToLock.id : null]);
      } else {
        setRightBans(prev => [...prev, finalAgentToLock ? finalAgentToLock.id : null]);
      }
    } else if (phase === 'picks') {
      const currentTeam = PICK_SEQUENCE[currentTurnIndex];
      if (currentTeam === 'Left') {
        setLeftPicks(prev => [...prev, finalAgentToLock || null]);
      } else {
        setRightPicks(prev => [...prev, finalAgentToLock || null]);
      }
    }
    
    setTentativeAgent(null);
    advanceTurn();
  };

  const handleAgentClick = (agent) => {
    if (phase === 'setup' || phase === 'finished') return;
    if (multiplayer.role === 'Guest') return; // Guests cannot click
    
    const isBanned = leftBans.includes(agent.id) || rightBans.includes(agent.id);
    const isPicked = leftPicks.some(p => p && p.id === agent.id) || rightPicks.some(p => p && p.id === agent.id);
    if (isBanned || isPicked) return;

    if (tentativeAgent && tentativeAgent.id === agent.id) {
       if (multiplayer.role && multiplayer.role !== 'Host') multiplayer.sendAction({ type: 'unhover' });
       else setTentativeAgent(null);
    } else {
       if (multiplayer.role && multiplayer.role !== 'Host') multiplayer.sendAction({ type: 'hover', agentId: agent.id });
       else setTentativeAgent(agent);
    }
  };

  // Network Synchronization
  useEffect(() => {
    if (multiplayer.role === 'Host') {
      multiplayer.broadcastState({ phase, currentTurnIndex, timeLeft, leftBans, rightBans, leftPicks, rightPicks, isPaused, tentativeAgent, teamAName, teamBName });
    }
  }, [phase, currentTurnIndex, timeLeft, leftBans, rightBans, leftPicks, rightPicks, isPaused, tentativeAgent, teamAName, teamBName]);

  useEffect(() => {
    if (multiplayer.role && multiplayer.role !== 'Host' && multiplayer.networkState) {
      setPhase(multiplayer.networkState.phase);
      setCurrentTurnIndex(multiplayer.networkState.currentTurnIndex);
      setTimeLeft(multiplayer.networkState.timeLeft);
      setLeftBans(multiplayer.networkState.leftBans);
      setRightBans(multiplayer.networkState.rightBans);
      setLeftPicks(multiplayer.networkState.leftPicks);
      setRightPicks(multiplayer.networkState.rightPicks);
      setIsPaused(multiplayer.networkState.isPaused);
      if (multiplayer.networkState.tentativeAgent !== undefined) {
        setTentativeAgent(multiplayer.networkState.tentativeAgent);
      }
      if (multiplayer.networkState.teamAName) setTeamAName(multiplayer.networkState.teamAName);
      if (multiplayer.networkState.teamBName) setTeamBName(multiplayer.networkState.teamBName);
    }
  }, [multiplayer.networkState]);

  useEffect(() => {
    if (multiplayer.role === 'Host') {
       const ev = multiplayer.popNetworkEvent();
       if (ev) {
          if (ev.type === 'hover' && ev.agentId) {
             setTentativeAgent(agents.find(a => a.id === ev.agentId));
          } else if (ev.type === 'unhover') {
             setTentativeAgent(null);
          } else if (ev.type === 'lockIn' && ev.agentId) {
             lockInSelection(ev.agentId);
          }
       }
    }
  }, [multiplayer.networkEvents]);

  // Timer Tick Effect
  useEffect(() => {
    if (phase === 'setup' || phase === 'finished') return;
    if (multiplayer.role && multiplayer.role !== 'Host') return;
    
    setTimeLeft(phase === 'bans' ? 30 : 15);
    setTentativeAgent(null); // Reset selection when turn changes
    
    const timer = setInterval(() => {
      if (isPaused) return;
      setTimeLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [phase, currentTurnIndex]);

  // Expiration Trigger Effect
  useEffect(() => {
    if (timeLeft === 5 && phase !== 'setup' && phase !== 'finished') {
       playSound('5secsleftping.mp3', 3);
    }
    if (timeLeft === 0 && phase !== 'setup' && phase !== 'finished') {
       lockInSelection();
    }
  }, [timeLeft]);

  // Background Music Effect
  useEffect(() => {
    if (phase === 'bans' || phase === 'picks') {
      playBGM();
    } else {
      stopBGM();
    }
    return () => stopBGM();
  }, [phase]);

  const startDraft = () => {
    setPhase('bans');
    setCurrentTurnIndex(0);
    setLeftBans([]);
    setRightBans([]);
    setLeftPicks([]);
    setRightPicks([]);
  };

  const currentTeam = phase === 'bans' ? BAN_SEQUENCE[currentTurnIndex] : 
                      phase === 'picks' ? PICK_SEQUENCE[currentTurnIndex] : null;

  const getRoleIcon = (role) => {
    switch(role) {
      case 'Duelist': return 'DuelistClassSymbol.webp';
      case 'Initiator': return 'InitiatorClassSymbol.webp';
      case 'Controller': return 'ControllerClassSymbol.webp';
      case 'Sentinel': return 'SentinelClassSymbol.webp';
      default: return null;
    }
  };

  const filteredAgents = agents.filter(a => roleFilter === 'ALL' || a.role === roleFilter);
  const activeTeam = phase === 'bans' ? (BAN_SEQUENCE[currentTurnIndex] === 'Left' ? 'Team A' : 'Team B') : (PICK_SEQUENCE[currentTurnIndex] === 'Left' ? 'Team A' : 'Team B');
  const isMyTurn = phase === 'setup' || phase === 'finished' || !multiplayer.role || multiplayer.role === 'Host' || multiplayer.role === 'Guest' || multiplayer.role === activeTeam;

  const pageGradient = phase !== 'setup' && phase !== 'finished' && currentTeam === 'Left'
    ? 'linear-gradient(to right, rgba(59, 130, 246, 0.35) 0%, transparent 60%)'
    : phase !== 'setup' && phase !== 'finished' && currentTeam === 'Right'
    ? 'linear-gradient(to left, rgba(239, 68, 68, 0.35) 0%, transparent 60%)'
    : 'none';

  return (
    <>
      <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: pageGradient,
          zIndex: -1,
          pointerEvents: 'none',
          transition: 'background-image 0.5s ease-in-out'
      }}></div>
      <div style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '2.5rem' }}>Draft Simulator</h1>
      
      {/* Header & Status */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', minHeight: '120px' }}>
        {phase === 'setup' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {!multiplayer.role && !multiplayer.roomId ? (
              <>
                <button onClick={startDraft} style={{ fontSize: '1.5rem', padding: '12px 32px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>START LOCAL DRAFT</button>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                   <button onClick={() => multiplayer.initHost()} style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Host Online</button>
                   <button onClick={() => {
                     const code = prompt("Enter Room Code:");
                     if (code) {
                        multiplayer.joinRoom(code.toUpperCase());
                     }
                   }} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Join Online</button>
                </div>
              </>
            ) : multiplayer.role === 'Host' ? (
              <>
                 <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <input value={teamAName} onChange={e => setTeamAName(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', textAlign: 'center', marginBottom: '8px', width: '150px' }} placeholder="Team A Name" />
                       <div style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>{multiplayer.roomCodes?.teamA}</div>
                       <div style={{ color: multiplayer.connectedCaptains['Team A'] ? '#22c55e' : '#ef4444', fontSize: '0.9rem' }}>{multiplayer.connectedCaptains['Team A'] ? 'Connected' : 'Waiting...'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 1rem' }}>
                       <div style={{ fontSize: '0.9rem', color: '#64748b' }}>GUEST CODE</div>
                       <div style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>{multiplayer.roomCodes?.guest}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <input value={teamBName} onChange={e => setTeamBName(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', textAlign: 'center', marginBottom: '8px', width: '150px' }} placeholder="Team B Name" />
                       <div style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>{multiplayer.roomCodes?.teamB}</div>
                       <div style={{ color: multiplayer.connectedCaptains['Team B'] ? '#22c55e' : '#ef4444', fontSize: '0.9rem' }}>{multiplayer.connectedCaptains['Team B'] ? 'Connected' : 'Waiting...'}</div>
                    </div>
                 </div>
                 <button onClick={startDraft} disabled={!multiplayer.connectedCaptains['Team A'] || !multiplayer.connectedCaptains['Team B']} style={{ fontSize: '1.5rem', padding: '12px 32px', backgroundColor: (multiplayer.connectedCaptains['Team A'] && multiplayer.connectedCaptains['Team B']) ? '#3b82f6' : '#475569', color: 'white', border: 'none', borderRadius: '8px', cursor: (multiplayer.connectedCaptains['Team A'] && multiplayer.connectedCaptains['Team B']) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>START ONLINE DRAFT</button>
              </>
            ) : (
              <>
                 <div style={{ fontSize: '1.2rem' }}>Joined as {multiplayer.role} in Room {multiplayer.roomId}</div>
                 <div style={{ color: '#64748b', fontStyle: 'italic', marginTop: '1rem' }}>Waiting for host to start...</div>
                 {multiplayer.error && <div style={{ color: '#ef4444', marginTop: '1rem' }}>{multiplayer.error}</div>}
              </>
            )}
          </div>
        ) : phase === 'finished' ? (
          <div>
            <h2 style={{ color: '#22c55e', fontSize: '2rem' }}>DRAFT COMPLETE!</h2>
            <button onClick={startDraft} style={{ marginTop: '1rem', padding: '8px 16px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Restart Draft</button>
          </div>
        ) : (
          <div>
            <h2 style={{ color: 'var(--accent-color)', fontSize: '1.8rem', textTransform: 'uppercase', margin: 0 }}>
              {currentTeam === 'Left' ? teamAName : teamBName} TEAM IS {phase === 'bans' ? 'BANNING' : 'PICKING'}
            </h2>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: '900', 
              color: timeLeft <= 5 ? '#ef4444' : 'white',
              fontFamily: 'monospace' 
            }}>
              0:{timeLeft.toString().padStart(2, '0')}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {(!multiplayer.role || multiplayer.role === 'Host') && (
                <button 
                  onClick={() => setIsPaused(!isPaused)} 
                  style={{ marginTop: '8px', padding: '12px 24px', backgroundColor: isPaused ? '#10b981' : '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {isPaused ? 'RESUME' : 'PAUSE'}
                </button>
              )}
              <button 
                onClick={() => { if (multiplayer.role && multiplayer.role !== 'Host') { multiplayer.sendAction({ type: 'lockIn', agentId: tentativeAgent.id }); setTentativeAgent(null); } else { lockInSelection(); } }} 
                disabled={!tentativeAgent || (multiplayer.role && multiplayer.role !== 'Host' && multiplayer.role !== (phase === 'bans' ? (BAN_SEQUENCE[currentTurnIndex] === 'Left' ? 'Team A' : 'Team B') : (PICK_SEQUENCE[currentTurnIndex] === 'Left' ? 'Team A' : 'Team B')))}
                style={{ 
                  marginTop: '8px', 
                  padding: '10px 32px', 
                  backgroundColor: tentativeAgent ? (phase === 'bans' ? '#ef4444' : '#3b82f6') : '#334155', 
                  color: tentativeAgent ? 'white' : '#64748b', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontWeight: '900',
                  fontSize: '1.2rem',
                  cursor: tentativeAgent ? 'pointer' : 'not-allowed',
                  boxShadow: tentativeAgent ? `0 4px 15px ${phase === 'bans' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)'}` : 'none',
                  transition: 'all 0.2s'
                }}
              >
                LOCK IN
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem' }}>
        
        {/* LEFT TEAM */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', opacity: phase !== 'setup' && phase !== 'finished' && currentTeam === 'Right' ? 0.4 : 1, filter: phase !== 'setup' && phase !== 'finished' && currentTeam === 'Right' ? 'grayscale(100%)' : 'none', transition: 'all 0.3s ease' }}>
          <h3 style={{ textAlign: 'center', backgroundColor: '#1e40af', padding: '8px', borderRadius: '8px 8px 0 0', margin: 0 }}>
             {!multiplayer.role || multiplayer.role === 'Host' ? (
                 <input type="text" value={teamAName} onChange={e => setTeamAName(e.target.value)} style={{ background: 'transparent', color: 'white', border: 'none', textAlign: 'center', fontSize: '1.17em', fontWeight: 'bold', width: '100%', outline: 'none' }} />
             ) : teamAName}
          </h3>
          <div style={{ backgroundColor: '#0f172a', padding: '16px', border: '1px solid #1e40af', borderRadius: '0 0 8px 8px', flex: 1 }}>
            
            {/* Bans */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase' }}>{t('draft.bans')}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[0, 1].map(i => {
                  const banId = leftBans[i];
                  const agent = banId ? agents.find(a => a.id === banId) : null;
                  const isActive = phase === 'bans' && currentTeam === 'Left' && currentTurnIndex === i;
                  const showTentative = isActive && tentativeAgent;

                  return (
                    <div 
                      key={i} 
                      onClick={() => { if(showTentative) setTentativeAgent(null); }}
                      style={{ 
                        width: '60px', height: '60px', 
                        backgroundColor: '#1e293b', 
                        border: isActive ? '2px solid #ef4444' : '1px solid #334155',
                        boxShadow: isActive ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none',
                        transition: 'all 0.2s',
                        cursor: showTentative ? 'pointer' : 'default',
                        position: 'relative'
                      }}>
                      {agent ? (
                        <img src={`${agent.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) opacity(0.7)' }} alt="banned" />
                      ) : showTentative ? (
                        <img src={`${tentativeAgent.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) opacity(0.4)' }} alt="tentative ban" />
                      ) : (banId === null && !isActive) ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.8rem', fontWeight: 'bold' }}>MISSED</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Picks */}
            <div>
              <div style={{ color: '#3b82f6', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase' }}>{t('draft.picks')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0, 1, 2, 3, 4].map(i => {
                  const pick = leftPicks[i];
                  const isMissed = leftPicks.length > i && pick === null;
                  
                  // Calculate index in the sequence for highlighting logic
                  let pickSeqIndex = -1;
                  let count = 0;
                  for (let j = 0; j < PICK_SEQUENCE.length; j++) {
                     if (PICK_SEQUENCE[j] === 'Left') {
                        if (count === i) { pickSeqIndex = j; break; }
                        count++;
                     }
                  }
                  const isActuallyActive = phase === 'picks' && currentTurnIndex === pickSeqIndex;
                  const showTentative = isActuallyActive && currentTeam === 'Left' && tentativeAgent;

                  return (
                    <div 
                      key={i} 
                      onClick={() => { if(showTentative) setTentativeAgent(null); }}
                      style={{ 
                        height: '70px', 
                        backgroundColor: isActuallyActive ? '#1e3a8a' : '#1e293b', 
                        display: 'flex', 
                        alignItems: 'center', 
                        border: isActuallyActive ? '2px solid #3b82f6' : '1px solid #334155',
                        boxShadow: isActuallyActive ? '0 0 15px rgba(59, 130, 246, 0.5)' : 'none',
                        transition: 'all 0.2s',
                        overflow: 'hidden',
                        cursor: showTentative ? 'pointer' : 'default'
                      }}>
                      {pick ? (
                        <>
                          <img src={`${pick.image}`} style={{ height: '100%', aspectRatio: '1', objectFit: 'cover', borderRight: '1px solid #334155' }} alt={pick.name} />
                          <div style={{ marginLeft: '12px', flex: 1 }}>
                            <div style={{ fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>{pick.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{pick.role}</div>
                          </div>
                        </>
                      ) : showTentative ? (
                        <>
                          <img src={`${tentativeAgent.image}`} style={{ height: '100%', aspectRatio: '1', objectFit: 'cover', borderRight: '1px dashed #334155', opacity: 0.5 }} alt={tentativeAgent.name} />
                          <div style={{ marginLeft: '12px', flex: 1, opacity: 0.5 }}>
                            <div style={{ fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>{tentativeAgent.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{tentativeAgent.role}</div>
                          </div>
                        </>
                      ) : isMissed ? (
                        <span style={{ marginLeft: '12px', color: '#ef4444', fontStyle: 'italic', fontWeight: 'bold' }}>MISSED PICK</span>
                      ) : (
                        <span style={{ marginLeft: '12px', color: isActuallyActive ? 'white' : '#64748b', fontWeight: isActuallyActive ? 'bold' : 'normal' }}>{isActuallyActive ? 'Picking...' : 'Waiting...'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* AGENT ROSTER (CENTER) */}
        <div style={{ flex: '2', display: 'flex', flexDirection: 'column' }}>
          
          <>{/* Role Filters */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
             <button 
               onClick={() => setRoleFilter('ALL')} 
               style={{ padding: '8px 16px', background: roleFilter === 'ALL' ? '#3b82f6' : '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
             >
               ALL
             </button>
             {['Controller', 'Duelist', 'Initiator', 'Sentinel'].map(r => (
               <button 
                 key={r} 
                 onClick={() => setRoleFilter(r)} 
                 style={{ padding: '8px 12px', background: roleFilter === r ? '#3b82f6' : '#1e293b', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                  <img src={`./images/roles/${getRoleIcon(r)}`} style={{ width: '24px', height: '24px' }} title={r} alt={r} />
               </button>
             ))}
          </div>

          {/* Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(6, 1fr)', 
            gap: '4px', 
            backgroundColor: '#1e293b',
            padding: '4px',
            border: '1px solid #334155',
            alignContent: 'start',
            minHeight: '400px'
          }}>
            {filteredAgents.map(agent => {
              const isBanned = leftBans.includes(agent.id) || rightBans.includes(agent.id);
              const isPicked = leftPicks.some(p => p && p.id === agent.id) || rightPicks.some(p => p && p.id === agent.id);
              const isTentative = tentativeAgent && tentativeAgent.id === agent.id;
              const isSelectable = !isBanned && !isPicked && (phase === 'bans' || phase === 'picks') && (!multiplayer.role || multiplayer.role === 'Host' || multiplayer.role === (activeTeam === 'Team A' ? 'Team A' : 'Team B'));

              return (
                <div 
                  key={agent.id} 
                  onClick={() => isSelectable ? handleAgentClick(agent) : null}
                  style={{ 
                    cursor: isSelectable ? 'pointer' : 'not-allowed',
                    aspectRatio: '1',
                    position: 'relative',
                    backgroundColor: '#0f172a',
                    border: isBanned ? '2px solid #ef4444' : isPicked ? '2px solid #22c55e' : isTentative ? (phase === 'bans' ? '2px solid #ef4444' : '2px solid #3b82f6') : '1px solid #475569',
                    opacity: (isBanned || isPicked) ? 0.4 : isTentative ? 0.8 : 1,
                    transition: 'all 0.1s',
                    overflow: 'hidden',
                    boxShadow: isTentative ? (phase === 'bans' ? '0 0 10px rgba(239, 68, 68, 0.8)' : '0 0 10px rgba(59, 130, 246, 0.8)') : 'none'
                  }}
                  onMouseOver={(e) => { if(isSelectable && !isTentative) e.currentTarget.style.borderColor = '#94a3b8' }}
                  onMouseOut={(e) => { if(isSelectable && !isTentative) e.currentTarget.style.borderColor = '#475569' }}
                >
                  <img 
                     src={`${agent.image}`} 
                     alt={agent.name}
                     style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  
                  {isBanned && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(239, 68, 68, 0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                       <div style={{ width: '100%', height: '4px', backgroundColor: '#ef4444', transform: 'rotate(45deg)', position: 'absolute' }}></div>
                       <div style={{ width: '100%', height: '4px', backgroundColor: '#ef4444', transform: 'rotate(-45deg)', position: 'absolute' }}></div>
                    </div>
                  )}

                  {isPicked && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(34, 197, 94, 0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                    </div>
                  )}

                  {isTentative && (
                     <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: phase === 'bans' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                      </div>
                  )}
                  
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
                    fontSize: '0.65rem', padding: '2px', fontWeight: 'bold', textAlign: 'center'
                  }}>
                    {agent.name}
                  </div>
                </div>
              );
            })}
          </div>
          </>
                {[0, 1].map(i => {
                  const banId = rightBans[i];
                  const agent = banId ? agents.find(a => a.id === banId) : null;
                  const isActive = phase === 'bans' && currentTeam === 'Right' && currentTurnIndex === i;
                  const showTentative = isActive && tentativeAgent;

                  return (
                    <div 
                      key={i} 
                      onClick={() => { if(showTentative) setTentativeAgent(null); }}
                      style={{ 
                        width: '60px', height: '60px', 
                        backgroundColor: '#1e293b', 
                        border: isActive ? '2px solid #ef4444' : '1px solid #334155',
                        boxShadow: isActive ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none',
                        transition: 'all 0.2s',
                        cursor: showTentative ? 'pointer' : 'default',
                        position: 'relative'
                      }}>
                      {agent ? (
                        <img src={`${agent.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) opacity(0.7)' }} alt="banned" />
                      ) : showTentative ? (
                        <img src={`${tentativeAgent.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) opacity(0.4)' }} alt="tentative ban" />
                      ) : (banId === null && !isActive) ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.8rem', fontWeight: 'bold' }}>MISSED</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Picks */}
            <div>
              <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'right' }}>{t('draft.picks')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0, 1, 2, 3, 4].map(i => {
                  const pick = rightPicks[i];
                  const isMissed = rightPicks.length > i && pick === null;
                  
                  let pickSeqIndex = -1;
                  let count = 0;
                  for (let j = 0; j < PICK_SEQUENCE.length; j++) {
                     if (PICK_SEQUENCE[j] === 'Right') {
                        if (count === i) { pickSeqIndex = j; break; }
                        count++;
                     }
                  }
                  const isActuallyActive = phase === 'picks' && currentTurnIndex === pickSeqIndex;
                  const showTentative = isActuallyActive && currentTeam === 'Right' && tentativeAgent;

                  return (
                    <div 
                      key={i} 
                      onClick={() => { if(showTentative) setTentativeAgent(null); }}
                      style={{ 
                        height: '70px', 
                        backgroundColor: isActuallyActive ? '#7f1d1d' : '#1e293b', 
                        display: 'flex', 
                        alignItems: 'center', 
                        border: isActuallyActive ? '2px solid #ef4444' : '1px solid #334155',
                        boxShadow: isActuallyActive ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none',
                        transition: 'all 0.2s',
                        overflow: 'hidden',
                        flexDirection: 'row-reverse', // Mirror layout for right side
                        cursor: showTentative ? 'pointer' : 'default'
                      }}>
                      {pick ? (
                        <>
                          <img src={`${pick.image}`} style={{ height: '100%', aspectRatio: '1', objectFit: 'cover', borderLeft: '1px solid #334155' }} alt={pick.name} />
                          <div style={{ marginRight: '12px', flex: 1, textAlign: 'right' }}>
                            <div style={{ fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>{pick.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{pick.role}</div>
                          </div>
                        </>
                      ) : showTentative ? (
                        <>
                          <img src={`${tentativeAgent.image}`} style={{ height: '100%', aspectRatio: '1', objectFit: 'cover', borderLeft: '1px dashed #334155', opacity: 0.5 }} alt={tentativeAgent.name} />
                          <div style={{ marginRight: '12px', flex: 1, textAlign: 'right', opacity: 0.5 }}>
                            <div style={{ fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>{tentativeAgent.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{tentativeAgent.role}</div>
                          </div>
                        </>
                      ) : isMissed ? (
                        <span style={{ marginRight: '12px', color: '#ef4444', fontStyle: 'italic', fontWeight: 'bold' }}>MISSED PICK</span>
                      ) : (
                        <span style={{ marginRight: '12px', color: isActuallyActive ? 'white' : '#64748b', fontWeight: isActuallyActive ? 'bold' : 'normal' }}>{isActuallyActive ? 'Picking...' : 'Waiting...'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>        </div>    </>
  );
};
export default Draft;






















