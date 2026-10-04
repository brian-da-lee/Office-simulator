const actions = {
  inbox: {
    label: "Cleared your inbox and replied 'sounds good!' to an email about the fire alarm test.",
    minutes: 60,
    work: 20,
    suspicion: 0,
    status: "Your inbox is zero. Your spirit is briefly full.",
  },
  snacks: {
    label: "Liberated communal pretzels. The snack drawer has no security clearance.",
    minutes: 30,
    work: 0,
    suspicion: 14,
    snacks: 1,
    status: "A delicious snack. A suspiciously empty snack drawer.",
  },
  meeting: {
    label: "Attended a meeting and said 'let's circle back' with conviction.",
    minutes: 60,
    work: 15,
    suspicion: 0,
    status: "Could've been an email. But now it counts as work.",
  },
  printer: {
    label: "Changed the printer defaults to landscape. Nobody will ever know. Probably.",
    minutes: 30,
    work: 0,
    suspicion: 20,
    status: "The printer is acting up. How mysterious.",
  },
  spreadsheet: {
    label: "Fixed the spreadsheet, including the formula that everyone feared.",
    minutes: 120,
    work: 30,
    suspicion: 0,
    status: "Look at you, making a tangible contribution.",
  },
  plants: {
    label: "Rearranged the office plants. You've created a botanical labyrinth.",
    minutes: 30,
    work: 0,
    suspicion: 8,
    status: "The plants are thriving. Your coworkers are disoriented.",
  },
};

const state = {
  minutes: 0,
  work: 0,
  suspicion: 0,
  snacks: 0,
  finished: false,
};

const elements = {
  time: document.querySelector("#clock-time"),
  timeLeft: document.querySelector("#time-left"),
  timeline: document.querySelector("#timeline-fill"),
  status: document.querySelector("#status-message"),
  work: document.querySelector("#work-score"),
  suspicion: document.querySelector("#suspicion-score"),
  workProgress: document.querySelector("#work-progress"),
  suspicionProgress: document.querySelector("#suspicion-progress"),
  heat: document.querySelector("#heat-message"),
  log: document.querySelector("#log-entries"),
  buttons: [...document.querySelectorAll(".action-card")],
  modal: document.querySelector("#modal-backdrop"),
  reset: document.querySelector("#reset-button"),
  restart: document.querySelector("#restart-button"),
};

function formatTime(totalMinutes) {
  const totalHours = 9 + Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(totalHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatClock(totalMinutes) {
  const totalHours = 9 + Math.floor(totalMinutes / 60);
  const hour = totalHours % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function updateDisplay() {
  const totalHours = 9 + Math.floor(state.minutes / 60);
  const remaining = 480 - state.minutes;
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;

  elements.time.innerHTML = `${formatClock(state.minutes)} <span>${totalHours >= 12 ? "PM" : "AM"}</span>`;
  elements.timeLeft.textContent = `${hours}h ${String(minutes).padStart(2, "0")}m`;
  elements.timeline.style.width = `${(state.minutes / 480) * 100}%`;
  elements.work.innerHTML = `${state.work}<span> / 100</span>`;
  elements.suspicion.innerHTML = `${state.suspicion}<span> / 100</span>`;
  elements.workProgress.style.width = `${state.work}%`;
  elements.suspicionProgress.style.width = `${state.suspicion}%`;
  elements.status.textContent = state.status;
  elements.buttons.forEach((button) => {
    button.disabled = state.finished || state.minutes + actions[button.dataset.action].minutes > 480;
  });

  if (state.suspicion >= 65) {
    elements.heat.innerHTML = '<span class="heat-icon">!</span> Your manager is starting to ask questions.';
  } else if (state.suspicion >= 35) {
    elements.heat.innerHTML = '<span class="heat-icon">◉</span> Someone just glanced over your shoulder.';
  } else {
    elements.heat.innerHTML = '<span class="heat-icon">✦</span> You\'re flying under the radar.';
  }
}

state.status = "New badge, same questionable morals.";

function addLog(action) {
  const entry = document.createElement("div");
  entry.className = "log-entry";

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatTime(state.minutes);

  const dot = document.createElement("span");
  dot.className = `log-dot ${action.work ? "" : "log-dot-crime"}`;

  const text = document.createElement("span");
  text.className = "log-text";
  text.textContent = action.label;

  entry.append(time, dot, text);
  elements.log.prepend(entry);
}

function finishDay() {
  state.finished = true;
  elements.buttons.forEach((button) => { button.disabled = true; });
  document.querySelector(".shift-tag").innerHTML = '<span class="status-dot"></span> SHIFT COMPLETE';
  document.querySelector("#final-work").textContent = `${state.work} / 100`;
  document.querySelector("#final-suspicion").textContent = `${state.suspicion} / 100`;
  document.querySelector("#final-snacks").textContent = String(state.snacks);

  const title = document.querySelector("#result-title");
  const copy = document.querySelector("#result-copy");
  const icon = document.querySelector("#result-icon");

  if (state.suspicion >= 70) {
    title.textContent = "HR would like a word.";
    copy.textContent = `You made it to five, but not before raising a few eyebrows. At least you secured ${state.snacks} snack${state.snacks === 1 ? "" : "s"} and made it through your shift.`;
    icon.textContent = "!";
    icon.classList.add("result-icon-hot");
  } else if (state.work >= 50) {
    title.textContent = "Employee of the month-ish.";
    copy.textContent = `A solid ${state.work} work ethic and ${state.suspicion} suspicion. You got the job done and had just enough fun. Go log off.`;
    icon.textContent = "✦";
    icon.classList.remove("result-icon-hot");
  } else {
    title.textContent = "You survived the workday.";
    copy.textContent = `A ${state.work} work ethic, ${state.suspicion} suspicion, and ${state.snacks} snack${state.snacks === 1 ? "" : "s"} secured. Honestly? You've earned that commute home.`;
    icon.textContent = "☕";
    icon.classList.remove("result-icon-hot");
  }

  elements.modal.hidden = false;
  elements.restart.focus();
}

function takeAction(actionName) {
  if (state.finished) return;

  const action = actions[actionName];
  if (!action) return;

  state.minutes += action.minutes;
  state.work = Math.min(100, state.work + action.work);
  state.suspicion = Math.min(100, state.suspicion + action.suspicion);
  state.snacks += action.snacks || 0;
  state.status = action.status;
  updateDisplay();
  addLog(action);

  if (state.minutes >= 480) finishDay();
}

function startNewDay() {
  state.minutes = 0;
  state.work = 0;
  state.suspicion = 0;
  state.snacks = 0;
  state.finished = false;
  state.status = "New badge, same questionable morals.";
  document.querySelector(".shift-tag").innerHTML = '<span class="status-dot"></span> SHIFT IN PROGRESS';
  elements.log.replaceChildren();
  elements.modal.hidden = true;
  const initialEntry = document.createElement("div");
  initialEntry.className = "log-entry";
  initialEntry.innerHTML = '<span class="log-time">09:00</span><span class="log-dot log-dot-start"></span><span class="log-text">Clocked in. They have no idea.</span>';
  elements.log.append(initialEntry);
  updateDisplay();
}

elements.buttons.forEach((button) => {
  button.addEventListener("click", () => takeAction(button.dataset.action));
});
elements.reset.addEventListener("click", startNewDay);
elements.restart.addEventListener("click", startNewDay);

updateDisplay();
