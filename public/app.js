const API_TMDB = "/api/tmdb";

const xrayPanel = document.getElementById("xrayPanel");
const xrayCast = document.getElementById("xrayCast");
const loaderMessage = document.getElementById("loaderMessage");
const gridTitle = document.getElementById("gridTitle");
const mediaGrid = document.getElementById("mediaGrid");
const seasonSelector = document.getElementById("seasonSelector");
const seasonSelect = document.getElementById("seasonSelect");
const episodeSelect = document.getElementById("episodeSelect");

let currentMediaId = null;
let currentMediaType = null;

document.addEventListener("DOMContentLoaded", () => {
    loadTrending();
    
    document.getElementById("searchBtn").addEventListener("click", handleSearch);
    document.getElementById("searchInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSearch();
    });
    
    document.querySelector(".logo").addEventListener("click", () => {
        document.getElementById("searchInput").value = "";
        gridTitle.innerText = "Tendances de la semaine (VF / VOSTFR)";
        loadTrending();
    });
    
    document.getElementById("closeModal").addEventListener("click", cleanPlayer);

    seasonSelect.addEventListener("change", (e) => {
        loadEpisodes(currentMediaId, e.target.value);
    });

    episodeSelect.addEventListener("change", (e) => {
        updatePlayerEmbed(currentMediaId, currentMediaType, seasonSelect.value, e.target.value);
    });
});

async function loadTrending() {
    try {
        const res = await fetch(`${API_TMDB}?endpoint=/trending/all/week`);
        const data = await res.json();
        renderGrid(data.results || [], mediaGrid);
    } catch (err) {
        mediaGrid.innerHTML = "<p>Erreur de chargement des données TMDB.</p>";
    }
}

async function handleSearch() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) return;
    
    try {
        const res = await fetch(`${API_TMDB}?endpoint=/search/multi&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        gridTitle.innerText = `Résultats pour "${query}"`;
        renderGrid(data.results || [], mediaGrid);
    } catch (err) {
        console.error("Erreur de recherche:", err);
    }
}

function renderGrid(items, container) {
    container.innerHTML = "";
    items.forEach(item => {
        if (!item.poster_path) return;
        const title = item.title || item.name;
        const type = item.media_type || (item.first_air_date ? "tv" : "movie");
        
        const card = document.createElement("div");
        card.className = "media-card";
        card.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${title}">
            <h4>${title}</h4>
        `;
        
        card.addEventListener("click", () => openMedia(item.id, type, title));
        container.appendChild(card);
    });
}

async function openMedia(id, type, title) {
    currentMediaId = id;
    currentMediaType = type;
    
    const modal = document.getElementById("playerModal");
    document.getElementById("playerTitle").innerText = title;
    modal.classList.add("active");
    
    loaderMessage.style.display = "block";
    loaderMessage.innerText = "Chargement du lecteur français...";
    xrayCast.innerHTML = "";
    
    // 1. Récupération du casting (X-Ray)
    try {
        const castRes = await fetch(`${API_TMDB}?endpoint=/${type}/${id}/credits`);
        const castData = await castRes.json();
        renderXRay(castData.cast || []);
    } catch (err) {
        console.error("Erreur casting:", err);
    }

    // 2. Gestion des saisons si c'est une série TV
    if (type === 'tv') {
        seasonSelector.style.display = "flex";
        try {
            const detailsRes = await fetch(`${API_TMDB}?endpoint=/tv/${id}`);
            const details = await detailsRes.json();
            populateSeasons(details.seasons || []);
        } catch (err) {
            console.error("Erreur détails série:", err);
        }
    } else {
        seasonSelector.style.display = "none";
        updatePlayerEmbed(id, type, 1, 1);
    }
}

async function populateSeasons(seasons) {
    seasonSelect.innerHTML = "";
    seasons.forEach(season => {
        if (season.season_number === 0) return; // Ignore les hors-séries/specials
        const opt = document.createElement("option");
        opt.value = season.season_number;
        opt.innerText = `Saison ${season.season_number}`;
        seasonSelect.appendChild(opt);
    });
    if (seasons.length > 0) {
        loadEpisodes(currentMediaId, seasonSelect.value || 1);
    }
}

async function loadEpisodes(id, seasonNum) {
    try {
        const res = await fetch(`${API_TMDB}?endpoint=/tv/${id}/season/${seasonNum}`);
        const data = await res.json();
        episodeSelect.innerHTML = "";
        (data.episodes || []).forEach(ep => {
            const opt = document.createElement("option");
            opt.value = ep.episode_number;
            opt.innerText = `Épisode ${ep.episode_number} : ${ep.name}`;
            episodeSelect.appendChild(opt);
        });
        if (data.episodes && data.episodes.length > 0) {
            updatePlayerEmbed(id, 'tv', seasonNum, data.episodes[0].episode_number);
        }
    } catch (err) {
        console.error("Erreur épisodes:", err);
    }
}

function updatePlayerEmbed(id, type, season, episode) {
    const existingIframe = document.getElementById("secureIframe");
    if (existingIframe) existingIframe.remove();

    // Mécanisme auto-embed par ID TMDB privilégiant les sources francophones (Multiembed / VidLink configurés en VF)
    let embedUrl = `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`;
    if (type === 'tv') {
        embedUrl += `&s=${season}&e=${episode}`;
    }

    const iframe = document.createElement("iframe");
    iframe.id = "secureIframe";
    iframe.src = embedUrl;
    iframe.style.width = "100%";
    iframe.style.height = "500px";
    iframe.style.border = "none";
    iframe.style.borderRadius = "8px";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");

    xrayPanel.parentNode.insertBefore(iframe, xrayPanel);
    loaderMessage.style.display = "none";
}

function renderXRay(cast) {
    xrayCast.innerHTML = "";
    cast.slice(0, 15).forEach(actor => {
        if (!actor.profile_path) return;
        const div = document.createElement("div");
        div.className = "cast-member";
        div.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w185${actor.profile_path}" alt="${actor.name}">
            <p><strong>${actor.name}</strong></p>
            <p style="color: #888;">${actor.character}</p>
        `;
        xrayCast.appendChild(div);
    });
}

function cleanPlayer() {
    document.getElementById("playerModal").classList.remove("active");
    const existingIframe = document.getElementById("secureIframe");
    if (existingIframe) existingIframe.remove();
    seasonSelector.style.display = "none";
}
