import "./style.css";

const COURSES = {
  samarahan: {
    name: "Samarahan CC",
    teeName: "Blue Tees",
    totalYardage: 6370,
    courseRating: 71.1,
    slopeRating: 133,
    holes: [
      { num: 1, dist: 380 },
      { num: 2, dist: 364 },
      { num: 3, dist: 137 },
      { num: 4, dist: 506 },
      { num: 5, dist: 165 },
      { num: 6, dist: 312 },
      { num: 7, dist: 328 },
      { num: 8, dist: 553 },
      { num: 9, dist: 340 },
      { num: 10, dist: 395 },
      { num: 11, dist: 340 },
      { num: 12, dist: 349 },
      { num: 13, dist: 412 },
      { num: 14, dist: 531 },
      { num: 15, dist: 196 },
      { num: 16, dist: 405 },
      { num: 17, dist: 157 },
      { num: 18, dist: 500 },
    ],
  },
  pebble: {
    name: "Pebble Beach",
    teeName: "Gold Tees",
    totalYardage: 6392,
    courseRating: 73.6,
    slopeRating: 140,
    holes: [
      { num: 1, dist: 380 },
      { num: 2, dist: 502 },
      { num: 3, dist: 390 },
      { num: 4, dist: 180 },
      { num: 5, dist: 530 },
      { num: 6, dist: 202 },
      { num: 7, dist: 106 },
      { num: 8, dist: 430 },
      { num: 9, dist: 464 },
      { num: 10, dist: 445 },
      { num: 11, dist: 390 },
      { num: 12, dist: 202 },
      { num: 13, dist: 390 },
      { num: 14, dist: 580 },
      { num: 15, dist: 395 },
      { num: 16, dist: 178 },
      { num: 17, dist: 188 },
      { num: 18, dist: 440 },
    ],
  },
  thehay: {
    name: "The Hay",
    teeName: "Short Course",
    totalYardage: 670,
    courseRating: 18.5,
    slopeRating: 45,
    holes: [
      { num: 1, dist: 57 },
      { num: 2, dist: 106 },
      { num: 3, dist: 82 },
      { num: 4, dist: 47 },
      { num: 5, dist: 48 },
      { num: 6, dist: 77 },
      { num: 7, dist: 61 },
      { num: 8, dist: 92 },
      { num: 9, dist: 100 },
    ],
  },
};
const ROUNDS = {
  quick3: { label: "Quick 3", n: 3 },
  half6: { label: "Half Front (6)", n: 6 },
  front9: { label: "Front 9", n: 9, start: 1 },
  back9: { label: "Back 9", n: 9, start: 10 },
  full18: { label: "Full 18", n: 18 },
};
function roundOk(k, c) {
  const r = ROUNDS[k];
  return (
    r.n <= c.holes.length &&
    (!r.start || r.start + r.n - 1 <= c.holes.length)
  );
}
const HELP =
  "Scales your distance to the hole, similar to playing from forward tees. The fairway width and green size remain standard to keep the challenge fair. Adjust in 5% increments (e.g., 20% to 25%) as your game improves.";

// ---------- state ----------
const cfg = {
  course: "samarahan",
  round: "full18",
  start: 1,
  customDist: 127,
  err: "",
  players: [{ name: "", factor: 1.0 }],
};
let G = null; // game
let T = null; // current turn
let screen = "setup";
let confirmExit = false;
let histView = false; // true while viewing a saved round from history
let lastScreen = null; // used to decide whether render() should reset scroll

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = (n) => Math.round(n * 10) / 10;
const fmtPar = (n) => (n === 0 ? "E" : n > 0 ? "+" + n : String(n));
const parCls = (n) => (n < 0 ? "under" : n > 0 ? "over" : "");
const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const ANIMALS = [
  "Tiger",
  "Eagle",
  "Panther",
  "Falcon",
  "Shark",
  "Cobra",
  "Wolf",
  "Bear",
  "Lion",
  "Hawk",
  "Fox",
  "Rhino",
];
function defName(i) {
  const n = ANIMALS.length;
  return ANIMALS[i % n] + (i >= n ? " " + (Math.floor(i / n) + 1) : "");
}
function cfgName(i) {
  return ((cfg.players[i] && cfg.players[i].name) || "").trim() || defName(i);
}
// Names are frozen into G when a round starts, so saved rounds keep their
// names. Older saves without G.names fall back to the setup form.
function pName(i) {
  return (G && G.names && G.names[i]) || cfgName(i);
}

function makeHole(label, baseDist) {
  const par =
    baseDist <= 250 ? 3 : baseDist <= 470 ? 4 : baseDist <= 690 ? 5 : 6;
  const maxVar = 20 + baseDist * 0.05;
  return {
    label,
    baseDist,
    par,
    width: maxVar * 2,
    maxVar,
    greenR: 10 + baseDist * 0.01,
    overhang: maxVar,
  };
}
function suggestPutts() {
  const ft = T.dist * 3;
  return ft <= 6 ? 1 : ft <= 40 ? 2 : 3;
}
function holeTitle(h) {
  return h.label === "Custom" ? "Custom" : "Hole " + h.label;
}
function curHole() {
  return G.holes[G.hi];
}
function onGreen() {
  return T.dist <= curHole().greenR;
}

// Slider range scales with the player's playing-distance factor:
//   max(200, baseDist * factor * 1.5)
const SLIDER_FLOOR = 200;
const SLIDER_HEADROOM = 1.5;
function smax() {
  const h = curHole(),
    p = G.players[G.pi];
  const scaled = Math.ceil(
    Math.max(SLIDER_FLOOR, h.baseDist * p.factor * SLIDER_HEADROOM),
  );
  // never let the slider end before the ball's current distance
  return Math.max(scaled, Math.ceil(T.dist));
}
function startRound() {
  const custom = cfg.course === "custom";
  let holes = [],
    course = null;
  if (custom) {
    if (!(+cfg.customDist > 0)) {
      cfg.err = "Enter a distance in yards.";
      render();
      return;
    }
    holes = [makeHole(1, clamp(Math.round(+cfg.customDist), 1, 2000))];
  } else {
    course = COURSES[cfg.course];
    for (let k = 0; k < ROUNDS[cfg.round].n; k++) {
      const h = course.holes[(cfg.start - 1 + k) % course.holes.length];
      holes.push(makeHole(h.num, h.dist));
    }
  }
  const players = cfg.players.map((p, i) => ({ i, factor: p.factor }));
  const names = cfg.players.map((p, i) => cfgName(i));
  histView = false;
  G = {
    id: Date.now(),
    saved: false,
    names,
    course,
    custom,
    holes,
    hi: 0,
    pi: 0,
    players,
    scores: players.map(() => holes.map(() => null)),
    stats: players.map(() => holes.map(() => null)),
  };
  resume = null;
  keepAwake();
  startTurn();
  screen = "play";
  render();
}
function startTurn() {
  const h = curHole(),
    p = G.players[G.pi];
  T = {
    dist: r1(h.baseDist * p.factor),
    strokes: 0,
    history: [],
    shot: 0,
    vari: 0,
    side: 1,
    msg: null,
    putts: 2,
    pens: 0,
    fw: null,
    greenAt: null,
    shots: [],
  };
  resetInputs();
  if (onGreen()) T.greenAt = 0;
}
function resetInputs() {
  T.shot = r1(clamp(T.dist, 0, smax()));
  T.vari = 0;
}

function totals(pi) {
  let strokes = 0,
    par = 0,
    pts = 0;
  G.scores[pi].forEach((s, k) => {
    if (s !== null) {
      strokes += s;
      par += G.holes[k].par;
      pts += Math.max(0, 2 - (s - G.holes[k].par));
    }
  });
  return { strokes, toPar: strokes - par, pts };
}

// ---------- actions ----------
function takeShot() {
  const h = curHole(),
    d = T.shot,
    v = T.vari,
    why = [],
    lim = h.maxVar;
  T.history.push({
    dist: T.dist,
    strokes: T.strokes,
    pens: T.pens,
    fw: T.fw,
    greenAt: T.greenAt,
    ns: T.shots.length,
  });
  T.shots.push({ d, v });
  if (Math.abs(v) > lim)
    why.push(
      "variation " +
        fmt1(Math.abs(v)) +
        " is past the max of " +
        fmt1(lim),
    );
  if (d - T.dist > h.overhang)
    why.push(
      "shot is " +
        fmt1(d - T.dist) +
        " yds past the pin, over the limit of " +
        fmt1(h.overhang),
    );
  if (why.length) {
    T.strokes += 2;
    T.pens += 1;
    buzz([80, 50, 80]);
    if (T.fw === null) T.fw = false;
    T.msg = {
      t: "bad",
      s:
        "Out of bounds: " +
        why.join("; ") +
        ". Ball has not moved. +2 strokes (the shot plus a 1 stroke penalty). Try again.",
    };
    resetInputs();
  } else {
    const forwardDist = Math.abs(T.dist - d);
    const sideDist = Math.abs(v);
    T.dist = r1(Math.sqrt(forwardDist ** 2 + sideDist ** 2));
    T.strokes += 1;
    const fair = Math.abs(v) <= lim / 2;
    const miss =
      v === 0
        ? "Dead straight. "
        : fmt1(Math.abs(v)) +
          " yds " +
          (v < 0 ? "left" : "right") +
          (d > 0
            ? " (" +
              ((Math.abs(v) * 100) / d).toFixed(1) +
              "% of the shot). "
            : ". ");
    if (T.fw === null) T.fw = fair;
    if (T.greenAt === null && onGreen()) T.greenAt = T.strokes;
    T.msg = onGreen()
      ? {
          t: "ok",
          s:
            "On the green, " +
            fmt1(T.dist) +
            " yds (" +
            fmt1(T.dist * 3) +
            " ft) to the pin. Tap Putt or keep hitting.",
        }
      : {
          t: "ok",
          s:
            (fair ? "You hit the fairway. " : "You are in the rough. ") +
            miss +
            "Ball is now " +
            fmt1(T.dist) +
            " yds from the hole.",
        };
    resetInputs();
  }
  render();
}
function undoShot() {
  if (!T.history.length) return;
  const last = T.history.pop();
  T.dist = last.dist;
  T.strokes = last.strokes;
  T.pens = last.pens;
  T.fw = last.fw;
  T.greenAt = last.greenAt;
  if (last.ns !== undefined) T.shots.length = last.ns;
  resetInputs();
  T.msg = { t: "ok", s: "Last shot undone." };
  render();
}
function finishHole() {
  T.strokes += T.putts;
  G.scores[G.pi][G.hi] = T.strokes;
  G.stats[G.pi][G.hi] = {
    pens: T.pens,
    fw: T.fw,
    gir: T.greenAt !== null && T.greenAt <= curHole().par - 2,
    putts: T.putts,
    shots: T.shots.slice(),
  };
  if (T.strokes - curHole().par < 0) buzz(150);
  screen = "result";
  render();
}
function advance() {
  if (G.pi < G.players.length - 1) {
    G.pi++;
  } else {
    G.pi = 0;
    G.hi++;
  }
  if (!G.custom && G.hi >= G.holes.length) {
    screen = "final";
    render();
    return;
  }
  if (G.custom && G.pi === 0) {
    G.hsd = G.holes[G.hi - 1].baseDist;
    screen = "holeset";
    render();
    return;
  }
  startTurn();
  screen = "play";
  render();
}

// ---------- storage, history, extras ----------
const LS = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  },
};
let resume = LS.get("pgs:save");
if (resume && !(resume.G && resume.T && resume.screen)) resume = null;
function buzz(p) {
  try {
    if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
}
let wake = null;
async function keepAwake() {
  try {
    if (navigator.wakeLock && !wake) {
      wake = await navigator.wakeLock.request("screen");
      wake.addEventListener("release", () => {
        wake = null;
      });
    }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && G && screen !== "setup")
    keepAwake();
});
function save() {
  if (G && screen !== "setup" && screen !== "final")
    LS.set("pgs:save", { G, T, screen });
}
const HIST_KEY = "pgs:history";
const DETAILS_KEY = "pgs:roundDetails";
const HIST_MAX = 20;
function roundName() {
  return G.course ? G.course.name : "Custom Course";
}
function finishRound() {
  LS.del("pgs:save");
  resume = null;
  if (G.saved) return;
  G.saved = true;
  const players = G.players.map((p, i) => {
    const t = totals(i);
    return {
      name: pName(p.i),
      factor: p.factor,
      strokes: t.strokes,
      toPar: t.toPar,
      pts: t.pts,
      holes: G.scores[i].filter((x) => x !== null).length,
    };
  });
  const holes = G.holes.filter((h, k) =>
    G.scores.some((sc) => sc[k] !== null),
  ).length;
  if (!holes) return;
  const date = Date.now();
  const hist = LS.get(HIST_KEY) || [];
  hist.unshift({
    id: G.id,
    date,
    course: roundName(),
    holes,
    players,
  });
  const newHist = hist.slice(0, HIST_MAX);

  // Full scorecard (same shape as G, so vFinal() can render it as-is).
  const detail = {
    id: G.id,
    date,
    saved: true,
    ended: !!G.ended,
    course: G.course,
    custom: G.custom,
    holes: G.holes,
    players: G.players,
    names: G.players.map((p) => pName(p.i)),
    scores: G.scores,
    stats: G.stats,
  };
  // Keep details only for rounds that are still in the summary list
  const keep = new Set(newHist.map((r) => r.id));
  const prevDetails = LS.get(DETAILS_KEY);
  const newDetails = [detail]
    .concat((prevDetails || []).filter((d) => d.id !== G.id))
    .filter((d) => keep.has(d.id))
    .slice(0, HIST_MAX);

  // Save both together: if the summary write fails, undo the details write.
  const okDetails = LS.set(DETAILS_KEY, newDetails);
  const okHist = LS.set(HIST_KEY, newHist);
  if (!okHist && okDetails) {
    if (prevDetails) LS.set(DETAILS_KEY, prevDetails);
    else LS.del(DETAILS_KEY);
  }
}
function bestFor(name, holes) {
  let best = null;
  (LS.get(HIST_KEY) || []).forEach((r) => {
    if (r.id === G.id || r.course !== roundName() || r.holes !== holes)
      return;
    r.players.forEach((p) => {
      if (
        p.name.toLowerCase() === name.toLowerCase() &&
        p.holes === holes &&
        (best === null || p.toPar < best)
      )
        best = p.toPar;
    });
  });
  return best;
}
function resumeCard() {
  if (!resume) return "";
  const g = resume.G;
  return `<div class="card"><h2 class="h3">Round in progress</h2><div class="hint flush">${esc(g.course ? g.course.name : "Custom Course")} · hole ${g.hi + 1}</div><div class="row"><button class="primary" data-act="resume">Resume</button><button data-act="discard">Discard</button></div></div>`;
}
function historyLine(r) {
  return r.players
    .map(
      (p) =>
        `${esc(p.name)}${p.factor != null ? " " + Math.round(p.factor * 100) + "%" : ""} · ${fmtPar(p.toPar)} (${p.pts} pts)`,
    )
    .join(" · ");
}
function historyCard() {
  const hist = LS.get(HIST_KEY) || [];
  if (!hist.length) return "";
  const withDetails = new Set(
    (LS.get(DETAILS_KEY) || []).map((d) => String(d.id)),
  );
  return `<div class="card mt"><h2 class="h3">Recent rounds</h2>${hist
    .slice(0, 6)
    .map((r) => {
      const body = `<b>${esc(new Date(r.date).toLocaleDateString())}</b> · ${esc(r.course)} · ${r.holes} holes<br>${historyLine(r)}`;
      return withDetails.has(String(r.id))
        ? `<button class="hist" data-act="view-history" data-id="${esc(r.id)}">${body}</button>`
        : `<div class="tl">${body}</div>`;
    })
    .join("")}</div>`;
}

// ---------- views ----------
function optList(items, sel) {
  return items
    .map(
      ([v, l]) =>
        `<option value="${v}" ${String(v) === String(sel) ? "selected" : ""}>${esc(l)}</option>`,
    )
    .join("");
}
function courseInfo(c) {
  return `${c.teeName} · ${c.totalYardage.toLocaleString("en-US")} yds · Rating ${c.courseRating} / Slope ${c.slopeRating}`;
}

function vSetup() {
  const custom = cfg.course === "custom",
    c = COURSES[cfg.course];
  const courseOpts = Object.entries(COURSES)
    .map(([k, v]) => [k, v.name])
    .concat([["custom", "Custom Course (Any Yardage)"]]);
  const rows = cfg.players
    .map(
      (p, i) => `
    <div class="prow">
<label for="n${i}">Player ${i + 1}</label>
<div class="row"><input type="text" id="n${i}" data-k="name" data-i="${i}" placeholder="${esc(defName(i))}" value="${esc(p.name)}">
<button class="rm" data-act="rm" data-v="${i}" ${cfg.players.length <= 1 ? "disabled" : ""}>Remove</button></div>
<label for="f${i}">Playing distance (forward tees)</label>
<div class="fslider"><input type="range" id="f${i}" data-k="factor" data-i="${i}" min="10" max="150" step="5" value="${Math.round(p.factor * 100)}"><output id="fo${i}" for="f${i}">${Math.round(p.factor * 100)}%</output></div>
    </div>`,
    )
    .join("");
  return `
  <h1>Paper Golf Score</h1>
  <p class="sub">Numbers-only golf for the driving range.</p>
  ${resumeCard()}
  <div class="cols">
  <div class="card">
    <label for="course">Course</label>
    <select id="course">${optList(courseOpts, cfg.course)}</select>
    ${
custom
  ? `
<label for="cdist">First hole distance (yards)</label>
<input type="number" id="cdist" inputmode="numeric" min="1" value="${esc(cfg.customDist)}" placeholder="e.g. 127">
${cfg.err ? `<div class="err">${esc(cfg.err)}</div>` : ""}
<div class="hint">Play as many holes as you like and tap End game when you are done. Before each new hole you can change the distance or keep it the same. Stats build up across the session.</div>
    `
  : `
<div class="hint">${esc(courseInfo(c))}</div>
<label for="round">Round length</label>
<select id="round">${optList(
  Object.entries(ROUNDS)
    .filter(([k]) => roundOk(k, c))
    .map(([k, v]) => [k, v.label]),
  cfg.round,
)}</select>
<label for="start">Starting hole</label>
<select id="start">${optList(
  c.holes.map((h) => [h.num, "Hole " + h.num + " · " + h.dist + " yds"]),
  cfg.start,
)}</select>
<div class="hint">Plays ${ROUNDS[cfg.round].n} holes from hole ${cfg.start}, wrapping back to hole 1 after ${c.holes.length}.</div>
    `
    }
  </div>
  <div class="card">
    ${rows}
    <div class="help">${HELP}</div>
    <button class="wide mt" data-act="add">Add Player</button>
  </div>
  </div>
  <button class="primary" data-act="start">Start round</button>
  ${historyCard()}`;
}

function scoreboard() {
  return `<div class="sb">${G.players
    .map((p, k) => {
      const t = totals(k);
      return `<span><b>${esc(pName(p.i))}</b> ${t.strokes} · <span class="${parCls(t.toPar)}">${fmtPar(t.toPar)}</span></span>`;
    })
    .join("")}</div>`;
}

function syncVar() {
  const n = $("#varNum"),
    sl = $("#vslider");
  if (n) n.value = fmt1(Math.abs(T.vari));
  if (sl && +sl.value !== T.vari) sl.value = T.vari;
  $("#segL").classList.toggle("on", T.side < 0);
  $("#segR").classList.toggle("on", T.side > 0);
}
function syncShot() {
  const n = $("#shotNum"),
    sl = $("#slider");
  if (n) n.value = fmt1(T.shot);
  if (sl && +sl.value !== T.shot) sl.value = T.shot;
}
function topBar(showScore) {
  return `<div class="top">${showScore ? scoreboard() : '<div class="grow"></div>'}<button class="exit" data-act="exit">End game</button></div>`;
}
function vPlay() {
  const h = curHole(),
    p = G.players[G.pi],
    g = onGreen();
  const eff = r1(h.baseDist * p.factor);
  const hdr = G.course
    ? G.course.name + " · " + G.course.teeName
    : "Custom Course";
  return `
  ${topBar(true)}
  <div class="hd"><span>${esc(hdr)}</span></div>
  <div class="hd sp"><b>${esc(pName(p.i))}</b><span>${holeTitle(h)} · Par ${h.par} · Start ${fmt1(eff)} yds</span></div>
  <div class="card">
    <div class="big">
<div><div class="num">${fmt1(T.dist)}</div><div class="lab">Yards to hole</div></div>
<div><div class="num">${T.strokes}</div><div class="lab">Strokes</div></div>
    </div>
    <div class="lim">Max var ±${fmt1(h.maxVar)} · Green ${fmt1(h.greenR)} yds · Overhang ${fmt1(h.overhang)} yds</div>
  </div>
  ${T.msg ? `<div class="msg ${T.msg.t}" role="status">${esc(T.msg.s)}</div>` : ""}
  ${g ? `<button class="putt-big" data-act="putt">Putt<small>${fmt1(T.dist * 3)} ft to the pin</small></button>` : ""}
  <div class="inputs">
  <div class="card inp">
    <div class="lab">Distance (yds) · tap the number to type</div>
    <input type="number" class="numin" id="shotNum" inputmode="decimal" step="0.1" min="0" value="${fmt1(T.shot)}" aria-label="Shot distance in yards">
    <input type="range" id="slider" min="0" max="${smax()}" step="0.1" value="${T.shot}" aria-label="Shot distance">
    <div class="btns">
<button data-act="d" data-v="-10">−10</button><button data-act="d" data-v="-1">−1</button><button data-act="d" data-v="-0.1">−0.1</button>
<button data-act="d" data-v="0.1">+0.1</button><button data-act="d" data-v="1">+1</button><button data-act="d" data-v="10">+10</button>
    </div>
  </div>
  <div class="card inp">
    <div class="lab">Variation (yds) · tap the number to type</div>
    <input type="number" class="numin" id="varNum" inputmode="decimal" step="0.1" min="0" value="${fmt1(Math.abs(T.vari))}" aria-label="Variation in yards">
    <div class="row seg"><button id="segL" data-act="side" data-v="-1" class="${T.side < 0 ? "on" : ""}">◀ Left</button><button id="segR" data-act="side" data-v="1" class="${T.side > 0 ? "on" : ""}">Right ▶</button></div>
    <input type="range" id="vslider" min="-50" max="50" step="0.1" value="${T.vari}" aria-label="Variation">
    <div class="btns">
<button data-act="v" data-v="-5">◀5</button><button data-act="v" data-v="-1">◀1</button><button data-act="v" data-v="-0.1">◀.1</button>
<button data-act="v" data-v="0.1">.1▶</button><button data-act="v" data-v="1">1▶</button><button data-act="v" data-v="5">5▶</button>
    </div>
  </div>
  </div>
  <div class="stack">
    <button class="primary" data-act="shot">Take Shot</button>
    <div class="row">
<button data-act="undo" ${T.history.length ? "" : "disabled"}>Undo Last Shot</button>
<button data-act="reset">Reset Shot</button>
    </div>
  </div>`;
}

// What the player is putting for, based on strokes so far + selected putts
function puttTarget() {
  const d = T.strokes + T.putts - curHole().par;
  let word;
  if (d <= -2) word = "Eagle or better";
  else if (d === -1) word = "Birdie";
  else if (d === 0) word = "Par";
  else if (d === 1) word = "Bogey";
  else if (d === 2) word = "Double Bogey";
  else if (d === 3) word = "Triple Bogey";
  else word = d + " Over Par";
  return { d, word };
}
function vPutt() {
  const h = curHole(),
    p = G.players[G.pi],
    pt = puttTarget();
  return `
  ${topBar(true)}
  <div class="hd"><span>${esc(G.course ? G.course.name : "Custom Course")}</span><b>${esc(pName(p.i))} · ${holeTitle(h)}</b></div>
  <h2 class="title">On the green</h2>
  <div class="card center">
    <div class="puttfor ${pt.d < 0 ? "under" : pt.d > 0 ? "over" : ""}" role="status">Putting for ${pt.word}</div>
    <div class="num">${fmt1(T.dist * 3)}</div><div class="lab">feet to pin</div><div class="lab">(${fmt1(T.dist)} yds)</div>
    <div class="lab mt">Number of putts</div>
    <div class="row stepper">
<button data-act="pm" data-v="-1" ${T.putts <= (T.strokes ? 0 : 1) ? "disabled" : ""} aria-label="Fewer putts">−1</button>
<div class="num">${T.putts}</div>
<button data-act="pm" data-v="1" ${T.putts >= 9 ? "disabled" : ""} aria-label="More putts">+1</button>
    </div>
    <div class="hint">${T.putts === 0 ? "Holed out without putting. " : ""}Strokes so far ${T.strokes} → hole total ${T.strokes + T.putts}</div>
  </div>
  <div class="stack">
    <button class="primary" data-act="finish">Finish Hole</button>
    <button data-act="keep">Keep Hitting</button>
  </div>`;
}

function scoreWord(d, s) {
  if (s === 1) return "Hole in one";
  return (
    {
      "-3": "Albatross",
      "-2": "Eagle",
      "-1": "Birdie",
      0: "Par",
      1: "Bogey",
      2: "Double bogey",
      3: "Triple bogey",
    }[d] || (d > 2 ? d + " over par" : -d + " under par")
  );
}
function vResult() {
  const h = curHole(),
    s = G.scores[G.pi][G.hi],
    d = s - h.par,
    p = G.players[G.pi];
  const last = G.pi === G.players.length - 1,
    lastHole = !G.custom && G.hi === G.holes.length - 1;
  let btns;
  if (!last)
    btns = `<button class="primary" data-act="next">Pass to ${esc(pName(G.players[G.pi + 1].i))}</button>`;
  else if (lastHole)
    btns = `<button class="primary" data-act="next">View Final Scorecard</button>`;
  else
    btns = `<button class="primary" data-act="next">Next Hole</button>`;
  return `
  ${topBar(false)}
  <div class="hd"><span>${esc(G.course ? G.course.name : "Custom Course")}</span><b>${esc(pName(p.i))} · ${holeTitle(h)}</b></div>
  <div class="card center mt">
    <div class="verdict ${parCls(d)}">${scoreWord(d, s)}</div>
    <div class="verdict-sub ${parCls(d)}">${fmtPar(d)}</div>
    <div class="lab mt">${s} strokes · Par ${h.par} · ${Math.max(0, 2 - d)} Stableford pts</div>
  </div>
  <div class="card cum">
    <h2>Running total</h2>
    ${G.players
.map((q, k) => {
  const t = totals(k);
  return `<div class="r"><span>${esc(pName(q.i))}</span><span><b>${t.strokes}</b> · <span class="${parCls(t.toPar)}">${fmtPar(t.toPar)}</span> · ${t.pts} pts</span></div>`;
})
.join("")}
  </div>
  <div class="stack">${btns}<button data-act="fix">Change putts</button></div>`;
}

function holeDiff(d) {
  const p = G.holes[G.hi - 1].baseDist;
  if (!(d > 0)) return "Enter a distance.";
  const x = r1(d - p);
  return x === 0
    ? "Same as the last hole (" + p + " yds)."
    : fmt1(Math.abs(x)).replace(/\.0$/, "") +
        " yards " +
        (x > 0 ? "more" : "less") +
        " than the last hole (" +
        p +
        " yds).";
}
function holePrev(d) {
  if (!(d > 0)) return "";
  const h = makeHole(0, d);
  return `Par ${h.par} · Max var ±${fmt1(h.maxVar)} · Green ${fmt1(h.greenR)} yds · Overhang ${fmt1(h.overhang)} yds`;
}
function vHoleSet() {
  return `
  ${topBar(false)}
  <div class="hd"><span>Custom Course</span><b>Hole ${G.hi + 1}</b></div>
  <h2 class="title">Next hole</h2>
  <div class="card center">
    <label for="hsd">Distance to hole (yards)</label>
    <input type="number" class="numin" id="hsd" inputmode="numeric" min="1" step="1" value="${G.hsd}">
    <div class="btns two"><button data-act="hs" data-v="-10">−10</button><button data-act="hs" data-v="-1">−1</button><button data-act="hs" data-v="1">+1</button><button data-act="hs" data-v="10">+10</button></div>
    <div class="hint" id="hsPrev">${holePrev(+G.hsd)}</div>
    <div class="hint" id="hsDiff">${holeDiff(+G.hsd)}</div>
  </div>
  <div class="stack"><button class="primary" data-act="hsstart">Start hole</button></div>`;
}
function vFinal() {
  const c = G.course;
  const played = G.holes
    .map((h, k) => k)
    .filter((k) => G.scores.some((sc) => sc[k] !== null));
  const parTot = played.reduce((a, k) => a + G.holes[k].par, 0);
  const rows = played
    .map((k) => {
      const h = G.holes[k];
      return `<tr><td class="hn">${h.label}</td>${c ? "" : `<td class="pr">${r1(h.baseDist)}</td>`}<td class="pr">${h.par}</td>${G.players
        .map((p, i) => {
          const sc = G.scores[i][k];
          if (sc === null) return `<td class="mu">–</td>`;
          const d = sc - h.par;
          return `<td class="sc ${parCls(d)}">${fmtPar(d)}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("");
  const foot = G.players
    .map((p, i) => {
      const t = totals(i);
      return `<td class="sc ${parCls(t.toPar)}">${fmtPar(t.toPar)}<div class="st">${t.strokes} strokes</div></td>`;
    })
    .join("");
  const pct = (a, b) => (b ? Math.round((a * 100) / b) + "%" : "–");
  const st = G.players.map((p, i) => {
    let fwH = 0,
      fwN = 0,
      gir = 0,
      n = 0,
      pens = 0,
      strokes = 0,
      putts = 0;
    G.stats[i].forEach((x, k) => {
      if (!x) return;
      n++;
      strokes += G.scores[i][k];
      pens += x.pens;
      putts += x.putts;
      if (x.gir) gir++;
      if (x.fw !== null) {
        fwN++;
        if (x.fw) fwH++;
      }
    });
    return {
      fw: fwN ? `${fwH}/${fwN} · ${pct(fwH, fwN)}` : "–",
      gir: n ? `${gir}/${n} · ${pct(gir, n)}` : "–",
      pen: n ? `${pens} · ${pct(pens, strokes)}` : "–",
      pt: n ? (putts / n).toFixed(1) : "–",
      pts: n ? totals(i).pts : "–",
      diff:
        n && c
          ? ((v) => (v > 0 ? "+" : "") + v.toFixed(1))(
              ((strokes - (c.courseRating * n) / c.holes.length) * 113) /
                c.slopeRating,
            )
          : "–",
    };
  });
  const srow = (label, key) =>
    `<tr><td class="hn">${label}</td>${st.map((x) => `<td>${x[key]}</td>`).join("")}</tr>`;
  const shape = (() => {
    const blocks = G.players
      .map((p, i) => {
        const shots = [];
        G.stats[i].forEach((x) => {
          if (x && x.shots) shots.push(...x.shots);
        });
        if (!shots.length) return "";
        const L = shots.filter((s) => s.v < 0),
          R = shots.filter((s) => s.v > 0),
          S = shots.length - L.length - R.length;
        const sumAbs = (a) => a.reduce((t, s) => t + Math.abs(s.v), 0),
          sumD = (a) => a.reduce((t, s) => t + s.d, 0);
        const pctD = (a) =>
          sumD(a) > 0
            ? ((sumAbs(a) * 100) / sumD(a)).toFixed(1) + "% of distance"
            : "";
        const side = (name, a, col) =>
          `<span style="color:${col}">■</span> ${name} <b>${a.length}</b> (${pct(a.length, shots.length)})` +
          (a.length
            ? ` · avg ${(sumAbs(a) / a.length).toFixed(1)} yds · ${pctD(a)}`
            : "");
        const avg = sumAbs(shots) / shots.length,
          bias = shots.reduce((t, s) => t + s.v, 0) / shots.length;
        const tend =
          Math.abs(bias) < Math.max(0.5, avg * 0.15)
            ? "No strong left or right tendency"
            : `Drifts ${bias > 0 ? "right" : "left"} by ${Math.abs(bias).toFixed(1)} yds on average`;
        const bar = `<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0 4px"><div style="flex:${L.length};background:var(--blue)"></div><div style="flex:${S};background:var(--green)"></div><div style="flex:${R.length};background:#d99a2b"></div></div>`;
        return `<div style="margin-bottom:14px"><div><b>${esc(pName(p.i))}</b> <span class="mu">· ${shots.length} shots</span></div>${bar}<div class="tl">${side("Left", L, "var(--blue)")}</div><div class="tl"><span style="color:var(--green)">■</span> Straight <b>${S}</b> (${pct(S, shots.length)})</div><div class="tl">${side("Right", R, "#d99a2b")}</div><div class="tl"><b>Overall</b> avg miss ${avg.toFixed(1)} yds · ${pctD(shots)}</div><div class="tl">${tend}</div></div>`;
      })
      .join("");
    return blocks
      ? `<div class="card"><h2 class="h3">Shot tendencies</h2>${blocks}<div class="hint">Every swing counts, including out of bounds shots. Percentages are the sideways miss as a share of the distance you hit.</div></div>`
      : "";
  })();
  const pbHtml = histView ? "" : G.players
    .map((p, i) => {
      const n = G.scores[i].filter((x) => x !== null).length;
      if (!n || n !== played.length) return "";
      const prev = bestFor(pName(p.i), n),
        t = totals(i);
      return prev !== null && t.toPar < prev
        ? `<div class="msg ok">🏆 ${esc(pName(p.i))}: new personal best here (${fmtPar(t.toPar)}, previous ${fmtPar(prev)})</div>`
        : "";
    })
    .join("");
  const tally = G.players
    .map((p, i) => {
      const n = {
        "Eagle+": 0,
        Birdies: 0,
        Pars: 0,
        Bogeys: 0,
        "Double+": 0,
      };
      G.scores[i].forEach((sc, k) => {
        if (sc === null) return;
        const d = sc - G.holes[k].par;
        if (sc === 1 || d <= -2) n["Eagle+"]++;
        else if (d === -1) n.Birdies++;
        else if (d === 0) n.Pars++;
        else if (d === 1) n.Bogeys++;
        else n["Double+"]++;
      });
      const parts = Object.entries(n)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k} ${v}`)
        .join(" · ");
      return `<div class="tl"><b>${esc(pName(p.i))}</b> ${parts || "–"}</div>`;
    })
    .join("");
  return `
  <h2 class="title">${histView ? "Scorecard · " + esc(new Date(G.date).toLocaleDateString()) : G.ended ? "Scorecard · game ended" : "Final scorecard"}</h2>
  <p class="sub">${c ? `${esc(c.name)} · ${esc(c.teeName)} · ${c.totalYardage.toLocaleString("en-US")} yds · Rating ${c.courseRating} / Slope ${c.slopeRating}` : `Custom Course · ${played.length} hole${played.length === 1 ? "" : "s"}`}</p>
  ${pbHtml}
  ${
    parTot
? `<div class="card wrap"><table>
    <thead><tr><th>Hole</th>${c ? "" : "<th>Yds</th>"}<th>Par</th>${G.players.map((p) => `<th>${esc(pName(p.i))}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td class="hn">Total</td>${c ? "" : `<td class="pr">${r1(played.reduce((a, k) => a + G.holes[k].baseDist, 0))}</td>`}<td class="pr">${parTot}</td>${foot}</tr></tfoot>
  </table></div>
  <div class="card">${tally}</div>
  <div class="card wrap"><table>
    <thead><tr><th>Stats</th>${G.players.map((p) => `<th>${esc(pName(p.i))}</th>`).join("")}</tr></thead>
    <tbody>${srow("Tee shots on fairway", "fw")}${srow("Greens in reg.", "gir")}${srow("Penalties (% of strokes)", "pen")}${srow("Putts per hole", "pt")}${srow("Stableford pts", "pts")}${c ? srow("Paper differential", "diff") : ""}</tbody>
  </table></div>
  <p class="hint">Tee shot on fairway: the first shot of a hole lands within half the max variation (wider is the rough). Green in regulation: on the green in par minus 2 strokes or fewer. Penalties count out of bounds shots. Stableford: 2 pts for par, 3 birdie, 4 eagle, 1 bogey. Paper differential: (strokes minus course rating) x 113 / slope, scaled to the holes played. It assumes full distance, so it is most meaningful at 100%.</p>
  ${shape}`
: `<p class="sub">No holes were completed.</p>`
  }
  <button class="primary" data-act="menu">${histView ? "Back to Menu" : "New Round"}</button>`;
}

function render() {
  const app = $("#app");
  // Only jump to the top when the screen actually changes. Re-rendering the
  // same screen (e.g. after Take Shot or Undo) keeps the scroll position.
  const sameScreen = screen === lastScreen;
  const y = window.scrollY;
  app.innerHTML = {
    setup: vSetup,
    play: vPlay,
    putt: vPutt,
    result: vResult,
    final: vFinal,
    holeset: vHoleSet,
  }[screen]();
  lastScreen = screen;
  window.scrollTo(0, sameScreen ? y : 0);
  if (confirmExit && screen !== "setup" && screen !== "final")
    app.insertAdjacentHTML(
      "beforeend",
      `<div class="modal" role="dialog" aria-modal="true"><div class="mbox"><h2>End game?</h2><p class="sub">Are you sure? The round will end and the scores will be shown as they stand.</p><div class="row"><button data-act="exitno">Keep playing</button><button class="danger" data-act="exityes">End game</button></div></div></div>`,
    );
  if (screen === "final") {
    if (!histView) finishRound();
  } else save();
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  e.preventDefault();
  const a = b.dataset.act,
    v = +b.dataset.v;
  if (a === "start") startRound();
  else if (a === "d") {
    // update in place (no re-render) so the page never moves
    T.shot = r1(clamp(T.shot + v, 0, smax()));
    syncShot();
    save();
  } else if (a === "v") {
    T.vari = r1(clamp(T.vari + v, -100, 100));
    if (T.vari) T.side = T.vari < 0 ? -1 : 1;
    syncVar();
    save();
  } else if (a === "view-history") {
    const d = (LS.get(DETAILS_KEY) || []).find(
      (x) => String(x.id) === b.dataset.id,
    );
    if (!d) return;
    G = d;
    G.saved = true;
    histView = true;
    confirmExit = false;
    screen = "final";
    render();
  } else if (a === "shot") takeShot();
  else if (a === "undo") undoShot();
  else if (a === "reset") {
    resetInputs();
    T.msg = null;
    render();
  } else if (a === "putt") {
    T.putts = suggestPutts();
    screen = "putt";
    render();
  } else if (a === "pm") {
    T.putts = clamp(T.putts + v, T.strokes ? 0 : 1, 9);
    render();
  } else if (a === "finish") finishHole();
  else if (a === "keep") {
    screen = "play";
    T.msg = null;
    render();
  } else if (a === "next") advance();
  else if (a === "add") {
    cfg.players.push({ name: "", factor: 1.0 });
    render();
  } else if (a === "rm") {
    if (cfg.players.length > 1) {
      cfg.players.splice(v, 1);
      render();
    }
  } else if (a === "fix") {
    T.strokes -= T.putts;
    G.scores[G.pi][G.hi] = null;
    G.stats[G.pi][G.hi] = null;
    screen = "putt";
    render();
  } else if (a === "resume") {
    G = resume.G;
    T = resume.T;
    if (!T.shots) T.shots = [];
    screen = resume.screen;
    resume = null;
    keepAwake();
    render();
  } else if (a === "discard") {
    LS.del("pgs:save");
    resume = null;
    render();
  } else if (a === "hs") {
    G.hsd = clamp((+G.hsd || 0) + v, 1, 2000);
    render();
  } else if (a === "hsstart") {
    const d = Math.round(+G.hsd);
    if (!(d > 0)) return;
    G.holes[G.hi] = makeHole(G.hi + 1, clamp(d, 1, 2000));
    G.players.forEach((_, i) => {
      G.scores[i][G.hi] = null;
      G.stats[i][G.hi] = null;
    });
    startTurn();
    screen = "play";
    render();
  } else if (a === "side") {
    T.side = v;
    T.vari = Math.abs(T.vari) * v;
    syncVar();
    save();
  } else if (a === "exit") {
    confirmExit = true;
    render();
  } else if (a === "exitno") {
    confirmExit = false;
    render();
  } else if (a === "exityes") {
    confirmExit = false;
    G.ended = true;
    screen = "final";
    render();
  } else if (a === "menu") {
    confirmExit = false;
    histView = false;
    screen = "setup";
    render();
  }
});
document.addEventListener("input", (e) => {
  const t = e.target,
    id = t.id;
  if (id === "slider") {
    T.shot = +t.value;
    $("#shotNum").value = fmt1(T.shot);
    save();
  } else if (id === "shotNum") {
    const n = parseFloat(t.value);
    if (!isNaN(n)) {
      T.shot = r1(clamp(n, 0, smax()));
      $("#slider").value = T.shot;
    }
  } else if (id === "varNum") {
    const n = parseFloat(t.value);
    if (!isNaN(n)) {
      T.vari = r1(clamp(Math.abs(n), 0, 100)) * T.side;
      $("#vslider").value = T.vari;
    }
  } else if (id === "vslider") {
    T.vari = +t.value;
    if (T.vari) T.side = T.vari < 0 ? -1 : 1;
    syncVar();
  } else if (t.dataset.k === "name")
    cfg.players[+t.dataset.i].name = t.value;
  else if (t.dataset.k === "factor") {
    const f = parseFloat(t.value) / 100;
    if (f >= 0.1 && f <= 1.5) {
      cfg.players[+t.dataset.i].factor = Math.round(f * 100) / 100;
      const o = $("#fo" + t.dataset.i);
      if (o) o.textContent = Math.round(f * 100) + "%";
    }
  } else if (id === "cdist") {
    cfg.customDist = t.value;
    cfg.err = "";
  } else if (id === "hsd") {
    G.hsd = +t.value;
    $("#hsPrev").textContent = holePrev(G.hsd);
    $("#hsDiff").textContent = holeDiff(G.hsd);
  }
});
document.addEventListener("change", (e) => {
  const t = e.target,
    id = t.id,
    v = t.value;
  if (id === "course") {
    cfg.course = v;
    cfg.err = "";
    const nc = COURSES[v];
    if (nc) {
      if (!roundOk(cfg.round, nc)) cfg.round = "front9";
      if (cfg.start > nc.holes.length) cfg.start = 1;
    }
    render();
  } else if (id === "round") {
    cfg.round = v;
    if (ROUNDS[v].start) cfg.start = ROUNDS[v].start;
    render();
  } else if (id === "start") {
    cfg.start = +v;
    render();
  } else if (id === "shotNum") t.value = fmt1(T.shot);
  else if (id === "varNum") t.value = fmt1(Math.abs(T.vari));
  else if (t.dataset.k === "factor") {
    const f = parseFloat(v) / 100;
    cfg.players[+t.dataset.i].factor = isNaN(f)
      ? 1
      : clamp(Math.round(f * 100) / 100, 0.1, 1.5);
    // the slider updates live on "input", so no re-render is needed
  }
});
// Tap a number field and the whole value is selected, so typing replaces it.
let selTarget = null;
document.addEventListener("focusin", (e) => {
  const t = e.target;
  if (t && t.matches && t.matches('input[type="number"]')) {
    selTarget = t;
    // setTimeout: iOS Safari ignores select() inside the focus event itself
    setTimeout(() => {
      try {
        t.select();
      } catch (err) {}
    }, 0);
  }
});
// stop the mouse-up from collapsing the selection on desktop browsers
document.addEventListener("mouseup", (e) => {
  if (selTarget && e.target === selTarget) e.preventDefault();
  selTarget = null;
});
document.addEventListener("touchend", () => {
  selTarget = null;
});

render();
