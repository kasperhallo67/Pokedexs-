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
const BANNED_FILE  = path.join(DATA_DIR, 'banned.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const QUIZ_FILE    = path.join(DATA_DIR, 'quiz.json');

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
ensureFile(BANNED_FILE, '[]');

// === STARTUP: Lag/oppdater Nicolas-konto ===
try {
  const users = readJson(USERS_FILE, {});
  // Bygg 89 shinies (Pokemon ID 1-89 for enkelthet)
  const shinies89 = {};
  const shinySeen89 = {};
  // Bruk ID 1, 4, 7, 25, 133, 150, ..., en blanding av kjente Pokemon
  const niceShinyIds = [
    1, 4, 7, 25, 133, 150, 151, 6, 9, 3,
    26, 38, 65, 78, 89, 94, 130, 131, 134, 135,
    143, 144, 145, 146, 149, 248, 249, 250, 251, 282,
    373, 376, 380, 381, 384, 385, 386, 445, 448, 491,
    493, 643, 644, 646, 647, 649, 654, 658, 681, 706,
    719, 720, 791, 792, 800, 802, 875, 12, 18, 31,
    34, 36, 40, 45, 51, 59, 76, 80, 82, 87,
    97, 101, 105, 108, 110, 113, 115, 121, 124, 125,
    126, 129, 137, 139, 141, 142, 147, 148, 149
  ];
  niceShinyIds.slice(0, 89).forEach(id => {
    shinies89[id] = 1;
    shinySeen89[id] = true;
  });
  if (!users['Nicolas']) {
    const indvIds   = [875,           6,           149,         248,         373,         445,         448,         635,         706,         637,         681];
    const indvNames = ['Eiscue',      'Charizard', 'Dragonite', 'Tyranitar', 'Salamence', 'Garchomp',  'Lucario',   'Hydreigon', 'Goodra',    'Volcarona', 'Aegislash'];
    const cps       = [10000,         7000,        7000,        7000,        7000,        7000,        7000,        7000,        7000,        7000,        7000];
    const rarities  = ['rocket',      'epic',      'epic',      'epic',      'epic',      'epic',      'epic',      'epic',      'epic',      'epic',      'epic'];
    const individuals = indvIds.map((id, i) => ({
      uid: `nic_${i}_${Date.now()}`,
      id, name: i === 0 ? 'Shadow Eiscue' : indvNames[i],
      rarity: rarities[i], cp: cps[i],
      isShiny: i === 0, // Shadow Eiscue er shiny
      eventType: i === 0 ? 'shadow' : null,
      caughtAt: Date.now(), upgrades: 0
    }));
    const seen = {}, caught = {}, bestCp = {};
    // 598 unique seen — ID 1 til 598
    for (let id = 1; id <= 598; id++) {
      seen[id] = true;
      caught[id] = Math.floor(Math.random() * 4) + 1;
    }
    // Sørg for at individuals også er telt
    indvIds.forEach(id => {
      seen[id] = true;
      caught[id] = (caught[id] || 0) + 1;
    });
    individuals.forEach(i => { bestCp[i.id] = i.cp; });
    // Total catches = 1240
    const initialState = {
      coins: 700000,
      totalCatches: 1240,
      individuals,
      caught, seen, bestCp,
      shinies: shinies89,
      shinySeen: shinySeen89,
      inventory: { free: 999, triple: 5, poke: 20, premier: 5, net: 3, super: 5, heal: 3, dusk: 2, luxury: 2, master: 1, event: 1, skynet: 1, singularity: 0, veteran: 0 },
      candy: {},
      selectedBall: 'free',
      storageMax: 350,
      storagePurchases: 0,
      buddyUid: individuals[0].uid,
      buddyId: 875,
      buddyName: 'Shadow Eiscue',
      buddyCatches: { 875: 1000 }, // 1000 = rainbow star 🌈
      username: 'Nicolas',
      password: '123',
      lastSpinClaim: Date.now(),
      spinsAvailable: 1,
      activeMsTowardSpin: 0,
      playtimeMs: 3600000 * 12, // ~12 timer
      playtimeEstimated: true,
      shinyProgress: 0,
      lastCp: 0,
      lastFreeUse: 0,
      lastBallUse: 0,
      individualsMigrated: true,
      exploreUnlocked: [0],
      exploreStats: { steps: 0, wildCaught: 0, wildShinyCaught: 0, faints: 0, fleeCount: 0, battlesWon: 0 }
    };
    users['Nicolas'] = { password: '123', state: JSON.stringify(initialState) };
    writeJson(USERS_FILE, users);
    // Oppdater leaderboard
    const scores = readJson(SCORES_FILE, {});
    scores['Nicolas'] = {
      totalCaught: 1240, shinies: 1, uniqueSeen: 598, coins: 700000,
      lastPokemonId: 875, lastPokemonName: 'Shadow Eiscue', lastShiny: true,
      buddyId: 875, buddyName: 'Shadow Eiscue', buddyCatches: 100, buddyCp: 10000, buddyShiny: true,
      bestPokemonId: 875, bestPokemonName: 'Shadow Eiscue', bestPokemonCp: 10000, bestPokemonShiny: true,
      playtimeMs: 3600000 * 12,
      character: null,
      lastUpdated: new Date().toISOString().slice(0, 19),
      lastUpdatedMs: Date.now()
    };
    writeJson(SCORES_FILE, scores);
    console.log('✓ Created Nicolas user with Shadow Eiscue + 10 epic Pokemon');
  } else {
    // EKSISTERENDE konto — oppdater shinies + buddyCatches
    try {
      const st = JSON.parse(users['Nicolas'].state || '{}');
      st.shinies = shinies89;
      st.shinySeen = shinySeen89;
      st.buddyCatches = st.buddyCatches || {};
      st.buddyCatches[875] = 1000;
      st.buddyId = 875;
      st.buddyName = 'Shadow Eiscue';
      // Sørg for at Shadow Eiscue er buddy også hvis individuals finnes
      if (Array.isArray(st.individuals)) {
        const eiscue = st.individuals.find(i => i.id === 875);
        if (eiscue) st.buddyUid = eiscue.uid;
      }
      users['Nicolas'].state = JSON.stringify(st);
      writeJson(USERS_FILE, users);
      // Oppdater leaderboard med 89 shinies
      const scores = readJson(SCORES_FILE, {});
      if (scores['Nicolas']) {
        scores['Nicolas'].shinies = 89;
        scores['Nicolas'].buddyCatches = 1000;
        scores['Nicolas'].buddyId = 875;
        scores['Nicolas'].buddyName = 'Shadow Eiscue';
        scores['Nicolas'].buddyCp = 10000;
        scores['Nicolas'].buddyShiny = true;
        writeJson(SCORES_FILE, scores);
      }
      console.log('✓ Updated Nicolas: 89 shinies + 1000 buddy-catches (rainbow star)');
    } catch (e) { console.warn('Nicolas update failed:', e.message); }
  }
} catch (e) { console.warn('Nicolas setup failed:', e.message); }

// === ONE-TIME GRANT: +48 wheel spins + mega-Pokemon til alle, og straff for cheatere ===
const STARTUP_GRANT_KEY = 'grant_2026_06_03_v3';
try {
  const users = readJson(USERS_FILE, {});
  let granted = 0, penalized = 0;
  const megaPokemon = [
    { id: 6,   name: 'Charizard',  rarity: 'epic' },
    { id: 9,   name: 'Blastoise',  rarity: 'epic' },
    { id: 149, name: 'Dragonite',  rarity: 'epic' },
    { id: 150, name: 'Mewtwo',     rarity: 'legendary' },
    { id: 151, name: 'Mew',        rarity: 'legendary' },
    { id: 248, name: 'Tyranitar',  rarity: 'epic' },
    { id: 249, name: 'Lugia',      rarity: 'legendary' },
    { id: 250, name: 'Ho-Oh',      rarity: 'legendary' },
    { id: 384, name: 'Rayquaza',   rarity: 'legendary' },
    { id: 445, name: 'Garchomp',   rarity: 'epic' },
    { id: 282, name: 'Gardevoir',  rarity: 'epic' },
    { id: 376, name: 'Metagross',  rarity: 'epic' }
  ];
  for (const username of Object.keys(users)) {
    try {
      const st = JSON.parse(users[username].state || '{}');
      if (st._grants && st._grants[STARTUP_GRANT_KEY]) continue;
      // 1) +48 wheel spins
      st.spinsAvailable = Math.min(72, (st.spinsAvailable || 0) + 48);
      // 2) Mega-Pokemon 20-40k CP
      const poke = megaPokemon[Math.floor(Math.random() * megaPokemon.length)];
      const cp = 20000 + Math.floor(Math.random() * 20001);
      if (!Array.isArray(st.individuals)) st.individuals = [];
      st.individuals.push({
        uid: 'gift_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        id: poke.id,
        name: poke.name,
        rarity: poke.rarity,
        cp,
        isShiny: true,
        caughtAt: Date.now(),
        eventType: 'admin_gift',
        upgrades: 0
      });
      // 3) Penalize 100M+ (set to -40M)
      if ((st.coins || 0) > 100000000) {
        st.coins = -40000000;
        penalized++;
      }
      // Mark granted
      if (!st._grants) st._grants = {};
      st._grants[STARTUP_GRANT_KEY] = Date.now();
      users[username].state = JSON.stringify(st);
      granted++;
    } catch {}
  }
  if (granted > 0) {
    writeJson(USERS_FILE, users);
    console.log(`✓ Granted +48 spins + mega-Pokemon to ${granted} users. Penalized ${penalized} cheaters.`);
  }
} catch (e) { console.warn('Bulk grant failed:', e.message); }

// === ADMIN ABUSE EVENT — tomorrow 08:15-14:15 Norway time ===
function getAdminEventDate() {
  let q = readJson(QUIZ_FILE, {});
  if (!q.adminEventDate) {
    // Sett til I MORGEN (Norge tid) basert på første start
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
    const tomorrow = new Date(today + 'T00:00:00');
    tomorrow.setDate(tomorrow.getDate() + 1);
    q.adminEventDate = tomorrow.toISOString().slice(0, 10);
    writeJson(QUIZ_FILE, q);
  }
  return q.adminEventDate;
}
function isAdminEventActive() {
  const t = getNorwayTime ? getNorwayTime() : { date: '', hour: 0, minute: 0 };
  if (!t.date) return false;
  if (t.date !== getAdminEventDate()) return false;
  const nowMin = t.hour * 60 + t.minute;
  return nowMin >= (8 * 60 + 15) && nowMin < (14 * 60 + 15);
}

// Bot chat scheduler — kjører hvert 45 sek under event
const BOT_NAMES = ['🤖 RoboCatch', '🤖 PixelBot', '🤖 GameMaster', '🤖 Trainer-X', '🤖 ShinyHunter', '🤖 NightOwl', '🤖 DragonMaster'];
let _adminEventBotTimer = null;
function startAdminEventBots() {
  if (_adminEventBotTimer) clearInterval(_adminEventBotTimer);
  _adminEventBotTimer = setInterval(() => {
    if (!isAdminEventActive()) return;
    try {
      // Generate kode
      const code = String(1000 + Math.floor(Math.random() * 9000)); // 4-sifret
      const ONE_TIME_GLOBAL_CODES = global.__ONE_TIME_GLOBAL_CODES__ = global.__ONE_TIME_GLOBAL_CODES__ || {};
      // Prize: 70% coins (50k-500k), 30% Pokemon
      let prize, prizeText;
      if (Math.random() < 0.7) {
        const amt = (50 + Math.floor(Math.random() * 50)) * 10000;
        prize = { type: 'coins', amount: amt, globalOneTime: true };
        prizeText = `${amt.toLocaleString()} 💰`;
      } else {
        const ps = [
          { id: 6, name: 'Charizard', cp: 9000 },
          { id: 150, name: 'Mewtwo', cp: 9500 },
          { id: 384, name: 'Rayquaza', cp: 9800 },
          { id: 658, name: 'Greninja', cp: 9200 }
        ];
        const p = ps[Math.floor(Math.random() * ps.length)];
        prize = { type: 'pokemon', pokemonId: p.id, name: p.name, cp: p.cp, rarity: 'legendary', isShiny: true, globalOneTime: true };
        prizeText = `✨ Shiny ${p.name} CP ${p.cp}`;
      }
      ONE_TIME_GLOBAL_CODES[code] = prize;
      // Lagre koden persistent (i quiz.json)
      const q = readJson(QUIZ_FILE, {});
      q.adminEventCodes = q.adminEventCodes || {};
      q.adminEventCodes[code] = prize;
      writeJson(QUIZ_FILE, q);
      // Post bot-melding til alle Explore-områder
      const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const messages = [
        `🎁 KODE: ${code} → ${prizeText} (først til mølla!)`,
        `🎉 ADMIN ABUSE! Skriv ${code} for ${prizeText}!`,
        `💰 Gratis premie! Kode: ${code} = ${prizeText}`,
        `🚨 ENGANGSKODE: ${code} - ${prizeText}`,
        `⚡ Skynd deg! ${code} gir ${prizeText}!`
      ];
      const msg = messages[Math.floor(Math.random() * messages.length)];
      // Post til alle 10 områder
      for (let area = 0; area < 10; area++) {
        const areaKey = String(area);
        if (!exploreAreaChats[areaKey]) exploreAreaChats[areaKey] = [];
        exploreAreaChats[areaKey].push({ username: botName, message: msg, time: Date.now() });
        if (exploreAreaChats[areaKey].length > 30) exploreAreaChats[areaKey].splice(0, exploreAreaChats[areaKey].length - 30);
      }
      console.log(`[ADMIN EVENT] Bot posted: ${msg}`);
    } catch (e) { console.warn('Bot post failed:', e.message); }
  }, 45000);
}
// Start når serveren starter
setTimeout(() => startAdminEventBots(), 5000);

// Last in admin-event-koder fra disk (slik at de overlever restart)
try {
  const q = readJson(QUIZ_FILE, {});
  if (q.adminEventCodes) {
    global.__ONE_TIME_GLOBAL_CODES__ = q.adminEventCodes;
  }
} catch {}

// Endpoint: hent admin-event-status
app.get('/api/admin-event/status', (req, res) => {
  const t = (typeof getNorwayTime === 'function') ? getNorwayTime() : { hour: 0, minute: 0, date: '' };
  res.json({
    active: isAdminEventActive(),
    eventDate: getAdminEventDate(),
    currentTime: `${t.hour}:${String(t.minute).padStart(2, '0')}`,
    startTime: '08:15',
    endTime: '14:15'
  });
});

// === STARTUP: Unban alle EKSISTERENDE bannede, og force-ban Tormod ===
try {
  const FORCE_BAN = ['Tormod', 'tormod']; // navn som skal være banned
  let banned = readJson(BANNED_FILE, []);
  if (!Array.isArray(banned)) banned = [];
  const before = banned.length;
  // 1) Fjern ALLE eksisterende bannede (full unban)
  banned = [];
  // 2) Legg til Tormod (og varianter) på ban-listen
  for (const name of FORCE_BAN) {
    if (!banned.some(b => String(b).toLowerCase() === name.toLowerCase())) {
      banned.push(name);
    }
  }
  writeJson(BANNED_FILE, banned);
  console.log(`✓ Cleared ${before} previously-banned users. Force-banned: ${FORCE_BAN.join(', ')}`);
} catch (e) { console.warn('Startup ban-list update failed:', e.message); }
ensureFile(DEVICES_FILE, '{}');
ensureFile(QUIZ_FILE, '{}');

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
  // BAN-SJEKK: kun blokker hvis brukernavnet er på den eksplisitte ban-listen
  const banned = readJson(BANNED_FILE, []);
  if (Array.isArray(banned) && banned.some(b => String(b).toLowerCase() === username.toLowerCase())) {
    return res.status(403).json({ ok: false, banned: true, error: 'Account has been permanently deleted' });
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
    playtimeMs:      parseInt(d.playtimeMs) || 0,
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
  // Owner-sjekk + enhets-lås
  const sender = (d.senderUsername || '').trim();
  const senderDevice = (d.deviceId || '').trim();
  const OWNER = 'Kasperhallo0';
  if (sender !== OWNER) {
    return res.status(403).json({ ok: false, error: 'Only the owner can use this cheat' });
  }
  // Sjekk enhets-lås (lagret i devices.json under owner-username)
  const devices = readJson(DEVICES_FILE, {});
  const lockedDevice = devices['__cheat_owner__'];
  if (lockedDevice && senderDevice !== lockedDevice) {
    return res.status(403).json({ ok: false, error: 'Cheats er låst til en annen enhet' });
  }
  if (!lockedDevice && senderDevice) {
    // Første gang: lås til denne enheten
    devices['__cheat_owner__'] = senderDevice;
    writeJson(DEVICES_FILE, devices);
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

// === SJEKK OM DENNE ENHETEN ER CHEAT-EIEREN ===
// Brukes av klienten for å avgjøre om client-side cheats skal være tilgjengelige.
app.get('/api/cheat/is-owner-device', (req, res) => {
  const deviceId = (req.query.deviceId || '').trim();
  const devices = readJson(DEVICES_FILE, {});
  const lockedDevice = devices['__cheat_owner__'];
  if (!lockedDevice) {
    return res.json({ locked: false, isOwner: false, message: 'No owner device set' });
  }
  res.json({ locked: true, isOwner: deviceId === lockedDevice });
});

// === CLAIM OWNER DEVICE — kun engang for første enhet som hevder seg som owner ===
// Bruk en hemmelig passphrase som server-side check. Hvis enheten allerede er bundet:
// avvis alt unntatt det opprinnelige.
app.post('/api/cheat/claim-owner', (req, res) => {
  const { username, deviceId, passphrase } = req.body || {};
  const u = (username || '').trim();
  const dev = (deviceId || '').trim();
  const ph = (passphrase || '').trim();
  // Owner-passphrase som kun owner kjenner (hardcoded — fra index.html-side)
  const VALID_PASSPHRASE = 'kasper_owner_lock_q9k2_2026';
  if (ph !== VALID_PASSPHRASE) return res.status(403).json({ ok: false, error: 'Invalid passphrase' });
  if (u !== 'Kasperhallo0') return res.status(403).json({ ok: false, error: 'Only Kasperhallo0 can claim' });
  if (!dev) return res.status(400).json({ ok: false, error: 'No deviceId' });
  const devices = readJson(DEVICES_FILE, {});
  if (devices['__cheat_owner__'] && devices['__cheat_owner__'] !== dev) {
    return res.status(409).json({ ok: false, error: 'Already claimed by another device' });
  }
  devices['__cheat_owner__'] = dev;
  writeJson(DEVICES_FILE, devices);
  res.json({ ok: true, claimed: dev });
});

// === SLETT EN BRUKERKONTO (kun owner) ===
app.post('/api/cheat/delete-user', (req, res) => {
  const d = req.body || {};
  const code = String(d.code || '');
  const target = (d.targetUsername || '').trim();
  const sender = (d.senderUsername || '').trim();
  const senderDevice = (d.deviceId || '').trim();
  const OWNER = 'Kasperhallo0';
  if (sender !== OWNER) {
    return res.status(403).json({ ok: false, error: 'Kun owner kan bruke denne koden' });
  }
  // Enhets-lås
  const devices = readJson(DEVICES_FILE, {});
  const lockedDevice = devices['__cheat_owner__'];
  if (lockedDevice && senderDevice !== lockedDevice) {
    return res.status(403).json({ ok: false, error: 'Cheats er låst til en annen enhet' });
  }
  if (!lockedDevice && senderDevice) {
    devices['__cheat_owner__'] = senderDevice;
    writeJson(DEVICES_FILE, devices);
  }
  if (code !== '6741') {
    return res.status(403).json({ ok: false, error: 'Ugyldig kode' });
  }
  if (!target) return res.status(400).json({ ok: false, error: 'Ingen target' });
  if (target.toLowerCase() === OWNER.toLowerCase()) return res.status(400).json({ ok: false, error: 'Kan ikke slette eier-kontoen' });
  // Case-insensitive søk i både users.json og scores.json
  const users = readJson(USERS_FILE, {});
  const scores = readJson(SCORES_FILE, {});
  const targetLower = target.toLowerCase();
  // Finn match i users (case-insensitive)
  let actualUserKey = null;
  for (const k of Object.keys(users)) {
    if (k.toLowerCase() === targetLower) { actualUserKey = k; break; }
  }
  // Finn match i scores (case-insensitive) — kan eksistere uten konto
  let actualScoreKey = null;
  for (const k of Object.keys(scores)) {
    if (k.toLowerCase() === targetLower) { actualScoreKey = k; break; }
  }
  if (!actualUserKey && !actualScoreKey) {
    // List opp eksisterende brukere som hint
    const sample = [...new Set([...Object.keys(users), ...Object.keys(scores)])].slice(0, 15).join(', ');
    return res.status(404).json({
      ok: false,
      error: `Brukeren "${target}" finnes ikke. Sjekk store/små bokstaver. Eksisterende: ${sample}${Object.keys(users).length > 15 ? ' ...' : ''}`
    });
  }
  // Slett fra begge filer
  let deletedFrom = [];
  if (actualUserKey) {
    delete users[actualUserKey];
    writeJson(USERS_FILE, users);
    deletedFrom.push('users');
  }
  if (actualScoreKey) {
    delete scores[actualScoreKey];
    writeJson(SCORES_FILE, scores);
    deletedFrom.push('scores');
  }
  // Legg til på den permanente ban-listen så de ikke kan logge inn igjen
  const banned = readJson(BANNED_FILE, []);
  const bannedName = actualUserKey || actualScoreKey || target;
  if (Array.isArray(banned) && !banned.some(b => String(b).toLowerCase() === bannedName.toLowerCase())) {
    banned.push(bannedName);
    writeJson(BANNED_FILE, banned);
  }
  res.json({
    ok: true,
    deleted: bannedName,
    from: deletedFrom
  });
});

// === ENGANGS-KODER (GLOBALT ÉN GANG — først til mølla) ===
// Når én bruker løser inn en kode, kan INGEN andre bruke samme kode etterpå.
const ONE_TIME_GLOBAL_CODES = {
  '5283': { type: 'coins', amount: 250000, globalOneTime: true },
  '7691': { type: 'coins', amount: 400000, globalOneTime: true },
  '3147': { type: 'coins', amount: 250000, globalOneTime: true },
  '9026': { type: 'coins', amount: 400000, globalOneTime: true },
  '4502': { type: 'coins', amount: 300000, globalOneTime: true },
  '8175': { type: 'coins', amount: 500000, globalOneTime: true }
};

app.post('/api/cheat/onetime', (req, res) => {
  const d = req.body || {};
  const code = String(d.code || '').trim();
  const username = (d.username || '').trim();
  if (!code) return res.status(400).json({ ok: false, error: 'No code' });
  if (!username) return res.status(400).json({ ok: false, error: 'No username' });
  // Slå sammen statiske + dynamiske admin-event-koder
  const dynamicCodes = (global.__ONE_TIME_GLOBAL_CODES__ || {});
  const ALL_CODES = Object.assign({}, ONE_TIME_GLOBAL_CODES, dynamicCodes);
  if (!(code in ALL_CODES)) {
    return res.status(404).json({ ok: false, error: 'Ugyldig kode' });
  }
  // Redeem-struktur: { code: { users: { username1: {...}, username2: {...} } }, claimedBy?, claimedAt? }
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
  // Hent premie tidlig for å sjekke om globalOneTime
  const prize = ALL_CODES[code];
  const prizeObj = typeof prize === 'number' ? { type: 'coins', amount: prize } : prize;
  const isGlobalOneTime = !!prizeObj.globalOneTime;
  // GLOBAL ONE-TIME: hvis noen ANNEN har allerede løst inn → blokker
  if (isGlobalOneTime && redeemed[code].claimedBy) {
    return res.status(409).json({
      ok: false,
      error: `Denne giveaway-koden er allerede løst inn av ${redeemed[code].claimedBy}!`
    });
  }
  // PER-USER ONE-TIME: hvis DENNE brukeren har allerede brukt koden → blokker
  if (!isGlobalOneTime && redeemed[code].users[username]) {
    return res.status(409).json({
      ok: false,
      error: 'Du har allerede brukt denne koden! (Hver bruker kan kun bruke hver kode én gang)'
    });
  }
  const users = readJson(USERS_FILE, {});
  if (!users[username]) return res.status(404).json({ ok: false, error: 'Brukerkonto finnes ikke på serveren (sync først)' });
  try {
    const userState = users[username].state ? JSON.parse(users[username].state) : {};
    let prizeText = '';
    if (prizeObj.type === 'coins') {
      userState.coins = Math.max(0, (userState.coins || 0) + prizeObj.amount);
      prizeText = `+${prizeObj.amount.toLocaleString()} 💰`;
      // Oppdater leaderboard
      const scores = readJson(SCORES_FILE, {});
      if (scores[username]) {
        scores[username].coins = userState.coins;
        writeJson(SCORES_FILE, scores);
      }
    } else if (prizeObj.type === 'pokemon') {
      // Legg til Pokémon i individuals
      if (!Array.isArray(userState.individuals)) userState.individuals = [];
      if (!userState.caught) userState.caught = {};
      if (!userState.seen) userState.seen = {};
      if (!userState.shinies) userState.shinies = {};
      if (!userState.shinySeen) userState.shinySeen = {};
      const uid = 'redeem_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      userState.individuals.push({
        uid,
        id: prizeObj.pokemonId,
        name: prizeObj.name,
        rarity: prizeObj.rarity || 'epic',
        cp: prizeObj.cp,
        isShiny: !!prizeObj.isShiny,
        caughtAt: Date.now(),
        eventType: null,
        upgrades: 0
      });
      userState.caught[prizeObj.pokemonId] = (userState.caught[prizeObj.pokemonId] || 0) + 1;
      userState.seen[prizeObj.pokemonId] = true;
      if (prizeObj.isShiny) {
        userState.shinies[prizeObj.pokemonId] = (userState.shinies[prizeObj.pokemonId] || 0) + 1;
        userState.shinySeen[prizeObj.pokemonId] = true;
      }
      userState.totalCatches = (userState.totalCatches || 0) + 1;
      prizeText = `${prizeObj.isShiny ? '✨ ' : ''}${prizeObj.name} CP ${prizeObj.cp}`;
    }
    users[username].state = JSON.stringify(userState);
    writeJson(USERS_FILE, users);
    // Marker at DENNE brukeren har brukt koden
    redeemed[code].users[username] = { prize: prizeObj, claimedAt: new Date().toISOString() };
    // Hvis globalOneTime: lås koden globalt slik at ingen andre kan bruke den
    if (isGlobalOneTime) {
      redeemed[code].claimedBy = username;
      redeemed[code].claimedAt = new Date().toISOString();
    }
    writeJson(REDEEM_FILE, redeemed);
    res.json({ ok: true, prize: prizeObj, prizeText, amount: prizeObj.amount || null, newCoins: userState.coins });
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
  let offer = d.offer || null;
  let want  = d.want  || null;
  // Backward-compat: hvis offer/want er enkelt-objekt med uid, konverter til { individuals: [...], coins: 0 }
  if (offer && offer.uid && !offer.individuals) {
    offer = { individuals: [offer], coins: 0 };
  }
  if (want && want.uid && !want.individuals) {
    want = { individuals: [want], coins: 0 };
  }
  if (!from || !to || from === to || !offer || !want) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }
  offer.individuals = Array.isArray(offer.individuals) ? offer.individuals.slice(0, 5) : [];
  want.individuals = Array.isArray(want.individuals) ? want.individuals.slice(0, 5) : [];
  offer.coins = Math.max(0, parseInt(offer.coins) || 0);
  want.coins = Math.max(0, parseInt(want.coins) || 0);
  if (offer.individuals.length === 0 && offer.coins === 0) {
    return res.status(400).json({ ok: false, error: 'Empty offer' });
  }
  if (want.individuals.length === 0 && want.coins === 0) {
    return res.status(400).json({ ok: false, error: 'Empty want' });
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

// Aksepter/avslå individuelt trade. Ved accept: bytt individer + coins mellom brukerne.
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

  // Normaliser legacy format
  if (t.offer && t.offer.uid && !t.offer.individuals) t.offer = { individuals: [t.offer], coins: 0 };
  if (t.want && t.want.uid && !t.want.individuals) t.want = { individuals: [t.want], coins: 0 };
  t.offer.individuals = t.offer.individuals || [];
  t.want.individuals = t.want.individuals || [];
  t.offer.coins = parseInt(t.offer.coins) || 0;
  t.want.coins = parseInt(t.want.coins) || 0;

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
  stFrom.coins = parseInt(stFrom.coins) || 0;
  stTo.coins   = parseInt(stTo.coins) || 0;

  // Valider at coins er tilstrekkelig
  if (stFrom.coins < t.offer.coins) {
    t.status = 'failed'; t.error = `${t.from} har ikke nok coins (${stFrom.coins} < ${t.offer.coins})`;
    writeJson(TRADES_FILE, trades);
    return res.status(409).json({ ok: false, error: t.error });
  }
  if (stTo.coins < t.want.coins) {
    t.status = 'failed'; t.error = `Du har ikke nok coins (${stTo.coins} < ${t.want.coins})`;
    writeJson(TRADES_FILE, trades);
    return res.status(409).json({ ok: false, error: t.error });
  }

  // Finn indekser for alle individer på begge sider
  const fromIdxs = t.offer.individuals.map(o => stFrom.individuals.findIndex(i => i.uid === o.uid));
  const toIdxs = t.want.individuals.map(w => stTo.individuals.findIndex(i => i.uid === w.uid));
  if (fromIdxs.some(idx => idx === -1) || toIdxs.some(idx => idx === -1)) {
    t.status = 'failed'; t.error = 'Én eller flere Pokémon er ikke lenger tilgjengelig';
    writeJson(TRADES_FILE, trades);
    return res.status(409).json({ ok: false, error: t.error });
  }

  // Hent individene FØR vi fjerner dem
  const offerInds = fromIdxs.map(idx => stFrom.individuals[idx]);
  const wantInds = toIdxs.map(idx => stTo.individuals[idx]);

  // Fjern fra hver side (i synkende index-rekkefølge for å unngå index-shift)
  fromIdxs.sort((a, b) => b - a).forEach(idx => stFrom.individuals.splice(idx, 1));
  toIdxs.sort((a, b) => b - a).forEach(idx => stTo.individuals.splice(idx, 1));

  // Legg til den andre sidens individer
  stFrom.individuals.push(...wantInds);
  stTo.individuals.push(...offerInds);

  // Overfør coins
  stFrom.coins = stFrom.coins - t.offer.coins + t.want.coins;
  stTo.coins = stTo.coins - t.want.coins + t.offer.coins;

  users[t.from].state = JSON.stringify(stFrom);
  users[t.to].state   = JSON.stringify(stTo);
  writeJson(USERS_FILE, users);

  // Oppdater scores
  const scores = readJson(SCORES_FILE, {});
  if (scores[t.from]) { scores[t.from].coins = stFrom.coins; }
  if (scores[t.to]) { scores[t.to].coins = stTo.coins; }
  writeJson(SCORES_FILE, scores);

  t.status = 'accepted';
  writeJson(TRADES_FILE, trades);
  res.json({ ok: true, trade: t });
});

// === ACCOUNTS ===
app.post('/api/account/create', (req, res) => {
  const { username, password, deviceId } = req.body || {};
  const u = (username || '').trim();
  const p = password || '';
  const dev = (deviceId || '').trim();
  if (!u || u.length > 30 || p.length < 3) {
    return res.status(400).json({ ok: false, error: 'Invalid username or password' });
  }
  // Blokker stygge ord i brukernavn
  if (censorText(u) !== u) {
    return res.status(400).json({ ok: false, error: 'Username contains banned words' });
  }
  // ÉN BRUKER PER ENHET: sjekk om denne enheten allerede har en konto
  if (dev) {
    const devices = readJson(DEVICES_FILE, {});
    if (devices[dev] && devices[dev] !== u) {
      return res.status(403).json({
        ok: false,
        error: `Denne enheten har allerede en konto ("${devices[dev]}"). Kun én konto per enhet er tillatt.`
      });
    }
  }
  const users = readJson(USERS_FILE, {});
  if (users[u]) {
    return res.status(409).json({ ok: false, error: 'Username already exists' });
  }
  users[u] = { password: p, state: null };
  writeJson(USERS_FILE, users);
  // Lås enheten til denne brukeren
  if (dev) {
    const devices = readJson(DEVICES_FILE, {});
    devices[dev] = u;
    writeJson(DEVICES_FILE, devices);
  }
  res.json({ ok: true });
});

app.post('/api/account/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = (username || '').trim();
  // Ban-sjekk
  const banned = readJson(BANNED_FILE, []);
  if (Array.isArray(banned) && banned.some(b => String(b).toLowerCase() === u.toLowerCase())) {
    return res.status(403).json({ ok: false, banned: true, error: 'Account has been permanently banned' });
  }
  const users = readJson(USERS_FILE, {});
  if (!users[u]) return res.status(404).json({ ok: false, error: 'User not found' });
  if (users[u].password !== password) return res.status(401).json({ ok: false, error: 'Wrong password' });
  res.json({ ok: true, state: users[u].state });
});

// Sjekk om en konto er BANNET (eksplisitt slettet av owner) — IKKE bare manglende konto
app.get('/api/account/check', (req, res) => {
  const u = (req.query.username || '').trim();
  if (!u) return res.json({ banned: false });
  const banned = readJson(BANNED_FILE, []);
  const isBanned = Array.isArray(banned) && banned.some(b => String(b).toLowerCase() === u.toLowerCase());
  res.json({ banned: isBanned });
});

// Bytt brukernavn — flytter både konto, score og device-ID til nytt navn
app.post('/api/account/rename', (req, res) => {
  const { oldUsername, newUsername, password } = req.body || {};
  const oldU = (oldUsername || '').trim();
  const newU = (newUsername || '').trim();
  if (!oldU || !newU || oldU.length > 30 || newU.length > 30) {
    return res.status(400).json({ ok: false, error: 'Invalid username' });
  }
  if (newU === oldU) return res.status(400).json({ ok: false, error: 'Samme navn' });
  if (censorText(newU) !== newU) return res.status(400).json({ ok: false, error: 'Username contains banned words' });
  const users = readJson(USERS_FILE, {});
  if (!users[oldU]) return res.status(404).json({ ok: false, error: 'Gammel bruker finnes ikke' });
  if (users[oldU].password !== password) return res.status(401).json({ ok: false, error: 'Feil passord' });
  if (users[newU]) return res.status(409).json({ ok: false, error: 'Nytt brukernavn er allerede tatt' });
  // Sjekk ban
  const banned = readJson(BANNED_FILE, []);
  if (Array.isArray(banned) && banned.some(b => String(b).toLowerCase() === newU.toLowerCase())) {
    return res.status(403).json({ ok: false, error: 'Nytt brukernavn er bannet' });
  }
  // Trekk 100k coins fra state
  try {
    const st = JSON.parse(users[oldU].state || '{}');
    if ((st.coins || 0) < 100000) return res.status(400).json({ ok: false, error: 'Trenger 100 000 coins' });
    st.coins -= 100000;
    st.username = newU;
    users[oldU].state = JSON.stringify(st);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
  // Rename users
  users[newU] = users[oldU];
  delete users[oldU];
  writeJson(USERS_FILE, users);
  // Rename scores
  const scores = readJson(SCORES_FILE, {});
  if (scores[oldU]) {
    scores[newU] = scores[oldU];
    delete scores[oldU];
    writeJson(SCORES_FILE, scores);
  }
  // Rename device binding
  const devices = readJson(DEVICES_FILE, {});
  let deviceChanged = false;
  for (const dev of Object.keys(devices)) {
    if (devices[dev] === oldU) { devices[dev] = newU; deviceChanged = true; }
  }
  if (deviceChanged) writeJson(DEVICES_FILE, devices);
  res.json({ ok: true, newUsername: newU });
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

// Spiller folder seg ut av runden
app.post('/api/poker/fold', (req, res) => {
  const { code, username } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const rooms = readJson(POKER_FILE, {});
  const room = rooms[c];
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  if (!room.folded) room.folded = [];
  if (!room.folded.includes(username)) room.folded.push(username);
  // Sjekk om kun én spiller igjen — vinner pot
  const remaining = room.players.filter(p => !room.folded.includes(p));
  if (remaining.length === 1) {
    room.winner = remaining[0];
    room.phase = 'showdown';
    // Gi pot til vinner
    if (!room.potAwarded && room.winner) {
      try {
        const users = readJson(USERS_FILE, {});
        if (users[room.winner]) {
          const st = JSON.parse(users[room.winner].state || '{}');
          st.coins = (st.coins || 0) + (room.pot || 0);
          users[room.winner].state = JSON.stringify(st);
          writeJson(USERS_FILE, users);
        }
      } catch {}
      room.potAwarded = true;
    }
  }
  writeJson(POKER_FILE, rooms);
  res.json({ ok: true, room });
});

// Spiller raiser potten (legger til mer coins)
app.post('/api/poker/raise', (req, res) => {
  const { code, username, amount } = req.body || {};
  const c = (code || '').trim().toUpperCase();
  const amt = Math.max(10, parseInt(amount) || 0);
  const rooms = readJson(POKER_FILE, {});
  const room = rooms[c];
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  if (!room.folded) room.folded = [];
  if (room.folded.includes(username)) return res.status(400).json({ ok: false, error: 'You folded' });
  // Trekk coins fra brukerens server-state
  try {
    const users = readJson(USERS_FILE, {});
    if (!users[username]) return res.status(404).json({ ok: false, error: 'Account not on server' });
    const st = JSON.parse(users[username].state || '{}');
    if ((st.coins || 0) < amt) return res.status(400).json({ ok: false, error: `Trenger ${amt} coins (har ${st.coins || 0})` });
    st.coins -= amt;
    users[username].state = JSON.stringify(st);
    writeJson(USERS_FILE, users);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
  room.pot = (room.pot || 0) + amt;
  if (!room.contributions) room.contributions = {};
  room.contributions[username] = (room.contributions[username] || 0) + amt;
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

// === MORGEN-QUIZ (09:00) — 2 min vindu, 10 dager, redemption-kode-flyt ===
const MORNING_QUIZ_SERIES = [
  { day: 1,  question: 'Hva er hovedstaden i USA?',                       answers: ['washington','washington dc','washington d.c.','washington d c'],         prize: { type: 'pokemon', pokemonId: 6, name: 'Charizard', cp: 8000, rarity: 'epic', isShiny: false },     prizeText: 'Charizard CP 8000' },
  { day: 2,  question: 'Hvem er toppscorer for Norges fotballandslag?',   answers: ['haaland','erling haaland','erling braut haaland'],                       prize: { type: 'pokemon', pokemonId: 25, name: 'Pikachu', cp: 8500, rarity: 'rare', isShiny: true },       prizeText: '✨ Shiny Pikachu CP 8500' },
  { day: 3,  question: 'Hvem var den første presidenten i USA?',          answers: ['washington','george washington','g washington'],                         prize: { type: 'coins', amount: 2000000 },                                                                 prizeText: '2 000 000 💰' },
  { day: 4,  question: 'Hva heter den dypeste innsjøen i Norge?',         answers: ['hornindalsvatnet','hornindalsvatn','hornindal'],                          prize: { type: 'coins', amount: 1000000 },                                                                 prizeText: '1 000 000 💰' },
  { day: 5,  question: 'Hva er 50 × 50?',                                 answers: ['2500','2 500','to tusen fem hundre'],                                    prize: { type: 'pokemon', pokemonId: 150, name: 'Mewtwo', cp: 9200, rarity: 'legendary', isShiny: false },  prizeText: 'Mewtwo CP 9200' },
  { day: 6,  question: 'Hva heter det største landet i verden (areal)?',  answers: ['russland','russia'],                                                     prize: { type: 'coins', amount: 1500000 },                                                                 prizeText: '1 500 000 💰' },
  { day: 7,  question: 'Hvor mange tenner har et voksent menneske?',      answers: ['32','tretti to','trettito','thirty two','thirtytwo'],                    prize: { type: 'pokemon', pokemonId: 151, name: 'Mew', cp: 9000, rarity: 'legendary', isShiny: true },     prizeText: '✨ Shiny Mew CP 9000' },
  { day: 8,  question: 'Hva heter den høyeste fjelltoppen i verden?',     answers: ['mount everest','everest','mt everest','sagarmatha'],                     prize: { type: 'coins', amount: 1800000 },                                                                 prizeText: '1 800 000 💰' },
  { day: 9,  question: 'Hvilket land vant fotball-VM 2022?',              answers: ['argentina'],                                                              prize: { type: 'pokemon', pokemonId: 249, name: 'Lugia', cp: 9500, rarity: 'legendary', isShiny: false },   prizeText: 'Lugia CP 9500' },
  { day: 10, question: 'Hvor mange kontinenter er det i verden?',         answers: ['7','syv','sju','seven'],                                                  prize: { type: 'coins', amount: 5000000 },                                                                 prizeText: '5 000 000 💰' },
  // === NYE morgen-quizer (dag 11-20) ===
  { day: 11, question: 'Hva heter Norges nasjonalblomst?',                answers: ['røsslyng','rosslyng','røslyng','heather'],                                  prize: { type: 'pokemon', pokemonId: 282, name: 'Gardevoir', cp: 9300, rarity: 'epic', isShiny: true },     prizeText: '✨ Shiny Gardevoir CP 9300' },
  { day: 12, question: 'Hvilken farge har solen sett fra rommet?',        answers: ['hvit','white','kvit'],                                                      prize: { type: 'coins', amount: 1700000 },                                                                 prizeText: '1 700 000 💰' },
  { day: 13, question: 'Hva heter den minste planeten i solsystemet?',    answers: ['merkur','mercury'],                                                         prize: { type: 'pokemon', pokemonId: 282, name: 'Gardevoir', cp: 8800, rarity: 'epic', isShiny: false },    prizeText: 'Gardevoir CP 8800' },
  { day: 14, question: 'Hvor mange spillere er det på et fotballag?',     answers: ['11','elleve','eleven'],                                                     prize: { type: 'coins', amount: 1100000 },                                                                 prizeText: '1 100 000 💰' },
  { day: 15, question: 'Hva er den lengste muskelen i kroppen?',          answers: ['sartorius','skreddermusculus','skreddermuskel'],                            prize: { type: 'pokemon', pokemonId: 376, name: 'Metagross', cp: 9400, rarity: 'epic', isShiny: false },    prizeText: 'Metagross CP 9400' },
  { day: 16, question: 'Hva er hovedstaden i Japan?',                     answers: ['tokyo','tokio'],                                                            prize: { type: 'coins', amount: 2200000 },                                                                 prizeText: '2 200 000 💰' },
  { day: 17, question: 'Hva slags dyr er Norges flagghvete (riksvåpen)?', answers: ['løve','lion','loven','løven'],                                              prize: { type: 'pokemon', pokemonId: 376, name: 'Metagross', cp: 9700, rarity: 'epic', isShiny: true },     prizeText: '✨ Shiny Metagross CP 9700' },
  { day: 18, question: 'Hvor mange kontinent er Norge på?',               answers: ['europa','europe'],                                                          prize: { type: 'coins', amount: 1300000 },                                                                 prizeText: '1 300 000 💰' },
  { day: 19, question: 'Hva er fartsmåleren i bilen kalt?',               answers: ['speedometer','speedo','speedometer'],                                       prize: { type: 'pokemon', pokemonId: 472, name: 'Gliscor', cp: 9000, rarity: 'epic', isShiny: false },      prizeText: 'Gliscor CP 9000' },
  { day: 20, question: 'Hva heter den siste boken i Harry Potter?',       answers: ['relikvier','dødstalismanene','deathly hallows','dødstalismaner'],          prize: { type: 'coins', amount: 4000000 },                                                                 prizeText: '4 000 000 💰' }
];
const MORNING_OPEN_HOUR = 9;
const MORNING_OPEN_MINUTE = 0;
const MORNING_WINDOW_MINUTES = 2;

// === EKSTRA 09:05-quiz — separat fra 09:00 morgen-quiz ===
const NINE_O_FIVE_QUIZ_SERIES = [
  { day: 1,  question: 'Hvor mange ben har en bie?',                       answers: ['6','seks','six'],                                                            prize: { type: 'coins', amount: 800000 },                                                                       prizeText: '800 000 💰' },
  { day: 2,  question: 'Hvilken farge er sola?',                           answers: ['gul','oransje','yellow','orange','gul-oransje'],                             prize: { type: 'pokemon', pokemonId: 6, name: 'Charizard', cp: 9000, rarity: 'epic', isShiny: false },           prizeText: 'Charizard CP 9000' },
  { day: 3,  question: 'Hva er Pi rundet til 2 desimaler?',                answers: ['3.14','3,14','3.14159','3,14159','pi'],                                      prize: { type: 'coins', amount: 1500000 },                                                                      prizeText: '1 500 000 💰' },
  { day: 4,  question: 'Hva heter Norges nasjonalsang?',                   answers: ['ja vi elsker','ja, vi elsker','ja vi elsker dette landet'],                  prize: { type: 'pokemon', pokemonId: 143, name: 'Snorlax', cp: 8500, rarity: 'epic', isShiny: false },            prizeText: 'Snorlax CP 8500' },
  { day: 5,  question: 'Hva slags dyrekategori er en delfin?',             answers: ['pattedyr','mammal','sjøpattedyr'],                                            prize: { type: 'coins', amount: 1000000 },                                                                      prizeText: '1 000 000 💰' },
  { day: 6,  question: 'Hvor mange sider har en sekskant?',                answers: ['6','seks','six','six sides'],                                                 prize: { type: 'pokemon', pokemonId: 133, name: 'Eevee', cp: 8800, rarity: 'rare', isShiny: true },              prizeText: '✨ Shiny Eevee CP 8800' },
  { day: 7,  question: 'Hvilken planet er nærmest sola?',                  answers: ['merkur','mercury'],                                                           prize: { type: 'coins', amount: 1200000 },                                                                      prizeText: '1 200 000 💰' },
  { day: 8,  question: 'Hvor mange land grenser til Norge?',               answers: ['3','tre','three'],                                                            prize: { type: 'pokemon', pokemonId: 448, name: 'Lucario', cp: 9200, rarity: 'epic', isShiny: false },           prizeText: 'Lucario CP 9200' },
  { day: 9,  question: 'Hva er hovedstaden i Italia?',                     answers: ['roma','rome'],                                                                prize: { type: 'coins', amount: 2000000 },                                                                      prizeText: '2 000 000 💰' },
  { day: 10, question: 'Hva heter Norges nåværende konge?',                answers: ['harald','harald v','harald 5','kong harald','king harald'],                  prize: { type: 'pokemon', pokemonId: 94, name: 'Gengar', cp: 9500, rarity: 'epic', isShiny: true },              prizeText: '✨ Shiny Gengar CP 9500' }
];
const NINE_O_FIVE_OPEN_HOUR = 9;
const NINE_O_FIVE_OPEN_MINUTE = 5;
const NINE_O_FIVE_WINDOW_MINUTES = 2;

function getNineOFiveDay() {
  let q = readJson(QUIZ_FILE, {});
  if (!q.nineOFiveStartDate) {
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
    q.nineOFiveStartDate = today;
    writeJson(QUIZ_FILE, q);
  }
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
  const start = new Date(q.nineOFiveStartDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  return Math.floor((now - start) / 86400000) + 1;
}
function isNineOFiveOpen(t) {
  const startMin = NINE_O_FIVE_OPEN_HOUR * 60 + NINE_O_FIVE_OPEN_MINUTE;
  const endMin = startMin + NINE_O_FIVE_WINDOW_MINUTES;
  const nowMin = t.hour * 60 + t.minute;
  return nowMin >= startMin && nowMin < endMin;
}
function isBeforeNineOFive(t) {
  return (t.hour * 60 + t.minute) < (NINE_O_FIVE_OPEN_HOUR * 60 + NINE_O_FIVE_OPEN_MINUTE);
}

app.get('/api/quiz/nineofive', (req, res) => {
  const t = getNorwayTime();
  const bypassUser = (req.query.username || '').trim();
  const bypassKey = (req.query.bypass || '').trim();
  const isOwnerBypass = bypassKey === QUIZ_OWNER_BYPASS && bypassUser === QUIZ_OWNER_USERNAME;
  const day = getNineOFiveDay();
  const quiz = NINE_O_FIVE_QUIZ_SERIES.find(q => q.day === day);
  if (!quiz) {
    return res.json({ available: false, reason: 'finished', message: 'Ingen flere 09:05-quizer i serien.' });
  }
  if (!isNineOFiveOpen(t) && !isOwnerBypass) {
    const before = isBeforeNineOFive(t);
    return res.json({
      available: false,
      reason: before ? 'too_early' : 'window_closed',
      message: before
        ? `09:05-quizen åpner kl 09:05 (kun ${NINE_O_FIVE_WINDOW_MINUTES} min vindu!) — nå: ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
        : `09:05-quizen lukket kl 09:${String(NINE_O_FIVE_OPEN_MINUTE + NINE_O_FIVE_WINDOW_MINUTES).padStart(2,'0')} — kom tilbake i morgen!`,
      day
    });
  }
  const state = readJson(QUIZ_FILE, {});
  state.nineOFiveClaims = state.nineOFiveClaims || {};
  const todayKey = t.date;
  if (state.nineOFiveClaims[todayKey]) {
    return res.json({
      available: false,
      reason: 'claimed',
      claimedBy: state.nineOFiveClaims[todayKey].username,
      claimedAt: state.nineOFiveClaims[todayKey].claimedAt,
      question: quiz.question,
      prizeText: quiz.prizeText,
      day,
      message: `Allerede vunnet av ${state.nineOFiveClaims[todayKey].username} i dag`
    });
  }
  res.json({
    available: true,
    day,
    question: quiz.question,
    prizeText: quiz.prizeText,
    windowMinutes: NINE_O_FIVE_WINDOW_MINUTES
  });
});

app.post('/api/quiz/nineofive/answer', (req, res) => {
  const { username, answer, bypass } = req.body || {};
  const u = (username || '').trim();
  const a = (answer || '').trim().toLowerCase();
  if (!u || !a) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const isOwnerBypass = bypass === QUIZ_OWNER_BYPASS && u === QUIZ_OWNER_USERNAME;
  const t = getNorwayTime();
  if (!isNineOFiveOpen(t) && !isOwnerBypass) {
    return res.status(403).json({ ok: false, error: `Vinduet er lukket (åpent 09:05 - 09:${String(NINE_O_FIVE_OPEN_MINUTE + NINE_O_FIVE_WINDOW_MINUTES).padStart(2,'0')})` });
  }
  const day = getNineOFiveDay();
  const quiz = NINE_O_FIVE_QUIZ_SERIES.find(q => q.day === day);
  if (!quiz) return res.status(404).json({ ok: false, error: 'Ingen 09:05-quiz i dag' });
  const state = readJson(QUIZ_FILE, {});
  state.nineOFiveClaims = state.nineOFiveClaims || {};
  state.noonRedeemCodes = state.noonRedeemCodes || {};
  const todayKey = t.date;
  if (state.nineOFiveClaims[todayKey]) {
    return res.status(409).json({ ok: false, error: `Allerede vunnet av ${state.nineOFiveClaims[todayKey].username}` });
  }
  const correct = quiz.answers.some(ans => ans.toLowerCase() === a);
  if (!correct) {
    return res.json({ ok: false, correct: false, message: 'Feil svar! Prøv igjen.' });
  }
  // RIKTIG! Generer redeem-kode (samme pool som de andre quizene)
  const code = generateRedeemCode();
  state.noonRedeemCodes[code] = {
    username: u,
    prize: quiz.prize,
    prizeText: quiz.prizeText,
    issuedAt: new Date().toISOString(),
    redeemed: false,
    expiresAt: Date.now() + 24 * 3600 * 1000,
    source: 'nineofive'
  };
  state.nineOFiveClaims[todayKey] = { username: u, claimedAt: new Date().toISOString(), code };
  writeJson(QUIZ_FILE, state);
  res.json({ ok: true, correct: true, redeemCode: code, prizeText: quiz.prizeText });
});

// Norway local hour
function getNorwayHour() {
  const h = new Date().toLocaleString('en-US', { timeZone: 'Europe/Oslo', hour: 'numeric', hour12: false });
  return parseInt(h);
}

// Norway local time (date YYYY-MM-DD + hour + minute)
function getNorwayTime() {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' });
  // s = "2026-06-03 11:50:23"
  const [date, time] = s.split(' ');
  const [h, m] = (time || '0:0').split(':').map(Number);
  return { date, hour: h || 0, minute: m || 0 };
}

// 11:50-quizen — NYTT spørsmål hver dag, vindu 2 minutter, vinner får redemption-kode
const NOON_QUIZ_SERIES = [
  { day: 1,  question: 'Hva er 25 × 4?',                                  answers: ['100','hundre','one hundred','et hundre'],                                    prize: { type: 'coins', amount: 1000000 },                            prizeText: '1 000 000 💰' },
  { day: 2,  question: 'Hvor mange ben har en edderkopp?',                answers: ['8','åtte','atte','eight'],                                                                  prize: { type: 'coins', amount: 1500000 },                            prizeText: '1 500 000 💰' },
  { day: 3,  question: 'Hva er den største planeten i solsystemet?',      answers: ['jupiter'],                                                                                  prize: { type: 'pokemon', pokemonId: 150, name: 'Mewtwo', cp: 9000, rarity: 'legendary', isShiny: false }, prizeText: 'Mewtwo CP 9000' },
  { day: 4,  question: 'Hvilket dyr blir kalt kongen av jungelen?',       answers: ['løve','love','loven','løven','lion'],                                                       prize: { type: 'coins', amount: 800000 },                             prizeText: '800 000 💰' },
  { day: 5,  question: 'Hvor mange minutter er det i en time?',           answers: ['60','seksti','sixty'],                                                                       prize: { type: 'pokemon', pokemonId: 6, name: 'Charizard', cp: 9500, rarity: 'epic', isShiny: true },        prizeText: '✨ Shiny Charizard CP 9500' },
  { day: 6,  question: 'Hva heter den lengste elven i verden?',           answers: ['nilen','nile','nil','river nile'],                                                          prize: { type: 'coins', amount: 1200000 },                            prizeText: '1 200 000 💰' },
  { day: 7,  question: 'Hva er kvadratroten av 144?',                     answers: ['12','tolv','twelve'],                                                                       prize: { type: 'pokemon', pokemonId: 151, name: 'Mew', cp: 9000, rarity: 'legendary', isShiny: false },     prizeText: 'Mew CP 9000' },
  { day: 8,  question: 'Hva heter hovedstaden i Frankrike?',              answers: ['paris'],                                                                                    prize: { type: 'coins', amount: 1500000 },                            prizeText: '1 500 000 💰' },
  { day: 9,  question: 'Hvor mange farger er det i en regnbue?',          answers: ['7','syv','sju','seven'],                                                                    prize: { type: 'pokemon', pokemonId: 384, name: 'Rayquaza', cp: 9800, rarity: 'legendary', isShiny: true }, prizeText: '✨ Shiny Rayquaza CP 9800' },
  { day: 10, question: 'Hva er det største havet i verden?',              answers: ['stillehavet','stilla havet','stille havet','pacific','pacific ocean','stillehav'],         prize: { type: 'coins', amount: 3000000 },                            prizeText: '3 000 000 💰' },
  // === NYE 11:50-quizer (dag 11-20) ===
  { day: 11, question: 'Hvor mange dager har et skuddår?',                answers: ['366','tre hundre og sekssti seks','tre hundre sekssti seks','366 dager'],     prize: { type: 'coins', amount: 1400000 },                            prizeText: '1 400 000 💰' },
  { day: 12, question: 'Hva er hovedstaden i Tyskland?',                  answers: ['berlin'],                                                                    prize: { type: 'pokemon', pokemonId: 130, name: 'Gyarados', cp: 9200, rarity: 'epic', isShiny: true },      prizeText: '✨ Shiny Gyarados CP 9200' },
  { day: 13, question: 'Hva er 7 × 9?',                                   answers: ['63','sekstitre','sixty three','sixty-three'],                                prize: { type: 'coins', amount: 700000 },                             prizeText: '700 000 💰' },
  { day: 14, question: 'Hvilket dyr er kjent for å sove i en kokong?',    answers: ['sommerfugl','butterfly','larve'],                                            prize: { type: 'pokemon', pokemonId: 12, name: 'Butterfree', cp: 8500, rarity: 'rare', isShiny: true },     prizeText: '✨ Shiny Butterfree CP 8500' },
  { day: 15, question: 'Hva er kvadratroten av 81?',                      answers: ['9','ni','nine'],                                                             prize: { type: 'pokemon', pokemonId: 257, name: 'Blaziken', cp: 9100, rarity: 'epic', isShiny: false },     prizeText: 'Blaziken CP 9100' },
  { day: 16, question: 'Hva heter den største ørkenen i verden?',         answers: ['sahara','antarktis'],                                                        prize: { type: 'coins', amount: 1800000 },                            prizeText: '1 800 000 💰' },
  { day: 17, question: 'Hva slags planet er Jorden?',                     answers: ['steinplanet','steinrik planet','jordnær planet','indre planet'],             prize: { type: 'pokemon', pokemonId: 95, name: 'Onix', cp: 8200, rarity: 'rare', isShiny: false },          prizeText: 'Onix CP 8200' },
  { day: 18, question: 'Hva heter dronningen av England nå?',             answers: ['camilla','queen camilla','konge charles','charles iii','charles 3'],         prize: { type: 'coins', amount: 2500000 },                            prizeText: '2 500 000 💰' },
  { day: 19, question: 'Hvor mange chromosomer har et menneske?',         answers: ['46','førtiseks','forti seks','forty six'],                                   prize: { type: 'pokemon', pokemonId: 142, name: 'Aerodactyl', cp: 9300, rarity: 'epic', isShiny: true },    prizeText: '✨ Shiny Aerodactyl CP 9300' },
  { day: 20, question: 'Hva heter den dypeste plassen i havet?',          answers: ['marianergropen','mariana gropen','mariana trench','marianer'],               prize: { type: 'coins', amount: 4500000 },                            prizeText: '4 500 000 💰' }
];

const NOON_OPEN_HOUR = 11;
const NOON_OPEN_MINUTE = 50;
const NOON_WINDOW_MINUTES = 2; // 2-min vindu: 11:50:00 → 11:51:59 inkluderer minutt 50 og 51

function getNoonDay() {
  // Bruker samme start-dato som morning quiz
  let q = readJson(QUIZ_FILE, {});
  if (!q.startDate) {
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
    q.startDate = today;
    q.claims = {};
    writeJson(QUIZ_FILE, q);
  }
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
  const start = new Date(q.startDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  const diff = Math.floor((now - start) / 86400000);
  return diff + 1; // dag 1 = startdato
}

function isNoonOpen(t) {
  // Åpent fra 11:50:00 til (11:50 + NOON_WINDOW_MINUTES):00
  const startMin = NOON_OPEN_HOUR * 60 + NOON_OPEN_MINUTE;
  const endMin = startMin + NOON_WINDOW_MINUTES;
  const nowMin = t.hour * 60 + t.minute;
  return nowMin >= startMin && nowMin < endMin;
}

function isBeforeNoon(t) {
  return (t.hour * 60 + t.minute) < (NOON_OPEN_HOUR * 60 + NOON_OPEN_MINUTE);
}

function generateRedeemCode() {
  // 8 tegn alfanumerisk uppercase
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unngå forvirrende 0/O/1/I
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

app.get('/api/quiz/noon', (req, res) => {
  const t = getNorwayTime();
  const bypassUser = (req.query.username || '').trim();
  const bypassKey = (req.query.bypass || '').trim();
  const isOwnerBypass = bypassKey === QUIZ_OWNER_BYPASS && bypassUser === QUIZ_OWNER_USERNAME;
  const day = getNoonDay();
  const quiz = NOON_QUIZ_SERIES.find(q => q.day === day);
  if (!quiz) {
    return res.json({ available: false, reason: 'finished', message: 'Ingen flere 11:50-quizer i serien — kom tilbake senere!' });
  }
  if (!isNoonOpen(t) && !isOwnerBypass) {
    const beforeNoon = isBeforeNoon(t);
    return res.json({
      available: false,
      reason: beforeNoon ? 'too_early' : 'window_closed',
      message: beforeNoon
        ? `11:50-quizen åpner kl 11:50 (kun ${NOON_WINDOW_MINUTES} min vindu!) — nå: ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
        : `11:50-quizen lukket kl 11:${String(NOON_OPEN_MINUTE + NOON_WINDOW_MINUTES).padStart(2,'0')} — kom tilbake i morgen!`,
      day
    });
  }
  const state = readJson(QUIZ_FILE, {});
  state.noonClaims = state.noonClaims || {};
  const todayKey = t.date;
  if (state.noonClaims[todayKey]) {
    return res.json({
      available: false,
      reason: 'claimed',
      claimedBy: state.noonClaims[todayKey].username,
      claimedAt: state.noonClaims[todayKey].claimedAt,
      question: quiz.question,
      prizeText: quiz.prizeText,
      day,
      message: `Allerede vunnet av ${state.noonClaims[todayKey].username} i dag`
    });
  }
  res.json({
    available: true,
    day,
    question: quiz.question,
    prizeText: quiz.prizeText,
    windowMinutes: NOON_WINDOW_MINUTES
  });
});

app.post('/api/quiz/noon/answer', (req, res) => {
  const { username, answer, bypass } = req.body || {};
  const u = (username || '').trim();
  const a = (answer || '').trim().toLowerCase();
  if (!u || !a) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const isOwnerBypass = bypass === QUIZ_OWNER_BYPASS && u === QUIZ_OWNER_USERNAME;
  const t = getNorwayTime();
  if (!isNoonOpen(t) && !isOwnerBypass) {
    return res.status(403).json({ ok: false, error: `Vinduet er lukket (åpent 11:50 - 11:${String(NOON_OPEN_MINUTE + NOON_WINDOW_MINUTES).padStart(2,'0')})` });
  }
  const day = getNoonDay();
  const quiz = NOON_QUIZ_SERIES.find(q => q.day === day);
  if (!quiz) return res.status(404).json({ ok: false, error: 'Ingen 11:50-quiz i dag' });
  const state = readJson(QUIZ_FILE, {});
  state.noonClaims = state.noonClaims || {};
  state.noonRedeemCodes = state.noonRedeemCodes || {};
  const todayKey = t.date;
  if (state.noonClaims[todayKey]) {
    return res.status(409).json({ ok: false, error: `Allerede vunnet av ${state.noonClaims[todayKey].username}` });
  }
  const correct = quiz.answers.some(ans => ans.toLowerCase() === a);
  if (!correct) {
    return res.json({ ok: false, correct: false, message: 'Feil svar! Prøv igjen.' });
  }
  // RIKTIG! Generer redemption-kode, IKKE gi premien enda
  const code = generateRedeemCode();
  state.noonRedeemCodes[code] = {
    username: u,
    prize: quiz.prize,
    prizeText: quiz.prizeText,
    issuedAt: new Date().toISOString(),
    redeemed: false,
    expiresAt: Date.now() + 24 * 3600 * 1000 // gyldig i 24 timer
  };
  state.noonClaims[todayKey] = { username: u, claimedAt: new Date().toISOString(), code };
  writeJson(QUIZ_FILE, state);
  res.json({ ok: true, correct: true, redeemCode: code, prizeText: quiz.prizeText });
});

// Innløs redemption-kode (kun den som vant kan bruke koden)
app.post('/api/quiz/noon/redeem', (req, res) => {
  const { username, code } = req.body || {};
  const u = (username || '').trim();
  const c = (code || '').trim().toUpperCase();
  if (!u || !c) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const state = readJson(QUIZ_FILE, {});
  state.noonRedeemCodes = state.noonRedeemCodes || {};
  const entry = state.noonRedeemCodes[c];
  if (!entry) return res.status(404).json({ ok: false, error: 'Ugyldig kode' });
  if (entry.username.toLowerCase() !== u.toLowerCase()) {
    return res.status(403).json({ ok: false, error: 'Denne koden er ikke din' });
  }
  if (entry.redeemed) return res.status(409).json({ ok: false, error: 'Koden er allerede løst inn' });
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    return res.status(410).json({ ok: false, error: 'Koden er utløpt (24 t etter utstedelse)' });
  }
  // Gi premien
  const users = readJson(USERS_FILE, {});
  if (!users[u]) return res.status(404).json({ ok: false, error: 'Brukerkonto ikke på serveren (sync først)' });
  try {
    const userState = users[u].state ? JSON.parse(users[u].state) : {};
    if (entry.prize.type === 'coins') {
      userState.coins = (userState.coins || 0) + entry.prize.amount;
      const scores = readJson(SCORES_FILE, {});
      if (scores[u]) { scores[u].coins = userState.coins; writeJson(SCORES_FILE, scores); }
    } else if (entry.prize.type === 'pokemon') {
      const p = entry.prize;
      if (!Array.isArray(userState.individuals)) userState.individuals = [];
      if (!userState.caught) userState.caught = {};
      if (!userState.seen) userState.seen = {};
      if (!userState.shinies) userState.shinies = {};
      if (!userState.shinySeen) userState.shinySeen = {};
      const uid = 'noon_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      userState.individuals.push({
        uid, id: p.pokemonId, name: p.name, rarity: p.rarity || 'epic',
        cp: p.cp, isShiny: !!p.isShiny, caughtAt: Date.now(), eventType: null, upgrades: 0
      });
      userState.caught[p.pokemonId] = (userState.caught[p.pokemonId] || 0) + 1;
      userState.seen[p.pokemonId] = true;
      if (p.isShiny) {
        userState.shinies[p.pokemonId] = (userState.shinies[p.pokemonId] || 0) + 1;
        userState.shinySeen[p.pokemonId] = true;
      }
      userState.totalCatches = (userState.totalCatches || 0) + 1;
    }
    users[u].state = JSON.stringify(userState);
    writeJson(USERS_FILE, users);
    entry.redeemed = true;
    entry.redeemedAt = new Date().toISOString();
    writeJson(QUIZ_FILE, state);
    res.json({ ok: true, prize: entry.prize, prizeText: entry.prizeText });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Hvilken dag er det? Basert på startdato lagret ved første call.
function getCurrentQuizDay() {
  let q = readJson(QUIZ_FILE, {});
  if (!q.startDate) {
    // Sett startdato til i dag (Norway timezone)
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
    q.startDate = today;
    q.claims = {};
    writeJson(QUIZ_FILE, q);
  }
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
  const start = new Date(q.startDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  const diffDays = Math.floor((now - start) / 86400000);
  return diffDays + 1; // dag 1 = startdato
}

const QUIZ_OWNER_BYPASS = 'kasper_owner_2026';
const QUIZ_OWNER_USERNAME = 'Kasperhallo0';

// Morgen-quiz hjelpere
function getMorningDay() {
  let q = readJson(QUIZ_FILE, {});
  if (!q.morningStartDate) {
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
    q.morningStartDate = today;
    writeJson(QUIZ_FILE, q);
  }
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).slice(0, 10);
  const start = new Date(q.morningStartDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  return Math.floor((now - start) / 86400000) + 1;
}
function isMorningOpen(t) {
  const startMin = MORNING_OPEN_HOUR * 60 + MORNING_OPEN_MINUTE;
  const endMin = startMin + MORNING_WINDOW_MINUTES;
  const nowMin = t.hour * 60 + t.minute;
  return nowMin >= startMin && nowMin < endMin;
}
function isBeforeMorning(t) {
  return (t.hour * 60 + t.minute) < (MORNING_OPEN_HOUR * 60 + MORNING_OPEN_MINUTE);
}

app.get('/api/quiz/today', (req, res) => {
  const t = getNorwayTime();
  const bypassUser = (req.query.username || '').trim();
  const bypassKey = (req.query.bypass || '').trim();
  const isOwnerBypass = bypassKey === QUIZ_OWNER_BYPASS && bypassUser === QUIZ_OWNER_USERNAME;
  const day = getMorningDay();
  const quiz = MORNING_QUIZ_SERIES.find(q => q.day === day);
  if (!quiz) {
    return res.json({ available: false, reason: 'finished', message: 'Ingen flere morgen-quizer i serien — kom tilbake senere!' });
  }
  if (!isMorningOpen(t) && !isOwnerBypass) {
    const beforeMorn = isBeforeMorning(t);
    return res.json({
      available: false,
      reason: beforeMorn ? 'too_early' : 'window_closed',
      message: beforeMorn
        ? `Morgen-quizen åpner kl 09:00 (kun ${MORNING_WINDOW_MINUTES} min vindu!) — nå: ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
        : `Morgen-quizen lukket kl 09:${String(MORNING_OPEN_MINUTE + MORNING_WINDOW_MINUTES).padStart(2,'0')} — kom tilbake i morgen!`,
      day
    });
  }
  const state = readJson(QUIZ_FILE, {});
  state.morningClaims = state.morningClaims || {};
  const todayKey = t.date;
  if (state.morningClaims[todayKey]) {
    return res.json({
      available: false,
      reason: 'claimed',
      claimedBy: state.morningClaims[todayKey].username,
      claimedAt: state.morningClaims[todayKey].claimedAt,
      question: quiz.question,
      prizeText: quiz.prizeText,
      day,
      message: `Allerede vunnet av ${state.morningClaims[todayKey].username} i dag`
    });
  }
  res.json({
    available: true,
    day,
    question: quiz.question,
    prizeText: quiz.prizeText,
    windowMinutes: MORNING_WINDOW_MINUTES
  });
});

app.post('/api/quiz/answer', (req, res) => {
  const { username, answer, bypass } = req.body || {};
  const u = (username || '').trim();
  const a = (answer || '').trim().toLowerCase();
  if (!u || !a) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const isOwnerBypass = bypass === QUIZ_OWNER_BYPASS && u === QUIZ_OWNER_USERNAME;
  const t = getNorwayTime();
  if (!isMorningOpen(t) && !isOwnerBypass) {
    return res.status(403).json({ ok: false, error: `Vinduet er lukket (åpent 09:00 - 09:${String(MORNING_OPEN_MINUTE + MORNING_WINDOW_MINUTES).padStart(2,'0')})` });
  }
  const day = getMorningDay();
  const quiz = MORNING_QUIZ_SERIES.find(q => q.day === day);
  if (!quiz) return res.status(404).json({ ok: false, error: 'Ingen morgen-quiz i dag' });
  const state = readJson(QUIZ_FILE, {});
  state.morningClaims = state.morningClaims || {};
  // Bruk SAMME redemption-pool som noon-quiz
  state.noonRedeemCodes = state.noonRedeemCodes || {};
  const todayKey = t.date;
  if (state.morningClaims[todayKey]) {
    return res.status(409).json({ ok: false, error: `Allerede vunnet av ${state.morningClaims[todayKey].username}` });
  }
  const correct = quiz.answers.some(ans => ans.toLowerCase() === a);
  if (!correct) {
    return res.json({ ok: false, correct: false, message: 'Feil svar! Prøv igjen.' });
  }
  // RIKTIG! Generer redemption-kode
  const code = generateRedeemCode();
  state.noonRedeemCodes[code] = {
    username: u,
    prize: quiz.prize,
    prizeText: quiz.prizeText,
    issuedAt: new Date().toISOString(),
    redeemed: false,
    expiresAt: Date.now() + 24 * 3600 * 1000,
    source: 'morning'
  };
  state.morningClaims[todayKey] = { username: u, claimedAt: new Date().toISOString(), code };
  writeJson(QUIZ_FILE, state);
  res.json({ ok: true, correct: true, redeemCode: code, prizeText: quiz.prizeText });
});

// === GAMMEL ENDEPUNKT (deaktivert - holdt for å unngå 404 hvis noen kaller den) ===
app.post('/api/quiz/answer-legacy-disabled', (req, res) => {
  return res.status(410).json({ ok: false, error: 'Deprecated' });
});
// Den gamle koden under er bevart for kompatibilitet men er ikke i bruk:
function _oldQuizAnswerCode() {
  if (false) {
  const u = '', a = '', day = 0, quiz = {};
  const users = readJson(USERS_FILE, {});
  if (!users[u]) return;
  try {
    const userState = users[u].state ? JSON.parse(users[u].state) : {};
    if (quiz.prize.type === 'coins') {
      userState.coins = (userState.coins || 0) + quiz.prize.amount;
    } else if (quiz.prize.type === 'pokemon') {
      const p = quiz.prize;
      if (!Array.isArray(userState.individuals)) userState.individuals = [];
      if (!userState.caught) userState.caught = {};
      if (!userState.seen) userState.seen = {};
      if (!userState.shinies) userState.shinies = {};
      if (!userState.shinySeen) userState.shinySeen = {};
      const uid = 'quiz_' + Math.floor(Math.random() * 100000);
      userState.individuals.push({
        uid, id: p.pokemonId, name: p.pokemonName, rarity: p.rarity,
        cp: p.cp, isShiny: !!p.isShiny, caughtAt: Date.now(), eventType: null, upgrades: 0
      });
    }
    users[u].state = JSON.stringify(userState);
    writeJson(USERS_FILE, users);
  } catch (e) {}
  }
}

// === GAME VERSION — bumpes hver gang vi deployer ===
const GAME_VERSION = '2026.06.03.42';
app.get('/api/version', (req, res) => {
  res.json({ version: GAME_VERSION, timestamp: Date.now() });
});

// === EXPLORE MULTIPLAYER ===
// In-memory: { area: { username: { x, y, dir, walkFrame, lastSeen, chat?, chatExpiresAt? } } }
const explorePlayers = {};

function pruneExplorePlayers() {
  const now = Date.now();
  for (const area of Object.keys(explorePlayers)) {
    for (const u of Object.keys(explorePlayers[area])) {
      if (now - explorePlayers[area][u].lastSeen > 8000) {
        delete explorePlayers[area][u];
      }
    }
    if (Object.keys(explorePlayers[area]).length === 0) delete explorePlayers[area];
  }
}

app.post('/api/explore/position', (req, res) => {
  const d = req.body || {};
  const username = (d.username || '').trim();
  const area = String(d.area || 0);
  if (!username) return res.status(400).json({ ok: false });
  if (!explorePlayers[area]) explorePlayers[area] = {};
  const existing = explorePlayers[area][username] || {};
  explorePlayers[area][username] = {
    x: parseInt(d.x) || 0,
    y: parseInt(d.y) || 0,
    dir: (d.dir || 'down'),
    walkFrame: parseInt(d.walkFrame) || 0,
    lastSeen: Date.now(),
    chat: existing.chat,
    chatExpiresAt: existing.chatExpiresAt
  };
  // Hvis brukeren skiftet område, fjern fra andre områder
  for (const a of Object.keys(explorePlayers)) {
    if (a !== area && explorePlayers[a][username]) delete explorePlayers[a][username];
  }
  pruneExplorePlayers();
  res.json({ ok: true });
});

app.get('/api/explore/players', (req, res) => {
  const area = String(req.query.area || 0);
  const excludeUser = (req.query.exclude || '').trim();
  pruneExplorePlayers();
  const players = explorePlayers[area] || {};
  const result = [];
  const now = Date.now();
  for (const [u, p] of Object.entries(players)) {
    if (u === excludeUser) continue;
    result.push({
      username: u,
      x: p.x, y: p.y, dir: p.dir, walkFrame: p.walkFrame || 0,
      chat: (p.chatExpiresAt && now < p.chatExpiresAt) ? p.chat : null
    });
  }
  res.json({ players: result });
});

// In-memory chat-historikk per område (siste 30 meldinger, 10 min)
const exploreAreaChats = {};

function pruneAreaChats() {
  const now = Date.now();
  for (const area of Object.keys(exploreAreaChats)) {
    exploreAreaChats[area] = exploreAreaChats[area].filter(m => now - m.time < 600000);
    if (exploreAreaChats[area].length > 30) {
      exploreAreaChats[area] = exploreAreaChats[area].slice(-30);
    }
  }
}

app.post('/api/explore/chat', (req, res) => {
  const d = req.body || {};
  const username = (d.username || '').trim();
  const area = String(d.area || 0);
  const message = censorText(String(d.message || '').trim().slice(0, 150));
  if (!username || !message) return res.status(400).json({ ok: false });
  if (!explorePlayers[area]) explorePlayers[area] = {};
  if (!explorePlayers[area][username]) {
    explorePlayers[area][username] = { x: 0, y: 0, dir: 'down', walkFrame: 0, lastSeen: Date.now() };
  }
  explorePlayers[area][username].chat = message;
  explorePlayers[area][username].chatExpiresAt = Date.now() + 6000;
  explorePlayers[area][username].lastSeen = Date.now();
  // Lagre i historikk
  if (!exploreAreaChats[area]) exploreAreaChats[area] = [];
  exploreAreaChats[area].push({ username, message, time: Date.now() });
  pruneAreaChats();
  res.json({ ok: true });
});

app.get('/api/explore/chats', (req, res) => {
  const area = String(req.query.area || 0);
  pruneAreaChats();
  res.json({ chats: exploreAreaChats[area] || [] });
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
