// Sticky Navigation Menu
let nav = document.querySelector("nav");
let scrollBtn = document.querySelector(".scroll-button a");
// Show/hide sticky navigation and scroll button based on scroll position
window.onscroll = function () {
  if (document.documentElement.scrollTop > 20) {
    nav.classList.add("sticky");
    scrollBtn.style.display = "block";
  } else {
    nav.classList.remove("sticky");
    scrollBtn.style.display = "none";
  }
};
// Side Navigation Menu
let body = document.querySelector("body");
let navBar = document.querySelector(".navbar");
let menuBtn = document.querySelector(".menu-btn");
let cancelBtn = document.querySelector(".cancel-btn");

menuBtn.onclick = () => {
  navBar.classList.add("active"); // Show the navbar
  menuBtn.style.display = "none"; // Hide menu icon
  cancelBtn.style.display = "block"; // Show cancel icon
  body.classList.add("disabledScroll"); // Optional: prevent background scroll
};

cancelBtn.onclick = () => {
  navBar.classList.remove("active"); // Hide the navbar
  menuBtn.style.display = "block"; // Show menu icon
  cancelBtn.style.display = "none"; // Hide cancel icon
  body.classList.remove("disabledScroll");
};
