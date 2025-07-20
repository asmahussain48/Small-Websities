const startEl = document.getElementById("start");
const stopEl = document.getElementById("stop");
const resetEl = document.getElementById("reset");
const timerEl = document.getElementById("timer");
const soundSelector = document.getElementById("soundSelector");
const ambientSound = document.getElementById("ambientSound");
const soundButtons = document.querySelectorAll(".sound-btn");
const ambientSound = document.getElementById("ambientSound");
let selectedSound = "";
let isTimerRunning = false;

function playAmbientSound() {
  if (selectedSound && isTimerRunning) {
    ambientSound.src = `${selectedSound}.mp3`;
    ambientSound.play().catch(() => {});
  }
}

function stopAmbientSound() {
  ambientSound.pause();
  ambientSound.currentTime = 0;
}

// Handle button clicks
soundButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectedSound = button.dataset.sound;
    playAmbientSound();
  });
});

const alarmSound = new Audio("alarm.mp3");

let interval;
let timeLeft = 3000;

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  timerEl.textContent = formattedTime;
}

function startTimer() {
  clearInterval(interval);
  isTimerRunning = true;
  playAmbientSound();

  interval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTimer();
    } else {
      clearInterval(interval);
      isTimerRunning = false;
      stopAmbientSound();
      alarmSound.play();
      alert("Time's up!");
      timeLeft = 3000;
      updateTimer();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(interval);
  isTimerRunning = false;
  stopAmbientSound();
}

function resetTimer() {
  clearInterval(interval);
  timeLeft = 3000;
  updateTimer();
  isTimerRunning = false;
  stopAmbientSound();
}


function stopTimer() {
  clearInterval(interval);
  ambientSound.pause();
}

function resetTimer() {
  clearInterval(interval);
  timeLeft = 3000;
  updateTimer();
  ambientSound.pause();
}

function playAmbientSound(type) {
  ambientSound.pause();
  if (!type) return;

  ambientSound.src = `${type}.mp3`;
  ambientSound.play().catch(() => {
    console.log("Playback failed. User interaction may be required.");
  });
}

soundSelector.addEventListener("change", (e) => {
  playAmbientSound(e.target.value);
});

updateTimer();

startEl.addEventListener("click", startTimer);
stopEl.addEventListener("click", stopTimer);
resetEl.addEventListener("click", resetTimer);
