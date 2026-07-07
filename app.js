// Center point + radius (meters) for each Nairobi area you visit
const BUILT_IN_ZONES = [
  { name: "Upper Hill",      lat: -1.2966, lng: 36.8172, radius: 800 },
  { name: "Westlands",       lat: -1.2647, lng: 36.8055, radius: 800 },
  { name: "Industrial Area", lat: -1.3167, lng: 36.8500, radius: 900 },
  { name: "CBD",             lat: -1.2833, lng: 36.8167, radius: 700 },
  { name: "Langata",         lat: -1.3667, lng: 36.7500, radius: 1000 },
];

let customZones = JSON.parse(localStorage.getItem("customZones") || "[]");

function saveCustomZones() {
  localStorage.setItem("customZones", JSON.stringify(customZones));
}

function allZones() {
  return BUILT_IN_ZONES.concat(customZones);
}

const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const taskZoneSelect = document.getElementById("taskZone");
const zoneForm = document.getElementById("zoneForm");
const zoneNameInput = document.getElementById("zoneName");
const zoneRadiusInput = document.getElementById("zoneRadius");
const captureLocationBtn = document.getElementById("captureLocationBtn");
const capturedCoordsEl = document.getElementById("capturedCoords");
const saveZoneBtn = document.getElementById("saveZoneBtn");
const zoneList = document.getElementById("zoneList");

let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
// tracks which zone we were "inside" last update, so we only notify once per entry
let currentZoneName = null;
let capturedCoords = null;

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function renderZoneOptions() {
  const previousValue = taskZoneSelect.value;
  taskZoneSelect.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());
  allZones().forEach(z => {
    const option = document.createElement("option");
    option.value = z.name;
    option.textContent = z.name;
    taskZoneSelect.appendChild(option);
  });
  if (allZones().some(z => z.name === previousValue)) {
    taskZoneSelect.value = previousValue;
  }
}

function renderZoneList() {
  zoneList.innerHTML = "";
  if (customZones.length === 0) {
    zoneList.innerHTML = '<li class="empty">No custom locations yet</li>';
    return;
  }
  customZones.forEach(zone => {
    const li = document.createElement("li");

    const name = document.createElement("span");
    name.className = "task-text";
    name.textContent = `${zone.name} (${zone.radius}m radius)`;

    const del = document.createElement("button");
    del.className = "deleteBtn";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      customZones = customZones.filter(z => z.name !== zone.name);
      saveCustomZones();
      renderZoneList();
      renderZoneOptions();
    });

    li.append(name, del);
    zoneList.appendChild(li);
  });
}

captureLocationBtn.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    capturedCoordsEl.textContent = "Geolocation not supported on this device";
    return;
  }
  capturedCoordsEl.textContent = "Capturing your location...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturedCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      capturedCoordsEl.textContent =
        `Captured: ${capturedCoords.lat.toFixed(5)}, ${capturedCoords.lng.toFixed(5)}`;
      saveZoneBtn.disabled = false;
    },
    (err) => {
      capturedCoordsEl.textContent = "Could not get location: " + err.message;
    },
    { enableHighAccuracy: true }
  );
});

zoneForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = zoneNameInput.value.trim();
  if (!name || !capturedCoords) return;
  const radius = parseInt(zoneRadiusInput.value, 10) || 500;

  customZones.push({ name, lat: capturedCoords.lat, lng: capturedCoords.lng, radius });
  saveCustomZones();
  renderZoneList();
  renderZoneOptions();

  zoneForm.reset();
  capturedCoords = null;
  capturedCoordsEl.textContent = "No location captured yet";
  saveZoneBtn.disabled = true;
});

function renderTasks() {
  taskList.innerHTML = "";
  if (tasks.length === 0) {
    taskList.innerHTML = '<li class="empty">No tasks yet</li>';
    return;
  }
  tasks.forEach(task => {
    const li = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    const text = document.createElement("span");
    text.className = "task-text" + (task.done ? " done" : "");
    text.textContent = task.text;

    const zone = document.createElement("span");
    zone.className = "task-zone";
    zone.textContent = task.zone;

    const del = document.createElement("button");
    del.className = "deleteBtn";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();
      renderTasks();
    });

    li.append(checkbox, text, zone, del);
    taskList.appendChild(li);
  });
}

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = document.getElementById("taskText").value.trim();
  const zone = document.getElementById("taskZone").value;
  if (!text || !zone) return;

  const newTask = { id: Date.now(), text, zone, done: false };
  tasks.push(newTask);
  saveTasks();
  renderTasks();
  taskForm.reset();

  // if you're already standing in this zone, remind right away instead of
  // waiting for a zone-entry event that already happened before this task existed
  if (zone === currentZoneName) {
    notify(zone, [newTask]);
  }
});

// Distance in meters between two lat/lng points (Haversine formula)
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findZoneForPosition(lat, lng) {
  return allZones().find(z => distanceMeters(lat, lng, z.lat, z.lng) <= z.radius) || null;
}

let audioCtx = null;

// resume the audio context on any tap, since browsers block sound until a user gesture happens
document.addEventListener("click", () => {
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
});

function playSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.15);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.16);
    });
  } catch (e) {
    // ignore if audio isn't available on this device
  }
}

function notify(zoneName, pendingTasks) {
  const body = pendingTasks.map(t => "• " + t.text).join("\n");
  playSound();
  if (Notification.permission === "granted") {
    new Notification(`You're in ${zoneName}`, { body });
  } else {
    // fallback so you still see something even without notification permission
    alert(`You're in ${zoneName}\n${body}`);
  }
}

function handlePosition(position) {
  const { latitude, longitude } = position.coords;
  const zone = findZoneForPosition(latitude, longitude);
  const zoneName = zone ? zone.name : null;

  statusEl.textContent = zoneName
    ? `Location: in ${zoneName}`
    : "Location: not near any saved area";

  // only fire when we just entered a new zone (not on every GPS update)
  if (zoneName && zoneName !== currentZoneName) {
    const pending = tasks.filter(t => t.zone === zoneName && !t.done);
    if (pending.length > 0) notify(zoneName, pending);
  }
  currentZoneName = zoneName;
}

function handleError(err) {
  statusEl.textContent = "Location error: " + err.message;
  if (err.code === err.PERMISSION_DENIED) {
    // don't keep silently retrying on future loads once permission is revoked
    localStorage.removeItem("trackingEnabled");
    startBtn.disabled = false;
    startBtn.textContent = "Start tracking my location";
  }
}

function startTracking() {
  if (!("geolocation" in navigator)) {
    statusEl.textContent = "Geolocation not supported on this device";
    return;
  }
  navigator.geolocation.watchPosition(handlePosition, handleError, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 20000,
  });
  localStorage.setItem("trackingEnabled", "true");
  statusEl.textContent = "Location: tracking started...";
  startBtn.textContent = "Tracking active";
  startBtn.disabled = true;
}

startBtn.addEventListener("click", async () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  startTracking();
});

// resume tracking automatically on reload if it was already on and permission is still granted
if (localStorage.getItem("trackingEnabled") === "true") {
  if ("permissions" in navigator) {
    navigator.permissions.query({ name: "geolocation" }).then(result => {
      if (result.state === "granted") startTracking();
    }).catch(() => startTracking());
  } else {
    startTracking();
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

renderTasks();
renderZoneOptions();
renderZoneList();
