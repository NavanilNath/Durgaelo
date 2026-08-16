const YOUTUBE_PLAYLIST_ID = "PLZ43g6qkgiq8";
const $ = id => document.getElementById(id);

let oldYT = null, oldYTReady = false, oldYTLoaded = false, oldVideoIds = [], oldListLoaded = false;
let currentOld = -1;
let ytMetadata = [];
let ytProgressInterval;
let isDraggingBar = false;

function onYouTubeIframeAPIReady() {
  oldYTReady = true;
  initOldSongs();
}

function initOldSongs() {
  if (oldYTLoaded || !oldYTReady) return;
  if (!/^https?:$/.test(window.location.protocol)) {
    $("oldSearch").placeholder = "Start the local server (npm start) to play songs.";
    return;
  }

  oldYTLoaded = true;
  oldYT = new YT.Player("oldYoutubePlayer", {
    width: "0",
    height: "0",
    videoId: "",
    playerVars: { autoplay: 0, playsinline: 1, rel: 0, widget_referrer: window.location.href },
    events: {
      onReady: () => {
        $("oldSearch").placeholder = "Loading Pujo songs…";
        oldYT.cuePlaylist({ listType: "playlist", list: YOUTUBE_PLAYLIST_ID, index: 0 });
      },
      onStateChange: event => {
        if (event.data === YT.PlayerState.CUED && !oldListLoaded) {
          oldListLoaded = true;
          loadOldSongList();
          $("oldSearch").placeholder = "Search Pujo songs…";
          $("oldSearch").disabled = false;
        }

        const playlistIndex = oldYT.getPlaylistIndex?.();
        if (Number.isInteger(playlistIndex) && playlistIndex >= 0) {
          currentOld = playlistIndex;
          updateYouTubeTrackUI();
        }

        const isPlaying = event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING;
        $("play").textContent = isPlaying ? "Ⅱ" : "▶";
        document.querySelectorAll("#oldList .oldSong button").forEach((button, index) => {
          button.textContent = index === currentOld && isPlaying ? "Ⅱ" : "▶";
        });

        clearInterval(ytProgressInterval);
        if (isPlaying) {
          ytProgressInterval = setInterval(() => {
            if (isDraggingBar || !oldYT.getCurrentTime) return;
            const duration = oldYT.getDuration();
            if (duration > 0) $("fill").style.width = ((oldYT.getCurrentTime() / duration) * 100) + "%";
          }, 500);
        }
      },
      onError: event => {
        $("oldSearch").placeholder = "YouTube player error: " + event.data;
        console.error("YouTube error", event.data);
      }
    }
  });
}

async function loadOldSongList() {
  oldVideoIds = oldYT.getPlaylist() || [];
  if (!oldVideoIds.length) {
    $("oldSearch").placeholder = "No playable videos found in this playlist.";
    return;
  }

  $("oldList").innerHTML = oldVideoIds.map((id, index) => `
    <div class="oldSong" id="oldSong-${index}">
      <div class="oldNum">${String(index + 1).padStart(2, "0")}</div>
      <div><div class="oldTitle">Loading video details…</div><div class="oldSub">Loading artist…</div></div>
      <button aria-label="Play YouTube song ${index + 1}">▶</button>
    </div>`).join("");

  document.querySelectorAll(".oldSong").forEach((element, index) => {
    element.addEventListener("click", () => playOldSong(index));
  });

  for (let index = 0; index < oldVideoIds.length; index++) {
    const songElement = $("oldSong-" + index);
    let titleText = `YouTube Song ${index + 1}`;
    let artistText = "Artist unavailable";

    try {
      const response = await fetch("/api/video-metadata?id=" + encodeURIComponent(oldVideoIds[index]));
      if (!response.ok) throw new Error("Metadata request failed");
      const metadata = await response.json();
      titleText = metadata.title || titleText;
      artistText = metadata.author_name || artistText;
    } catch (error) {
      console.warn("Unable to load YouTube metadata", error);
    }

    ytMetadata[index] = { title: titleText, artist: artistText };
    const title = document.querySelector(`#oldSong-${index} .oldTitle`);
    const artist = document.querySelector(`#oldSong-${index} .oldSub`);
    if (title) title.textContent = titleText;
    if (artist) artist.textContent = artistText;
    if (songElement) songElement.dataset.search = (titleText + " " + artistText).toLowerCase();
    if (currentOld === index) updateYouTubeTrackUI();
  }
}

function updateYouTubeTrackUI() {
  const metadata = ytMetadata[currentOld];
  if (metadata) {
    $("title").textContent = metadata.title;
    $("artist").textContent = metadata.artist;
    $("cover").innerHTML = metadata.title.split(" ").slice(0, 2).join("<br>");
  }
  document.querySelectorAll(".oldSong").forEach(song => song.classList.remove("active"));
  const activeSong = $("oldSong-" + currentOld);
  if (activeSong) activeSong.classList.add("active");
}

function playOldSong(index) {
  const state = oldYT.getPlayerState();
  if (currentOld === index && (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING)) {
    oldYT.pauseVideo();
  } else if (currentOld === index) {
    oldYT.playVideo();
  } else {
    currentOld = index;
    oldYT.playVideoAt(index);
  }
  updateYouTubeTrackUI();
}

function filterOldSongs() {
  const query = $("oldSearch").value.toLowerCase();
  document.querySelectorAll(".oldSong").forEach(song => {
    song.style.display = (song.dataset.search || "").includes(query) ? "grid" : "none";
  });
}
$("oldSearch").addEventListener("input", filterOldSongs);

function toggleYT() {
  if (!oldYT) return;
  const state = oldYT.getPlayerState();
  if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) oldYT.pauseVideo();
  else oldYT.playVideo();
}

function nextYT() {
  if (oldYT) oldYT.nextVideo();
}

function prevYT() {
  if (oldYT) oldYT.previousVideo();
}

$("play").onclick = toggleYT;
document.querySelectorAll(".ctrl")[0].onclick = prevYT;
document.querySelectorAll(".ctrl")[1].onclick = nextYT;

function calculateSeek(event) {
  const bounds = $("bar").getBoundingClientRect();
  return Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
}

function applySeek(percent) {
  if (oldYT && oldYT.getDuration) {
    const duration = oldYT.getDuration();
    if (duration > 0) oldYT.seekTo(duration * percent, true);
  }
  $("fill").style.width = (percent * 100) + "%";
}

$("bar").addEventListener("pointerdown", event => {
  event.preventDefault();
  isDraggingBar = true;
  $("bar").setPointerCapture(event.pointerId);
  applySeek(calculateSeek(event));
});
$("bar").addEventListener("pointermove", event => {
  if (isDraggingBar) applySeek(calculateSeek(event));
});
$("bar").addEventListener("pointerup", event => {
  isDraggingBar = false;
  $("bar").releasePointerCapture(event.pointerId);
});
$("bar").addEventListener("pointercancel", event => {
  isDraggingBar = false;
  $("bar").releasePointerCapture(event.pointerId);
});

const dhakAudio = new Audio("audio/dhak-sound.mp3");
$("dhakButton").addEventListener("click", () => {
  if (dhakAudio.paused) dhakAudio.play().then(() => $("dhakButton").classList.add("playing")).catch(() => {});
  else {
    dhakAudio.pause();
    $("dhakButton").classList.remove("playing");
  }
});
dhakAudio.addEventListener("pause", () => $("dhakButton").classList.remove("playing"));
dhakAudio.addEventListener("play", () => $("dhakButton").classList.add("playing"));

let trueIstTimeMs = null;
let lastSyncTimeMs = null;

async function syncTrueTime() {
  try {
    const response = await fetch("https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata");
    if (!response.ok) throw new Error("TimeAPI failed");
    const data = await response.json();
    const safeTimeString = data.dateTime.split(".")[0] + "+05:30";
    trueIstTimeMs = new Date(safeTimeString).getTime();
    lastSyncTimeMs = performance.now();
  } catch (error) {
    console.warn("Primary time API failed, trying fallback...", error);
    try {
      const fallbackResponse = await fetch("https://worldtimeapi.org/api/timezone/Asia/Kolkata");
      if (!fallbackResponse.ok) throw new Error("WorldTimeAPI failed");
      const fallbackData = await fallbackResponse.json();
      trueIstTimeMs = new Date(fallbackData.datetime).getTime();
      lastSyncTimeMs = performance.now();
    } catch (fallbackError) {
      console.error("All APIs failed. Falling back to device clock.", fallbackError);
      trueIstTimeMs = Date.now();
      lastSyncTimeMs = performance.now();
    }
  }
}

function updateTimeAndCountdown() {
  if (trueIstTimeMs === null) {
    if ($("clock")) $("clock").textContent = "Syncing...";
    return;
  }

  const nowMs = trueIstTimeMs + (performance.now() - lastSyncTimeMs);
  const now = new Date(nowMs);
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const clockEl = $("clock");
  if (clockEl) clockEl.textContent = timeFormatter.format(now);

  const targetDateMs = new Date("2026-10-15T00:00:00+05:30").getTime();
  const daysLeft = Math.ceil((targetDateMs - nowMs) / (1000 * 60 * 60 * 24));
  const countdownEl = $("countdownNum");
  if (countdownEl) countdownEl.textContent = daysLeft > 0 ? daysLeft : 0;
}

syncTrueTime().then(() => {
  updateTimeAndCountdown();
  setInterval(updateTimeAndCountdown, 1000);
  setInterval(syncTrueTime, 10 * 60 * 1000);
});
