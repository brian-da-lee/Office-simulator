(() => {
  const canvas = document.querySelector("#office-canvas");
  const context = canvas?.getContext("2d");
  const liveRegion = document.querySelector("#accessible-status");
  if (!canvas || !context) return;

  const TAU = Math.PI * 2;
  const actions = [
    { id: "inbox", title: "Clear your inbox", detail: "Everything is fine. Reply all.", kind: "WORK", minutes: 60, work: 20, suspicion: 0, x: -0.9, z: -1.15, prop: "desk", color: "#658361", log: "Cleared your inbox. Replied 'sounds good!' to the fire alarm test." },
    { id: "spreadsheet", title: "Fix the spreadsheet", detail: "A pivot table. A true hero.", kind: "WORK", minutes: 120, work: 30, suspicion: 0, x: -0.9, z: -1.15, prop: "desk", color: "#658361", log: "Fixed the spreadsheet, including the formula everyone feared." },
    { id: "meeting", title: "Attend a meeting", detail: "Circle back. Nod thoughtfully.", kind: "WORK", minutes: 60, work: 15, suspicion: 0, x: -0.55, z: -3.1, prop: "meeting", color: "#8d875d", log: "Attended a meeting and said 'let's circle back' with conviction." },
    { id: "snacks", title: "Liberate the snacks", detail: "Communal means community.", kind: "MISCHIEF", minutes: 30, work: 0, suspicion: 14, snacks: 1, x: 3.25, z: 2.45, prop: "snacks", color: "#c38c57", log: "Liberated communal pretzels. The snack drawer has no security clearance." },
    { id: "printer", title: "Prank the printer", detail: "Landscape. Every. Single. Page.", kind: "MISCHIEF", minutes: 30, work: 0, suspicion: 20, x: 3.35, z: -0.95, prop: "printer", color: "#c67d55", log: "Changed the printer defaults to landscape. How mysterious." },
    { id: "plants", title: "Rearrange the plants", detail: "Office feng shui. Obviously.", kind: "MISCHIEF", minutes: 30, work: 0, suspicion: 8, x: -3.55, z: 0.9, prop: "plants", color: "#889568", log: "Rearranged the office plants. Botanical labyrinth achieved." },
  ];
  const state = {
    minutes: 0,
    work: 0,
    suspicion: 0,
    snacks: 0,
    finished: false,
    logs: [{ time: "09:00", text: "Clocked in. They have no idea.", kind: "start" }],
    status: "Pick an office station. Any station. You're on the clock.",
    toast: "",
    toastUntil: 0,
  };
  const player = { x: 0.15, z: 2.1, moving: false };
  const camera = { angle: 0.5, dragging: false, lastX: 0, lastY: 0, pitch: 0 };
  const keys = new Set();
  const polygons = new Map();

  let width = 0;
  let height = 0;
  let scale = 1;
  let previousFrame = 0;
  let animationFrame = 0;
  let hoveredAction = null;
  let actionProgress = null;
  let pointerMoved = false;

  const colors = {
    desk: "#b48a5e",
    leg: "#897456",
    monitor: "#374c48",
    screen: "#c4dfc0",
    plant: "#68895c",
    printer: "#ece8dc",
    chair: "#627c71",
    shirt: "#819c72",
    pants: "#485951",
    skin: "#e6b88d",
    hair: "#52453b",
  };

  function shade(hex, amount) {
    const value = Number.parseInt(hex.slice(1), 16);
    const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel * amount))),
    );
    return `rgb(${channels.join(",")})`;
  }

  function project(x, y, z) {
    const sine = Math.sin(camera.angle);
    const cosine = Math.cos(camera.angle);
    const sideways = x * cosine - z * sine;
    const depth = x * sine + z * cosine;
    const perspective = 13 / (13 + depth * 0.17);
    const baseline = height * 0.49 + camera.pitch;
    return {
      x: width * 0.5 + sideways * scale * perspective,
      y: baseline + (depth * 0.39 - y * 0.8) * scale * perspective,
      depth,
    };
  }

  function polygon(points, fill, stroke = null) {
    context.beginPath();
    const projected = points.map(([x, y, z]) => project(x, y, z));
    projected.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function cubeFaces(x, y, z, w, h, d, color) {
    const x1 = x - w / 2;
    const x2 = x + w / 2;
    const y1 = y;
    const y2 = y + h;
    const z1 = z - d / 2;
    const z2 = z + d / 2;
    const v = [
      [x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2],
      [x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2],
    ];
    return [
      { points: [v[0], v[1], v[5], v[4]], shade: 0.79 },
      { points: [v[1], v[2], v[6], v[5]], shade: 0.9 },
      { points: [v[2], v[3], v[7], v[6]], shade: 1.06 },
      { points: [v[3], v[0], v[4], v[7]], shade: 0.85 },
      { points: [v[4], v[5], v[6], v[7]], shade: 1.16 },
    ].map((face) => ({
      ...face,
      depth: face.points.reduce((total, point) => total + point[0] * Math.sin(camera.angle) + point[2] * Math.cos(camera.angle), 0) / 4,
      color: shade(color, face.shade),
    }));
  }

  function addCube(items, x, y, z, w, h, d, color) {
    items.push(...cubeFaces(x, y, z, w, h, d, color));
  }

  function drawFloorAndWalls() {
    polygon([[-6, 0, -5], [6, 0, -5], [6, 0, 5], [-6, 0, 5]], "#d9d4c4");

    for (let x = -5; x <= 5; x += 1) {
      const a = project(x, 0, -5);
      const b = project(x, 0, 5);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = "#bebba9";
      context.globalAlpha = 0.48;
      context.stroke();
      context.globalAlpha = 1;
    }
    for (let z = -4; z <= 4; z += 1) {
      const a = project(-6, 0, z);
      const b = project(6, 0, z);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = "#bebba9";
      context.globalAlpha = 0.48;
      context.stroke();
      context.globalAlpha = 1;
    }

    polygon([[-6, 0, -5], [6, 0, -5], [6, 4.6, -5], [-6, 4.6, -5]], "#e9e9db");
    polygon([[-6, 0, 5], [-6, 0, -5], [-6, 4.6, -5], [-6, 4.6, 5]], "#d5ddce");
    polygon([[-3.8, 1.2, -4.96], [-1, 1.2, -4.96], [-1, 3.6, -4.96], [-3.8, 3.6, -4.96]], "#b6cfc1");
    polygon([[-3.8, 1.12, -4.94], [-1, 1.12, -4.94], [-1, 1.25, -4.94], [-3.8, 1.25, -4.94]], "#f4efdf");
    polygon([[-3.8, 3.55, -4.94], [-1, 3.55, -4.94], [-1, 3.68, -4.94], [-3.8, 3.68, -4.94]], "#f4efdf");
    polygon([[-2.52, 1.2, -4.9], [-2.39, 1.2, -4.9], [-2.39, 3.6, -4.9], [-2.52, 3.6, -4.9]], "#f4efdf");
    polygon([[-3.8, 2.35, -4.9], [-1, 2.35, -4.9], [-1, 2.48, -4.9], [-3.8, 2.48, -4.9]], "#f4efdf");

    const backWall = [project(-6, 0, -5), project(6, 0, -5), project(6, 4.6, -5), project(-6, 4.6, -5)];
    const leftWall = [project(-6, 0, 5), project(-6, 0, -5), project(-6, 4.6, -5), project(-6, 4.6, 5)];
    drawWallTrim(backWall);
    drawWallTrim(leftWall);
  }

  function drawWallTrim(points) {
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.strokeStyle = "#b8c2ad";
    context.lineWidth = 1;
    context.stroke();
  }

  function addPlant(items, x, z, size = 1) {
    addCube(items, x, 0, z, 0.62 * size, 0.48 * size, 0.62 * size, "#bb8666");
    addCube(items, x, 0.43 * size, z, 0.67 * size, 0.12 * size, 0.67 * size, "#d09a75");
    addCube(items, x, 0.52 * size, z, 0.1 * size, 0.52 * size, 0.1 * size, "#748c5b");
    addCube(items, x - 0.19 * size, 0.66 * size, z + 0.04 * size, 0.22 * size, 0.16 * size, 0.14 * size, colors.plant);
    addCube(items, x + 0.2 * size, 0.77 * size, z - 0.02 * size, 0.2 * size, 0.17 * size, 0.12 * size, "#779263");
    addCube(items, x, 0.94 * size, z - 0.15 * size, 0.18 * size, 0.15 * size, 0.13 * size, "#80976b");
  }

  function buildFurniture(items) {
    for (const [legX, legZ] of [[-1.85, -1.6], [-0.02, -1.6], [-1.85, -0.5], [-0.02, -0.5]]) {
      addCube(items, legX, 0, legZ, 0.12, 1.3, 0.12, "#897456");
    }
    addCube(items, -0.93, 1.3, -1.05, 2.05, 0.17, 1.28, colors.desk);
    addCube(items, -0.93, 1.48, -1.52, 0.82, 0.76, 0.13, colors.monitor);
    addCube(items, -0.93, 1.57, -1.438, 0.68, 0.55, 0.025, colors.screen);
    addCube(items, -0.93, 1.39, -1.29, 0.12, 0.13, 0.15, "#88958a");
    addCube(items, -0.94, 1.39, -0.96, 0.73, 0.035, 0.26, "#e9e4d9");
    addCube(items, -0.82, 1.43, -0.96, 0.085, 0.035, 0.075, "#57685d");

    addCube(items, 0.1, 0, 0.48, 0.81, 1.04, 0.75, colors.chair);
    addCube(items, 0.1, 0.99, 0.48, 0.92, 0.16, 0.84, "#739184");
    addCube(items, 0.1, 0.43, 0.86, 0.13, 0.42, 0.13, "#555b4d");

    addCube(items, -0.55, 0, -3.1, 1.18, 0.32, 1.18, "#927b62");
    addCube(items, -0.55, 0.32, -3.1, 1.35, 0.1, 1.35, "#bca17d");
    for (const [x, z] of [[-1.35, -3.9], [0.25, -3.9], [-1.35, -2.3], [0.25, -2.3]]) {
      addCube(items, x, 0, z, 0.12, 0.77, 0.12, "#887657");
    }

    addCube(items, 3.35, 0, -0.95, 0.88, 0.73, 0.78, colors.printer);
    addCube(items, 3.35, 0.73, -0.95, 0.74, 0.19, 0.72, "#d9d5ca");
    addCube(items, 3.35, 0.6, -0.54, 0.51, 0.09, 0.13, "#c2beb1");
    addCube(items, 3.35, 0.49, -1.39, 0.51, 0.06, 0.13, "#657b73");

    addCube(items, 3.25, 0, 2.45, 0.8, 0.78, 0.84, "#a5805b");
    addCube(items, 3.25, 0.76, 2.45, 0.86, 0.13, 0.9, "#c79c72");
    addCube(items, 3.25, 0.64, 2.88, 0.6, 0.08, 0.08, "#785a40");
    addCube(items, 3.25, 0.46, 2.88, 0.61, 0.32, 0.07, "#ead9af");

    addPlant(items, -3.55, 0.9, 1.1);
    addPlant(items, 4.15, 1.9, 0.85);
    addPlant(items, -4.25, -2.3, 0.78);
  }

  function drawPerson(x, z, time, moving) {
    const bob = moving ? Math.abs(Math.sin(time * 12)) * 0.065 : Math.sin(time * 2.1) * 0.02;
    const items = [];
    addCube(items, x - 0.09, bob, z, 0.16, 0.46, 0.17, colors.pants);
    addCube(items, x + 0.09, bob, z, 0.16, 0.46, 0.17, "#526259");
    addCube(items, x, bob + 0.44, z, 0.48, 0.61, 0.32, colors.shirt);
    addCube(items, x - 0.3, bob + 0.47, z + 0.03, 0.12, 0.43, 0.12, "#6e8964");
    addCube(items, x + 0.3, bob + 0.47, z - 0.03, 0.12, 0.42, 0.12, "#748e69");
    addCube(items, x, bob + 1.03, z, 0.35, 0.37, 0.32, colors.skin);
    addCube(items, x, bob + 1.32, z, 0.37, 0.15, 0.34, colors.hair);
    items.sort((a, b) => a.depth - b.depth);
    items.forEach((face) => polygon(face.points, face.color));

    const shadow = project(x, 0.015, z);
    context.beginPath();
    context.ellipse(shadow.x, shadow.y, scale * 0.35, scale * 0.12, 0, 0, TAU);
    context.fillStyle = "#44504430";
    context.fill();
  }

  function roundRect(x, y, w, h, radius, fill, stroke = null) {
    context.beginPath();
    context.roundRect(x, y, w, h, radius);
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.stroke();
    }
  }

  function text(value, x, y, size, color, weight = 400, align = "left", font = '"DM Sans", Arial, sans-serif', maxWidth) {
    context.fillStyle = color;
    context.font = `${weight} ${size}px ${font}`;
    context.textAlign = align;
    context.textBaseline = "middle";
    if (maxWidth) context.fillText(value, x, y, maxWidth);
    else context.fillText(value, x, y);
  }

  function panel(x, y, w, h, accent = "#79936b") {
    roundRect(x + 3, y + 4, w, h, 13, "#23332812");
    roundRect(x, y, w, h, 12, "#fcfbf2ed", "#ffffffd9");
    roundRect(x, y, 4, h, [12, 0, 0, 12], accent);
  }

  function drawScoreboard() {
    const compact = width < 560;
    const panelX = compact ? 12 : 22;
    const panelY = compact ? 12 : 20;
    const panelW = compact ? Math.min(width - 24, 398) : 422;
    const panelH = compact ? 106 : 119;
    panel(panelX, panelY, panelW, panelH);

    text("OFFICE HOURS", panelX + 18, panelY + 18, compact ? 9 : 10, "#697668", 500, "left", '"DM Mono", monospace');
    text(state.finished ? "SHIFT COMPLETE" : "MONDAY, PROBABLY", panelX + panelW - 16, panelY + 18, 8, "#969989", 500, "right", '"DM Mono", monospace');

    const elapsedHours = 9 + Math.floor(state.minutes / 60);
    const clockHour = elapsedHours % 12 || 12;
    const clock = `${String(clockHour).padStart(2, "0")}:${String(state.minutes % 60).padStart(2, "0")}`;
    text(clock, panelX + 17, panelY + 50, compact ? 25 : 29, "#29372e", 600, "left", '"Space Grotesk", sans-serif');
    text(elapsedHours >= 12 ? "PM" : "AM", panelX + (compact ? 83 : 91), panelY + 52, 10, "#597751", 500, "left", '"DM Mono", monospace');

    const remaining = Math.max(0, 480 - state.minutes);
    const timeRemaining = `${Math.floor(remaining / 60)}h ${String(remaining % 60).padStart(2, "0")}m LEFT`;
    text(timeRemaining, panelX + panelW - 16, panelY + 48, 8, "#697668", 500, "right", '"DM Mono", monospace');

    const barX = panelX + 17;
    const barY = panelY + (compact ? 74 : 80);
    const barW = panelW - 34;
    roundRect(barX, barY, barW, 4, 3, "#e6e8db");
    if (state.minutes > 0) roundRect(barX, barY, barW * state.minutes / 480, 4, 3, "#79936b");
    text("9 AM", barX, barY + 14, 7, "#969989", 400, "left", '"DM Mono", monospace');
    text("5 PM", barX + barW, barY + 14, 7, "#969989", 400, "right", '"DM Mono", monospace');

    const statsY = panelY + panelH + 9;
    const statsW = compact ? 115 : 128;
    const statsH = 36;
    panel(panelX, statsY, statsW, statsH, "#83a275");
    text("WORK ETHIC", panelX + 11, statsY + 12, 7, "#808a7c", 500, "left", '"DM Mono", monospace');
    text(`${state.work} / 100`, panelX + 11, statsY + 26, 10, "#40533f", 500, "left", '"DM Mono", monospace');

    const suspicionX = panelX + statsW + 8;
    panel(suspicionX, statsY, statsW, statsH, state.suspicion >= 35 ? "#cb8257" : "#c39b61");
    text("SUSPICION", suspicionX + 11, statsY + 12, 7, "#858778", 500, "left", '"DM Mono", monospace');
    text(`${state.suspicion} / 100`, suspicionX + 11, statsY + 26, 10, "#594837", 500, "left", '"DM Mono", monospace');

    const snackW = compact ? 103 : 111;
    if (!compact || width > 355) {
      const snackX = suspicionX + statsW + 8;
      panel(snackX, statsY, snackW, statsH, "#c5955d");
      text("SNACKS", snackX + 11, statsY + 12, 7, "#858778", 500, "left", '"DM Mono", monospace');
      text(`${state.snacks} SECURED`, snackX + 11, statsY + 26, 9, "#594837", 500, "left", '"DM Mono", monospace');
    }
  }

  function drawActionCard(action, x, y, w, h, compact, hovered) {
    const background = hovered ? "#f7f5e9fa" : "#fcfbf2f2";
    const border = hovered ? "#9bab84" : "#ffffffd1";
    roundRect(x + 2, y + 3, w, h, 9, "#23332813");
    roundRect(x, y, w, h, 9, background, border);
    roundRect(x, y, 3, h, [9, 0, 0, 9], action.color);
    const isWork = action.kind === "WORK";
    const categoryColor = isWork ? "#728169" : "#b0754f";
    text(action.kind, x + 11, y + 12, 6, categoryColor, 500, "left", '"DM Mono", monospace');
    text(action.minutes === 30 ? "30 MIN" : `${action.minutes / 60} HR`, x + w - 9, y + 12, 6, "#8c9082", 400, "right", '"DM Mono", monospace');
    text(action.title, x + 11, y + (compact ? 31 : 34), compact ? 9 : 11, "#334238", 600, "left", '"DM Sans", Arial, sans-serif', w - 20);
    if (!compact && h > 56) text(action.detail, x + 11, y + 51, 8, "#848a7b", 400);
    if (h > 57) {
      const reward = action.work ? `+${action.work} WORK ETHIC` : action.snacks ? "+1 SNACK" : `+${action.suspicion} CHAOS`;
      text(reward, x + 11, y + h - 11, 7, action.kind === "WORK" ? "#668059" : "#b57853", 500, "left", '"DM Mono", monospace');
    }
  }

  function drawControlPanel() {
    const compact = width < 560;
    const gap = 7;
    const margin = compact ? 11 : 19;
    const availableWidth = Math.max(0, width - margin * 2);
    const cardW = Math.min(compact ? 178 : 188, (availableWidth - gap * 2) / 3);
    const cardH = compact ? 54 : 67;
    const x = (width - (cardW * 3 + gap * 2)) / 2;
    const y = height - cardH - (compact ? 13 : 19);
    const visibleActions = width < 390
      ? [actions[0], actions[3], actions[4]]
      : [actions[0], actions[3], actions[4]];

    visibleActions.forEach((action, index) => {
      const cardX = x + index * (cardW + gap);
      const enabled = !state.finished && state.minutes + action.minutes <= 480;
      context.globalAlpha = enabled ? 1 : 0.54;
      drawActionCard(action, cardX, y, cardW, cardH, compact, hoveredAction === action.id);
      context.globalAlpha = 1;
      polygons.set(`card:${action.id}`, { x: cardX, y, w: cardW, h: cardH, action: enabled ? action : null });
    });

    const moreY = y - (compact ? 43 : 48);
    const moreGap = 6;
    const moreW = compact ? Math.min(145, (availableWidth - moreGap * 2) / 3) : 160;
    const moreX = (width - (moreW * 3 + moreGap * 2)) / 2;
    const extraActions = width < 390
      ? [actions[1], actions[2], actions[5]]
      : [actions[1], actions[2], actions[5]];
    extraActions.forEach((action, index) => {
      const cardX = moreX + index * (moreW + moreGap);
      const enabled = !state.finished && state.minutes + action.minutes <= 480;
      context.globalAlpha = enabled ? 0.96 : 0.48;
      drawActionCard(action, cardX, moreY, moreW, compact ? 36 : 40, true, hoveredAction === action.id);
      context.globalAlpha = 1;
      polygons.set(`card:${action.id}`, { x: cardX, y: moreY, w: moreW, h: compact ? 36 : 40, action: enabled ? action : null });
    });
  }

  function drawActivityPanel() {
    if (width < 560) return;
    const w = Math.min(263, Math.max(185, width * 0.22));
    const x = width - w - 21;
    const y = 20;
    const count = width < 740 ? 3 : 5;
    const rows = state.logs.slice(0, count);
    const panelH = 74 + rows.length * 27;
    panel(x, y, w, panelH, "#87947b");
    text("THE PAPER TRAIL", x + 15, y + 19, 8, "#667264", 500, "left", '"DM Mono", monospace');
    context.beginPath();
    context.arc(x + w - 31, y + 19, 3, 0, TAU);
    context.fillStyle = "#81a471";
    context.fill();
    text("LIVE", x + w - 14, y + 19, 6, "#8d9584", 400, "right", '"DM Mono", monospace');

    rows.forEach((entry, index) => {
      const rowY = y + 46 + index * 27;
      text(entry.time, x + 14, rowY, 7, "#909485", 400, "left", '"DM Mono", monospace');
      context.beginPath();
      context.arc(x + 55, rowY, 3, 0, TAU);
      context.fillStyle = entry.kind === "crime" ? "#d2895b" : entry.kind === "start" ? "#8295a0" : "#87a478";
      context.fill();
      const maxChars = Math.max(15, Math.floor((w - 76) / 5.7));
      const content = entry.text.length > maxChars ? `${entry.text.slice(0, maxChars - 1)}…` : entry.text;
      text(content, x + 66, rowY, 7, "#667269", 400);
    });
  }

  function drawStatusPanel() {
    const message = state.finished
      ? "5 PM. The office is somebody else's problem now."
      : state.suspicion >= 65
        ? "Your manager is starting to ask questions."
        : state.suspicion >= 35
          ? "Someone just glanced over your shoulder."
          : state.status;
    const compact = width < 560;
    const x = compact ? 12 : 22;
    const y = compact ? 168 : 176;
    const maxWidth = compact ? width - 24 : Math.min(430, width - 475);
    if (maxWidth < 60) return;
    const w = Math.min(compact ? 330 : 410, maxWidth);
    const h = compact ? 32 : 35;
    roundRect(x + 2, y + 3, w, h, 8, "#23332810");
    roundRect(x, y, w, h, 8, "#fcfbf2e8", "#ffffffc9");
    text("✳", x + 13, y + h / 2, 12, "#b58c55");
    const maxChars = Math.max(9, Math.floor((w - 39) / (compact ? 6 : 6.4)));
    text(message.length > maxChars ? `${message.slice(0, maxChars - 1)}…` : message, x + 29, y + h / 2, compact ? 8 : 9, "#70796e");
  }

  function drawStationLabels(now) {
    actions.forEach((action) => {
      if (action.id === "spreadsheet") return;
      const anchor = project(action.x, action.prop === "meeting" ? 1.05 : action.prop === "desk" ? 2.42 : action.prop === "snacks" ? 1.34 : 1.35, action.z);
      const widthLabel = action.title.length * 5.4 + 24;
      const x = anchor.x - widthLabel / 2;
      const y = anchor.y - 4;
      const hovered = hoveredAction === action.id || hoveredAction === "inbox" && action.id === "inbox";
      const selected = actionProgress?.action.id === action.id;
      roundRect(x + 2, y + 2, widthLabel, 23, 6, "#24352c20");
      roundRect(x, y, widthLabel, 22, 6, hovered ? "#fcfbf2" : "#f7f5ebed", hovered ? action.color : "#ffffffbf");
      context.beginPath();
      context.arc(x + 9, y + 11, 3, 0, TAU);
      context.fillStyle = action.color;
      context.fill();
      const available = !state.finished && state.minutes + action.minutes <= 480;
      context.globalAlpha = available ? 1 : 0.53;
      text(action.title, x + 16, y + 11, 7, "#3a483b", 500);
      context.globalAlpha = 1;
      polygons.set(`station:${action.id}`, {
        x: x - 8, y: y - 8, w: widthLabel + 16, h: 39,
        action: available && !selected ? action : null,
      });
    });
  }

  function drawToast(now) {
    if (!state.toast || now > state.toastUntil) return;
    const alpha = Math.min(1, (state.toastUntil - now) * 2);
    context.globalAlpha = alpha;
    const w = Math.min(360, width - 32);
    const x = (width - w) / 2;
    const y = Math.max(8, height * 0.27);
    roundRect(x + 3, y + 4, w, 50, 11, "#20332924");
    roundRect(x, y, w, 47, 10, "#fcfbf5");
    text(state.toast, width / 2, y + 23, 11, "#426147", 600, "center");
    context.globalAlpha = 1;
  }

  function drawDpad() {
    if (width >= 560 || state.finished) return;
    const x = 17;
    const y = Math.min(height - 137, Math.max(178, height * 0.43));
    const button = 35;
    const gap = 3;
    const buttons = [
      { label: "↑", key: "forward", x: x + button + gap, y },
      { label: "←", key: "left", x, y: y + button + gap },
      { label: "↓", key: "back", x: x + button + gap, y: y + button + gap },
      { label: "→", key: "right", x: x + (button + gap) * 2, y: y + button + gap },
    ];
    buttons.forEach((item) => {
      const active = keys.has(item.key);
      roundRect(item.x, item.y, button, button, 8, active ? "#dfe8d7ee" : "#fcfbf2dd", "#ffffffd1");
      text(item.label, item.x + button / 2, item.y + button / 2, 16, "#4a6046", 500, "center");
      polygons.set(`move:${item.key}`, { x: item.x, y: item.y, w: button, h: button });
    });
  }

  function drawFinishPanel() {
    if (!state.finished) return;
    const w = Math.min(420, width - 32);
    const h = 174;
    const x = (width - w) / 2;
    const y = Math.max(215, height * 0.37);
    roundRect(x + 4, y + 6, w, h, 15, "#23332833");
    roundRect(x, y, w, h, 14, "#fcfbf2fa", "#ffffffed");
    roundRect(x, y, 4, h, [14, 0, 0, 14], state.suspicion >= 70 ? "#ca8156" : "#75906c");
    text("SHIFT COMPLETE · 5:00 PM", x + 22, y + 23, 8, "#748071", 500, "left", '"DM Mono", monospace');
    text(state.suspicion >= 70 ? "HR would like a word." : state.work >= 50 ? "Employee of the month-ish." : "You survived the workday.", x + 22, y + 52, width < 400 ? 16 : 19, "#2d3b31", 600, "left", '"Space Grotesk", sans-serif', w - 44);
    const statsY = y + 100;
    const statGap = (w - 44) / 3;
    const values = [
      { label: "WORK ETHIC", value: `${state.work} / 100` },
      { label: "SUSPICION", value: `${state.suspicion} / 100` },
      { label: "SNACKS", value: String(state.snacks) },
    ];
    values.forEach((stat, index) => {
      text(stat.label, x + 22 + statGap * index, statsY, 7, "#919486", 500, "left", '"DM Mono", monospace');
      text(stat.value, x + 22 + statGap * index, statsY + 20, 11, "#42523f", 500, "left", '"DM Mono", monospace');
    });
  }

  function drawRestartButton() {
    if (!state.finished) return;
    const w = 148;
    const h = 42;
    const x = (width - w) / 2;
    const y = height * 0.69;
    roundRect(x, y, w, h, 9, "#58784d");
    text("PLAY ANOTHER DAY  ↗", x + w / 2, y + h / 2, 9, "#fffefa", 600, "center", '"DM Mono", monospace');
    polygons.set("restart", { x, y, w, h });
  }

  function draw(now = 0) {
    if (!width || !height) return;
    const time = now / 1000;
    polygons.clear();
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#e8eddf");
    background.addColorStop(1, "#dedcca");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    drawFloorAndWalls();
    const objects = [];
    buildFurniture(objects);
    objects.sort((a, b) => a.depth - b.depth);
    objects.forEach((face) => polygon(face.points, face.color));

    drawPerson(player.x, player.z, time, player.moving);
    drawStationLabels(time);
    drawScoreboard();
    drawStatusPanel();
    drawActivityPanel();
    drawControlPanel();
    drawDpad();
    drawToast(time);
    drawFinishPanel();
    drawRestartButton();
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    scale = Math.min(width / 14, height / 9.6);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function updateAccessibleStatus(message, announce = false) {
    state.status = message;
    if (announce && liveRegion) liveRegion.textContent = message;
  }

  function activateAction(action) {
    if (!action || state.finished || state.minutes + action.minutes > 480) return;
    state.minutes += action.minutes;
    state.work = Math.min(100, state.work + action.work);
    state.suspicion = Math.min(100, state.suspicion + action.suspicion);
    state.snacks += action.snacks || 0;
    state.logs.unshift({
      time: clockTime(),
      text: action.log,
      kind: action.work ? "work" : "crime",
    });
    state.logs.length = Math.min(state.logs.length, 12);
    state.toast = `${action.work ? "GOOD JOB" : "OFFICE MISCHIEF"} · ${action.title}`;
    state.toastUntil = performance.now() / 1000 + 2.2;
    if (state.minutes >= 480) {
      state.finished = true;
      updateAccessibleStatus("Shift complete. You made it to 5 PM. Click the canvas to play another day.", true);
    } else if (state.suspicion >= 70) {
      updateAccessibleStatus("Your manager is starting to ask questions. Walk it off.", true);
    } else {
      updateAccessibleStatus(`${action.title}. ${clockTime()}. ${480 - state.minutes} workday minutes remain.`, true);
    }

    draw(performance.now());
  }

  function clockTime() {
    const hour = 9 + Math.floor(state.minutes / 60);
    return `${String(hour).padStart(2, "0")}:${String(state.minutes % 60).padStart(2, "0")}`;
  }

  function resetGame() {
    state.minutes = 0;
    state.work = 0;
    state.suspicion = 0;
    state.snacks = 0;
    state.finished = false;
    state.logs = [{ time: "09:00", text: "Clocked in. They have no idea.", kind: "start" }];
    state.status = "Pick an office station. Any station. You're on the clock.";
    state.toast = "A FRESH DAY. A FRESH SET OF QUESTIONABLE CHOICES.";
    state.toastUntil = performance.now() / 1000 + 2.2;
    actionProgress = null;
    player.x = 0.15;
    player.z = 2.1;
    camera.angle = 0.5;
    camera.pitch = 0;
    keys.clear();
    hoveredAction = null;
    if (liveRegion) liveRegion.textContent = "New day. You clocked in at 9 AM. Use WASD or arrow keys to walk, drag to look around, and click an office station to take an action.";
    draw(performance.now());
  }

  function movePlayer(delta, now) {
    if (state.finished) return;
    let horizontal = Number(keys.has("d") || keys.has("arrowright") || keys.has("right"))
      - Number(keys.has("a") || keys.has("arrowleft") || keys.has("left"));
    let vertical = Number(keys.has("s") || keys.has("arrowdown") || keys.has("back"))
      - Number(keys.has("w") || keys.has("arrowup") || keys.has("forward"));

    if (!Math.hypot(horizontal, vertical) && actionProgress) {
      const dx = actionProgress.action.x - player.x;
      const dz = actionProgress.action.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 1.6) {
        horizontal = (dx * Math.cos(camera.angle) - dz * Math.sin(camera.angle)) / distance;
        vertical = (dx * Math.sin(camera.angle) + dz * Math.cos(camera.angle)) / distance;
      }
    }

    const magnitude = Math.hypot(horizontal, vertical);
    if (!magnitude) return;
    horizontal /= magnitude;
    vertical /= magnitude;

    const cosine = Math.cos(camera.angle);
    const sine = Math.sin(camera.angle);
    player.x += (horizontal * cosine + vertical * sine) * delta * 2.7;
    player.z += (-horizontal * sine + vertical * cosine) * delta * 2.7;
    player.x = Math.max(-4.85, Math.min(4.85, player.x));
    player.z = Math.max(-4.2, Math.min(4.2, player.z));
    player.moving = true;

    if (actionProgress) {
      const distance = Math.hypot(player.x - actionProgress.action.x, player.z - actionProgress.action.z);
      if (distance < 1.65) {
        const action = actionProgress.action;
        actionProgress = null;
        activateAction(action);
      } else if (now / 1000 > actionProgress.until) {
        actionProgress = null;
        updateAccessibleStatus("Didn't reach that station in time. Walk closer and click it again.");
      }
    }
  }

  function frame(now) {
    const delta = Math.min((now - previousFrame) / 1000 || 0, 0.05);
    previousFrame = now;
    player.moving = false;
    movePlayer(delta, now);
    draw(now);
    animationFrame = window.requestAnimationFrame(frame);
  }

  function within(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function clickAt(x, y) {
    if (state.finished) {
      if (within(polygons.get("restart"), x, y)) resetGame();
      return;
    }

    for (const [id, rect] of [...polygons.entries()].reverse()) {
      if (!within(rect, x, y)) continue;
      if (id === "restart") {
        resetGame();
        return;
      }
      if (id.startsWith("move:")) {
        keys.add(id.slice(5));
        window.setTimeout(() => keys.delete(id.slice(5)), 190);
        return;
      }
      if (rect.action) {
        const action = rect.action;
        const distance = Math.hypot(player.x - action.x, player.z - action.z);
        if (distance <= 2.25) {
          activateAction(action);
        } else {
          actionProgress = { action, until: performance.now() / 1000 + Math.min(12, distance / 2.2 + 3) };
          updateAccessibleStatus(`Walking over to ${action.title}. Use WASD to move faster.`);
          state.toast = `ON THE MOVE → ${action.title.toUpperCase()}`;
          state.toastUntil = performance.now() / 1000 + 1.8;
        }
        return;
      }
    }
  }

  function updatePointer(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    hoveredAction = null;
    for (const [id, rect] of polygons) {
      if (id.startsWith("card:") && within(rect, x, y)) {
        hoveredAction = id.slice(5);
        break;
      }
      if (id.startsWith("station:") && within(rect, x, y)) {
        hoveredAction = id.slice(8);
        break;
      }
    }
    canvas.style.cursor = hoveredAction ? "pointer" : camera.dragging ? "grabbing" : "crosshair";
  }

  canvas.addEventListener("pointerdown", (event) => {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (event.pointerType === "touch") {
      for (const [id, rect] of polygons) {
        if (id.startsWith("move:") && within(rect, x, y)) {
          keys.add(id.slice(5));
          canvas.setPointerCapture(event.pointerId);
          return;
        }
      }
    }
    camera.dragging = true;
    camera.lastX = event.clientX;
    camera.lastY = event.clientY;
    camera.startX = event.clientX;
    camera.startY = event.clientY;
    pointerMoved = false;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    updatePointer(event);
    if (!camera.dragging || event.pointerType === "touch" && [...keys].some((key) => ["forward", "back", "left", "right"].includes(key))) return;
    const deltaX = event.clientX - camera.lastX;
    const deltaY = event.clientY - camera.lastY;
    if (Math.hypot(event.clientX - camera.startX, event.clientY - camera.startY) > 7) {
      pointerMoved = true;
      camera.angle += deltaX * 0.007;
      camera.pitch = Math.max(-35, Math.min(35, camera.pitch + deltaY * 0.35));
    }
    camera.lastX = event.clientX;
    camera.lastY = event.clientY;
  });

  canvas.addEventListener("pointerup", (event) => {
    const bounds = canvas.getBoundingClientRect();
    const wasDragging = camera.dragging;
    camera.dragging = false;
    for (const key of ["forward", "back", "left", "right"]) keys.delete(key);
    if (wasDragging && !pointerMoved) clickAt(event.clientX - bounds.left, event.clientY - bounds.top);
  });

  canvas.addEventListener("pointercancel", () => {
    camera.dragging = false;
    keys.clear();
  });

  function handleCanvasKeyDown(event) {
    if (state.finished && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      resetGame();
      return;
    }
    onKeyDown(event);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      keys.add(key);
    }
    if (event.key === "Escape") {
      actionProgress = null;
      camera.pitch = 0;
      camera.angle = 0.5;
    }
  }

  window.addEventListener("keydown", handleCanvasKeyDown);
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => {
    keys.clear();
    camera.dragging = false;
  });
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", () => window.cancelAnimationFrame(animationFrame), { once: true });

  window.officeScene = {
    perform(actionId) {
      const action = actions.find((candidate) => candidate.id === actionId);
      if (action) activateAction(action);
    },
    reset: resetGame,
  };

  resize();
  animationFrame = window.requestAnimationFrame(frame);
  if (liveRegion) liveRegion.textContent = "You clocked in at 9 AM. Use WASD or arrow keys to walk, drag to look around, and click an office station to take an action.";
})();
