const STORAGE_KEY = 'gunita';

const $ = (s, el = document) => el.querySelector(s);
const grid = $('#grid');
const emptyMsg = $('#emptyMsg');
const statusEl = $('#status');

let state = {
    stream: null,
    facingMode: 'environment',
    snapshot: null,
    upload: null,
    songLink: '',
    note: '',
    moments: loadMoments(),
};

function loadMoments() {
    try {return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch {return [];}
}
function saveMoments() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.moments));
}

const video = $('#video');
const canvas = $('#canvas');
const timer = $('#timer');

async function startCamera() {
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());

    try{
    const constraints = { video: { facingMode: state.facingMode } };
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = state.stream;
    video.play();
    setStatus("Camera ready");
    canvas.classList.add("hidden");
    state.snapshotBase64 = null;
    }catch(err){
    setStatus("Camera blocked or unavailable. You can still import a photo.");
    }
}

function captureFrame() {
    if (!video.videoWidth)
    return setStatus('camera not ready.');

    const brush = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    brush.drawImage(video, 0, 0, canvas.width, canvas.height);

    state.snapshot = canvas.toDataURL('image/jpeg', 0.8);
    canvas.classList.remove('hidden');
    video.classList.add("hidden");
    canvas.classList.remove("hidden");
    setStatus('Moment Captured. Add a song and a note, then Finalize.');
}

function startTimer() {
    if (!video.srcObject) return setStatus('Start the camera.');
    let n = 3;
    timer.textContent = n;
    timer.classList.remove('hidden');
    const tick = setInterval (() =>{
        n--; timer.textContent = n;
        if (n <= 0) {
            clearInterval(tick);
            timer.classList.add('hidden');
            captureFrame();
        }
    }, 1000);
}

const fileInput = $('#file');
$('#importBtn').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        state.upload = await compress(file, 1000, 0.85);
        state.snapshot = null;

        // preview it on canvas
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
            canvas.classList.remove('hidden');
            video.classList.add('hidden');
        };
        img.src = state.upload;

        setStatus('Photo imported.');
    } catch (err) {
        setStatus('Failed to import photo.');
    }
});

function compress(file, maxW=1000, quality=0.85){
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = img.width > maxW ? maxW / img.width : 1;
                const w = img.width * scale;
                const h = img.height * scale;
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = fr.result;
        };
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
}


const btnSong = $('#songBtn');
const songInput = $('#songLink');
const songPreview = $('#songPreview');

btnSong.addEventListener('click', () => {
    songInput.focus();
    songPreview.classList.remove('hidden');
    updateSongPreview();
});
songInput.addEventListener('input', updateSongPreview);

function updateSongPreview() {
    const url = songInput.value.trim();
    
    state.songLink = url;
    if (url.includes("open.spotify.com/track/")){
    const trackId = url.split("/track/")[1]?.split("?")[0];
    if (trackId){
      const embed = `https://open.spotify.com/embed/track/${trackId}`;
      songPreview.innerHTML = 
      `<iframe src="${embed}" width="100%" height="80" frameborder="0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"></iframe>`;
      songPreview.classList.remove("hidden");
      return;
    }
  }

  if (/\.(mp3|wav|ogg)(\?|$)/i.test(url)){
    songPreview.innerHTML = `<audio controls src="${url}"></audio>`;
    songPreview.classList.remove("hidden");
    return;
  }
  songPreview.innerHTML = `<div class="muted">Link added (not a playable embed)</div>`;
  songPreview.classList.remove("hidden");
}

const noteText = $('#noteText');
noteText.addEventListener('input', () => state.note = noteText.value.trim());

$('#finalizeBtn').addEventListener('click', () => {
    const photo = state.snapshot || state.upload;
    if (!photo) return setStatus('Capture or import a photo first.');
    const entry = {
        id: Date.now(),
        photo,
        songLink: state.songLink,
        note: state.note,
        date: new Date().toISOString().split('T')[0],
    };
    state.moments.push(entry);
    saveMoments();
    renderGallery();
    resetMeta();
    setStatus('Moment saved!');
});

function resetMeta() {
    state.snapshot = null;
    state.upload = null;
    canvas.classList.add('hidden');
    video.classList.remove("hidden"); 
    songInput.value = '';
    songPreview.innerHTML = '';
    songPreview.classList.add('hidden');
    noteText.value = '';
    state.songLink = '';
    state.note = '';
}

function renderGallery() {
    grid.innerHTML = '';
    const items = state.moments.slice(-4);
    if(!items.length) {
        emptyMsg.style.display = 'block';
        return;
    }
    emptyMsg.style.display = 'none';

    items.forEach(m => {
        const card = document.createElement('div');
        card.className = 'card';

        const left = document.createElement('div');
        left.className = 'left';
        const img = document.createElement('img');
        img.src = m.photo;
        img.alt = "moment photo";
        left.appendChild(img);

        const right = document.createElement('div');
        right.className = 'right';  

        const songSlot = document.createElement('div');
        songSlot.className = 'song-slot';
        if (m.songLink.includes("open.spotify.com/track/")){
            const id = m.songLink.split("/track/")[1]?.split("?")[0];
            if (id){
                const iframe = document.createElement("iframe");
                iframe.src = `https://open.spotify.com/embed/track/${id}`;
                iframe.setAttribute("allow","autoplay; clipboard-write; encrypted-media; picture-in-picture");
                right.appendChild(Object.assign(songSlot, {innerHTML: ""}));
                songSlot.appendChild(iframe);
            }
        } else if (/\.(mp3|wav|ogg)(\?|$)/i.test(m.songLink)){
            const audio = document.createElement("audio");
            audio.controls = true; audio.src = m.songLink;
            songSlot.appendChild(audio);
        } else {
            songSlot.innerHTML = `<div class="muted">No playable song</div>`;
        }

        const noteSlot = document.createElement('div');
        noteSlot.className = 'note-slot';
        noteSlot.textContent = m.note || "—";

        const dateSlot = document.createElement('div');
        dateSlot.className = 'date-slot';
        dateSlot.textContent = m.date;

        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.className = 'delete-btn';
        delBtn.addEventListener('click', () => {
            state.moments = state.moments.filter(x => x.id !== m.id);
            saveMoments();
            renderGallery();
        });

        right.appendChild(songSlot);
        right.appendChild(noteSlot);
        right.appendChild(dateSlot);
        right.appendChild(delBtn);

        card.appendChild(left);
        card.appendChild(right);

        grid.appendChild(card);
    });
}

$('#captureBtn').addEventListener('click', captureFrame);
$('#timerBtn').addEventListener('click', () => startTimer());
$('#switchCamBtn').addEventListener('click', () => {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
});

function setStatus(msg) {
    statusEl.textContent = msg || "";
}

window.addEventListener('load', async () => {
      if (navigator.mediaDevices?.getUserMedia){
    await startCamera();
  } else {
    setStatus("getUserMedia not supported; use Import photo.");
  }
  renderGallery();
});


