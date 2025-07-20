const startEl = document.getElementById("start");
const stopEl = document.getElementById("stop");
const resetEl = document.getElementById("reset");
const timerEl = document.getElementById("timer");
const ambientSound = document.getElementById("ambientSound");
ambientSound.loop = true;
const bgVideo = document.getElementById("bgVideo");

const soundButtons = document.querySelectorAll(".sound-btn");

const alarmSound = new Audio("alarm.mp3");

let interval;
let timeLeft = 3000;
let selectedSound = "";
let isTimerRunning = false;

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerEl.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

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

// function changeBackground(sound) {
//   let backgroundUrl = "";
//   switch (sound) {
//     case "rain":
//       backgroundUrl = "url('rain.jpg')";
//       break;
//     case "birds":
//       backgroundUrl = "url('birds.jpg')";
//       break;
//     case "classical":
//       backgroundUrl = "url('classical.jpg')";
//       break;
//     default:
//       backgroundUrl = "";
//   }
//   document.body.style.backgroundImage = backgroundUrl;
// }
function changeBackground(sound) {
  switch (sound) {
    case "rain":
      bgVideo.src = "rain.mp4";
      break;
    case "birds":
      bgVideo.src = "birds.mp4";
      break;
    case "classical":
      bgVideo.src = "classical.mp4";
      break;
    default:
      bgVideo.removeAttribute("src");
  }
}

soundButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectedSound = button.dataset.sound;
    changeBackground(selectedSound);
    playAmbientSound();
  });
});

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

updateTimer();

startEl.addEventListener("click", startTimer);
stopEl.addEventListener("click", stopTimer);
resetEl.addEventListener("click", resetTimer);
