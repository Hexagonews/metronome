let audioCtx = null;
const audioBuffers = {};
let isPlaying = false;
let currentBeat = 0;
let bpm = 120;
let beatsPerMeasure = 4;
let nextNoteTime = 0.0;
const lookahead = 25.0;
const scheduleAheadTime = 0.2; // Gives mobile browsers a comfortable processing window
let timerID = null;
let activeSources = []; 
let isAudioLoaded = false;

const startBtn = document.getElementById('start-btn');
const bpmInput = document.getElementById('bpm');
const bpmVal = document.getElementById('bpm-val');

// Keep button visually clean right away
startBtn.textContent = "Start"; 

async function loadSound(name, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return audioCtx.decodeAudioData(arrayBuffer).then(buffer => {
        audioBuffers[name] = buffer;
    });
}

async function initAudio() {
    // Safely clear out any lingering broken context loops
    if (audioCtx) {
        try { await audioCtx.close(); } catch(e) {}
    }

    // 1. Create the AudioContext immediately on user tap
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 2. MOBILE SILENCE UNLOCK SHIELD
    // Force-play an instantaneous silent note right now.
    // This permanently satisfies the mobile browser security check.
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime); // 100% silent
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(0);
    oscillator.stop(0.01); 

    startBtn.textContent = "Loading...";
    startBtn.disabled = true; // Prevents double-clicking bugs while downloading files
    
    try {
        // NOTE: If you converted files to .wav, change '.mp3' to '.wav' here!
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
        alert("Metronome couldn't load your audio files! Double-check that 1.mp3, 2.mp3, 3.mp3, and 4.mp3 are in your root folder and named correctly.");
        
        // Reset button state on error so it doesn't stay greyed out
        isAudioLoaded = false;
        isPlaying = false;
        startBtn.textContent = "Start";
        startBtn.disabled = false;
        startBtn.classList.remove('playing');
    }
}

function playVoice(beatNumber, time) {
    if (!audioBuffers[beatNumber]) return;

    // Cross-fade trailing overlaps to completely remove audio cut-off clicks
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
    
    // Safety check to keep clock from drifting and trapping the browser loop
    if (nextNoteTime < audioCtx.currentTime) {
        nextNoteTime = audioCtx.currentTime;
    }

    currentBeat++;
    if (currentBeat > beatsPerMeasure) {
        currentBeat = 1;
    }
}

function scheduleNote(beatNumber, time) {
    playVoice(beatNumber, time);
    
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
    if (isPlaying) return; // Disallow duplicate engine cycles

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

    // Force clear and cut audio loops immediately
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

// Global UI Listeners
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

document.querySelectorAll('.time-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
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