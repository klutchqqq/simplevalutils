import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Confetti from 'react-confetti';

const FunMode = () => {
  const { t } = useLanguage();
  const [agents, setAgents] = useState([]);
  const [bannedAgents, setBannedAgents] = useState([]);
  const [isRolling, setIsRolling] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Master composition mode
  const [teamCompMode, setTeamCompMode] = useState('manual');
  const [customRoles, setCustomRoles] = useState({
    Controller: 0,
    Duelist: 0,
    Initiator: 0,
    Sentinel: 0
  });
  
  // Combine player config and rolling state
  const [boxes, setBoxes] = useState(
    Array.from({ length: 5 }, (_, i) => ({ 
      name: `PLAYER ${i + 1}`, 
      role: 'ALL', 
      status: 'idle', 
      finalAgent: null, 
      currentAgent: null 
    }))
  );

  const rollIntervals = useRef([]);
  const lockTimeouts = useRef([]);

  useEffect(() => {
    fetch('./data/agents.json')
      .then(res => res.json())
      .then(data => setAgents(data))
      .catch(err => console.error("Failed to fetch agents", err));

    return () => {
      rollIntervals.current.forEach(clearInterval);
      lockTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  const toggleBan = (agentId) => {
    if (isRolling) return;
    setBannedAgents(prev => 
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const updatePlayer = (index, field, value) => {
    if (isRolling) return;
    setBoxes(prev => prev.map((box, i) => i === index ? { ...box, [field]: value } : box));
  };

  const updateCustomRole = (role, delta) => {
    if (isRolling) return;
    setCustomRoles(prev => {
      const total = Object.values(prev).reduce((a, b) => a + b, 0);
      const val = prev[role];
      if (delta > 0 && total >= 5) return prev;
      if (delta < 0 && val <= 0) return prev;
      return { ...prev, [role]: val + delta };
    });
  };

  const startRoll = () => {
    if (isRolling) return;
    
    const availableAgents = agents.filter(a => !bannedAgents.includes(a.id));
    if (availableAgents.length < 5) {
      alert("Not enough agents to form a team of 5! Unban some agents.");
      return;
    }

    // Process team composition settings
    let generatedRoles = [];
    if (teamCompMode === 'standard') {
      generatedRoles = ['Controller', 'Duelist', 'Initiator', 'Sentinel', 'ALL'];
    } else if (teamCompMode === 'all_same') {
      const roles = ['Controller', 'Duelist', 'Initiator', 'Sentinel'];
      const randomRole = roles[Math.floor(Math.random() * roles.length)];
      generatedRoles = Array(5).fill(randomRole);
    } else if (teamCompMode === 'custom') {
      for (let i = 0; i < customRoles.Controller; i++) generatedRoles.push('Controller');
      for (let i = 0; i < customRoles.Duelist; i++) generatedRoles.push('Duelist');
      for (let i = 0; i < customRoles.Initiator; i++) generatedRoles.push('Initiator');
      for (let i = 0; i < customRoles.Sentinel; i++) generatedRoles.push('Sentinel');
      while (generatedRoles.length < 5) generatedRoles.push('ALL');
    } else {
      generatedRoles = boxes.map(b => b.role);
    }

    // Shuffle roles so they aren't predictably assigned to Player 1, Player 2 sequentially (unless manual)
    if (teamCompMode !== 'manual') {
      generatedRoles.sort(() => 0.5 - Math.random());
    }

    // Determine final selection respecting generated roles
    const finalSelection = [];
    const usedIds = new Set();
    const newBoxes = [...boxes];

    for (let i = 0; i < 5; i++) {
      const roleNeeded = generatedRoles[i];
      newBoxes[i].role = roleNeeded; // Override the box's role visually for the roll
      
      let validAgents = availableAgents.filter(a => !usedIds.has(a.id));
      
      if (roleNeeded !== 'ALL') {
        validAgents = validAgents.filter(a => a.role === roleNeeded);
      }
      
      if (validAgents.length === 0) {
        alert(`Not enough unbanned agents to fulfill the role '${roleNeeded}' without overlap! Try loosening your role requirements or unbanning agents.`);
        return;
      }
      
      const chosen = validAgents[Math.floor(Math.random() * validAgents.length)];
      finalSelection.push(chosen);
      usedIds.add(chosen.id);
    }
    
    setIsRolling(true);
    setShowConfetti(false);

    // Initialize rolling state
    setBoxes(newBoxes.map((box, i) => ({ 
      ...box, 
      status: 'rolling', 
      finalAgent: finalSelection[i], 
      currentAgent: availableAgents[Math.floor(Math.random() * availableAgents.length)] 
    })));

    rollIntervals.current.forEach(clearInterval);
    lockTimeouts.current.forEach(clearTimeout);
    rollIntervals.current = [];
    lockTimeouts.current = [];

    const lockTimes = [1000, 2500, 4000, 5500, 8000];

    for (let i = 0; i < 5; i++) {
      // Slot machine effect
      rollIntervals.current[i] = setInterval(() => {
        setBoxes(prev => {
          const next = [...prev];
          if (next[i].status === 'rolling') {
            const roleNeeded = next[i].role;
            let cycleAgents = availableAgents;
            if (roleNeeded !== 'ALL') {
              cycleAgents = availableAgents.filter(a => a.role === roleNeeded);
              if (cycleAgents.length === 0) cycleAgents = availableAgents; // fallback for visual
            }
            next[i].currentAgent = cycleAgents[Math.floor(Math.random() * cycleAgents.length)];
          }
          return next;
        });
      }, 80);

      // Lock in
      lockTimeouts.current[i] = setTimeout(() => {
        clearInterval(rollIntervals.current[i]);
        
        setBoxes(prev => {
          const next = [...prev];
          next[i].status = 'locked';
          next[i].currentAgent = next[i].finalAgent;
          return next;
        });

        try {
          const audio = new Audio(`${import.meta.env.BASE_URL}audio/box${i + 1}default.mp3.mp3`);
          audio.volume = 0.5;
          audio.play().catch(e => console.log("Audio play blocked/failed:", e));
        } catch (err) {
          console.error(err);
        }

        if (i === 4) {
          setIsRolling(false);
          setShowConfetti(true);
        }
      }, lockTimes[i]);
    }
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'Duelist': return 'DuelistClassSymbol.webp';
      case 'Initiator': return 'InitiatorClassSymbol.webp';
      case 'Controller': return 'ControllerClassSymbol.webp';
      case 'Sentinel': return 'SentinelClassSymbol.webp';
      default: return null;
    }
  };

  return (
    <div style={{ paddingTop: '2rem', textAlign: 'center' }}>
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={400} />}
      
      <h1 style={{ marginBottom: '1rem', fontSize: '2.5rem' }}>Fun Mode: Agent Slot Machine</h1>
      <p style={{ color: 'var(--accent-color)', marginBottom: '2rem' }}>
        Ban agents below, assign roles, then click Roll to randomly draft your team!
      </p>

      {/* Global Team Composition Settings */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
         <label style={{ color: '#94a3b8', fontWeight: '900', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
           Auto-Assign Roles Options
         </label>
         <select 
            value={teamCompMode} 
            onChange={e => setTeamCompMode(e.target.value)}
            disabled={isRolling}
            style={{ 
              padding: '10px 20px', 
              borderRadius: '8px', 
              backgroundColor: '#1e293b', 
              color: 'white', 
              border: '2px solid #334155', 
              fontSize: '1.1rem', 
              cursor: isRolling ? 'not-allowed' : 'pointer',
              outline: 'none',
              fontWeight: 'bold',
              minWidth: '300px',
              textAlign: 'center'
            }}
         >
            <option value="manual">Off (Manual Per Box)</option>
            <option value="standard">Standard (4 Roles + 1 Flex)</option>
            <option value="all_same">Chaos (All Same Random Role)</option>
            <option value="custom">Fully Custom Layout</option>
         </select>

         {/* Custom Comp UI */}
         {teamCompMode === 'custom' && (
           <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', flexWrap: 'wrap', justifyContent: 'center' }}>
             {['Controller', 'Duelist', 'Initiator', 'Sentinel'].map(r => (
               <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '8px', border: '1px solid #475569' }}>
                 <img src={`./images/roles/${getRoleIcon(r)}`} alt={r} style={{ width: '28px', height: '28px' }} title={r} />
                 <button onClick={() => updateCustomRole(r, -1)} disabled={customRoles[r] === 0 || isRolling} style={{ background: 'transparent', color: customRoles[r] === 0 ? '#475569' : 'white', border: 'none', cursor: (customRoles[r] === 0 || isRolling) ? 'not-allowed' : 'pointer', fontSize: '1.5rem', fontWeight: 'bold' }}>-</button>
                 <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#3b82f6', minWidth: '20px', textAlign: 'center' }}>{customRoles[r]}</span>
                 <button onClick={() => updateCustomRole(r, 1)} disabled={Object.values(customRoles).reduce((a,b)=>a+b, 0) >= 5 || isRolling} style={{ background: 'transparent', color: Object.values(customRoles).reduce((a,b)=>a+b, 0) >= 5 ? '#475569' : 'white', border: 'none', cursor: (Object.values(customRoles).reduce((a,b)=>a+b, 0) >= 5 || isRolling) ? 'not-allowed' : 'pointer', fontSize: '1.5rem', fontWeight: 'bold' }}>+</button>
               </div>
             ))}
             <div style={{ width: '100%', fontSize: '0.9rem', color: '#64748b', marginTop: '8px', fontWeight: 'bold' }}>
               Total Selected: {Object.values(customRoles).reduce((a,b)=>a+b, 0)} / 5
               {Object.values(customRoles).reduce((a,b)=>a+b, 0) < 5 && " (Remaining slots will be 'ALL' flex)"}
             </div>
           </div>
         )}
      </div>

      {/* 5 Slot Machine Boxes */}
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '3rem', flexWrap: 'wrap' }}>
        {boxes.map((box, i) => (
          <div key={i} className="card" style={{ 
            width: '200px', 
            height: '320px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'flex-start',
            padding: '16px 12px',
            border: box.status === 'locked' ? '3px solid #22c55e' : '1px solid var(--border-color)',
            boxShadow: box.status === 'locked' ? '0 0 25px rgba(34, 197, 94, 0.5)' : 'none',
            backgroundColor: box.status === 'locked' ? '#f0fdf4' : 'var(--bg-color)',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden'
          }}>
             {box.status === 'rolling' && (
               <div style={{
                 position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                 background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
                 animation: 'slideDown 0.2s infinite linear',
                 pointerEvents: 'none', zIndex: 10
               }}></div>
             )}
             
             <style>
              {`
                @keyframes slideDown { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
              `}
             </style>

             {/* Player Config Header */}
             <div style={{ width: '100%', zIndex: 5, marginBottom: '1rem' }}>
                <input 
                  value={box.name}
                  onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                  placeholder="Player Name"
                  disabled={isRolling}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px dashed #cbd5e1',
                    color: box.status === 'locked' ? '#166534' : 'var(--text-color)',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    marginBottom: '8px',
                    outline: 'none'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {box.role !== 'ALL' && (
                    <img src={`./images/roles/${getRoleIcon(box.role)}`} alt={box.role} style={{ width: '16px', height: '16px' }} />
                  )}
                  <select 
                    value={box.role}
                    onChange={(e) => updatePlayer(i, 'role', e.target.value)}
                    disabled={isRolling || teamCompMode !== 'manual'}
                    title={teamCompMode !== 'manual' ? "Roles are currently auto-assigned by the setting above." : "Manually lock a role for this player"}
                    style={{
                      background: 'transparent',
                      border: '1px solid #475569',
                      color: (teamCompMode !== 'manual') ? '#64748b' : 'var(--text-color)',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      fontSize: '0.75rem',
                      outline: 'none',
                      cursor: (isRolling || teamCompMode !== 'manual') ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="ALL" style={{ color: 'black' }}>{t('fun.roles.all')}</option>
                    <option value="Duelist" style={{ color: 'black' }}>Duelist</option>
                    <option value="Initiator" style={{ color: 'black' }}>Initiator</option>
                    <option value="Controller" style={{ color: 'black' }}>Controller</option>
                    <option value="Sentinel" style={{ color: 'black' }}>Sentinel</option>
                  </select>
                </div>
             </div>

             {box.currentAgent ? (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                 {/* Agent Image */}
                 <div style={{ 
                   width: '110px', height: '110px', borderRadius: '50%',
                   backgroundColor: '#e2e8f0', marginBottom: '1rem', overflow: 'hidden',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   border: '4px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                 }}>
                   <img 
                     src={`${box.currentAgent.image}`} 
                     alt={box.currentAgent.name} 
                     style={{ 
                       width: '100%', height: '100%', objectFit: 'cover', 
                       filter: box.status === 'rolling' ? 'blur(3px)' : 'none',
                       transition: 'filter 0.1s'
                     }} 
                     onError={(e) => { e.target.style.display = 'none'; }}
                   />
                 </div>
                 
                 {/* Agent Details */}
                 <div style={{ 
                   fontSize: '1.4rem', fontWeight: '900', textTransform: 'uppercase',
                   color: box.status === 'locked' ? '#166534' : 'var(--text-color)',
                   filter: box.status === 'rolling' ? 'blur(2px)' : 'none',
                   transition: 'filter 0.1s'
                 }}>
                   {box.currentAgent.name}
                 </div>
                 <div style={{ 
                   color: box.status === 'locked' ? '#22c55e' : 'var(--accent-color)', 
                   fontWeight: 'bold', marginTop: '2px', fontSize: '0.8rem',
                   filter: box.status === 'rolling' ? 'blur(2px)' : 'none',
                   display: 'flex', alignItems: 'center', gap: '4px'
                 }}>
                   {box.currentAgent.role}
                 </div>
               </div>
             ) : (
               <div style={{ fontSize: '4rem', color: '#cbd5e1', fontWeight: 'bold', margin: 'auto' }}>?</div>
             )}
          </div>
        ))}
      </div>

      <button 
        onClick={startRoll} 
        disabled={isRolling}
        style={{ 
          fontSize: '2rem', padding: '16px 64px', borderRadius: '12px',
          backgroundColor: isRolling ? '#94a3b8' : '#3b82f6', color: 'white',
          border: 'none', cursor: isRolling ? 'not-allowed' : 'pointer',
          fontWeight: '900', textTransform: 'uppercase',
          boxShadow: isRolling ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.4)',
          transform: isRolling ? 'none' : 'scale(1)', transition: 'all 0.2s',
          marginBottom: '4rem'
        }}
        onMouseOver={(e) => { if(!isRolling) e.currentTarget.style.transform = 'scale(1.05)' }}
        onMouseOut={(e) => { if(!isRolling) e.currentTarget.style.transform = 'scale(1)' }}
      >
        {isRolling ? t('fun.roll') + '...' : 'ROLL'}
      </button>

      <hr style={{ borderTop: '1px solid var(--border-color)', margin: '0 auto 2rem auto', width: '80%' }} />

      {/* Grid Ban Section */}
      <div>
        <h3 style={{ marginBottom: '1.5rem', textTransform: 'uppercase', color: '#94a3b8' }}>{t('fun.roster')}</h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(6, 1fr)', 
          gap: '4px', 
          maxWidth: '650px', 
          margin: '0 auto',
          backgroundColor: '#1e293b',
          padding: '4px',
          border: '1px solid #334155'
        }}>
          {agents.map(agent => {
            const isBanned = bannedAgents.includes(agent.id);
            return (
              <div 
                key={agent.id} 
                onClick={() => toggleBan(agent.id)}
                style={{ 
                  cursor: isRolling ? 'not-allowed' : 'pointer',
                  aspectRatio: '1',
                  position: 'relative',
                  backgroundColor: '#0f172a',
                  border: isBanned ? '2px solid #ef4444' : '1px solid #475569',
                  transition: 'all 0.1s',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => { if(!isRolling && !isBanned) e.currentTarget.style.borderColor = '#94a3b8' }}
                onMouseOut={(e) => { if(!isRolling && !isBanned) e.currentTarget.style.borderColor = '#475569' }}
              >
                <img 
                   src={`${agent.image}`} 
                   alt={agent.name}
                   style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isBanned ? 0.3 : 1 }}
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
                
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
                  fontSize: '0.65rem', padding: '2px', fontWeight: 'bold'
                }}>
                  {agent.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default FunMode;

