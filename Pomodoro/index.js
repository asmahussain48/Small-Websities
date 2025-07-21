// Pomodoro Timer Logic
const startEl = document.getElementById("start");
const stopEl = document.getElementById("stop");
const resetEl = document.getElementById("reset");
const timerEl = document.getElementById("timer");

let interval;
let timeLeft = 3000;
let isTimerRunning = false;

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerEl.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function startTimer() {
  clearInterval(interval);
  isTimerRunning = true;
  interval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTimer();
    } else {
      clearInterval(interval);
      isTimerRunning = false;
      alert("Time's up!");
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(interval);
  isTimerRunning = false;
}

function resetTimer() {
  clearInterval(interval);
  timeLeft = 3000;
  updateTimer();
  isTimerRunning = false;
}

startEl.addEventListener("click", startTimer);
stopEl.addEventListener("click", stopTimer);
resetEl.addEventListener("click", resetTimer);

updateTimer(); // Initialize the timer

// Ambient Sound Logic (MIXING enabled)
const soundFiles = {
  original: "sounds/original.mp3",
  lofi: "sounds/lofi.mp3",
  nature: "sounds/nature.mp3",
  rain: "sounds/rain.mp3",
  fireplace: "sounds/fireplace.mp3",
  library: "sounds/library.mp3",
};

const audioElements = {};
let unlocked = false;

// Create and preload audio
Object.entries(soundFiles).forEach(([key, src]) => {
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0;
  audioElements[key] = audio;
});
const sliders = document.querySelectorAll('input[type="range"]');

sliders.forEach(slider => {
  slider.addEventListener("input", function () {
    const value = (this.value - this.min) / (this.max - this.min) * 100;
    this.style.background = `linear-gradient(to right, #4facfe 0%, #00f2fe ${value}%, #ccc ${value}%)`;
  });
});

// Unlock all audio on first click
document.addEventListener("click", () => {
  if (!unlocked) {
    Object.values(audioElements).forEach(audio => {
      audio.play().catch(() => {});
    });
    unlocked = true;
  }
});

// Volume slider logic for mixing
document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.min = 0;
  slider.max = 1;
  slider.step = 0.01;
  slider.value = 0;

  slider.addEventListener("input", (e) => {
    const soundKey = e.target.getAttribute("data-sound");
    const volume = parseFloat(e.target.value);
    const audio = audioElements[soundKey];

    if (audio) {
      audio.volume = volume;
      if (volume > 0 && audio.paused) {
        audio.play().catch(() => {});
      } else if (volume === 0) {
        audio.pause(); // or keep looping if preferred
      }
    }
  });
});

// fullscreen.js

const fullscreenBtn = document.getElementById("fullscreen");
const fullscreenWrapper = document.getElementById("fullscreen-wrapper");
const mainLayout = document.querySelector(".main-layout");
const soundPanel = document.querySelector(".sound-panel");

fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    fullscreenWrapper.requestFullscreen().then(() => {
      soundPanel.style.display = "none";
      mainLayout.style.justifyContent = "center";
      fullscreenWrapper.classList.add("fullscreen-mode");
      fullscreenBtn.textContent = "Exit Fullscreen";
    });
  } else {
    document.exitFullscreen().then(() => {
      soundPanel.style.display = "";
      mainLayout.style.justifyContent = "center";
      fullscreenWrapper.classList.remove("fullscreen-mode");
      fullscreenBtn.textContent = "Fullscreen";
    });
  }
});

