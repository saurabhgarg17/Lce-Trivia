# LCE Trivia

A Kahoot-style multiplayer trivia game.

- **Backend** – `Trivia.Api`: ASP.NET Core (.NET 10) Web API + SignalR, MongoDB storage.
- **Frontend** – `web`: React + TypeScript (Vite). Any client (iOS/Android) can use the same REST API and SignalR hub.

## Run

```powershell
docker compose up -d                 # MongoDB on :27017 (or point Mongo:ConnectionString at your own)
cd Trivia.Api; dotnet run            # http://localhost:5154
cd web; npm install; npm run dev     # http://localhost:5173 (proxies /api, /hubs, /uploads to the API)
```

Open the app, create a trivia (questions with image / GIF / YouTube media, uploads supported), click **Host**, and have friends open the site and enter the 6-digit PIN.

## API for clients

REST (`/api`): `GET/POST /quizzes`, `GET/PUT/DELETE /quizzes/{id}`, `POST /games {quizId}` → `{code, hostToken}`, `GET /games/{code}`, `POST /media` (multipart `file`).

SignalR hub `/hubs/game`. Methods: `HostConnect(code, hostToken)`, `HostNext(code, hostToken)`, `Join(code, name)` → `{playerId, error}`, `Rejoin(code, playerId)`, `SubmitAnswer(code, playerId, choice)`. The server pushes one `state` event (phase: `lobby | question | reveal | leaderboard | finished`) to each connection on every change, so clients simply render the latest state. Reconnect by calling `Rejoin`/`HostConnect` again.

Scoring: points scale with answer speed (up to the question's points, half for the last second) plus a streak bonus. Finished games are stored in the `gameResults` collection. Set `VITE_API_URL` when the API is hosted on another origin.
