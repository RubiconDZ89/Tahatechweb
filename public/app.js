const API_TMDB = "/api/tmdb";
const API_SCRAPER = "https://tahatechscraper.onrender.com";

const videoPlayer = document.getElementById("mainVideo");
const xrayPanel = document.getElementById("xrayPanel");
const xrayCast = document.getElementById("xrayCast");
const loaderMessage = document.getElementById("loaderMessage");
const gridTitle = document.getElementById("gridTitle");
const mediaGrid = document.getElementById("mediaGrid");

let currentMedia = null;
let hlsInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  loadTrending();
  loadContinueWatching();

  document.getElementById("searchBtn").addEventListener("click", handleSearch);
  document.getElementById("searchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  document.querySelector(".logo").addEventListener("click", () => {
    document.getElementById("searchInput").value = "";
    gridTitle.innerText = "Tendances de la semaine";
    loadTrending();
  });

  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("playerModal").classList.remove("active");
    saveProgress();
    cleanPlayer();
  });
});

async function loadTrending() {
  try {
    const res = await fetch(`${API_TMDB}?endpoint=/trending/all/week`);
    const data = await res.json();
    renderGrid(data.results || [], mediaGrid);
  } catch (err) {
    mediaGrid.innerHTML = "<p>Erreur de chargement TMDB.</p>";
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
    card.addEventListener("click", () => openPlayer(item.id, type, title, item.poster_path, 0));
    container.appendChild(card);
  });
}

// Continuer à regarder
videoPlayer.addEventListener("timeupdate", () => {
  if (videoPlayer.currentTime > 10 && currentMedia && videoPlayer.duration > 0) {
    const history = JSON.parse(localStorage.getItem("tahaWatchHistory") || "{}");
    history[currentMedia.id] = {
      id: currentMedia.id,
      title: currentMedia.title,
      poster: currentMedia.poster,
      type: currentMedia.type,
      time: videoPlayer.currentTime,
      duration: videoPlayer.duration,
      lastWatched: Date.now()
    };
    localStorage.setItem("tahaWatchHistory", JSON.stringify(history));
  }
});

function saveProgress() {
  videoPlayer.pause();
  loadContinueWatching();
}

function loadContinueWatching() {
  const history = JSON.parse(localStorage.getItem("tahaWatchHistory") || "{}");
  const historyArr = Object.values(history).sort((a, b) => b.lastWatched - a.lastWatched);
  
  const continueSection = document.getElementById("continueWatchingSection");
  const continueGrid = document.getElementById("continueGrid");
  
  if (historyArr.length > 0) {
    continueSection.style.display = "block";
    continueGrid.innerHTML = "";
    
    historyArr.slice(0, 6).forEach(item => {
      const progress = (item.time / item.duration) * 100;
      const card = document.createElement("div");
      card.className = "media-card";
      card.innerHTML = `
        <img src="https://image.tmdb.org/t/p/w300${item.poster}" alt="${item.title}">
        <div class="progress-bar"><div class="progress-filled" style="width: ${progress}%"></div></div>
        <h4>${item.title}</h4>
      `;
      card.addEventListener("click", () => openPlayer(item.id, item.type, item.title, item.poster, item.time));
      continueGrid.appendChild(card);
    });
  } else {
    continueSection.style.display = "none";
  }
}

// X-Ray
videoPlayer.addEventListener("pause", () => {
  if (!videoPlayer.seeking) xrayPanel.classList.add("active");
});
videoPlayer.addEventListener("play", () => xrayPanel.classList.remove("active"));

async function fetchXRay(id, type) {
  try {
    const res = await fetch(`${API_TMDB}?endpoint=/${type}/${id}/credits`);
    const data = await res.json();
    const cast = (data.cast || []).slice(0, 5);
    
    xrayCast.innerHTML = cast.map(actor => `
      <div class="actor-card">
        <img src="${actor.profile_path ? 'https://image.tmdb.org/t/p/w185'+actor.profile_path : 'https://via.placeholder.com/44x44?text=👤'}">
        <div class="actor-info">
          <h4>${actor.name}</h4>
          <p>${actor.character}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    xrayCast.innerHTML = "<p>Casting non disponible</p>";
  }
}

// Initialisation et Scraping
async function openPlayer(id, type, title, poster, resumeTime) {
  currentMedia = { id, type, title, poster };
  document.getElementById("playerModal").classList.add("active");
  loaderMessage.innerText = "Recherche du flux vidéo (cela peut prendre 30s si le serveur est en veille)...";
  
  fetchXRay(id, type);

  try {
    const res = await fetch(`${API_SCRAPER}?id=${id}`);
    const data = await res.json();
    
    if (data.source) {
      loaderMessage.innerText = "";
      playStream(data.source, resumeTime);
    } else {
      loaderMessage.innerText = "Erreur: Aucun flux compatible trouvé.";
    }
  } catch (err) {
    loaderMessage.innerText = "Erreur de connexion au serveur d'extraction.";
  }
}

function playStream(url, resumeTime) {
  if (url.includes('.m3u8')) {
    if (Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(videoPlayer);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        videoPlayer.currentTime = resumeTime;
        videoPlayer.play();
      });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      videoPlayer.src = url;
      videoPlayer.currentTime = resumeTime;
      videoPlayer.play();
    }
  } else {
    videoPlayer.src = url;
    videoPlayer.currentTime = resumeTime;
    videoPlayer.play();
  }
}

function cleanPlayer() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  videoPlayer.src = "";
  xrayPanel.classList.remove("active");
}
