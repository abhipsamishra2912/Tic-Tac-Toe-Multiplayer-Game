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

loadLeaderboard();