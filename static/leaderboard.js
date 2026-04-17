async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboard-body");

    try {
        const res  = await fetch("/leaderboard");
        const data = await res.json();

        if (!data.length) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="3">// NO DATA FOUND</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        data.forEach((player, i) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="rank-cell">${String(i + 1).padStart(2, "0")}</td>
                <td>${player.name || player.uid}</td>
                <td>${player.elo_rating}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="3">// FAILED TO LOAD DATA</td></tr>`;
    }
}

loadLeaderboard();