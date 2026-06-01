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
const REDEEM_FILE  = path.join(DATA_DIR, 'redeem.json');

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
ensureFile(REDEEM_FILE, '{}');

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

// === PROFANITY FILTER ===
// Sensurerer dårlige ord på norsk og engelsk
const BAD_WORDS = [
  // English
  'fuck','shit','bitch','asshole','dick','pussy','cunt','bastard','slut','whore',
  'nigger','nigga','faggot','retard','wanker','prick','douche','motherfucker',
  // Norwegian
  'faen','fitte','kuk','jævla','jævel','jevla','jevel','dritt','drittsekk',
  'fitta','fittetryne','homo','homse','hore','kjerring','tispe','niggern','negerjente',
  'merrr','negar','rævhol','rævhull','rævhøl','pikk','pikkhode','idiot','idiotisk',
  'neger','satan','helvete'
];
function censorText(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  for (const word of BAD_WORDS) {
    // Tillat mellomrom og vanlige bypass-tegn (. - _ * /) mellom hver bokstav
    // Eks: "f a e n", "f.a.e.n", "f-a-e-n" blir også sensurert
    const pattern = word.split('').map(c => {
      return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('[\\s.\\-_*\\/]*');
    const re = new RegExp(pattern, 'gi');
    result = result.replace(re, (match) => '*'.repeat(match.length));
  }
  return result;
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
    bestPokemonId:   parseInt(d.bestPokemonId) || 0,
    bestPokemonName: (d.bestPokemonName || '').slice(0, 50),
    bestPokemonCp:   parseInt(d.bestPokemonCp) || 0,
    bestPokemonShiny: !!d.bestPokemonShiny,
    character:       d.character || null,
    lastUpdated: new Date().toISOString().slice(0, 19),
    lastUpdatedMs: Date.now()
  };
  writeJson(SCORES_FILE, scores);
  res.json({ ok: true });
});

app.get('/api/leaderboard', (req, res) => {
  // Returner ALLE registrerte brukere — selv om de ikke har spilt.
  // Slik beholder vi alle spillere på leaderboarden for evig.
  const scores = readJson(SCORES_FILE, {});
  const users = readJson(USERS_FILE, {});
  const merged = { ...scores };
  for (const username of Object.keys(users)) {
    if (!merged[username]) {
      // Bruker som finnes men aldri har sendt score — vis med 0-stats
      merged[username] = {
        totalCaught: 0, shinies: 0, uniqueSeen: 0, coins: 0,
        lastPokemonId: 0, lastPokemonName: '', lastShiny: false,
        buddyId: 0, buddyName: '', buddyCatches: 0, buddyCp: 0, buddyShiny: false,
        bestPokemonId: 0, bestPokemonName: '', bestPokemonCp: 0, bestPokemonShiny: false,
        character: null,
        lastUpdated: 'never',
        lastUpdatedMs: 0,
        neverPlayed: true
      };
    }
  }
  res.json(merged);
});

// === CHEAT: gi penger til en bestemt bruker (kun med riktig cheat-kode) ===
app.post('/api/cheat/give', (req, res) => {
  const d = req.body || {};
  const code = String(d.code || '');
  const target = (d.targetUsername || '').trim();
  const amount = parseInt(d.amount) || 0;
  // Ny owner-kode (de gamle ble lekket) + sjekk at avsender er eier
  const sender = (d.senderUsername || '').trim();
  const OWNER = 'kasperhallo0';
  if (sender !== OWNER) {
    return res.status(403).json({ ok: false, error: 'Only the owner can use this cheat' });
  }
  if (code !== '5694') {
    return res.status(403).json({ ok: false, error: 'Invalid cheat code' });
  }
  if (!target) return res.status(400).json({ ok: false, error: 'No target username' });
  if (amount === 0) return res.status(400).json({ ok: false, error: 'Amount cannot be 0' });
  const users = readJson(USERS_FILE, {});
  if (!users[target]) return res.status(404).json({ ok: false, error: 'User not found on server' });
  try {
    const userState = users[target].state ? JSON.parse(users[target].state) : {};
    userState.coins = Math.max(0, (userState.coins || 0) + amount);
    users[target].state = JSON.stringify(userState);
    writeJson(USERS_FILE, users);
    // Oppdater også leaderboard-coins så det vises umiddelbart
    const scores = readJson(SCORES_FILE, {});
    if (scores[target]) {
      scores[target].coins = userState.coins;
      writeJson(SCORES_FILE, scores);
    }
    res.json({ ok: true, newCoins: userState.coins, given: amount });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === SLETT EN BRUKERKONTO (kun owner) ===
app.post('/api/cheat/delete-user', (req, res) => {
  const d = req.body || {};
  const code = String(d.code || '');
  const target = (d.targetUsername || '').trim();
  const sender = (d.senderUsername || '').trim();
  const OWNER = 'kasperhallo0';
  if (sender !== OWNER) {
    return res.status(403).json({ ok: false, error: 'Kun owner kan bruke denne koden' });
  }
  if (code !== '6741') {
    return res.status(403).json({ ok: false, error: 'Ugyldig kode' });
  }
  if (!target) return res.status(400).json({ ok: false, error: 'Ingen target' });
  if (target === OWNER) return res.status(400).json({ ok: false, error: 'Kan ikke slette eier-kontoen' });
  // Slett fra users.json
  const users = readJson(USERS_FILE, {});
  if (!users[target]) return res.status(404).json({ ok: false, error: 'Brukeren finnes ikke' });
  delete users[target];
  writeJson(USERS_FILE, users);
  // Slett fra scores.json
  const scores = readJson(SCORES_FILE, {});
  if (scores[target]) {
    delete scores[target];
    writeJson(SCORES_FILE, scores);
  }
  res.json({ ok: true, deleted: target });
});

// === DELTE ENGANGS-KODER (alle kan bruke, men hver bruker kun én gang per kode) ===
// Disse 10 kodene gir 500 000 coins hver. Alle brukere kan løse inn hver kode,
// men kun ÉN gang per konto per kode.
const ONE_TIME_GLOBAL_CODES = {
  '384721': 500000,
  '105693': 500000,
  '627840': 500000,
  '459127': 500000,
  '738205': 500000,
  '916384': 500000,
  '253079': 500000,
  '681492': 500000,
  '547361': 500000,
  '873150': 500000
};

app.post('/api/cheat/onetime', (req, res) => {
  const d = req.body || {};
  const code = String(d.code || '').trim();
  const username = (d.username || '').trim();
  if (!code) return res.status(400).json({ ok: false, error: 'No code' });
  if (!username) return res.status(400).json({ ok: false, error: 'No username' });
  if (!(code in ONE_TIME_GLOBAL_CODES)) {
    return res.status(404).json({ ok: false, error: 'Ugyldig kode' });
  }
  // Redeem-struktur: { code: { users: { username1: {...}, username2: {...} } } }
  // Sjekk om DENNE brukeren allerede har brukt koden
  const redeemed = readJson(REDEEM_FILE, {});
  if (!redeemed[code]) redeemed[code] = { users: {} };
  // Backward-compat: hvis gammel struktur uten "users", konverter
  if (!redeemed[code].users) {
    if (redeemed[code].username) {
      redeemed[code] = { users: { [redeemed[code].username]: { amount: redeemed[code].amount, claimedAt: redeemed[code].claimedAt } } };
    } else {
      redeemed[code] = { users: {} };
    }
  }
  if (redeemed[code].users[username]) {
    return res.status(409).json({
      ok: false,
      error: 'Du har allerede brukt denne koden! (Hver bruker kan kun bruke hver kode én gang)'
    });
  }
  const users = readJson(USERS_FILE, {});
  if (!users[username]) return res.status(404).json({ ok: false, error: 'Brukerkonto finnes ikke på serveren (sync først)' });
  const amount = ONE_TIME_GLOBAL_CODES[code];
  try {
    const userState = users[username].state ? JSON.parse(users[username].state) : {};
    userState.coins = Math.max(0, (userState.coins || 0) + amount);
    users[username].state = JSON.stringify(userState);
    writeJson(USERS_FILE, users);
    // Oppdater også leaderboard
    const scores = readJson(SCORES_FILE, {});
    if (scores[username]) {
      scores[username].coins = userState.coins;
      writeJson(SCORES_FILE, scores);
    }
    // Marker at DENNE brukeren har brukt koden (andre kan fortsatt bruke den)
    redeemed[code].users[username] = { amount, claimedAt: new Date().toISOString() };
    writeJson(REDEEM_FILE, redeemed);
    res.json({ ok: true, amount, newCoins: userState.coins });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
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
  const msg  = censorText((d.message || '').trim().slice(0, 500));
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

// === INDIVIDUAL TRADES — bytt spesifikke individer med CP ===

// Hent en spillers individer (for å vise på trade-skjermen)
app.get('/api/user/individuals', (req, res) => {
  const u = (req.query.username || '').trim();
  if (!u) return res.json({ individuals: [] });
  const users = readJson(USERS_FILE, {});
  if (!users[u] || !users[u].state) return res.json({ individuals: [] });
  try {
    const st = JSON.parse(users[u].state);
    const inds = Array.isArray(st.individuals) ? st.individuals : [];
    // Returner forenklet liste (uid, id, name, cp, isShiny, eventType, type, rarity)
    res.json({
      individuals: inds.map(i => ({
        uid: i.uid, id: i.id, name: i.name, cp: i.cp,
        isShiny: !!i.isShiny, eventType: i.eventType || null,
        type: i.type || 'Normal', rarity: i.rarity || 'common'
      }))
    });
  } catch {
    res.json({ individuals: [] });
  }
});

// Send individuelt trade-tilbud
app.post('/api/trade/ind/send', (req, res) => {
  const d = req.body || {};
  const from = (d.from || '').trim();
  const to   = (d.to   || '').trim();
  const offer = d.offer || null;  // { uid, id, name, cp, isShiny, ... }
  const want  = d.want  || null;
  if (!from || !to || from === to || !offer || !want) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }
  const trades = readJson(TRADES_FILE, []);
  const newTrade = {
    id: crypto.randomUUID(),
    kind: 'individual',
    from, to,
    offer, want,
    status: 'pending',
    created: new Date().toISOString().slice(0, 19)
  };
  trades.push(newTrade);
  writeJson(TRADES_FILE, trades);
  res.json({ ok: true, trade: newTrade });
});

// Aksepter/avslå individuelt trade. Ved accept: bytt individer mellom brukerne.
app.post('/api/trade/ind/respond', (req, res) => {
  const { id, action, username } = req.body || {};
  const trades = readJson(TRADES_FILE, []);
  const t = trades.find(x => x && x.id === id && x.kind === 'individual' && x.to === username && x.status === 'pending');
  if (!t) return res.status(404).json({ ok: false, error: 'Trade not found' });

  if (action === 'decline') {
    t.status = 'declined';
    writeJson(TRADES_FILE, trades);
    return res.json({ ok: true, trade: t });
  }

  // accept: validér og swap
  const users = readJson(USERS_FILE, {});
  if (!users[t.from] || !users[t.to]) {
    t.status = 'failed';
    t.error = 'User missing on server';
    writeJson(TRADES_FILE, trades);
    return res.status(400).json({ ok: false, error: 'User missing on server' });
  }
  let stFrom, stTo;
  try { stFrom = JSON.parse(users[t.from].state || '{}'); stTo = JSON.parse(users[t.to].state || '{}'); }
  catch {
    t.status = 'failed'; writeJson(TRADES_FILE, trades);
    return res.status(500).json({ ok: false, error: 'Could not read state' });
  }
  stFrom.individuals = Array.isArray(stFrom.individuals) ? stFrom.individuals : [];
  stTo.individuals   = Array.isArray(stTo.individuals)   ? stTo.individuals   : [];

  const fromIdx = stFrom.individuals.findIndex(i => i.uid === t.offer.uid);
  const toIdx   = stTo.individuals.findIndex(i => i.uid === t.want.uid);
  if (fromIdx === -1 || toIdx === -1) {
    t.status = 'failed';
    t.error = 'One of the Pokémon is no longer available';
    writeJson(TRADES_FILE, trades);
    return res.status(409).json({ ok: false, error: t.error });
  }

  // Faktisk swap
  const fromInd = stFrom.individuals[fromIdx];
  const toInd   = stTo.individuals[toIdx];
  stFrom.individuals.splice(fromIdx, 1);
  stTo.individuals.splice(toIdx, 1);
  stFrom.individuals.push(toInd);
  stTo.individuals.push(fromInd);

  users[t.from].state = JSON.stringify(stFrom);
  users[t.to].state   = JSON.stringify(stTo);
  writeJson(USERS_FILE, users);

  t.status = 'accepted';
  writeJson(TRADES_FILE, trades);
  res.json({ ok: true, trade: t });
});

// === ACCOUNTS ===
app.post('/api/account/create', (req, res) => {
  const { username, password } = req.body || {};
  const u = (username || '').trim();
  const p = password || '';
  if (!u || u.length > 30 || p.length < 3) {
    return res.status(400).json({ ok: false, error: 'Invalid username or password' });
  }
  // Blokker stygge ord i brukernavn
  if (censorText(u) !== u) {
    return res.status(400).json({ ok: false, error: 'Username contains banned words' });
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
  const m = censorText((message || '').trim().slice(0, 500));
  if (!u || !m) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const messages = readJson(CHAT_FILE, []);
  messages.push({
    id: crypto.randomUUID(),
    username: censorText(u),
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

// ===== PVP BATTLE — sanntid spiller-mot-spiller =====
function cleanupPvpRooms(battles) {
  const now = Date.now();
  for (const [code, b] of Object.entries(battles)) {
    // Slett rom etter 15 min inaktivitet, eller 60 sek etter 'done'
    if (now - (b.lastUpdate || 0) > 900000) delete battles[code];
    else if (b.status === 'done' && now - (b.lastUpdate || 0) > 60000) delete battles[code];
  }
}

// Belønn vinneren med begge innsatsene
function pvpAwardWinner(battle) {
  if (!battle || !battle.winner || !battle.bet) return;
  if (battle.payoutDone) return; // unngå dobbel utbetaling
  const payout = battle.bet * 2;
  try {
    const users = readJson(USERS_FILE, {});
    if (users[battle.winner]) {
      const ws = JSON.parse(users[battle.winner].state || '{}');
      ws.coins = (ws.coins || 0) + payout;
      users[battle.winner].state = JSON.stringify(ws);
      writeJson(USERS_FILE, users);
      // Oppdater også leaderboard
      const scores = readJson(SCORES_FILE, {});
      if (scores[battle.winner]) {
        scores[battle.winner].coins = ws.coins;
        writeJson(SCORES_FILE, scores);
      }
    }
  } catch (e) { console.warn('pvp payout failed:', e.message); }
  battle.payoutDone = true;
  battle.payout = payout;
}

function readBattles() {
  const b = readJson(BATTLES_FILE, {});
  // Hvis filen var et array fra før, konverter
  return (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
}

// Bygg team-array fra request, validér 1-3 Pokémon
function buildTeam(arr) {
  if (!Array.isArray(arr)) return null;
  const team = arr.slice(0, 3).map(p => {
    const id = parseInt(p.id) || 0;
    const name = (p.name || '').toString().slice(0, 40) || 'Pokémon';
    const cp = parseInt(p.cp) || 100;
    const isShiny = !!p.isShiny;
    if (!id) return null;
    const maxHp = Math.max(20, cp * 2);
    return { id, name, cp, hp: maxHp, maxHp, isShiny };
  }).filter(Boolean);
  return team.length > 0 ? team : null;
}

app.post('/api/pvp/create', (req, res) => {
  const d = req.body || {};
  const username = (d.username || '').trim();
  const team = buildTeam(d.team);
  const bet = Math.max(0, parseInt(d.bet) || 0);
  if (!username || !team) return res.status(400).json({ ok: false, error: 'Missing fields or team' });
  if (bet > 0) {
    const users = readJson(USERS_FILE, {});
    if (!users[username]) return res.status(404).json({ ok: false, error: 'Your account is not on server (sync first)' });
    try {
      const hostState = JSON.parse(users[username].state || '{}');
      if ((hostState.coins || 0) < bet) return res.status(400).json({ ok: false, error: `Not enough coins (need ${bet}, have ${hostState.coins || 0})` });
      hostState.coins -= bet;
      users[username].state = JSON.stringify(hostState);
      writeJson(USERS_FILE, users);
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Could not deduct bet' });
    }
  }
  const battles = readBattles();
  cleanupPvpRooms(battles);
  for (const [code, b] of Object.entries(battles)) {
    if (b.host === username && b.status !== 'active') delete battles[code];
  }
  let code;
  do { code = Math.floor(1000 + Math.random() * 9000).toString(); } while (battles[code]);
  battles[code] = {
    host: username,
    hostTeam: team,
    hostActive: 0,
    guest: null,
    guestTeam: null,
    guestActive: 0,
    status: 'waiting',
    bet,
    createdAt: Date.now(),
    lastUpdate: Date.now()
  };
  writeJson(BATTLES_FILE, battles);
  res.json({ ok: true, code, bet });
});

app.post('/api/pvp/join', (req, res) => {
  const d = req.body || {};
  const code = (d.code || '').trim();
  const username = (d.username || '').trim();
  const team = buildTeam(d.team);
  const battles = readBattles();
  cleanupPvpRooms(battles);
  if (!battles[code]) return res.status(404).json({ ok: false, error: 'Room not found or expired' });
  const b = battles[code];
  if (b.guest) return res.status(409).json({ ok: false, error: 'Room is full' });
  if (b.host === username) return res.status(409).json({ ok: false, error: 'Cannot join your own room' });
  if (b.status !== 'waiting') return res.status(409).json({ ok: false, error: 'Room is not open' });
  if (!team) return res.status(400).json({ ok: false, error: 'Missing team' });
  const bet = b.bet || 0;
  if (bet > 0) {
    const users = readJson(USERS_FILE, {});
    if (!users[username]) return res.status(404).json({ ok: false, error: 'Your account is not on server (sync first)' });
    try {
      const guestState = JSON.parse(users[username].state || '{}');
      if ((guestState.coins || 0) < bet) return res.status(400).json({ ok: false, error: `Not enough coins for bet (need ${bet}, have ${guestState.coins || 0})` });
      guestState.coins -= bet;
      users[username].state = JSON.stringify(guestState);
      writeJson(USERS_FILE, users);
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Could not deduct bet' });
    }
  }
  b.guest = username;
  b.guestTeam = team;
  b.guestActive = 0;
  b.status = 'active';
  b.startedAt = Date.now();
  b.lastUpdate = Date.now();
  writeJson(BATTLES_FILE, battles);
  res.json({ ok: true, battle: b });
});

app.get('/api/pvp/state', (req, res) => {
  const code = (req.query.code || '').trim();
  const battles = readBattles();
  if (!battles[code]) return res.json({ ok: false, error: 'not_found' });
  res.json({ ok: true, battle: battles[code] });
});

app.post('/api/pvp/attack', (req, res) => {
  const d = req.body || {};
  const code = (d.code || '').trim();
  const username = (d.username || '').trim();
  const dmg = Math.max(1, parseInt(d.dmg) || 1);
  const battles = readBattles();
  if (!battles[code]) return res.status(404).json({ ok: false });
  const b = battles[code];
  if (b.status !== 'active') return res.status(400).json({ ok: false, error: 'not_active' });
  const now = Date.now();
  const readyAt = (b.startedAt || now) + 3000;
  if (now < readyAt) return res.status(400).json({ ok: false, error: 'wait_countdown', readyAt });

  // Hvem angriper, og hvem blir truffet?
  let targetTeam, targetActiveKey, ownerOfTarget;
  if (b.host === username) {
    targetTeam = b.guestTeam;
    targetActiveKey = 'guestActive';
    ownerOfTarget = 'guest';
  } else if (b.guest === username) {
    targetTeam = b.hostTeam;
    targetActiveKey = 'hostActive';
    ownerOfTarget = 'host';
  } else {
    return res.status(403).json({ ok: false });
  }
  if (!targetTeam) return res.status(400).json({ ok: false, error: 'no_team' });

  const idx = b[targetActiveKey] || 0;
  const target = targetTeam[idx];
  if (!target || target.hp <= 0) return res.status(400).json({ ok: false, error: 'already_fainted' });
  target.hp = Math.max(0, target.hp - dmg);

  // Hvis denne fainted: avanser til neste Pokémon i laget
  if (target.hp <= 0) {
    // Finn neste ikke-fainted index
    let nextIdx = -1;
    for (let i = idx + 1; i < targetTeam.length; i++) {
      if (targetTeam[i].hp > 0) { nextIdx = i; break; }
    }
    if (nextIdx === -1) {
      // Alle 3 har fainted — kamp slutt
      b.status = 'done';
      b.winner = username;
      pvpAwardWinner(b);
    } else {
      b[targetActiveKey] = nextIdx;
    }
  }

  b.lastUpdate = Date.now();
  writeJson(BATTLES_FILE, battles);
  res.json({ ok: true, battle: b });
});

app.post('/api/pvp/leave', (req, res) => {
  const d = req.body || {};
  const code = (d.code || '').trim();
  const username = (d.username || '').trim();
  const battles = readBattles();
  if (battles[code]) {
    const b = battles[code];
    if (b.status === 'waiting' && b.host === username) {
      // Refunder innsats hvis ingen joined enda
      if (b.bet > 0) {
        try {
          const users = readJson(USERS_FILE, {});
          if (users[username]) {
            const us = JSON.parse(users[username].state || '{}');
            us.coins = (us.coins || 0) + b.bet;
            users[username].state = JSON.stringify(us);
            writeJson(USERS_FILE, users);
          }
        } catch {}
      }
      delete battles[code];
    } else if (b.status === 'active') {
      // Den som forlater taper, motstander vinner og får utbetaling
      b.status = 'done';
      b.winner = b.host === username ? b.guest : b.host;
      b.lastUpdate = Date.now();
      pvpAwardWinner(b);
    }
    writeJson(BATTLES_FILE, battles);
  }
  res.json({ ok: true });
});

app.get('/api/pvp/list', (req, res) => {
  const battles = readBattles();
  cleanupPvpRooms(battles);
  writeJson(BATTLES_FILE, battles);
  const rooms = Object.entries(battles)
    .filter(([_, b]) => b.status === 'waiting')
    .map(([code, b]) => ({
      code,
      host: b.host,
      hostTeam: (b.hostTeam || []).map(p => ({ id: p.id, name: p.name, cp: p.cp, isShiny: p.isShiny })),
      bet: b.bet || 0
    }));
  res.json({ rooms });
});

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
