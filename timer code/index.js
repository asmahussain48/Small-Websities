const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const resetBtn = document.getElementById("reset");
const timerDisplay = document.getElementById("timer");
const DEFAULT_TIME = 50 * 60; // 50 minutes

let totalTime = DEFAULT_TIME
let timerInterval;
let isRunning = false;

function updateDisplay() {
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;
  timerDisplay.textContent =
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
   console.log("Timer started with:", totalTime, "seconds"); // ← Debug line
  timerInterval = setInterval(() => {
    if (totalTime > 0) {
      totalTime--;
      updateDisplay();
    } else {
      clearInterval(timerInterval);
      isRunning = false;
      alert("Time's up!");
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  isRunning = false;
}

function resetTimer() {
  clearInterval(timerInterval);
  totalTime = 50 * 60;
  updateDisplay();
  isRunning = false;
}

startBtn.addEventListener("click", startTimer);
stopBtn.addEventListener("click", stopTimer);
resetBtn.addEventListener("click", resetTimer);

// Initialize display
updateDisplay();
