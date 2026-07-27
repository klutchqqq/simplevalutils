import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Shuffle, Download, Save, Upload, Settings } from 'lucide-react';

const Tournament = () => {
  const { t } = useLanguage();
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem('valorant_tournament_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[key] !== undefined) return parsed[key];
      }
    } catch (e) {}
    return typeof defaultVal === 'function' ? defaultVal() : defaultVal;
  };

  const [isSetupComplete, setIsSetupComplete] = useState(() => loadState('isSetupComplete', false));
  const [format, setFormat] = useState(() => loadState('format', 'single'));
  const [teamCount, setTeamCount] = useState(() => loadState('teamCount', 8));
  const [mapRule, setMapRule] = useState(() => loadState('mapRule', 'host'));
  const [draftRule, setDraftRule] = useState(() => loadState('draftRule', 'banpick'));

  const [teams, setTeams] = useState(() => loadState('teams', () => Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`)));
  const [winners, setWinners] = useState(() => loadState('winners', {}));
  const [matchMaps, setMatchMaps] = useState(() => loadState('matchMaps', {})); 
  const [championLabel, setChampionLabel] = useState(() => loadState('championLabel', 'CHAMPION'));

  useEffect(() => {
    localStorage.setItem('valorant_tournament_state', JSON.stringify({
      isSetupComplete, format, teamCount, mapRule, draftRule, teams, winners, matchMaps, championLabel
    }));
  }, [isSetupComplete, format, teamCount, mapRule, draftRule, teams, winners, matchMaps, championLabel]);

  const handleTeamCountChange = (newCount) => {
    setTeamCount(newCount);
    setTeams(prev => {
      const newTeams = [...prev];
      if (newCount > prev.length) {
        for (let i = prev.length; i < newCount; i++) newTeams.push(`Team ${i + 1}`);
      } else if (newCount < prev.length) {
        newTeams.length = newCount;
      }
      return newTeams;
    });
    setWinners({});
    setMatchMaps({});
  };

  const handleTeamNameChange = (index, newName) => {
    const newTeams = [...teams];
    newTeams[index] = newName;
    setTeams(newTeams);
  };

  const randomizeTeams = () => {
    setTeams([...teams].sort(() => 0.5 - Math.random()));
    setWinners({});
    setMatchMaps({});
  };

  const [availableMaps, setAvailableMaps] = useState([]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/maps.json`)
      .then(r => r.json())
      .then(data => setAvailableMaps(data))
      .catch(e => console.error(e));
  }, []);

  const singleEliminationRounds = useMemo(() => {
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teams.length)));
    const paddedTeams = [...teams];
    while (paddedTeams.length < nextPowerOf2) paddedTeams.push('BYE');

    const rounds = []; 
    let currentTeams = paddedTeams;
    let r = 0;

    while (currentTeams.length > 0) {
      if (currentTeams.length === 1) {
        rounds.push([{ isChampion: true, team: currentTeams[0], r, matchIndex: 0 }]);
        break;
      }
      const matches = [];
      const nextTeams = [];
      for (let i = 0; i < currentTeams.length; i += 2) {
        const t1 = currentTeams[i];
        const t2 = currentTeams[i + 1];
        const matchIndex = i / 2;
        matches.push({ t1, t2, matchIndex, r });
        
        const winnerKey = `${r}-${matchIndex}`;
        let advancedTeam = null;

        if (t1 === 'BYE' && t2 === 'BYE') advancedTeam = 'BYE';
        else if (t1 === 'BYE') advancedTeam = t2;
        else if (t2 === 'BYE') advancedTeam = t1;
        else if (winners[winnerKey] === 0) advancedTeam = t1;
        else if (winners[winnerKey] === 1) advancedTeam = t2;

        nextTeams.push(advancedTeam || 'TBD');
      }
      rounds.push(matches);
      currentTeams = nextTeams;
      r++;
    }
    return rounds;
  }, [teams, winners]);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState('default'); 
  const hitboxes = useRef([]);
  const [mapPickerTarget, setMapPickerTarget] = useState(null); 

  useEffect(() => {
    if (!isSetupComplete || format !== 'single') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const boxWidth = 220;
    const boxHeight = 70;
    const hGap = 80;
    const vGap = 30;
    const startX = 40;
    const startY = 60;
    const badgeHeight = 24;

    const roundCount = singleEliminationRounds.length;
    const maxMatches = singleEliminationRounds[0].length;
    
    const dpr = window.devicePixelRatio || 1;
    const rawWidth = startX + roundCount * (boxWidth + hGap);
    const rawHeight = startY + maxMatches * (boxHeight + vGap + (mapRule === 'host' ? badgeHeight : 0)) + 100;
    
    canvas.width = rawWidth * dpr;
    canvas.height = rawHeight * dpr;
    canvas.style.width = `${rawWidth}px`;
    canvas.style.height = `${rawHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, rawWidth, rawHeight);

    hitboxes.current = [];
    const positions = {}; 

    singleEliminationRounds.forEach((round, r) => {
      round.forEach((match, m) => {
        let x = startX + r * (boxWidth + hGap);
        let y = 0;
        
        let totalBoxH = boxHeight;
        if (!match.isChampion && mapRule === 'host') totalBoxH += badgeHeight;

        if (r === 0) {
          y = startY + m * (totalBoxH + vGap);
        } else {
          if (match.isChampion) {
            const child1 = positions[`${r-1}-0`];
            y = child1 ? child1.y : startY;
          } else {
            const child1 = positions[`${r-1}-${m*2}`];
            const child2 = positions[`${r-1}-${m*2+1}`];
            if (child1 && child2) y = (child1.y + child2.y) / 2;
            else if (child1) y = child1.y;
            else y = startY;
          }
        }
        
        positions[`${r}-${match.matchIndex}`] = { x, y, isChampion: match.isChampion };

        if (match.isChampion) {
          ctx.fillStyle = '#eab308';
          ctx.shadowColor = 'rgba(234, 179, 8, 0.4)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetY = 4;
          ctx.beginPath();
          ctx.roundRect(x, y, boxWidth, boxHeight, 8);
          ctx.fill();
          ctx.shadowBlur = 0; 
          ctx.shadowOffsetY = 0;

          ctx.fillStyle = '#888';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(championLabel, x + boxWidth/2, y - 10);

          ctx.fillStyle = 'white';
          ctx.font = 'bold 18px Inter, sans-serif';
          ctx.fillText(match.team, x + boxWidth/2, y + boxHeight/2 + 6);
        } else {
          let currentY = y;
          if (mapRule === 'host') {
            const mapSelected = matchMaps[`${r}-${match.matchIndex}`];
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.roundRect(x, currentY, boxWidth, badgeHeight, [8, 8, 0, 0]);
            ctx.fill();
            
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(mapSelected ? `MAP: ${mapSelected}` : t('tourn.map.tbd'), x + boxWidth/2, currentY + 16);
            
            hitboxes.current.push({
              type: 'map', r, matchIndex: match.matchIndex,
              x, y: currentY, w: boxWidth, h: badgeHeight
            });
            currentY += badgeHeight;
          }

          const isT1BYE = match.t1 === 'BYE';
          const isT2BYE = match.t2 === 'BYE';
          const winnerKey = `${r}-${match.matchIndex}`;
          const isT1Won = !isT1BYE && (winners[winnerKey] === 0 || (match.t2 === 'BYE'));
          const isT2Won = !isT2BYE && (winners[winnerKey] === 1 || (match.t1 === 'BYE'));
          
          const isT1Lost = !isT1BYE && (winners[winnerKey] === 1);
          const isT2Lost = !isT2BYE && (winners[winnerKey] === 0);

          const drawTeam = (team, isTop, isWon, isLost, isBYE) => {
            const ty = currentY + (isTop ? 0 : boxHeight/2);
            ctx.fillStyle = isBYE ? '#f1f5f9' : (isWon ? '#dcfce7' : (isLost ? '#fee2e2' : '#ffffff'));
            ctx.beginPath();
            if (isTop) {
              ctx.roundRect(x, ty, boxWidth, boxHeight/2, mapRule === 'host' ? [0,0,0,0] : [8, 8, 0, 0]);
            } else {
              ctx.roundRect(x, ty, boxWidth, boxHeight/2, [0, 0, 8, 8]);
            }
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = isLost ? '#94a3b8' : '#1e293b';
            ctx.font = (isWon && !isBYE) ? 'bold 14px Inter, sans-serif' : '14px Inter, sans-serif';
            ctx.textAlign = 'left';
            
            if (isLost) {
               const metrics = ctx.measureText(team);
               ctx.beginPath();
               ctx.moveTo(x + 15, ty + boxHeight/4);
               ctx.lineTo(x + 15 + Math.min(metrics.width, boxWidth-30), ty + boxHeight/4);
               ctx.strokeStyle = '#94a3b8';
               ctx.stroke();
            }
            
            ctx.fillText(isBYE ? '' : team, x + 15, ty + boxHeight/4 + 5);

            if (!isBYE && team !== 'TBD') {
              hitboxes.current.push({
                type: 'team', r, matchIndex: match.matchIndex, teamIndex: isTop ? 0 : 1,
                x, y: ty, w: boxWidth, h: boxHeight/2
              });
            }
          };

          drawTeam(match.t1, true, isT1Won, isT1Lost, isT1BYE);
          drawTeam(match.t2, false, isT2Won, isT2Lost, isT2BYE);
        }
      });
    });

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    singleEliminationRounds.forEach((round, r) => {
      round.forEach((match, m) => {
        if (match.isChampion) return;
        const current = positions[`${r}-${match.matchIndex}`];
        const next = positions[`${r+1}-${Math.floor(match.matchIndex/2)}`];
        
        let totalBoxH = boxHeight;
        if (mapRule === 'host') totalBoxH += badgeHeight;

        if (current && next) {
          const startXLine = current.x + boxWidth;
          const startYLine = current.y + totalBoxH/2;
          
          let nextTotalBoxH = boxHeight;
          if (!next.isChampion && mapRule === 'host') nextTotalBoxH += badgeHeight;
          
          const endXLine = next.x;
          const endYLine = next.y + nextTotalBoxH/2;

          ctx.beginPath();
          ctx.moveTo(startXLine, startYLine);
          ctx.lineTo(startXLine + hGap/2, startYLine);
          ctx.lineTo(startXLine + hGap/2, endYLine);
          ctx.lineTo(endXLine, endYLine);
          ctx.stroke();
        }
      });
    });

  }, [isSetupComplete, singleEliminationRounds, mapRule, winners, matchMaps, championLabel]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width * (window.devicePixelRatio || 1));
    const scaleY = canvas.height / (rect.height * (window.devicePixelRatio || 1));
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasClick = (e) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    for (const box of hitboxes.current) {
      if (coords.x >= box.x && coords.x <= box.x + box.w && coords.y >= box.y && coords.y <= box.y + box.h) {
        if (box.type === 'team') {
          setWinners(prev => {
            const next = { ...prev };
            const key = `${box.r}-${box.matchIndex}`;
            if (next[key] === box.teamIndex) delete next[key]; 
            else next[key] = box.teamIndex; 
            return next;
          });
        } else if (box.type === 'map') {
          setMapPickerTarget({ r: box.r, matchIndex: box.matchIndex });
        }
        break;
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    let isHover = false;
    for (const box of hitboxes.current) {
      if (coords.x >= box.x && coords.x <= box.x + box.w && coords.y >= box.y && coords.y <= box.y + box.h) {
        isHover = true;
        break;
      }
    }
    setHoveredNode(isHover ? 'pointer' : 'default');
  };

  const exportAsImage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'valorant-tournament-bracket.png';
    link.href = dataUrl;
    link.click();
  };

  const fileInputRef = useRef(null);
  const exportBracketJson = () => {
    const stateToSave = { isSetupComplete, format, teamCount, mapRule, draftRule, teams, winners, matchMaps, championLabel };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stateToSave, null, 2));
    const link = document.createElement('a');
    link.download = 'valorant-tournament-save.json';
    link.href = dataStr;
    link.click();
  };
  
  const importBracketJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.isSetupComplete !== undefined) setIsSetupComplete(parsed.isSetupComplete);
        if (parsed.format) setFormat(parsed.format);
        if (parsed.teamCount) setTeamCount(parsed.teamCount);
        if (parsed.mapRule) setMapRule(parsed.mapRule);
        if (parsed.draftRule) setDraftRule(parsed.draftRule);
        if (parsed.teams) setTeams(parsed.teams);
        if (parsed.winners) setWinners(parsed.winners);
        if (parsed.matchMaps) setMatchMaps(parsed.matchMaps);
        if (parsed.championLabel) setChampionLabel(parsed.championLabel);
      } catch (err) {
        alert('Invalid save file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const inputStyle = { padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', width: '100%' };

  return (
    <div style={{ paddingTop: '2rem' }}>
      {!isSetupComplete ? (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ textTransform: 'uppercase', fontWeight: 900, fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>{t('tourn.setup')}</h2>
          
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>{t('tourn.format')}</label>
                <select value={format} onChange={e => setFormat(e.target.value)} style={inputStyle}>
                  <option value="single">{t('tourn.single')}</option>
                  <option value="double">{t('tourn.double')}</option>
                  <option value="swiss">{t('tourn.swiss')}</option>
                  <option value="group">{t('tourn.group')}</option>
                </select>
                {format !== 'single' && <small style={{ color: '#ef4444', display: 'block', marginTop: '4px' }}>{t('tourn.notbuilt')}</small>}
              </div>
              
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>{t('tourn.teams')}</label>
                <select value={teamCount} onChange={e => handleTeamCountChange(Number(e.target.value))} style={inputStyle}>
                  {[4, 8, 16, 32, 64].map(num => (
                    <option key={num} value={num}>{num} {t('tourn.teams.count')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>{t('tourn.maprule')}</label>
                <select value={mapRule} onChange={e => setMapRule(e.target.value)} style={inputStyle}>
                  <option value="host">{t('tourn.maprule.host')}</option>
                  <option value="bo1">Best of 1</option>
                  <option value="bo3">Best of 3</option>
                  <option value="bo5">Best of 5</option>
                  <option value="random">{t('tourn.maprule.random')}</option>
                </select>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>{t('tourn.draftrule')}</label>
                <select value={draftRule} onChange={e => setDraftRule(e.target.value)} style={inputStyle}>
                  <option value="banpick">{t('tourn.draftrule.banpick')}</option>
                  <option value="pick">{t('tourn.draftrule.pick')}</option>
                  <option value="none">{t('tourn.draftrule.none')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{t('tourn.reg')}</h3>
              <button onClick={randomizeTeams} title="Randomize Seeds" style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-color)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                <Shuffle size={14} /> Randomize
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {teams.map((team, index) => (
                <input 
                  key={index}
                  type="text" 
                  value={team}
                  onChange={(e) => handleTeamNameChange(index, e.target.value)}
                  placeholder={`Seed ${index + 1}`}
                  style={inputStyle}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => setIsSetupComplete(true)} style={{ backgroundColor: '#22c55e', color: 'white', padding: '1rem 3rem', fontSize: '1.2rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              {t('tourn.gen')}
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ backgroundColor: '#8b5cf6', color: 'white', padding: '1rem 3rem', fontSize: '1.2rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={18} /> {t('tourn.load')}
            </button>
            <input type="file" ref={fileInputRef} onChange={importBracketJson} accept=".json" style={{ display: 'none' }} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          
          <div className="card" ref={containerRef} style={{ flexGrow: 1, overflowX: 'auto', backgroundColor: '#f8fafc', color: '#1a1a1a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setIsSetupComplete(false)} style={{ backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Settings size={18} /> {t('tourn.settings')}
                </button>
                <button onClick={exportAsImage} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={18} /> {t('tourn.export')}
                </button>
                <button onClick={exportBracketJson} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={18} /> {t('tourn.save')}
                </button>
              </div>
              <h2 style={{ margin: 0, textTransform: 'uppercase', fontWeight: 900, fontSize: '2rem' }}>
                {t('tourn.bracket')}
              </h2>
            </div>

            {format === 'single' ? (
              <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                <canvas 
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  style={{ cursor: hoveredNode, maxWidth: '100%', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>
                [ {format.toUpperCase()} Bracket UI will be built in the future. Switch to Single Elimination in {t('tourn.settings')}. ]
              </div>
            )}
          </div>
        </div>
      )}

      {mapPickerTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }} onClick={() => setMapPickerTarget(null)}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '12px', width: '80%', maxWidth: '800px', maxHeight: '80%', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'white', marginTop: 0 }}>{t('tourn.map.select')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {availableMaps.map(map => (
                <div key={map.id} 
                     onClick={() => {
                        setMatchMaps(prev => ({ ...prev, [`${mapPickerTarget.r}-${mapPickerTarget.matchIndex}`]: map.name }));
                        setMapPickerTarget(null);
                     }}
                     style={{ cursor: 'pointer', textAlign: 'center', padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                  <img src={map.image} alt={map.name} style={{ width: '100%', height: 'auto', marginBottom: '0.5rem', opacity: 0.8 }} />
                  <div style={{ color: 'white', fontWeight: 'bold' }}>{map.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tournament;



