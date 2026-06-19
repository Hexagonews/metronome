let audioCtx = null;
const audioBuffers = {};
let isPlaying = false;
let currentBeat = 0;
let bpm = 120;
let beatsPerMeasure = 4;
let nextNoteTime = 0.0;
const lookahead = 25.0;
const scheduleAheadTime = 0.2; 
let timerID = null;
let activeSources = []; 
let isAudioLoaded = false;
let currentSoundType = 'voice'; // Tracks 'voice' or 'click'

const startBtn = document.getElementById('start-btn');
const bpmInput = document.getElementById('bpm');
const bpmVal = document.getElementById('bpm-val');

startBtn.textContent = "Start"; 

async function loadSound(name, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return audioCtx.decodeAudioData(arrayBuffer).then(buffer => {
        audioBuffers[name] = buffer;
    });
}

async function initAudio() {
    if (audioCtx) {
        try { await audioCtx.close(); } catch(e) {}
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // MOBILE SILENCE UNLOCK SHIELD
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime); 
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(0);
    oscillator.stop(0.01); 

    startBtn.textContent = "Loading...";
    startBtn.disabled = true; 
    
    try {
        await Promise.all([
            loadSound('1', '1.mp3'),
            loadSound('2', '2.mp3'),
            loadSound('3', '3.mp3'),
            loadSound('4', '4.mp3')
        ]);
        
        isAudioLoaded = true;
        startBtn.disabled = false; 
        start();
    } catch (error) {
        console.error("Audio initialization failed:", error);
        alert("Metronome couldn't load voice files! You can still use 'Click' mode if files are missing.");
        
        // Safety fallback: allow click track even if download fails
        isAudioLoaded = true; 
        startBtn.disabled = false;
        startBtn.textContent = "Start";
    }
}

// Synthesizes a clean woodblock metronome click out of raw audio waves
function playSyntheticClick(beatNumber, time) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // High pitch beep on beat 1, slightly lower on beats 2, 3, 4
    if (beatNumber === 1) {
        osc.frequency.setValueAtTime(1000, time); // 1000Hz (sharp accent)
    } else {
        osc.frequency.setValueAtTime(600, time);  // 600Hz (subdued click)
    }
    
    // Create an instantaneous snap/envelope volume drop
    gainNode.gain.setValueAtTime(0.6, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    
    osc.start(time);
    osc.stop(time + 0.06);
    
    activeSources.push({ source: osc, gainNode: gainNode });
}

function playVoice(beatNumber, time) {
    if (!audioBuffers[beatNumber]) return;

    activeSources.forEach(item => {
        try {
            item.gainNode.gain.setValueAtTime(item.gainNode.gain.value, time);
            item.gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
            item.source.stop(time + 0.06);
        } catch(e) {}
    });
    activeSources = [];

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffers[beatNumber];

    const gainNode = audioCtx.createGain();
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start(time);
    activeSources.push({ source, gainNode });
}

function nextNote() {
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTime += secondsPerBeat;
    
    if (nextNoteTime < audioCtx.currentTime) {
        nextNoteTime = audioCtx.currentTime;
    }

    currentBeat++;
    if (currentBeat > beatsPerMeasure) {
        currentBeat = 1;
    }
}

function scheduleNote(beatNumber, time) {
    if (currentSoundType === 'voice') {
        playVoice(beatNumber, time);
    } else {
        playSyntheticClick(beatNumber, time);
    }
    
    setTimeout(() => {
        if (isPlaying) {
            const display = document.getElementById('visual-beat');
            display.textContent = beatNumber;
            display.classList.add('pulse');
            setTimeout(() => display.classList.remove('pulse'), 80);
        }
    }, (time - audioCtx.currentTime) * 1000);
}

function scheduler() {
    if (!isPlaying) return;

    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
        if (!isPlaying) break;
        scheduleNote(currentBeat + 1 > beatsPerMeasure ? 1 : currentBeat + 1, nextNoteTime);
        nextNote();
    }
    
    if (isPlaying) {
        timerID = setTimeout(scheduler, lookahead);
    }
}

function start() {
    if (isPlaying) return; 

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    isPlaying = true;
    currentBeat = 0;
    nextNoteTime = audioCtx.currentTime + 0.02;
    startBtn.textContent = "Stop";
    startBtn.classList.add('playing');
    scheduler();
}

function stop() {
    isPlaying = false;
    if (timerID) {
        clearTimeout(timerID);
        timerID = null;
    }

    activeSources.forEach(item => {
        try {
            item.source.stop();
            item.source.disconnect();
        } catch(e) {}
    });
    activeSources = [];

    startBtn.textContent = "Start";
    startBtn.classList.remove('playing');
}

// UI Listeners
startBtn.addEventListener('click', () => {
    if (!isAudioLoaded) {
        initAudio();
    } else {
        if (isPlaying) { stop(); } else { start(); }
    }
});

bpmInput.addEventListener('input', (e) => {
    bpm = parseInt(e.target.value);
    bpmVal.value = bpm;
});

bpmVal.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    if (isNaN(value)) return; 
    if (value < 40) value = 40;
    if (value > 218) value = 218;
    bpm = value;
    bpmInput.value = bpm;
});

bpmVal.addEventListener('blur', (e) => {
    if (e.target.value === '' || parseInt(e.target.value) < 40) {
        bpm = 40;
    } else if (parseInt(e.target.value) > 218) {
        bpm = 218;
    }
    bpmVal.value = bpm;
    bpmInput.value = bpm;
});

// Sound Type Selection Logic
document.querySelectorAll('#sound-picker .time-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('#sound-picker .time-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        currentSoundType = e.target.getAttribute('data-sound');
    });
});

document.querySelectorAll('.time-picker:not(#sound-picker) .time-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.time-picker:not(#sound-picker) .time-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        beatsPerMeasure = parseInt(e.target.getAttribute('data-value'));
        if (isAudioLoaded) stop(); 
    });
});

const themeToggleBtn = document.getElementById('theme-toggle');
const rootElement = document.documentElement;

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = rootElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        rootElement.setAttribute('data-theme', 'light');
        themeToggleBtn.textContent = '🌙 Dark Mode';
    } else {
        rootElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.textContent = '☀️ Light Mode';
    }
});
