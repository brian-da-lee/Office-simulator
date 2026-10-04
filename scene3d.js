(() => {
  const canvas = document.querySelector("#office-canvas");
  const viewport = document.querySelector("#scene-viewport");
  const playerTag = document.querySelector(".scene-player-tag");
  if (!canvas || !viewport) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const keys = new Set();
  const player = { x: 0, z: 2.2, moving: false };
  const camera = { angle: 0.64, dragX: null };
  const scene = { action: null, actionStarted: 0, time: 0 };
  const controls = [...document.querySelectorAll("[data-move]")];
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

  let width = 0;
  let height = 0;
  let scale = 1;
  let previousFrame = 0;
  let animationFrame = 0;

  function resize() {
    const bounds = viewport.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    scale = Math.min(width / 12.7, height / 8.4);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }

  function project(x, y, z) {
    const cosine = Math.cos(camera.angle);
    const sine = Math.sin(camera.angle);
    const sideways = x * cosine - z * sine;
    const depth = x * sine + z * cosine;
    return {
      x: width * 0.5 + sideways * scale,
      y: height * 0.59 + (depth * 0.43 - y * 0.9) * scale,
      depth,
    };
  }

  function polygon(points, fill, stroke = null) {
    context.beginPath();
    points.forEach((point, index) => {
      const projected = project(point[0], point[1], point[2]);
      if (index === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    });
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 0.8;
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
    const faces = [
      { points: [v[0], v[1], v[5], v[4]], shade: 0.79 },
      { points: [v[1], v[2], v[6], v[5]], shade: 0.9 },
      { points: [v[2], v[3], v[7], v[6]], shade: 1.06 },
      { points: [v[3], v[0], v[4], v[7]], shade: 0.85 },
      { points: [v[4], v[5], v[6], v[7]], shade: 1.16 },
    ];
    return faces.map((face) => ({
      ...face,
      depth: face.points.reduce((total, point) => total + point[0] * Math.sin(camera.angle) + point[2] * Math.cos(camera.angle), 0) / 4,
      color: shade(color, face.shade),
    }));
  }

  function shade(hex, amount) {
    const value = Number.parseInt(hex.slice(1), 16);
    const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel * amount))),
    );
    return `rgb(${channels.join(",")})`;
  }

  function addCube(items, x, y, z, w, h, d, color) {
    items.push(...cubeFaces(x, y, z, w, h, d, color));
  }

  function room() {
    const floor = [
      [-5.5, 0, -4.6], [5.5, 0, -4.6], [5.5, 0, 4.6], [-5.5, 0, 4.6],
    ];
    polygon(floor, "#d9d4c4");

    for (let x = -5; x <= 5; x += 1) {
      const a = project(x, 0, -4.6);
      const b = project(x, 0, 4.6);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = "#c9c4b5";
      context.globalAlpha = 0.45;
      context.stroke();
      context.globalAlpha = 1;
    }
    for (let z = -4; z <= 4; z += 1) {
      const a = project(-5.5, 0, z);
      const b = project(5.5, 0, z);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = "#c9c4b5";
      context.globalAlpha = 0.45;
      context.stroke();
      context.globalAlpha = 1;
    }

    polygon([[-5.5, 0, -4.6], [5.5, 0, -4.6], [5.5, 4.8, -4.6], [-5.5, 4.8, -4.6]], "#e8e8d9");
    polygon([[-5.5, 0, 4.6], [-5.5, 0, -4.6], [-5.5, 4.8, -4.6], [-5.5, 4.8, 4.6]], "#d6ddce");
    polygon([[-3.9, 1.4, -4.58], [-1.6, 1.4, -4.58], [-1.6, 3.9, -4.58], [-3.9, 3.9, -4.58]], "#b7cfc1");
    polygon([[-3.9, 1.4, -4.55], [-1.6, 1.4, -4.55], [-1.6, 1.5, -4.55], [-3.9, 1.5, -4.55]], "#f1ead9");
    polygon([[-3.9, 3.8, -4.55], [-1.6, 3.8, -4.55], [-1.6, 3.9, -4.55], [-3.9, 3.9, -4.55]], "#f1ead9");
    polygon([[-2.85, 1.4, -4.5], [-2.75, 1.4, -4.5], [-2.75, 3.9, -4.5], [-2.85, 3.9, -4.5]], "#f1ead9");
  }

  function drawPlant(items, x, z, size = 1) {
    addCube(items, x, 0, z, 0.63 * size, 0.52 * size, 0.63 * size, "#bb8666");
    addCube(items, x, 0.46 * size, z, 0.68 * size, 0.12 * size, 0.68 * size, "#d09a75");
    addCube(items, x, 0.56 * size, z, 0.12 * size, 0.5 * size, 0.12 * size, "#748c5b");
    addCube(items, x - 0.21 * size, 0.68 * size, z + 0.05 * size, 0.21 * size, 0.16 * size, 0.12 * size, colors.plant);
    addCube(items, x + 0.2 * size, 0.76 * size, z - 0.03 * size, 0.2 * size, 0.17 * size, 0.12 * size, "#779263");
    addCube(items, x - 0.02 * size, 0.93 * size, z - 0.16 * size, 0.19 * size, 0.15 * size, 0.12 * size, "#80976b");
  }

  function buildFurniture(items) {
    for (const [legX, legZ] of [[-1.7, -0.95], [0.25, -0.95], [-1.7, 0.05], [0.25, 0.05]]) {
      addCube(items, legX, 0, legZ, 0.13, 1.3, 0.13, colors.leg);
    }
    addCube(items, -0.73, 1.3, -0.45, 2.12, 0.17, 1.23, colors.desk);
    addCube(items, -0.73, 1.48, -0.58, 0.82, 0.74, 0.12, colors.monitor);
    addCube(items, -0.73, 1.57, -0.505, 0.68, 0.55, 0.025, colors.screen);
    addCube(items, -0.73, 1.39, -0.38, 0.11, 0.13, 0.13, "#88958a");
    addCube(items, -0.74, 1.39, -0.11, 0.75, 0.035, 0.28, "#e9e4d9");
    addCube(items, -0.65, 1.43, -0.12, 0.085, 0.035, 0.075, "#57685d");
    addCube(items, 0.78, 0, 1.0, 0.84, 1.23, 0.86, colors.chair);
    addCube(items, 0.78, 1.15, 1.0, 0.96, 0.16, 0.94, "#739184");
    addCube(items, 0.78, 0.55, 1.37, 0.14, 0.44, 0.14, "#555b4d");
    addCube(items, 3.45, 0, -0.4, 0.79, 0.62, 0.62, colors.printer);
    addCube(items, 3.45, 0.62, -0.4, 0.66, 0.18, 0.59, "#d9d5ca");
    addCube(items, 3.45, 0.51, -0.08, 0.48, 0.08, 0.14, "#c2beb1");
    drawPlant(items, -3.6, -0.35, 1.2);
    drawPlant(items, 3.9, 2.3, 0.87);
    addCube(items, 2.9, 0, 2.8, 0.48, 0.41, 0.48, "#a77d5d");
    addCube(items, 2.9, 0.39, 2.8, 0.51, 0.12, 0.51, "#bf9470");
    addCube(items, 2.9, 0.51, 2.8, 0.09, 0.38, 0.09, "#68855c");
    addCube(items, 2.78, 0.67, 2.82, 0.21, 0.13, 0.11, "#718e63");
    addCube(items, 3.02, 0.72, 2.74, 0.19, 0.14, 0.1, "#78936a");
  }

  function drawPerson(x, z, time, isMoving) {
    const bob = isMoving ? Math.abs(Math.sin(time * 12)) * 0.07 : Math.sin(time * 2.1) * 0.025;
    const baseY = bob;
    const parts = [];
    addCube(parts, x, baseY, z, 0.16, 0.48, 0.18, colors.pants);
    addCube(parts, x + 0.1, baseY, z, 0.16, 0.48, 0.18, "#526259");
    addCube(parts, x, baseY + 0.46, z, 0.49, 0.62, 0.34, colors.shirt);
    addCube(parts, x - 0.08, baseY + 0.49, z + 0.23, 0.12, 0.47, 0.12, "#6e8964");
    addCube(parts, x + 0.3, baseY + 0.49, z + 0.13, 0.12, 0.42, 0.12, "#748e69");
    addCube(parts, x + 0.1, baseY + 1.07, z, 0.35, 0.38, 0.32, colors.skin);
    addCube(parts, x + 0.1, baseY + 1.38, z, 0.37, 0.15, 0.34, colors.hair);
    const faces = parts.flat();
    faces.sort((a, b) => a.depth - b.depth);
    faces.forEach((face) => polygon(face.points, face.color));

    const shadow = project(x + 0.1, 0.02, z);
    context.beginPath();
    context.ellipse(shadow.x, shadow.y, scale * 0.39, scale * 0.13, 0, 0, Math.PI * 2);
    context.fillStyle = "#44504425";
    context.fill();
    if (playerTag) {
      playerTag.style.left = `${shadow.x}px`;
      playerTag.style.top = `${shadow.y - scale * 1.8}px`;
    }
  }

  function drawActionIndicator(now) {
    if (!scene.action) return;
    const elapsed = now - scene.actionStarted;
    if (elapsed > 1.1) {
      scene.action = null;
      return;
    }
    const anchor = project(player.x + 0.1, 2.05 + Math.sin(elapsed * 5) * 0.12, player.z);
    const labels = {
      inbox: "INBOX ZERO!",
      snacks: "SNACK ACQUIRED!",
      meeting: "CIRCLE BACK!",
      printer: "CHAOS MODE!",
      spreadsheet: "SHEET GENIUS!",
      plants: "FENG SHUI!",
    };
    const label = labels[scene.action] || "NICE WORK!";
    context.save();
    context.font = `600 ${Math.max(10, scale * 0.33)}px "DM Mono", monospace`;
    const textWidth = context.measureText(label).width;
    const tagWidth = textWidth + 20;
    const tagHeight = Math.max(23, scale * 0.68);
    const opacity = Math.min(1, (1.1 - elapsed) * 3);
    context.globalAlpha = opacity;
    context.fillStyle = scene.action === "snacks" || scene.action === "printer" || scene.action === "plants" ? "#fff4e4" : "#f4f8eb";
    context.beginPath();
    context.roundRect(anchor.x - tagWidth / 2, anchor.y - tagHeight / 2, tagWidth, tagHeight, 6);
    context.fill();
    context.fillStyle = "#365a3b";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, anchor.x, anchor.y);
    context.restore();
  }

  function draw(now = 0) {
    if (!width || !height) return;
    const time = now / 1000;
    scene.time = time;
    context.clearRect(0, 0, width, height);
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#e8eddf");
    background.addColorStop(1, "#dedcca");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const items = [];
    buildFurniture(items);
    items.push({ character: true, x: player.x, z: player.z, depth: player.x * Math.sin(camera.angle) + player.z * Math.cos(camera.angle) });
    items.sort((a, b) => a.depth - b.depth);
    room();
    items.forEach((item) => {
      if (item.character) {
        drawPerson(item.x, item.z, time, player.moving);
      } else {
        polygon(item.points, item.color);
      }
    });
    drawActionIndicator(now / 1000);
  }

  function frame(now) {
    const elapsed = Math.min((now - previousFrame) / 1000 || 0, 0.05);
    previousFrame = now;
    const forward = keys.has("w") || keys.has("arrowup") || keys.has("forward");
    const backward = keys.has("s") || keys.has("arrowdown") || keys.has("back");
    const left = keys.has("a") || keys.has("arrowleft") || keys.has("left");
    const right = keys.has("d") || keys.has("arrowright") || keys.has("right");
    player.moving = forward || backward || left || right;

    if (player.moving) {
      const directionX = Number(right) - Number(left);
      const directionZ = Number(backward) - Number(forward);
      const length = Math.hypot(directionX, directionZ) || 1;
      player.x = Math.max(-4.65, Math.min(4.65, player.x + (directionX / length) * elapsed * 2.2));
      player.z = Math.max(-3.65, Math.min(3.65, player.z + (directionZ / length) * elapsed * 2.2));
    }

    draw(now);
    animationFrame = window.requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      if (event.target instanceof HTMLElement && event.target.closest("button, a, input, textarea, select")) return;
      event.preventDefault();
      keys.add(key);
    }
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  canvas.addEventListener("pointerdown", (event) => {
    camera.dragX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (camera.dragX === null) return;
    const movement = event.clientX - camera.dragX;
    camera.angle += movement * 0.009;
    camera.dragX = event.clientX;
  });

  canvas.addEventListener("pointerup", () => { camera.dragX = null; });
  canvas.addEventListener("pointercancel", () => { camera.dragX = null; });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("resize", resize);

  controls.forEach((button) => {
    const direction = button.dataset.move;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      keys.add(direction);
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", () => keys.delete(direction));
    button.addEventListener("pointercancel", () => keys.delete(direction));
    button.addEventListener("lostpointercapture", () => keys.delete(direction));
  });

  window.officeScene = {
    perform(action) {
      scene.action = action;
      scene.actionStarted = scene.time;
    },
    reset() {
      player.x = 0;
      player.z = 2.2;
      camera.angle = 0.64;
      scene.action = null;
      keys.clear();
    },
  };

  resize();
  animationFrame = window.requestAnimationFrame(frame);
  window.addEventListener("pagehide", () => window.cancelAnimationFrame(animationFrame), { once: true });
})();
