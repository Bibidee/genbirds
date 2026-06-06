"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Level } from "@/data/levels";
import { BIRDS, BirdDef } from "@/data/birds";
import { SLING, WORLD, launchVector } from "@/lib/physics";
import { Launch } from "@/lib/replay";

type Phase = "ready" | "aim" | "flying" | "settling" | "ended";

export interface GameState {
  score: number;            // total = baseScore + completionBonus + unusedBirdBonus
  baseScore: number;        // enemies*1000 + blocks*100, ticks during gameplay
  completionBonus: number;  // 1500 on win, 0 otherwise
  unusedBirdBonus: number;  // unusedBirds * 500 on win
  unusedBirds: number;      // birds.length - (birdsUsed including killing-blow bird)
  birdsUsed: number;
  enemiesDestroyed: number;
  blocksDestroyed: number;
  remainingBirds: number;
  current: BirdDef | null;
  phase: Phase;
  won: boolean;
  launches: Launch[];
}

export default function GameCanvas({
  level,
  onState,
  onEnd,
}: {
  level: Level;
  onState: (s: GameState) => void;
  onEnd: (s: GameState) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>({
    score: 0, baseScore: 0, completionBonus: 0, unusedBirdBonus: 0, unusedBirds: 0,
    birdsUsed: 0, enemiesDestroyed: 0, blocksDestroyed: 0,
    remainingBirds: level.birds.length,
    current: BIRDS[level.birds[0]],
    phase: "ready", won: false, launches: [],
  });
  const [, force] = useState(0);

  // Matter refs
  const matterRef = useRef<any>(null);
  const engineRef = useRef<any>(null);
  const runnerRef = useRef<any>(null);
  const birdBodyRef = useRef<any>(null);
  const enemyBodiesRef = useRef<Map<any, { hp: number; max: number }>>(new Map());
  const blockBodiesRef = useRef<Map<any, { hp: number; kind: string }>>(new Map());
  const settleSinceRef = useRef<number>(0);
  const flightStartRef = useRef<number>(0);
  const draggingRef = useRef<{ x: number; y: number } | null>(null);
  const abilityUsedRef = useRef(false);
  const worldReadyAtRef = useRef<number>(0);
  const abilityFxRef = useRef<{ x: number; y: number; t: number; color: string } | null>(null);
  const bgCacheRef = useRef<{ w: number; h: number; canvas: HTMLCanvasElement } | null>(null);

  const pushState = useCallback((patch?: Partial<GameState>) => {
    if (patch) stateRef.current = { ...stateRef.current, ...patch };
    onState({ ...stateRef.current });
    force(v => v + 1);
  }, [onState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Matter = (await import("matter-js")).default;
      if (cancelled) return;
      matterRef.current = Matter;
      const engine = Matter.Engine.create({
        positionIterations: 6,
        velocityIterations: 4,
        constraintIterations: 2,
        enableSleeping: false,   // sleeping introduced wake-edge cases that could stall the bird in flight
      });
      engine.gravity.y = 1.1;
      engine.timing.timeScale = 1.4;
      engineRef.current = engine;
      const world = engine.world;

      // Ground & walls
      const ground = Matter.Bodies.rectangle(WORLD.width / 2, WORLD.groundY + 30, WORLD.width + 200, 60, { isStatic: true, label: "ground" });
      const leftWall = Matter.Bodies.rectangle(-30, WORLD.height / 2, 60, WORLD.height * 2, { isStatic: true, label: "wall" });
      const rightWall = Matter.Bodies.rectangle(WORLD.width + 30, WORLD.height / 2, 60, WORLD.height * 2, { isStatic: true, label: "wall" });
      Matter.World.add(world, [ground, leftWall, rightWall]);

      // Blocks
      for (const b of level.blocks) {
        const density = b.kind === "stone" ? 0.005 : b.kind === "wood" ? 0.002 : 0.0012;
        const body = Matter.Bodies.rectangle(b.x, b.y, b.w, b.h, { density, friction: 0.6, restitution: 0.05, label: "block" });
        const hp = b.kind === "stone" ? 60 : b.kind === "wood" ? 30 : 12;
        blockBodiesRef.current.set(body, { hp, kind: b.kind });
        Matter.World.add(world, body);
      }
      // Enemies (circles)
      for (const e of level.enemies) {
        const body = Matter.Bodies.circle(e.x, e.y, e.r, { density: 0.0015, restitution: 0.2, friction: 0.5, label: "enemy" });
        enemyBodiesRef.current.set(body, { hp: e.hp * 20, max: e.hp * 20 });
        Matter.World.add(world, body);
      }

      // Mark a settle window — initial overlaps/contacts shouldn't count as hits.
      worldReadyAtRef.current = performance.now();

      // Damage on collisions.
      // NOTE: do NOT call pushState() in here — collisions can fire many times
      // per frame and each call schedules a React render. The render loop below
      // already pushes state on the RAF cadence, which is plenty.
      Matter.Events.on(engine, "collisionStart", (ev: any) => {
        // Settle window: ignore the first ~350ms while bodies rest into place.
        // Short enough that a fast launch isn't penalised.
        if (performance.now() - worldReadyAtRef.current < 350) return;
        for (const pair of ev.pairs) {
          const a = pair.bodyA, b = pair.bodyB;
          // Require at least one body to be moving meaningfully — resting
          // contacts must not tick HP. Use absolute speeds, not just relative.
          const sa = Math.hypot(a.velocity.x, a.velocity.y);
          const sb = Math.hypot(b.velocity.x, b.velocity.y);
          if (sa < 5 && sb < 5) continue;
          const speed = Math.hypot((a.velocity.x - b.velocity.x), (a.velocity.y - b.velocity.y));
          const impact = speed * 3;
          if (impact < 6) continue;
          [a, b].forEach(body => {
            const eH = enemyBodiesRef.current.get(body);
            if (eH) {
              eH.hp -= impact;
              if (eH.hp <= 0) {
                Matter.World.remove(world, body);
                enemyBodiesRef.current.delete(body);
                const s = stateRef.current;
                s.enemiesDestroyed += 1;
                s.baseScore += 1000;
                s.score = s.baseScore + s.completionBonus + s.unusedBirdBonus;
              }
            }
            const bH = blockBodiesRef.current.get(body);
            if (bH) {
              bH.hp -= impact;
              if (bH.hp <= 0) {
                Matter.World.remove(world, body);
                blockBodiesRef.current.delete(body);
                const s = stateRef.current;
                s.blocksDestroyed += 1;
                s.baseScore += 100;
                s.score = s.baseScore + s.completionBonus + s.unusedBirdBonus;
              }
            }
          });
        }
      });

      // Use Matter.Runner — battle-tested fixed-delta loop.
      const runner = Matter.Runner.create();
      runnerRef.current = runner;
      Matter.Runner.run(runner, engine);

      // Spawn the first bird on the sling
      spawnNextBird(Matter);

      // Separate render loop so the canvas paints at display refresh while
      // the physics engine runs at its own pace.
      let raf = 0;
      let lastPush = 0;
      const draw = () => {
        renderScene();
        checkPhase(Matter);
        const now = performance.now();
        if (now - lastPush > 200) {
          lastPush = now;
          pushState();
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);

      // cleanup
      (engine as any)._cleanup = () => {
        cancelAnimationFrame(raf);
        try { Matter.Runner.stop(runner); } catch {}
        Matter.World.clear(world, false);
        Matter.Engine.clear(engine);
      };
    })();

    return () => {
      cancelled = true;
      const eng = engineRef.current as any;
      if (eng && eng._cleanup) eng._cleanup();
      engineRef.current = null;
      birdBodyRef.current = null;
      enemyBodiesRef.current.clear();
      blockBodiesRef.current.clear();
    };

  }, [level.id]);

  function spawnNextBird(Matter: any) {
    const s = stateRef.current;
    if (s.remainingBirds <= 0) return;
    const def = BIRDS[level.birds[s.birdsUsed]];
    const body = Matter.Bodies.circle(SLING.x, SLING.y - 10, 18, {
      density: 0.004 * def.weight,
      restitution: 0.35, friction: 0.6,
      frictionAir: 0.002,   // very low drag → bird glides further, feels faster
      label: "bird",
    });
    Matter.Body.setStatic(body, true);
    Matter.World.add(engineRef.current.world, body);
    birdBodyRef.current = body;
    abilityUsedRef.current = false;
    s.current = def;
    s.phase = "ready";
    pushState();
  }

  function checkPhase(Matter: any) {
    const s = stateRef.current;
    if (s.phase !== "flying") return;
    const body = birdBodyRef.current;
    if (!body) return;

    const now = performance.now();
    const v = Math.hypot(body.velocity.x, body.velocity.y);
    const settled =
      v < 1.5 ||                                      // slower → more permissive
      body.position.y > WORLD.groundY - 18 ||         // touching ground
      body.position.x > WORLD.width - 18 ||           // off right edge
      body.position.x < 18 ||                         // off left edge
      body.isSleeping === true;                       // Matter has put it to sleep
    const flightTooLong = now - flightStartRef.current > 8000; // hard 8s cap

    if (settled || flightTooLong) {
      if (!settleSinceRef.current) settleSinceRef.current = now;
      // 300 ms continuous "settled" → retire bird. Shorter than before so
      // the next bird spawns promptly.
      if (now - settleSinceRef.current > 300 || flightTooLong) {
        try { Matter.World.remove(engineRef.current.world, body); } catch {}
        birdBodyRef.current = null;
        settleSinceRef.current = 0;
        flightStartRef.current = 0;
        s.birdsUsed += 1;
        s.remainingBirds = Math.max(0, level.birds.length - s.birdsUsed);
        if (enemyBodiesRef.current.size === 0) endLevel(true);
        else if (s.remainingBirds <= 0) endLevel(false);
        else spawnNextBird(Matter);
        pushState(); // immediate push so the UI flips state right away
      }
    } else {
      settleSinceRef.current = 0;
    }
  }

  function endLevel(won: boolean) {
    const s = stateRef.current;
    if (s.phase === "ended") return;
    s.phase = "ended";
    s.won = won;
    if (won) {
      // checkPhase increments birdsUsed and updates remainingBirds BEFORE
      // calling endLevel, so the killing-blow bird is already accounted for.
      // remainingBirds is the true count of unused birds — no -1 correction.
      const unused = Math.max(0, s.remainingBirds);
      s.completionBonus = 1500;
      s.unusedBirdBonus = unused * 500;
      s.unusedBirds = unused;
      s.score = s.baseScore + s.completionBonus + s.unusedBirdBonus;
    } else {
      s.completionBonus = 0;
      s.unusedBirdBonus = 0;
      s.unusedBirds = 0;
      s.score = s.baseScore;
    }
    pushState();
    onEnd({ ...s });
  }

  function renderScene() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const sx = W / WORLD.width, sy = H / WORLD.height;

    // ---- Cached static background (sky + sun + hills + ground + slingshot) ----
    // Built once per canvas size. createLinearGradient was the dominant cost
    // when redrawn every frame; this turns the whole backdrop into a single
    // drawImage call.
    let bg = bgCacheRef.current;
    if (!bg || bg.w !== W || bg.h !== H) {
      const off = document.createElement("canvas");
      off.width = W; off.height = H;
      const c = off.getContext("2d")!;
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#bfe6ff"); sky.addColorStop(1, "#7ec8ff");
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = "#ffd23f"; c.beginPath(); c.arc(W - 90, 90, 40, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#5fbf3f";
      c.beginPath();
      c.moveTo(0, H * 0.85);
      c.bezierCurveTo(W * 0.25, H * 0.7, W * 0.5, H * 0.9, W, H * 0.78);
      c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      c.fillStyle = "#76c043"; c.fillRect(0, WORLD.groundY * sy, W, H - WORLD.groundY * sy);
      c.fillStyle = "#5aa030"; c.fillRect(0, WORLD.groundY * sy, W, 6);
      c.fillStyle = "#7a4a1f";
      c.fillRect((SLING.x - 8) * sx, SLING.y * sy, 16 * sx, 120 * sy);
      c.fillRect((SLING.x - 14) * sx, (SLING.y - 6) * sy, 28 * sx, 12 * sy);
      bg = { w: W, h: H, canvas: off };
      bgCacheRef.current = bg;
    }
    ctx.drawImage(bg.canvas, 0, 0);

    // Blocks
    for (const [body, info] of blockBodiesRef.current) {
      const { kind } = info;
      const fill = kind === "stone" ? "#9aa0a6" : kind === "wood" ? "#c9893b" : "rgba(191,234,255,0.85)";
      const stroke = kind === "stone" ? "#5e6266" : kind === "wood" ? "#7a4a1f" : "#7fc6e8";
      drawBody(ctx, body, sx, sy, fill, stroke);
    }
    // Enemies — flat fill + cheap highlight (createRadialGradient per body
    // per frame was a major fps sink; this draws ~3× faster).
    ctx.lineWidth = 2;
    for (const [body, info] of enemyBodiesRef.current) {
      const r = (body.circleRadius || 20) * sx;
      const px = body.position.x * sx, py = body.position.y * sy;
      const hpFrac = Math.max(0, info.hp / info.max);
      ctx.fillStyle = "#76c043";
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#2e6b1f"; ctx.stroke();
      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath(); ctx.arc(px - r * 0.35, py - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
      // eyes
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px - r * 0.35, py - r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.arc(px + r * 0.35, py - r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a2238"; ctx.beginPath(); ctx.arc(px - r * 0.30, py - r * 0.22, r * 0.10, 0, Math.PI * 2); ctx.arc(px + r * 0.40, py - r * 0.22, r * 0.10, 0, Math.PI * 2); ctx.fill();
      // hp bar
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(px - r, py - r - 10, r * 2, 4);
      ctx.fillStyle = hpFrac > 0.5 ? "#5fcf52" : hpFrac > 0.25 ? "#ffd23f" : "#ef3a3a";
      ctx.fillRect(px - r, py - r - 10, r * 2 * hpFrac, 4);
    }

    // Bird
    const bird = birdBodyRef.current;
    if (bird) {
      const def = stateRef.current.current!;
      const r = 18 * sx, px = bird.position.x * sx, py = bird.position.y * sy;
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#1a2238"; ctx.lineWidth = 2; ctx.stroke();
      // eye
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px + r * 0.3, py - r * 0.2, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a2238"; ctx.beginPath(); ctx.arc(px + r * 0.4, py - r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
      // beak
      ctx.fillStyle = "#ffb43a"; ctx.beginPath();
      ctx.moveTo(px + r * 0.8, py); ctx.lineTo(px + r * 1.4, py - r * 0.2); ctx.lineTo(px + r * 0.8, py + r * 0.2);
      ctx.closePath(); ctx.fill();
    }

    // Ability flash — expanding ring + label so taps always have feedback.
    if (abilityFxRef.current) {
      const fx = abilityFxRef.current;
      const elapsed = performance.now() - fx.t;
      const dur = 520;
      if (elapsed < dur) {
        const k = elapsed / dur;
        const cx = fx.x * sx, cy = fx.y * sy;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 6 * (1 - k) + 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 12 + k * 60, 0, Math.PI * 2);
        ctx.stroke();
        // Inner burst
        ctx.fillStyle = fx.color;
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 8 + k * 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        abilityFxRef.current = null;
      }
    }

    // Aim line
    if (draggingRef.current) {
      const d = draggingRef.current;
      ctx.setLineDash([8, 6]); ctx.strokeStyle = "rgba(26,34,56,0.55)"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SLING.x * sx, SLING.y * sy);
      ctx.lineTo(d.x * sx, d.y * sy);
      ctx.stroke();
      ctx.setLineDash([]);
      // band
      ctx.strokeStyle = "#3a1a00"; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo((SLING.x - 12) * sx, (SLING.y - 6) * sy);
      ctx.lineTo(d.x * sx, d.y * sy);
      ctx.lineTo((SLING.x + 12) * sx, (SLING.y - 6) * sy);
      ctx.stroke();
    }
  }

  function drawBody(ctx: CanvasRenderingContext2D, body: any, sx: number, sy: number, fill: string, stroke: string) {
    ctx.save();
    ctx.translate(body.position.x * sx, body.position.y * sy);
    ctx.rotate(body.angle);
    const v = body.vertices;
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < v.length; i++) {
      const x = (v[i].x - body.position.x) * sx;
      const y = (v[i].y - body.position.y) * sy;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function getPointer(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const wx = (e.clientX - rect.left) / rect.width * WORLD.width;
    const wy = (e.clientY - rect.top) / rect.height * WORLD.height;
    return { x: wx, y: wy };
  }

  function applyAbility() {
    if (abilityUsedRef.current) return;
    const s = stateRef.current;
    const body = birdBodyRef.current;
    const Matter = matterRef.current;
    if (!body || !s.current || !Matter || s.phase !== "flying") return;
    abilityUsedRef.current = true;
    abilityFxRef.current = { x: body.position.x, y: body.position.y, t: performance.now(), color: s.current.color };
    const ab = s.current.ability;
    if (ab === "balanced") {
      // Ruby Rocket — forward thrust boost so the tap always does something.
      const v = body.velocity;
      const len = Math.hypot(v.x, v.y) || 1;
      Matter.Body.setVelocity(body, { x: v.x + (v.x / len) * 6, y: v.y + (v.y / len) * 4 });
    } else if (ab === "dash") {
      const v = body.velocity;
      Matter.Body.setVelocity(body, { x: v.x * 2.4, y: v.y * 1.4 - 2 });
    } else if (ab === "heavy") {
      Matter.Body.setVelocity(body, { x: body.velocity.x, y: body.velocity.y + 10 });
    } else if (ab === "curve") {
      Matter.Body.setVelocity(body, { x: body.velocity.x * 0.6, y: body.velocity.y - 8 });
    } else if (ab === "drop") {
      const egg = Matter.Bodies.circle(body.position.x, body.position.y + 24, 10, { density: 0.006, label: "bird" });
      Matter.World.add(engineRef.current.world, egg);
    } else if (ab === "split") {
      const v = body.velocity;
      const kids = [-0.6, 0, 0.6].map(off => {
        const k = Matter.Bodies.circle(body.position.x, body.position.y, 12, { density: 0.003, label: "bird" });
        Matter.Body.setVelocity(k, { x: v.x + off * 6, y: v.y + off * 3 });
        return k;
      });
      Matter.World.remove(engineRef.current.world, body);
      birdBodyRef.current = kids[1];
      Matter.World.add(engineRef.current.world, kids);
    } else if (ab === "explode") {
      // delayed boom
      setTimeout(() => {
        if (!engineRef.current) return;
        const cx = body.position.x, cy = body.position.y;
        const radius = 110;
        for (const [enemy, info] of enemyBodiesRef.current) {
          const d = Math.hypot(enemy.position.x - cx, enemy.position.y - cy);
          if (d < radius) {
            info.hp -= 50;
            const f = (radius - d) / radius;
            Matter.Body.applyForce(enemy, enemy.position, { x: (enemy.position.x - cx) * 0.0008 * f, y: (enemy.position.y - cy) * 0.0008 * f });
            if (info.hp <= 0) {
              Matter.World.remove(engineRef.current.world, enemy);
              enemyBodiesRef.current.delete(enemy);
              const s2 = stateRef.current; s2.enemiesDestroyed += 1; s2.baseScore += 1000; s2.score = s2.baseScore + s2.completionBonus + s2.unusedBirdBonus;
            }
          }
        }
        for (const [block, info] of blockBodiesRef.current) {
          const d = Math.hypot(block.position.x - cx, block.position.y - cy);
          if (d < radius) {
            info.hp -= 60;
            const f = (radius - d) / radius;
            Matter.Body.applyForce(block, block.position, { x: (block.position.x - cx) * 0.0008 * f, y: (block.position.y - cy) * 0.0008 * f });
            if (info.hp <= 0) {
              Matter.World.remove(engineRef.current.world, block);
              blockBodiesRef.current.delete(block);
              const s2 = stateRef.current; s2.blocksDestroyed += 1; s2.baseScore += 100; s2.score = s2.baseScore + s2.completionBonus + s2.unusedBirdBonus;
            }
          }
        }
        pushState();
      }, 600);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    const s = stateRef.current;
    if (s.phase === "flying") { applyAbility(); return; }
    if (s.phase !== "ready") return;
    const p = getPointer(e);
    if (Math.hypot(p.x - SLING.x, p.y - SLING.y) > 240) return;
    draggingRef.current = { x: p.x, y: p.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    s.phase = "aim"; pushState();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const p = getPointer(e);
    const dx = p.x - SLING.x, dy = p.y - SLING.y;
    const len = Math.hypot(dx, dy);
    const max = SLING.range;
    const clamped = len > max ? { x: SLING.x + dx / len * max, y: SLING.y + dy / len * max } : p;
    draggingRef.current = clamped;
    const bird = birdBodyRef.current;
    const Matter = matterRef.current;
    if (bird && Matter) {
      // Move via Matter API so previousPosition stays in sync (Verlet integration).
      Matter.Body.setPosition(bird, { x: clamped.x, y: clamped.y });
    }
    force(v => v + 1);
  }
  function onPointerUp() {
    if (!draggingRef.current) return;
    const s = stateRef.current;
    const drag = draggingRef.current;
    draggingRef.current = null;
    const body = birdBodyRef.current;
    const Matter = matterRef.current;
    if (!body || !Matter) return;
    // Snap to drag point cleanly, then unfreeze, then apply velocity.
    // Order matters: setStatic must come BEFORE setVelocity, and we reset
    // previousPosition (via setPosition) so Verlet doesn't overwrite velocity.
    Matter.Body.setPosition(body, { x: drag.x, y: drag.y });
    Matter.Body.setStatic(body, false);
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
    const { vx, vy, angle, magnitude } = launchVector(drag.x, drag.y, 1.0);
    Matter.Body.setVelocity(body, { x: vx, y: vy });
    s.phase = "flying";
    settleSinceRef.current = 0;
    flightStartRef.current = performance.now();
    s.launches.push({ birdType: s.current!.type, angle, power: magnitude, timestamp: Date.now() });
    pushState();
  }

  // resize handling
  useEffect(() => {
    const onResize = () => {
      const wrap = wrapRef.current, canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const w = wrap.clientWidth;
      const h = w * (WORLD.height / WORLD.width);
      canvas.width = w; canvas.height = h;
      bgCacheRef.current = null; // force background rebuild for new dimensions
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full rounded-3xl overflow-hidden shadow-juicy border-4 border-white/70 select-none touch-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-auto bg-sky-200"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="absolute top-3 left-3 panel px-3 py-1 text-xs font-bold">
        {stateRef.current.phase === "flying"
          ? (abilityUsedRef.current
              ? `${stateRef.current.current?.name} — ability used`
              : `Click anywhere to use ${stateRef.current.current?.name}’s ability (${stateRef.current.current?.ability})`)
          : stateRef.current.phase === "ready" ? "Drag the bird to aim" : ""}
      </div>
    </div>
  );
}
