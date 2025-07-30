document.getElementById("recForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const message = document.getElementById("message").value.trim();

  if (message) {
    const div = document.createElement("div");
    div.className = "rec";
    div.textContent = name ? `“ ${message} ” — ${name}` : `“ ${message} ”`;
    document.getElementById("rec-list").appendChild(div);
    alert("Thank you for submitting a recommendation!");
    this.reset();
  }
});

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
