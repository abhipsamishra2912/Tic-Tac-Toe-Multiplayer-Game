async function loadLeaderboard() {
    try {
        const res = await fetch ("/leaderboard");
        const data = await res.json();

        const players = data;

        const tbody = document.getElementById("leaderboard-body");
        tbody.innerHTML = "";

        players.forEach((player, index) => {
            const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${player.name}</td>
                <td>${player.elo_rating}</td>
            </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch(error) {
        console.error("Error loading leaderboard:", error);
    }
}

const toggleBtn = document.getElementById("theme-toggle");

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    toggleBtn.textContent = "☀️";
}

toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
        toggleBtn.textContent = "☀️";
    }
    else {
        localStorage.setItem("theme", "light");
        toggleBtn.textContent = "🌙";
    }
});

loadLeaderboard();