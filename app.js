const pianoKeys = document.querySelectorAll(".piano-keys .key");
const volumeSlider = document.querySelector(".volume-slider input");
const keysCheckbox = document.querySelector(".keys-checkbox input");
const startRecBtn = document.querySelector("#start-recording");
const stopRecBtn = document.querySelector("#stop-recording");
const playRecBtn = document.querySelector("#play-recording");
const saveRecBtn = document.querySelector("#save-recording");

function openNav() {
    document.getElementById("nav-bar").style.left = "0";
}

function closeNav() {
    document.getElementById("nav-bar").style.left = "-250px";
}

let mediaRecorder;
let recordedChunks = [];
let audioContext;
let recordingDestination;
let volume = Number(volumeSlider.value);
let isRecording = false;
let allKeys = [];
let recordedKeys = [];
let recordedTimes = [];
let recordingStartTime;

const getAudioContext = async () => {
    if (!audioContext || audioContext.state === "closed") {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
        await audioContext.resume();
    }

    return audioContext;
};

const recordKey = (key) => {
    if (!isRecording) {
        return;
    }

    recordedKeys.push(key);
    recordedTimes.push(Date.now() - recordingStartTime);
};

const playTune = (key) => {
    const note = new Audio(`tunes/${key}.wav`);
    note.volume = volume;

    if (audioContext) {
        const source = audioContext.createMediaElementSource(note);
        const gain = audioContext.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(audioContext.destination);

        if (recordingDestination) {
            gain.connect(recordingDestination);
        }

        note.addEventListener("ended", () => {
            source.disconnect();
            gain.disconnect();
        }, { once: true });
    }

    note.play().catch((error) => {
        console.error("Unable to play note:", error);
    });

    const clickedKey = document.querySelector(`[data-key="${key}"]`);
    clickedKey.classList.add("active");
    setTimeout(() => clickedKey.classList.remove("active"), 150);
};

pianoKeys.forEach((key) => {
    allKeys.push(key.dataset.key);
    key.addEventListener("click", () => {
        recordKey(key.dataset.key);
        playTune(key.dataset.key);
    });
});

const handleVolume = (event) => {
    volume = Number(event.target.value);
};

const startRecording = async () => {
    if (mediaRecorder?.state === "recording") {
        return;
    }

    startRecBtn.disabled = true;
    recordedChunks = [];
    recordedKeys = [];
    recordedTimes = [];

    try {
        const context = await getAudioContext();
        recordingDestination = context.createMediaStreamDestination();
        mediaRecorder = new MediaRecorder(recordingDestination.stream);
        mediaRecorder.addEventListener("dataavailable", (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        });
        mediaRecorder.addEventListener("stop", () => {
            recordingDestination = null;
        }, { once: true });

        mediaRecorder.start();
        recordingStartTime = Date.now();
        isRecording = true;
        stopRecBtn.disabled = false;
        playRecBtn.disabled = true;
        saveRecBtn.disabled = true;
    } catch (error) {
        isRecording = false;
        recordingDestination = null;
        startRecBtn.disabled = false;
        console.error("Unable to start piano recording:", error);
    }
};

const stopRecording = () => {
    if (!mediaRecorder || mediaRecorder.state !== "recording") {
        return;
    }

    isRecording = false;
    mediaRecorder.stop();
    startRecBtn.disabled = false;
    stopRecBtn.disabled = true;
    playRecBtn.disabled = recordedKeys.length === 0;
    saveRecBtn.disabled = false;
};

const playRecording = () => {
    const startTime = Date.now();

    recordedKeys.forEach((key, index) => {
        const delay = Math.max(0, recordedTimes[index] - (Date.now() - startTime));
        setTimeout(() => playTune(key), delay);
    });
};

const saveRecording = () => {
    if (recordedChunks.length === 0) {
        return;
    }

    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "piano-recording.webm";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

const pressedKey = (event) => {
    if (event.repeat || !allKeys.includes(event.key)) {
        return;
    }

    recordKey(event.key);
    playTune(event.key);
};

const showHideKeys = () => {
    pianoKeys.forEach((key) => key.classList.toggle("hide"));
};

startRecBtn.addEventListener("click", startRecording);
stopRecBtn.addEventListener("click", stopRecording);
playRecBtn.addEventListener("click", playRecording);
saveRecBtn.addEventListener("click", saveRecording);
keysCheckbox.addEventListener("change", showHideKeys);
volumeSlider.addEventListener("input", handleVolume);
document.addEventListener("keydown", pressedKey);
