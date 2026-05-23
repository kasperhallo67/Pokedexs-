# Pokémon Samler 🎮

Et komplett Pokémon-fanger-spill med Pokédex, butikk, trading, casino (Plinko/Mines/Poker/Blackjack/Texas Hold'em), Team Rocket-utfordringer, og mer.

## 🚀 Kjøre lokalt

```bash
npm install
npm start
```

Spillet kjører på http://localhost:8765 (eller PORT-miljøvariabelen).

## ☁️ Deploy til Render (gratis)

1. Push prosjektet til GitHub
2. Opprett konto på [render.com](https://render.com)
3. Klikk **New +** → **Web Service**
4. Velg GitHub-repoet ditt
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Plan: **Free**
8. Klikk **Create Web Service**

Etter 1-2 minutter er spillet live på `https://<navn>.onrender.com`.

## 📂 Datalagring

Spillet bruker JSON-filer i `DATA_DIR` (default: prosjektmappen):
- `scores.json` — toppliste
- `users.json` — konto+passord+spilltilstand
- `trades.json` — handelstilbud
- `poker.json` — pokerrom

⚠️ **Merk:** På Render free tier nullstilles data ved ny deploy. For permanent lagring kan du
koble til ekstern database (Render PostgreSQL, Supabase, osv.).
