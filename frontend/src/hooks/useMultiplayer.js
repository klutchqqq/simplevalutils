import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

const generateRoomCode = (length = 5) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const useMultiplayer = () => {
  const [peer, setPeer] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [roomCodes, setRoomCodes] = useState(null); // { teamA, teamB, guest }
  const [role, setRole] = useState(null); // 'Host', 'Team A', 'Team B', 'Guest'
  const [connectedCaptains, setConnectedCaptains] = useState({ 'Team A': false, 'Team B': false });
  const [networkState, setNetworkState] = useState(null);
  const [networkEvents, setNetworkEvents] = useState([]);
  const [error, setError] = useState('');
  
  const connectionsRef = useRef({}); // For Host to keep track of ALL connections: peerId -> { conn, role }
  const hostConnectionRef = useRef(null); // For Captain to keep track of Host connection

  // Helper to process incoming messages
  const handleIncomingData = (data, conn, currentRoomCodes) => {
    if (data.type === 'IDENTIFY_V2') {
      let assignedRole = null;
      if (currentRoomCodes && data.token === currentRoomCodes.teamA) assignedRole = 'Team A';
      else if (currentRoomCodes && data.token === currentRoomCodes.teamB) assignedRole = 'Team B';
      else if (currentRoomCodes && data.token === currentRoomCodes.guest) assignedRole = 'Guest';
      
      if (assignedRole) {
        connectionsRef.current[conn.peer] = { conn, role: assignedRole };
        if (assignedRole === 'Team A' || assignedRole === 'Team B') {
          setConnectedCaptains(prev => ({ ...prev, [assignedRole]: true }));
        }
        conn.send({ type: 'ROLE_ASSIGNED', role: assignedRole });
      } else {
        conn.send({ type: 'ERROR', message: 'Invalid Room Code' });
      }
    } else if (data.type === 'ROLE_ASSIGNED') {
      setRole(data.role);
    } else if (data.type === 'ERROR') {
      setError(data.message);
    } else if (data.type === 'STATE_SYNC') {
      setNetworkState(data.state);
    } else if (data.type === 'ACTION') {
      setNetworkEvents(prev => [...prev, data.action]);
    }
  };

  const initHost = () => {
    const code = generateRoomCode(5);
    const tokenA = generateRoomCode(4);
    const tokenB = generateRoomCode(4);
    const tokenG = generateRoomCode(4);
    
    const generatedCodes = {
       teamA: `${code}-${tokenA}`,
       teamB: `${code}-${tokenB}`,
       guest: `${code}-${tokenG}`
    };
    
    const newPeer = new Peer(`valoutils-host-${code}`);
    
    newPeer.on('open', (id) => {
      setRoomId(code);
      setRoomCodes(generatedCodes);
      setRole('Host');
      setPeer(newPeer);
    });

    newPeer.on('connection', (conn) => {
      conn.on('data', (data) => handleIncomingData(data, conn, generatedCodes));
      conn.on('close', () => {
        const client = connectionsRef.current[conn.peer];
        if (client) {
           if (client.role === 'Team A' || client.role === 'Team B') {
              setConnectedCaptains(prev => ({ ...prev, [client.role]: false }));
           }
           delete connectionsRef.current[conn.peer];
        }
      });
    });

    newPeer.on('error', (err) => {
      setError(err.message);
    });
  };

  const joinRoom = (fullCode) => {
    if (!fullCode || !fullCode.includes('-')) {
       setError('Invalid code format. Expected ROOM-TOKEN');
       return;
    }
    const [hostId, token] = fullCode.split('-');
    const newPeer = new Peer();
    
    newPeer.on('open', (id) => {
      const conn = newPeer.connect(`valoutils-host-${hostId}`);
      
      conn.on('open', () => {
        hostConnectionRef.current = conn;
        setRoomId(hostId);
        setPeer(newPeer);
        
        // Identify ourselves to the host with the full code token
        conn.send({ type: 'IDENTIFY_V2', token: fullCode });
      });

      conn.on('data', (data) => handleIncomingData(data, conn, null));
      
      conn.on('close', () => {
        setError('Host disconnected.');
        hostConnectionRef.current = null;
      });
    });

    newPeer.on('error', (err) => {
      setError(err.message);
    });
  };

  const broadcastState = (state) => {
    if (role !== 'Host') return;
    const payload = { type: 'STATE_SYNC', state };
    Object.values(connectionsRef.current).forEach(client => {
       if (client && client.conn) {
          client.conn.send(payload);
       }
    });
  };

  const sendAction = (action) => {
    if (role === 'Host') {
      // Host actions execute locally immediately
      setNetworkEvents(prev => [...prev, action]);
    } else {
      // Captains send to host
      if (hostConnectionRef.current) {
        hostConnectionRef.current.send({ type: 'ACTION', action });
      }
    }
  };

  const popNetworkEvent = () => {
    if (networkEvents.length > 0) {
      const event = networkEvents[0];
      setNetworkEvents(prev => prev.slice(1));
      return event;
    }
    return null;
  };

  const disconnect = () => {
    if (peer) {
      peer.destroy();
    }
    setPeer(null);
    setRoomId('');
    setRole(null);
    setConnectedCaptains({ 'Team A': false, 'Team B': false });
    connectionsRef.current = {};
    hostConnectionRef.current = null;
  };

  return {
    initHost,
    joinRoom,
    broadcastState,
    sendAction,
    popNetworkEvent,
    disconnect,
    connectedCaptains,
    roomId,
    roomCodes,
    role,
    networkState,
    networkEvents,
    error,
    clearError: () => setError('')
  };
};

