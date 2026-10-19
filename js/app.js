const $ = function (id) {
  return document.getElementById(id);
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CIRCLE = 326.7;
const KEYS = ["subjects", "sessions", "goal", "timetable", "tasks"];

const dateEl = $("date");
const clockEl = $("clock");
const percentEl = $("percent");
const arcEl = $("arc");
const startBtn = $("startBtn");
const stopBtn = $("stopBtn");
const subjectEl = $("subject");
const newSubjectEl = $("newSubject");
const addSubjectBtn = $("addSubjectBtn");
const goalEl = $("goal");
const totalEl = $("total");
const sessionListEl = $("sessionList");
const barsEl = $("bars");
const tabsEl = $("tabs");
const classStartEl = $("classStart");
const classEndEl = $("classEnd");
const classNameEl = $("className");
const addClassBtn = $("addClassBtn");
const classListEl = $("classList");
const tomorrowDateEl = $("tomorrowDate");
const taskInputEl = $("taskInput");
const addTaskBtn = $("addTaskBtn");
const taskListEl = $("taskList");

const store = {};

async function loadStore() {
  let server = {};
  try {
    const res = await fetch("/api/data");
    server = await res.json();
  } catch (error) {}

  KEYS.forEach(function (key) {
    if (server[key] !== undefined) {
      store[key] = server[key];
    } else {
      try {
        const local = JSON.parse(localStorage.getItem(key));
        if (local !== null) store[key] = local;
      } catch (error) {}
    }
  });
}

function read(key, fallback) {
  return store[key] === undefined ? fallback : store[key];
}

function write(key, value) {
  store[key] = value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {}
  fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(store)
  }).catch(function () {});
}

function esc(text) {
  return String(text).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function dateKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function formatTime(total) {
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h + ":" + m + ":" + s;
}

function formatHM(total) {
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return h + "h " + m + "m";
}

let seconds = 0;
let timerId = null;
let selectedDay = (new Date().getDay() + 6) % 7;

let subjects = [];
let sessions = [];
let goal = 120;
let timetable = [];
let tasks = [];

function todaySeconds() {
  const today = dateKey();
  return sessions
    .filter(function (s) {
      return s.date === today;
    })
    .reduce(function (sum, s) {
      return sum + s.seconds;
    }, 0);
}

function renderTimer() {
  clockEl.textContent = formatTime(seconds);
  const ratio = Math.min(1, (todaySeconds() + seconds) / (goal * 60));
  arcEl.style.strokeDashoffset = CIRCLE * (1 - ratio);
  percentEl.textContent = Math.round(ratio * 100) + "% of daily goal";
}

function renderSubjects() {
  const current = subjectEl.value;
  subjectEl.innerHTML = "";
  subjects.forEach(function (name) {
    const option = document.createElement("option");
    option.textContent = name;
    subjectEl.appendChild(option);
  });
  if (subjects.includes(current)) subjectEl.value = current;
}

function renderToday() {
  const today = dateKey();
  const list = sessions.filter(function (s) {
    return s.date === today;
  });
  totalEl.textContent = formatHM(todaySeconds());

  if (list.length === 0) {
    sessionListEl.innerHTML = '<li class="empty">No sessions yet. Pick a subject and press Start.</li>';
    return;
  }

  sessionListEl.innerHTML = list
    .map(function (s) {
      return (
        '<li class="item"><span class="grow">' + esc(s.subject) + "</span>" +
        '<span class="muted">' + formatHM(s.seconds) + "</span>" +
        '<button class="del" data-session="' + s.id + '" aria-label="Delete session">&times;</button></li>'
      );
    })
    .join("");
}

function renderWeek() {
  const days = [];
  let max = 1;

  for (let i = 6; i >= 0; i--) {
    const key = dateKey(-i);
    const d = new Date();
    d.setDate(d.getDate() - i);
    const total = sessions
      .filter(function (s) {
        return s.date === key;
      })
      .reduce(function (sum, s) {
        return sum + s.seconds;
      }, 0);
    if (total > max) max = total;
    days.push({ label: DAYS[(d.getDay() + 6) % 7], total: total, today: i === 0 });
  }

  barsEl.innerHTML = days
    .map(function (d) {
      const height = Math.max(3, Math.round((d.total / max) * 110));
      const label = d.total ? (d.total / 3600).toFixed(1) + "h" : "";
      return (
        '<div class="bar' + (d.today ? " today" : "") + '"><b>' + label + "</b>" +
        '<i style="height:' + height + 'px"></i>' +
        '<span class="muted">' + d.label + "</span></div>"
      );
    })
    .join("");
}

function renderTabs() {
  tabsEl.innerHTML = DAYS.map(function (name, i) {
    return '<button class="tab" data-day="' + i + '" aria-selected="' + (i === selectedDay) + '">' + name + "</button>";
  }).join("");
}

function renderTimetable() {
  const list = timetable
    .filter(function (c) {
      return c.day === selectedDay;
    })
    .sort(function (a, b) {
      return a.start < b.start ? -1 : 1;
    });

  if (list.length === 0) {
    classListEl.innerHTML = '<li class="empty">Nothing scheduled for ' + DAYS[selectedDay] + ".</li>";
    return;
  }

  classListEl.innerHTML = list
    .map(function (c) {
      const range = c.end ? c.start + " to " + c.end : c.start;
      return (
        '<li class="item"><span class="time">' + esc(range) + "</span>" +
        '<span class="grow">' + esc(c.name) + "</span>" +
        '<button class="del" data-class="' + c.id + '" aria-label="Delete class">&times;</button></li>'
      );
    })
    .join("");
}

function renderTasks() {
  const tomorrow = dateKey(1);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  tomorrowDateEl.textContent = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short"
  });

  const list = tasks.filter(function (t) {
    return t.date === tomorrow;
  });

  if (list.length === 0) {
    taskListEl.innerHTML = '<li class="empty">Plan tomorrow now so you can start fast.</li>';
    return;
  }

  taskListEl.innerHTML = list
    .map(function (t) {
      return (
        '<li class="item' + (t.done ? " done" : "") + '">' +
        '<input type="checkbox" data-check="' + t.id + '"' + (t.done ? " checked" : "") + ' aria-label="Done">' +
        '<span class="grow">' + esc(t.text) + "</span>" +
        '<button class="del" data-task="' + t.id + '" aria-label="Delete task">&times;</button></li>'
      );
    })
    .join("");
}

function addSubject() {
  const name = newSubjectEl.value.trim();
  if (name === "" || subjects.includes(name)) return;

  subjects.push(name);
  write("subjects", subjects);
  renderSubjects();
  subjectEl.value = name;
  newSubjectEl.value = "";
}

function addClass() {
  const start = classStartEl.value;
  const name = classNameEl.value.trim();
  if (start === "" || name === "") return;

  timetable.push({
    id: Date.now(),
    day: selectedDay,
    start: start,
    end: classEndEl.value,
    name: name
  });
  write("timetable", timetable);
  classNameEl.value = "";
  renderTimetable();
}

function addTask() {
  const text = taskInputEl.value.trim();
  if (text === "") return;

  tasks.push({ id: Date.now(), date: dateKey(1), text: text, done: false });
  write("tasks", tasks);
  taskInputEl.value = "";
  renderTasks();
}

startBtn.addEventListener("click", function () {
  if (timerId === null) {
    timerId = setInterval(function () {
      seconds++;
      renderTimer();
    }, 1000);
    startBtn.textContent = "Pause";
  } else {
    clearInterval(timerId);
    timerId = null;
    startBtn.textContent = "Resume";
  }
});

stopBtn.addEventListener("click", function () {
  clearInterval(timerId);
  timerId = null;

  if (seconds >= 10) {
    sessions.push({
      id: Date.now(),
      date: dateKey(),
      subject: subjectEl.value,
      seconds: seconds
    });
    write("sessions", sessions);
  }

  seconds = 0;
  startBtn.textContent = "Start";
  renderTimer();
  renderToday();
  renderWeek();
});

goalEl.addEventListener("change", function () {
  const value = parseInt(goalEl.value, 10);
  if (value > 0) {
    goal = value;
    write("goal", goal);
    renderTimer();
  } else {
    goalEl.value = goal;
  }
});

addSubjectBtn.addEventListener("click", addSubject);
addClassBtn.addEventListener("click", addClass);
addTaskBtn.addEventListener("click", addTask);

newSubjectEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter") addSubject();
});

classNameEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter") addClass();
});

taskInputEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter") addTask();
});

document.addEventListener("click", function (e) {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.day !== undefined) {
    selectedDay = Number(btn.dataset.day);
    renderTabs();
    renderTimetable();
  }

  if (btn.dataset.session) {
    sessions = sessions.filter(function (s) {
      return String(s.id) !== btn.dataset.session;
    });
    write("sessions", sessions);
    renderToday();
    renderWeek();
    renderTimer();
  }

  if (btn.dataset.class) {
    timetable = timetable.filter(function (c) {
      return String(c.id) !== btn.dataset.class;
    });
    write("timetable", timetable);
    renderTimetable();
  }

  if (btn.dataset.task) {
    tasks = tasks.filter(function (t) {
      return String(t.id) !== btn.dataset.task;
    });
    write("tasks", tasks);
    renderTasks();
  }
});

document.addEventListener("change", function (e) {
  const id = e.target.dataset.check;
  if (!id) return;

  tasks.forEach(function (t) {
    if (String(t.id) === id) t.done = e.target.checked;
  });
  write("tasks", tasks);
  renderTasks();
});

async function init() {
  await loadStore();

  subjects = read("subjects", ["Math", "Science", "Languages", "Reading"]);
  sessions = read("sessions", []);
  goal = read("goal", 120);
  timetable = read("timetable", []);
  tasks = read("tasks", []);

  sessions.forEach(function (s, i) {
    if (!s.id) s.id = Date.now() + i;
  });

  dateEl.textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  goalEl.value = goal;
  renderSubjects();
  renderTimer();
  renderToday();
  renderWeek();
  renderTabs();
  renderTimetable();
  renderTasks();
}

init();