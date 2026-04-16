const toggleBtn = document.getElementById("theme-toggle");

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    toggleBtn.textContent = "🌙";
}

toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if(document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
        toggleBtn.textContent = "🌙";
    }
    else {
        localStorage.setItem("theme", "light");
        toggleBtn.textContent = "☀️";
    }
});
