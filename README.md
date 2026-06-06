# GenBirds

A beautiful, original physics-puzzle arcade where the **frontend** runs the gameplay
and **GenLayer** acts as the intelligent verification + anti-cheat layer.

> Original IP. Inspired by physics bird-launch puzzles but uses original characters,
> art, naming, and palette. No Rovio assets.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Matter.js for real-time physics
- `genlayer-js` for contract integration (optional at runtime — local fallback included)
- `viem` available where chain helpers are needed

## Quickstart

```bash
npm install
cp .env.example .env.local   # then edit values
npm run dev
npm run build
```

Open <http://localhost:3000>.

## Environment

```
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=
NEXT_PUBLIC_GENLAYER_RPC_URL=
```

If the contract is unconfigured, the app runs in **Local mode**: attempts and
leaderboard are stored in `localStorage` and judged client-side using the same
rules the contract enforces. Set both values to enable Chain mode.

## Pages

- `/` — landing, hero, flock, featured levels
- `/play` — level select (5 hand-tuned levels)
- `/play/[levelId]` — physics gameplay, scoring, verification panel
- `/leaderboard` — VALID-only verified scores
- `/daily` — daily-rotating featured level
- `/builder` — quick SVG layout sketcher; exports JSON for `data/levels.ts`
- `/profile` — your player ID and attempt history

## The flock

Original arcade birds with distinct abilities:

| Name           | Color  | Ability  |
|----------------|--------|----------|
| Ruby Rocket    | Red    | balanced |
| Solar Beak     | Yellow | dash     |
| Aqua Trio      | Blue   | split    |
| Boombeak       | Black  | explode  |
| Emerald Arc    | Green  | curve    |
| Cloud Dropper  | White  | drop     |
| Violet Boulder | Purple | heavy    |

Tap while a bird is flying to trigger its ability.

## Gameplay loop

1. Pick a level on `/play`.
2. Drag the bird back from the slingshot to aim; release to launch.
3. Tap mid-flight to fire the bird's ability.
4. Destroy all green enemies before you run out of birds.
5. End-of-level modal: **Submit to GenLayer** to verify and queue for the leaderboard.

## Submitting an attempt

The client builds a compact replay:

```ts
{
  levelId, levelHash,
  birdsUsed, launches: [{birdType, angle, power, timestamp}],
  claimedScore, enemiesDestroyed, blocksDestroyed, remainingBirds,
  physicsSummaryHash, replayHash
}
```

Then calls `submitAttempt(level, player, replay)` in `lib/genlayer.ts`. The same
shape is sent to the contract method `submit_attempt` once Chain mode is on.

Verdicts returned: `PENDING | VALID | INVALID | SUSPICIOUS | NEEDS_REVIEW`.
Only `VALID` attempts count for the leaderboard.

## Contract

Source: [`contracts/GenBirdsScoreRegistry.py`](contracts/GenBirdsScoreRegistry.py).

It exposes:

- `register_level(level_id, level_hash, max_score, bird_count, enemy_count, block_count)`
- `submit_attempt(...)` — runs structural checks + an optional LLM plausibility prompt
- `review_attempt(attempt_id, new_verdict, reason)` — owner-only
- `flag_attempt(attempt_id, reason)` — community-flag
- `get_level / get_attempt / get_player_best / get_level_best / get_player_attempts`

Deploy via the GenLayer Studio / CLI of your choice, then put the deployed address
into `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`. Call `register_level` for each level
in `data/levels.ts` from the owner account before play.

## Known limitations

- Chain calls in `lib/genlayer.ts` are wired as a shim that falls back to local
  storage if `genlayer-js` isn't available at runtime. Replace the `tryGenLayer`
  block with the project's real client once you've picked a deployment.
- The `/builder` page is a minimal sketcher — exports JSON only, no in-app save.
- Sound effects are not bundled (toggle reserved for a future pass).
- This repo doesn't run `npm install` for you (per project workflow); install
  once locally before `npm run dev` or `npm run build`.

## Structure

```
app/                Next.js routes (home, play, leaderboard, daily, builder, profile)
components/
  game/             GameCanvas, ScorePanel, VerificationPanel, modal, etc.
  layout/           Navbar, Footer
  ui/               Button, Card, Toast
contracts/          GenBirdsScoreRegistry.py
data/               birds.ts, levels.ts
lib/                physics, scoring, replay, hashing, genlayer, utils
```
