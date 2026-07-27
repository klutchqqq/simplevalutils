import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useMultiplayer } from '../hooks/useMultiplayer';

const SEQUENCES = {
  bo1: [
    { team: 'Team A', action: 'ban' },
    { team: 'Team B', action: 'ban' },
    { team: 'Team A', action: 'ban' },
    { team: 'Team B', action: 'ban' },
    { team: 'Team A', action: 'ban' },
    { team: 'Team B', action: 'ban' },
    { team: 'System', action: 'decider' }
  ],
  bo3: [
    { team: 'Team A', action: 'ban' },
    { team: 'Team B', action: 'ban' },
    { team: 'Team A', action: 'pick' },
    { team: 'Team B', action: 'side' },
    { team: 'Team B', action: 'pick' },
    { team: 'Team A', action: 'side' },
    { team: 'Team A', action: 'ban' },
    { team: 'Team B', action: 'ban' },
    { team: 'System', action: 'decider' }
  ],
  bo5: [
    { team: 'Team A', action: 'ban' },
    { team: 'Team B', action: 'ban' },
    { team: 'Team A', action: 'pick' },
    { team: 'Team B', action: 'side' },
    { team: 'Team B', action: 'pick' },
    { team: 'Team A', action: 'side' },
    { team: 'Team A', action: 'pick' },
    { team: 'Team B', action: 'side' },
    { team: 'Team B', action: 'pick' },
    { team: 'Team A', action: 'side' },
    { team: 'System', action: 'decider' }
  ]
};



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

const MapVeto = () => {
  const { t } = useLanguage();
  const [maps, setMaps] = useState([]);
  
  const [mode, setMode] = useState('bo3');
  const multiplayer = useMultiplayer();
  const [phase, setPhase] = useState('setup');
  const [isPaused, setIsPaused] = useState(false); // setup, veto, finished
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [stolenBy, setStolenBy] = useState(null); // 'Team A' or 'Team B'
  
  const [bans, setBans] = useState([]);
  const [picks, setPicks] = useState([]);
  const [events, setEvents] = useState([]);
  
  const [tentativeSelection, setTentativeSelection] = useState(null);
  
  const [teamAName, setTeamAName] = useState('TEAM A');
  const [teamBName, setTeamBName] = useState('TEAM B');

  useEffect(() => {
    fetch('./data/maps.json')
      .then(res => res.json())
      .then(data => setMaps(data))
      .catch(err => console.error("Failed to fetch maps", err));
  }, []);

  const sequence = SEQUENCES[mode];

  const lockInSelection = (autoValue = null) => {
    stopPingAudio();
    playSound('picksound.mp3');
    const step = sequence[currentTurnIndex];
    const value = autoValue || tentativeSelection;

    let newBans = [...bans];
    let newPicks = [...picks];
    let newEvents = [...events];
    
    if (step.action === 'ban') {
        newBans.push(value);
        newEvents.push({ type: 'ban', team: step.team, stolenBy, map: value });
    } else if (step.action === 'pick') {
        newPicks.push(value);
        newEvents.push({ type: 'pick', team: step.team, stolenBy, map: value, side: null });
    } else if (step.action === 'side') {
        const lastPickIndex = newEvents.findLastIndex(e => e.type === 'pick' && !e.side);
        if (lastPickIndex !== -1) {
            newEvents[lastPickIndex].side = value;
            newEvents[lastPickIndex].sidePicker = stolenBy || step.team;
        }
    }
    
    setBans(newBans);
    setPicks(newPicks);
    
    const nextIndex = currentTurnIndex + 1;
    const nextStep = sequence[nextIndex];
    
    if (nextStep && nextStep.action === 'decider') {
        const remainingMap = maps.find(m => !newBans.includes(m.id) && !newPicks.includes(m.id));
        if (remainingMap) {
          const randomSide = Math.random() > 0.5 ? 'attack' : 'defense';
          newEvents.push({ 
            type: 'decider', 
            team: 'System', 
            map: remainingMap.id, 
            side: randomSide,
            sidePicker: 'Team A' // Team A randomly assigned this side
          });
        }
        setEvents(newEvents);
        setPhase('finished');
        playSound('concluded.mp3');
    } else {
        setEvents(newEvents);
        setCurrentTurnIndex(nextIndex);
    }
    
    setTentativeSelection(null);
    setStolenBy(null);
  };

  const autoPickRandom = (step) => {
    if (step.action === 'ban' || step.action === 'pick') {
       const availableMaps = maps.filter(m => !bans.includes(m.id) && !picks.includes(m.id));
       const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
       lockInSelection(randomMap.id);
    } else if (step.action === 'side') {
       const randomSide = Math.random() > 0.5 ? 'attack' : 'defense';
       lockInSelection(randomSide);
    }
  };

  // Network Synchronization
  useEffect(() => {
    if (multiplayer.role === 'Host') {
      multiplayer.broadcastState({ phase, currentTurnIndex, timeLeft, bans, picks, events, stolenBy, isPaused, mode, teamAName, teamBName });
    }
  }, [phase, currentTurnIndex, timeLeft, bans, picks, events, stolenBy, isPaused, mode, teamAName, teamBName]);

  useEffect(() => {
    if (multiplayer.role && multiplayer.role !== 'Host' && multiplayer.networkState) {
      setPhase(multiplayer.networkState.phase);
      setCurrentTurnIndex(multiplayer.networkState.currentTurnIndex);
      setTimeLeft(multiplayer.networkState.timeLeft);
      setBans(multiplayer.networkState.bans);
      setPicks(multiplayer.networkState.picks);
      setEvents(multiplayer.networkState.events);
      setStolenBy(multiplayer.networkState.stolenBy);
      setIsPaused(multiplayer.networkState.isPaused);
      if (multiplayer.networkState.mode) setMode(multiplayer.networkState.mode);
      if (multiplayer.networkState.teamAName) setTeamAName(multiplayer.networkState.teamAName);
      if (multiplayer.networkState.teamBName) setTeamBName(multiplayer.networkState.teamBName);
    }
  }, [multiplayer.networkState]);

  useEffect(() => {
    if (multiplayer.role === 'Host') {
       const ev = multiplayer.popNetworkEvent();
       if (ev && ev.type === 'lockIn' && ev.value) {
          lockInSelection(ev.value);
       }
    }
  }, [multiplayer.networkEvents]);

  // Timer Tick
  useEffect(() => {
    if (phase !== 'veto') return;
    if (multiplayer.role && multiplayer.role !== 'Host') return;
    
    const timer = setInterval(() => {
      if (isPaused) return;
      setTimeLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [phase, currentTurnIndex, stolenBy]);

  // Turn Change Initialization
  useEffect(() => {
    if (phase !== 'veto') return;
    if (multiplayer.role && multiplayer.role !== 'Host') return;
    setTimeLeft(30);
    setTentativeSelection(null);
  }, [currentTurnIndex, phase]);

  // Expiration Trigger
  useEffect(() => {
    if (timeLeft === 5 && phase === 'veto') {
      playSound('5secsleftping.mp3', 3);
    }
    if (timeLeft === 0 && phase === 'veto') {
      const step = sequence[currentTurnIndex];
      if (!stolenBy) {
          // Steal turn
          setStolenBy(step.team === 'Team A' ? 'Team B' : 'Team A');
          setTimeLeft(30);
          setTentativeSelection(null);
      } else {
          // Both missed, auto pick
          autoPickRandom(step);
      }
    }
  }, [timeLeft]);

  // Background Music Effect
  useEffect(() => {
    if (phase === 'veto') {
      playBGM();
    } else {
      stopBGM();
    }
    return () => stopBGM();
  }, [phase]);

  const startMapVeto = () => {
    setPhase('veto');
    setCurrentTurnIndex(0);
    setBans([]);
    setPicks([]);
    setEvents([]);

    setStolenBy(null);
    setTentativeSelection(null);
  };


  const handleSelection = (val) => {
    if (tentativeSelection === val) setTentativeSelection(null);
    else setTentativeSelection(val);
  };

  const activeStep = phase === 'veto' ? sequence[currentTurnIndex] : null;
  const activeTeam = activeStep ? (stolenBy || activeStep.team) : null;
  const isStolen = !!stolenBy;
  const isMyTurn = phase === 'setup' || phase === 'finished' || !multiplayer.role || multiplayer.role === 'Host' || multiplayer.role === 'Guest' || multiplayer.role === activeTeam;

  const renderTeamSidebar = (teamName, bgColor, borderColor) => {
    const isTeamA = teamName === 'Team A';
    const displayName = isTeamA ? teamAName : teamBName;
    const teamPicks = events.filter(e => e.type === 'pick' && e.team === teamName);
    const teamBans = events.filter(e => e.type === 'ban' && e.team === teamName);
    const isInactive = phase === 'veto' && activeTeam !== teamName;

    return (
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', opacity: isInactive ? 0.4 : 1, filter: isInactive ? 'grayscale(100%)' : 'none', transition: 'all 0.3s ease' }}>
        <h3 style={{ textAlign: 'center', backgroundColor: bgColor, padding: '12px', borderRadius: '8px 8px 0 0', margin: 0, textTransform: 'uppercase' }}>
           {!multiplayer.role || multiplayer.role === 'Host' ? (
                 <input type="text" value={isTeamA ? teamAName : teamBName} onChange={e => isTeamA ? setTeamAName(e.target.value) : setTeamBName(e.target.value)} style={{ background: 'transparent', color: 'white', border: 'none', textAlign: 'center', fontSize: '1.17em', fontWeight: 'bold', width: '100%', outline: 'none', textTransform: 'uppercase' }} />
           ) : displayName}
        </h3>
        <div style={{ backgroundColor: '#0f172a', padding: '16px', border: `1px solid ${borderColor}`, borderRadius: '0 0 8px 8px', flex: 1 }}>
          
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ color: borderColor, textTransform: 'uppercase', marginBottom: '12px', borderBottom: `1px solid ${borderColor}`, paddingBottom: '4px' }}>{t('veto.picks')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {teamPicks.length === 0 && <div style={{ color: '#475569', fontStyle: 'italic' }}>No picks yet.</div>}
              {teamPicks.map((ev, i) => {
                const mapObj = maps.find(m => m.id === ev.map);
                if (!mapObj) return null;
                return (
                  <div key={i} style={{ height: '80px', position: 'relative', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${borderColor}` }}>
                    <img src={`${mapObj.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} alt={mapObj.name} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                      <div style={{ fontWeight: '900', fontSize: '1.5rem', textTransform: 'uppercase', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>{mapObj.name}</div>
                      {ev.side ? (
                        <div style={{ fontSize: '0.8rem', backgroundColor: ev.side === 'attack' ? '#ef4444' : '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', marginTop: '4px' }}>
                           {ev.sidePicker} starts {ev.side.toUpperCase()}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Waiting for side...</div>
                      )}
                      {ev.stolenBy && <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 'bold' }}>* STOLEN</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h4 style={{ color: '#ef4444', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #ef4444', paddingBottom: '4px' }}>{t('veto.bans')}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {teamBans.length === 0 && <div style={{ color: '#475569', fontStyle: 'italic' }}>No bans yet.</div>}
              {teamBans.map((ev, i) => {
                const mapObj = maps.find(m => m.id === ev.map);
                if (!mapObj) return null;
                return (
                  <div key={i} style={{ width: '80px', height: '50px', position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid #ef4444' }}>
                    <img src={`${mapObj.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%)', opacity: 0.5 }} alt={mapObj.name} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                       <div style={{ width: '100%', height: '2px', backgroundColor: '#ef4444', transform: 'rotate(25deg)', position: 'absolute' }}></div>
                       <div style={{ fontWeight: 'bold', fontSize: '0.7rem', textShadow: '1px 1px 2px black', zIndex: 1 }}>{mapObj.name}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    );
  };

  const pageGradient = phase === 'veto' && activeTeam === 'Team A'
    ? 'linear-gradient(to right, rgba(59, 130, 246, 0.35) 0%, transparent 60%)'
    : phase === 'veto' && activeTeam === 'Team B'
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
      <div style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '2.5rem' }}>Map Veto</h1>
      
      {phase === 'setup' && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          {!multiplayer.role && !multiplayer.roomId ? (
              <>
                 <h2>Select Format</h2>
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
                   {['bo1', 'bo3', 'bo5'].map(m => (
                     <button 
                       key={m}
                       onClick={() => setMode(m)}
                       style={{
                         padding: '16px 32px',
                         fontSize: '1.5rem',
                         backgroundColor: mode === m ? '#3b82f6' : '#1e293b',
                         color: 'white',
                         border: '2px solid',
                         borderColor: mode === m ? '#60a5fa' : '#334155',
                         borderRadius: '8px',
                         cursor: 'pointer',
                         fontWeight: 'bold',
                         textTransform: 'uppercase'
                       }}
                     >
                       {m}
                     </button>
                   ))}
                 </div>
                <button onClick={startMapVeto} style={{ fontSize: '1.5rem', padding: '12px 32px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>START LOCAL VETO</button>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
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
                 <h2>Select Format</h2>
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
                   {['bo1', 'bo3', 'bo5'].map(m => (
                     <button 
                       key={m}
                       onClick={() => setMode(m)}
                       style={{
                         padding: '16px 32px',
                         fontSize: '1.5rem',
                         backgroundColor: mode === m ? '#3b82f6' : '#1e293b',
                         color: 'white',
                         border: '2px solid',
                         borderColor: mode === m ? '#60a5fa' : '#334155',
                         borderRadius: '8px',
                         cursor: 'pointer',
                         fontWeight: 'bold',
                         textTransform: 'uppercase'
                       }}
                     >
                       {m}
                     </button>
                   ))}
                 </div>
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
                 <button onClick={startMapVeto} disabled={!multiplayer.connectedCaptains['Team A'] || !multiplayer.connectedCaptains['Team B']} style={{ fontSize: '1.5rem', padding: '12px 32px', backgroundColor: (multiplayer.connectedCaptains['Team A'] && multiplayer.connectedCaptains['Team B']) ? '#3b82f6' : '#475569', color: 'white', border: 'none', borderRadius: '8px', cursor: (multiplayer.connectedCaptains['Team A'] && multiplayer.connectedCaptains['Team B']) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>START ONLINE VETO</button>
              </>
            ) : (
              <>
                 <div style={{ fontSize: '1.5rem', color: '#8b5cf6', marginBottom: '1rem' }}>Connected as {multiplayer.role}</div>
                 <div style={{ color: '#94a3b8' }}>Waiting for host to start the veto...</div>
              </>
            )}
        </div>
      )}

      {phase !== 'setup' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem', minHeight: '130px' }}>
            {phase === 'finished' ? (
              <div>
                <h2 style={{ color: '#22c55e', fontSize: '2.5rem', textTransform: 'uppercase', textShadow: '0 0 10px rgba(34,197,94,0.5)' }}>Veto Complete!</h2>
                <button onClick={() => setPhase('setup')} style={{ marginTop: '1rem', padding: '8px 24px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t('veto.new')}</button>
              </div>
            ) : (
              <div>
                <h2 style={{ color: isStolen ? '#ef4444' : 'var(--accent-color)', fontSize: '1.8rem', textTransform: 'uppercase', margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                  {activeTeam === 'Team A' ? teamAName : teamBName} 
                  {isStolen && <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '1rem', padding: '4px 8px', borderRadius: '4px' }}>STOLEN TURN</span>}
                  - {activeStep.action === 'ban' ? 'BAN A MAP' : activeStep.action === 'pick' ? 'PICK A MAP' : 'CHOOSE STARTING SIDE'}
                </h2>
                <div style={{ 
                  fontSize: '3rem', 
                  fontWeight: '900', 
                  color: timeLeft <= 10 ? '#ef4444' : 'white',
                  fontFamily: 'monospace',
                  textShadow: timeLeft <= 5 ? '0 0 10px rgba(239,68,68,0.8)' : 'none'
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
                    onClick={() => { if (multiplayer.role && multiplayer.role !== 'Host') { multiplayer.sendAction({ type: 'lockIn', value: tentativeSelection }); setTentativeSelection(null); } else { lockInSelection(); } }} 
                    disabled={!tentativeSelection || (multiplayer.role && multiplayer.role !== 'Host' && multiplayer.role !== activeTeam)}
                    style={{ 
                      marginTop: '8px', 
                      padding: '12px 48px', 
                      backgroundColor: tentativeSelection ? (activeStep.action === 'ban' ? '#ef4444' : '#22c55e') : '#334155', 
                      color: tentativeSelection ? 'white' : '#64748b', 
                      border: 'none', 
                      borderRadius: '8px', 
                      fontWeight: '900',
                      fontSize: '1.2rem',
                      cursor: tentativeSelection ? 'pointer' : 'not-allowed',
                      boxShadow: tentativeSelection ? `0 4px 15px ${activeStep.action === 'ban' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}` : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    LOCK IN
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '2rem' }}>
            
            {renderTeamSidebar('Team A', '#1e40af', '#3b82f6')}

            {/* CENTER AREA */}
            <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               {phase === 'veto' && activeStep.action === 'side' && (
                 <div style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h3 style={{ marginBottom: '2rem', fontSize: '1.5rem', textAlign: 'center' }}>Choose starting side for the picked map</h3>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                       <div 
                         onClick={() => handleSelection('attack')}
                         style={{ 
                           width: '150px', height: '150px', 
                           backgroundColor: tentativeSelection === 'attack' ? '#ef4444' : '#1e293b', 
                           border: `4px solid ${tentativeSelection === 'attack' ? 'white' : '#ef4444'}`,
                           borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                           cursor: 'pointer', fontSize: '1.5rem', fontWeight: 'bold', transition: 'all 0.2s',
                           boxShadow: tentativeSelection === 'attack' ? '0 0 20px rgba(239,68,68,0.6)' : 'none'
                         }}>
                         ATTACK
                       </div>
                       <div 
                         onClick={() => handleSelection('defense')}
                         style={{ 
                           width: '150px', height: '150px', 
                           backgroundColor: tentativeSelection === 'defense' ? '#3b82f6' : '#1e293b', 
                           border: `4px solid ${tentativeSelection === 'defense' ? 'white' : '#3b82f6'}`,
                           borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                           cursor: 'pointer', fontSize: '1.5rem', fontWeight: 'bold', transition: 'all 0.2s',
                           boxShadow: tentativeSelection === 'defense' ? '0 0 20px rgba(59,130,246,0.6)' : 'none'
                         }}>
                         DEFENSE
                       </div>
                    </div>
                 </div>
               )}

               {phase === 'veto' && activeStep.action !== 'side' && (
                 <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignContent: 'start' }}>
                   {maps.map(map => {
                     const isBanned = bans.includes(map.id);
                     const isPicked = picks.includes(map.id);
                     const isSelectable = !isBanned && !isPicked && (!multiplayer.role || multiplayer.role === 'Host' || multiplayer.role === activeTeam);
                     const isTentative = tentativeSelection === map.id;

                     return (
                       <div 
                         key={map.id} 
                         onClick={() => isSelectable ? handleSelection(map.id) : null}
                         style={{ 
                           height: '120px',
                           position: 'relative',
                           backgroundColor: '#0f172a',
                           border: isBanned ? '2px solid #ef4444' : isPicked ? '2px solid #22c55e' : isTentative ? (activeStep.action === 'ban' ? '3px solid #ef4444' : '3px solid #22c55e') : '1px solid #475569',
                           opacity: (isBanned || isPicked) ? 0.3 : isTentative ? 0.9 : 1,
                           transition: 'all 0.1s',
                           overflow: 'hidden',
                           borderRadius: '8px',
                           cursor: isSelectable ? 'pointer' : 'not-allowed',
                           boxShadow: isTentative ? (activeStep.action === 'ban' ? '0 0 15px rgba(239, 68, 68, 0.8)' : '0 0 15px rgba(34, 197, 94, 0.8)') : 'none'
                         }}
                         onMouseOver={(e) => { if(isSelectable && !isTentative) e.currentTarget.style.borderColor = '#94a3b8' }}
                         onMouseOut={(e) => { if(isSelectable && !isTentative) e.currentTarget.style.borderColor = '#475569' }}
                       >
                         <img 
                            src={`${map.image}`} 
                            alt={map.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                         />
                         
                         {isBanned && (
                           <div style={{
                             position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                             backgroundColor: 'rgba(239, 68, 68, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                           }}>
                              <div style={{ width: '100%', height: '6px', backgroundColor: '#ef4444', transform: 'rotate(25deg)', position: 'absolute' }}></div>
                           </div>
                         )}

                         {isPicked && (
                           <div style={{
                             position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                             backgroundColor: 'rgba(34, 197, 94, 0.4)'
                           }}></div>
                         )}

                         {isTentative && (
                            <div style={{
                               position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                               backgroundColor: activeStep.action === 'ban' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'
                             }}></div>
                         )}
                         
                         <div style={{
                           position: 'absolute', bottom: 0, left: 0, right: 0,
                           backgroundColor: 'rgba(0,0,0,0.8)', color: 'white',
                           fontSize: '1rem', padding: '4px', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase'
                         }}>
                           {map.name}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}

               {/* Decider Display (Visible when finished) */}
               {phase === 'finished' && (
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', border: '2px solid #a855f7', borderRadius: '8px', padding: '24px', boxShadow: '0 0 20px rgba(168,85,247,0.3)' }}>
                    <h2 style={{ color: '#a855f7', textTransform: 'uppercase', marginBottom: '1rem' }}>Decider Map</h2>
                    {events.filter(e => e.type === 'decider').map(ev => {
                       const mapObj = maps.find(m => m.id === ev.map);
                       if (!mapObj) return null;
                       return (
                         <div key={ev.map} style={{ width: '100%', maxWidth: '400px', height: '200px', position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '2px solid #a855f7' }}>
                           <img src={`${mapObj.image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={mapObj.name} />
                           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                             <div style={{ fontWeight: '900', fontSize: '2.5rem', textTransform: 'uppercase', textShadow: '2px 2px 4px black' }}>{mapObj.name}</div>
                             <div style={{ fontSize: '1rem', backgroundColor: ev.side === 'attack' ? '#ef4444' : '#3b82f6', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold', marginTop: '8px' }}>
                                Team A randomly assigned {ev.side.toUpperCase()}
                             </div>
                           </div>
                         </div>
                       )
                    })}
                 </div>
               )}
            </div>

            {renderTeamSidebar('Team B', '#b91c1c', '#ef4444')}
          </div>
        </>
      )}
    </div>
    </>
  );
};

export default MapVeto;
















