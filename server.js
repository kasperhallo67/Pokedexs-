// Pokemon Samler - Node.js / Express server
// Erstatter server.ps1 for å kunne deployes til skytjenester (Render, Railway, etc.)

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8765;
const DATA_DIR = process.env.DATA_DIR || __dirname;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

// === DATA FILES ===
const SCORES_FILE  = path.join(DATA_DIR, 'scores.json');
const TRADES_FILE  = path.join(DATA_DIR, 'trades.json');
const USERS_FILE   = path.join(DATA_DIR, 'users.json');
const POKER_FILE   = path.join(DATA_DIR, 'poker.json');
const BATTLES_FILE = path.join(DATA_DIR, 'battles.json');
const CHAT_FILE    = path.join(DATA_DIR, 'chat.json');
const DM_FILE      = path.join(DATA_DIR, 'dm.json');

function ensureFile(file, defaultContent) {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, defaultContent);
  } catch (e) {
    console.error('Could not init file', file, e.message);
  }
}
ensureFile(SCORES_FILE, '{}');
ensureFile(TRADES_FILE, '[]');
ensureFile(USERS_FILE, '{}');
ensureFile(POKER_FILE, '{}');
ensureFile(BATTLES_FILE, '[]');
ensureFile(CHAT_FILE, '[]');
ensureFile(DM_FILE, '[]');

function readJson(file, def) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw && raw.trim() ? JSON.parse(raw) : def;
  } catch (e) {
    console.warn('Read error', file, e.message);
    return def;
  }
}
function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Write error', file, e.message);
  }
}

// CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// === SCORES ===
app.post('/api/score', (req, res) => {
  const d = req.body || {};
  const username = (d.username || '').trim();
  if (!username || username.length > 30) {
    return res.status(400).json({ ok: false, error: 'invalid username' });
  }
  const scores = readJson(SCORES_FILE, {});
  scores[username] = {
    totalCaught: parseInt(d.totalCaught) || 0,
    shinies:     parseInt(d.shinies)     || 0,
    uniqueSeen:  parseInt(d.uniqueSeen)  || 0,
    coins:       parseInt(d.coins)       || 0,
    lastPokemonId:   parseInt(d.lastPokemonId) || 0,
    lastPokemonName: (d.lastPokemonName || '').slice(0, 50),
    lastShiny:       !!d.lastShiny,
    buddyId:         parseInt(d.buddyId) || 0,
    buddyName:       (d.buddyName || '').slice(0, 50),
    buddyCatches:    parseInt(d.buddyCatches) || 0,
    buddyCp:         parseInt(d.buddyCp) || 0,
    buddyShiny:      !!d.buddyShiny,
    character:       d.character || null,
    lastUpdated: new Date().toISOString().slice(0, 19),
    lastUpdatedMs: Date.now()
  };
  writeJson(SCORES_FILE, scores);
  res.json({ ok: true });
});

app.get('/api/leaderboard', (req, res) => {
  res.json(readJson(SCORES_FILE, {}));
});

// Online players (active in last 90 sek)
app.get('/api/online', (req, res) => {
  const scores = readJson(SCORES_FILE, {});
  const now = Date.now();
  const online = {};
  for (const [name, data] of Object.entries(scores)) {
    const lastMs = data.lastUpdatedMs || new Date(data.lastUpdated || 0).getTime();
    if (now - lastMs < 90000) {
      online[name] = data;
    }
  }
  res.json(online);
});

// === DIRECT MESSAGES ===
app.post('/api/dm/send', (req, res) => {
  const d = req.body || {};
  const from = (d.from || '').trim();
  const to   = (d.to   || '').trim();
  const msg  = (d.message || '').trim().slice(0, 500);
  if (!from || !to || !msg) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const messages = readJson(DM_FILE, []);
  messages.push({
    id: crypto.randomUUID(),
    from, to, message: msg,
    time: new Date().toISOString()
  });
  if (messages.length > 1000) messages.splice(0, messages.length - 1000);
  writeJson(DM_FILE, messages);
  res.json({ ok: true });
});

app.get('/api/dm/messages', (req, res) => {
  const u1 = (req.query.user1 || '').trim();
  const u2 = (req.query.user2 || '').trim();
  if (!u1 || !u2) return res.json([]);
  const messages = readJson(DM_FILE, []);
  res.json(messages.filter(m =>
    (m.from === u1 && m.to === u2) || (m.from === u2 && m.to === u1)
  ));
});

app.get('/api/dm/all', (req, res) => {
  const u = (req.query.username || '').trim();
  const messages = readJson(DM_FILE, []);
  res.json(messages.filter(m => m.from === u || m.to === u));
});

// === TRADES ===
app.post('/api/trade/send', (req, res) => {
  const d = req.body || {};
  const from = (d.from || '').trim();
  const to   = (d.to   || '').trim();
  if (!from || !to || from === to) {
    return res.status(400).json({ ok: false, error: 'invalid usernames' });
  }
  const trades = readJson(TRADES_FILE, []);
  const newTrade = {
    id:         crypto.randomUUID(),
    from, to,
    offerId:    parseInt(d.offerId)   || 0,
    offerName:  d.offerName  || '',
    offerShiny: !!d.offerShiny,
    wantId:     parseInt(d.wantId)    || 0,
    wantName:   d.wantName   || '',
    wantShiny:  !!d.wantShiny,
    status:     'pending',
    created:    new Date().toISOString().slice(0, 19)
  };
  trades.push(newTrade);
  writeJson(TRADES_FILE, trades);
  res.json({ ok: true, trade: newTrade });
});

app.get('/api/trade/inbox', (req, res) => {
  const user = (req.query.username || '').trim();
  const trades = readJson(TRADES_FILE, []);
  res.json(trades.filter(t => t && (t.to === user || t.from === user)));
});

app.post('/api/trade/respond', (req, res) => {
  const { id, action, username } = req.body || {};
  const trades = readJson(TRADES_FILE, []);
  let found = null;
  for (const t of trades) {
    if (t && t.id === id && t.to === username && t.status === 'pending') {
      t.status = action === 'accept' ? 'accepted' : 'declined';
      found = t;
      break;
    }
  }
  if (found) {
    writeJson(TRADES_FILE, trades);
    res.json({ ok: true, trade: found });
  } else {
    res.status(404).json({ ok: false, error: 'trade not found' });
  }
});

app.post('/api/trade/ack', (req, res) => {
  const { id } = req.body || {};
  const trades = readJson(TRADES_FILE, []).filter(t => t && t.id !== id);
  writeJson(TRADES_FILE, trades);
  res.json({ ok: true });
});

// === ACCOUNTS ===
app.post('/api/account/create', (req, res) => {
  const { username, password } = req.body || {};
  const u = (username || '').trim();
  const p = password || '';
  if (!u || u.length > 30 || p.length < 3) {
    return res.status(400).json({ ok: false, error: 'Invalid username or password' });
  }
  const users = readJson(USERS_FILE, {});
  if (users[u]) {
    return res.status(409).json({ ok: false, error: 'Username already exists' });
  }
  users[u] = { password: p, state: null };
  writeJson(USERS_FILE, users);
  res.json({ ok: true });
});

app.post('/api/account/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = (username || '').trim();
  const users = readJson(USERS_FILE, {});
  if (!users[u]) return res.status(404).json({ ok: false, error: 'User not found' });
  if (users[u].password !== password) return res.status(401).json({ ok: false, error: 'Wrong password' });
  res.json({ ok: true, state: users[u].state });
});

app.post('/api/account/sync', (req, res) => {
  const { username, password, state } = req.body || {};
  const u = (username || '').trim();
  const users = readJson(USERS_FILE, {});
  if (!users[u]) {
    // Auto-register if doesn't exist
    users[u] = { password: password || '', state: state || null };
    writeJson(USERS_FILE, users);
    return res.json({ ok: true, created: true });
  }
  if (users[u].password !== password) return res.status(401).json({ ok: false, error: 'Wrong password' });
  users[u].state = state || null;
  writeJson(USERS_FILE, users);
  res.json({ ok: true });
});

// Hent en annen brukers samling (for trading - bare se hvilke Pokémon de har)
app.get('/api/user/collection', (req, res) => {
  const u = (req.query.username || '').trim();
  if (!u) return res.json({ caught: {}, shinies: {}, seen: {} });
  const users = readJson(USERS_FILE, {});
  if (!users[u] || !users[u].state) return res.json({ caught: {}, shinies: {}, seen: {} });
  try {
    const s = JSON.parse(users[u].state);
    res.json({
      caught: s.caught || {},
      shinies: s.shinies || {},
      seen: s.seen || {}
    });
  } catch (e) {
    res.json({ caught: {}, shinies: {}, seen: {} });
  }
});

// === POKER ROOMS ===
function processPokerRound(room) {
  // Texas-mode: nothing to process here; advance is separate
  return room;
}

app.post('/api/poker/create', (req, res) => {
  const d = req.body || {};
  const code = (d.code || '').trim().toUpperCase();
  const username = (d.username || '').trim();
  const bet = parseInt(d.bet) || 0;
  const maxPlayers = parseInt(d.maxPlayers) || 0;
  if (!code || !username || bet < 10 || maxPlayers < 2 || maxPlayers > 5) {
    return res.status(400).json({ ok: false, error: 'Invalid values' });
  }
  const rooms = readJson(POKER_FILE, {});
  if (rooms[code]) return res.status(409).json({ ok: false, error: 'Code already in use' });
  const room = {
    code, creator: username, bet, maxPlayers,
    status: 'lobby',
    players: [username],
    pot: 0, phase: '', seed: 0, round: 0,
    discards: {},
    startedAt: '',
    created: new Date().toISOString().slice(0, 19)
  };
  rooms[code] = room;
  writeJson(POKER_FILE, rooms);
  res.json({ ok: true, room });
});

app.post('/api/poker/join', (req, res) => {
  const { code, username } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const u = (username || '').trim();
  const rooms = readJson(POKER_FILE, {});
  if (!rooms[c]) return res.status(404).json({ ok: false, error: 'Room not found' });
  const room = rooms[c];
  if (room.status !== 'lobby') return res.status(400).json({ ok: false, error: 'Game already started' });
  if (room.players.length >= room.maxPlayers) return res.status(400).json({ ok: false, error: 'Room is full' });
  if (!room.players.includes(u)) {
    room.players.push(u);
    writeJson(POKER_FILE, rooms);
  }
  res.json({ ok: true, room });
});

app.post('/api/poker/start', (req, res) => {
  const { code, username, fillWithBots } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const rooms = readJson(POKER_FILE, {});
  const room = rooms[c];
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  if (room.creator !== username) return res.status(403).json({ ok: false, error: 'Only creator can start' });
  if (room.status !== 'lobby') return res.status(400).json({ ok: false, error: 'Already started' });
  let players = [...room.players];
  if (fillWithBots) {
    const bots = ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave'];
    let i = 0;
    while (players.length < room.maxPlayers && i < bots.length) {
      players.push(bots[i++]);
    }
  }
  if (players.length < 2) return res.status(400).json({ ok: false, error: 'Need at least 2 players (use bots to fill)' });
  room.players = players;
  room.status = 'playing';
  room.phase = 'discard';
  room.seed = Math.floor(Math.random() * 999999999);
  room.pot = room.bet * players.length;
  room.discards = {};
  room.round = 0;
  room.startedAt = new Date().toISOString().slice(0, 19);
  writeJson(POKER_FILE, rooms);
  res.json({ ok: true, room });
});

app.get('/api/poker/room', (req, res) => {
  const c = (req.query.code || '').trim().toUpperCase();
  const rooms = readJson(POKER_FILE, {});
  if (!rooms[c]) return res.status(404).json({ ok: false, error: 'Room not found' });
  res.json({ ok: true, room: rooms[c] });
});

app.post('/api/poker/discard', (req, res) => {
  const { code, username, indices } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const rooms = readJson(POKER_FILE, {});
  const room = rooms[c];
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  if (room.phase !== 'discard') return res.status(400).json({ ok: false, error: 'Not in discard phase' });
  if (!room.discards) room.discards = {};
  room.discards[username] = Array.isArray(indices) ? indices : [];
  // Auto-discard for bots
  for (const p of room.players) {
    if (p.startsWith('Bot ') && !(p in room.discards)) {
      const num = Math.floor(Math.random() * 4);
      const picks = [];
      const available = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, num);
      room.discards[p] = available;
    }
  }
  const allSubmitted = room.players.every(p => p in room.discards);
  if (allSubmitted) room.phase = 'showdown';
  writeJson(POKER_FILE, rooms);
  res.json({ ok: true, room });
});

app.post('/api/poker/advance', (req, res) => {
  // Texas-spesifikt: alle markerer "ready" for neste community-card
  const { code, username } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const rooms = readJson(POKER_FILE, {});
  const room = rooms[c];
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  if (!room.discards) room.discards = {};
  room.discards[username] = [];
  // Auto-ready bots
  for (const p of room.players) {
    if (p.startsWith('Bot ') && !(p in room.discards)) {
      room.discards[p] = [];
    }
  }
  const allReady = room.players.every(p => p in room.discards);
  if (allReady) {
    const currentRound = parseInt(room.round) || 0;
    if (currentRound >= 5) {
      room.phase = 'showdown';
    } else {
      room.round = currentRound + 1;
      room.discards = {};
    }
  }
  writeJson(POKER_FILE, rooms);
  res.json({ ok: true, room });
});

app.post('/api/poker/leave', (req, res) => {
  const { code, username } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const rooms = readJson(POKER_FILE, {});
  const room = rooms[c];
  if (room && room.status === 'lobby') {
    room.players = room.players.filter(p => p !== username);
    if (room.players.length === 0) {
      delete rooms[c];
    } else if (room.creator === username) {
      room.creator = room.players[0];
    }
    writeJson(POKER_FILE, rooms);
  }
  res.json({ ok: true });
});

app.post('/api/poker/close', (req, res) => {
  const { code } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const rooms = readJson(POKER_FILE, {});
  if (rooms[c]) {
    delete rooms[c];
    writeJson(POKER_FILE, rooms);
  }
  res.json({ ok: true });
});

// === CHAT ===
app.post('/api/chat/send', (req, res) => {
  const { username, message } = req.body || {};
  const u = (username || '').trim().slice(0, 30);
  const m = (message  || '').trim().slice(0, 500);
  if (!u || !m) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const messages = readJson(CHAT_FILE, []);
  messages.push({
    id: crypto.randomUUID(),
    username: u,
    message: m,
    time: new Date().toISOString()
  });
  // Keep only last 100 messages
  if (messages.length > 100) messages.splice(0, messages.length - 100);
  writeJson(CHAT_FILE, messages);
  res.json({ ok: true });
});

app.get('/api/chat/messages', (req, res) => {
  res.json(readJson(CHAT_FILE, []));
});

// === LEGACY BATTLE ENDPOINTS (used by older code paths, stubbed) ===
app.get('/api/battle/inbox', (req, res) => res.json([]));

// === Health check ===
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Catch-all: serve index.html for unknown routes (SPA fallback for direct URL access)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎮 Pokemon Samler running on port ${PORT}`);
  console.log(`📂 Data dir: ${DATA_DIR}`);
});
