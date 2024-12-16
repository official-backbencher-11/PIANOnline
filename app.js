const pianoKeys = document.querySelectorAll(".piano-keys .key"),
    volumeSlider = document.querySelector(".volume-slider"),
    keysCheckbox = document.querySelector(".keys-checkbox"),
    startRecBtn = document.querySelector("#start-recording"),
    stopRecBtn = document.querySelector("#stop-recording"),
    playRecBtn = document.querySelector("#play-recording"),
    saveRecBtn = document.querySelector("#save-recording");

function openNav() {
    document.getElementById("nav-bar").style.left = "0";
}
function closeNav() {
    document.getElementById("nav-bar").style.left = "-250px";
}


let mediaRecorder;
let recordedChunks = [];
let audioStream;
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let destination;

let allKeys = [],
    audio = new Audio(),
    recordedKeys = [],
    recordedTimes = [],
    recordingStartTime;

let isRecording = false;

const playTune = (key) => {
    audio.src = `tunes/${key}.wav`; // passing audio src based on key pressed
    audio.play(); // playing audio

    const clickedKey = document.querySelector(`[data-key="${key}"]`); // getting clicked key element
    clickedKey.classList.add("active"); // adding active class to the clicked key element
    setTimeout(() => { // removing active class after 150 ms from the clicked key element
        clickedKey.classList.remove("active");
    }, 150);
}

pianoKeys.forEach(key => {
    allKeys.push(key.dataset.key); // adding data-key value to the allKeys array
    // calling playTune function with passing data-key value as an argument
    key.addEventListener("click", () => {
        if (isRecording) {
            const currentTime = Date.now() - recordingStartTime;
            recordedKeys.push(key.dataset.key);
            recordedTimes.push(currentTime);
        }
        playTune(key.dataset.key);
    });
});

const handleVolume = (e) => {
    audio.volume = e.target.value; // passing the range slider value as an audio volume
}

const startRecording = () => {
    // Reset previous recording data
    recordedChunks = [];
    recordedKeys = [];
    recordedTimes = [];
    recordingStartTime = Date.now();
    isRecording = true;

    // Create a new audio context and set up a media stream
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            audioStream = stream;
            destination = audioContext.createMediaStreamDestination();

            // Create the MediaRecorder for capturing the audio stream
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => {
                recordedChunks.push(event.data); // Save the chunks of audio data
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'audio/webm' }); // Create a blob from the recorded data
                const audioUrl = URL.createObjectURL(blob); // Create an object URL for the audio blob
            };

            // Start recording
            mediaRecorder.start();
            startRecBtn.disabled = true;
            stopRecBtn.disabled = false;
            playRecBtn.disabled = true;
            saveRecBtn.disabled = true;
        })
        .catch(err => {
            console.error("Error accessing microphone: ", err);
        });
};

const stopRecording = () => {
    mediaRecorder.stop(); // Stop the recording
    audioStream.getTracks().forEach(track => track.stop()); // Stop the media stream
    audioContext.close();  // Close the audio context to free resources

    isRecording = false;
    startRecBtn.disabled = false;
    stopRecBtn.disabled = true;
    playRecBtn.disabled = false;
    saveRecBtn.disabled = false;
}

const playRecording = () => {
    let index = 0;
    const startTime = Date.now(); // get the current time to calculate delays

    const playNextKey = () => {
        if (index < recordedKeys.length) {
            const key = recordedKeys[index];
            const timeToWait = recordedTimes[index] - (Date.now() - startTime); // calculate delay for next key
            if (timeToWait > 0) {
                setTimeout(() => {
                    playTune(key); // play the recorded key
                    index++;
                    playNextKey(); // call playNextKey recursively to continue playing
                }, timeToWait);
            } else {
                playTune(key); // if the timeToWait is already passed, play immediately
                index++;
                playNextKey(); // continue to the next key
            }
        }
    };

    playNextKey(); // start playing the recording
}

const saveRecording = () => {
    const blob = new Blob(recordedChunks, { type: 'audio/webm' }); // Create a blob from the recorded chunks
    const url = URL.createObjectURL(blob); // Create an object URL for the blob
    const link = document.createElement('a'); // Create a link element
    link.href = url; // Set the href to the blob URL
    link.download = 'piano-recording.webm'; // Set the default download filename
    link.click(); // Programmatically click the link to start the download
};

const pressedKey = (e) => {
    // if the pressed key is in the allKeys array, only call the playTune function
    if (allKeys.includes(e.key)) {
        if (isRecording) {
            const currentTime = Date.now() - recordingStartTime; // record the time elapsed since recording started
            recordedKeys.push(e.key); // record the key pressed
            recordedTimes.push(currentTime); // record the time of the press
        }
        playTune(e.key);
    }
}

const showHideKeys = () => {
    // toggle the visibility of piano keys
    pianoKeys.forEach(key => key.classList.toggle("hide"));
}

startRecBtn.addEventListener("click", startRecording);
stopRecBtn.addEventListener("click", stopRecording);
playRecBtn.addEventListener("click", playRecording);
saveRecBtn.addEventListener("click", saveRecording);
keysCheckbox.addEventListener("click", showHideKeys);
volumeSlider.addEventListener("input", handleVolume);
document.addEventListener("keydown", pressedKey);
