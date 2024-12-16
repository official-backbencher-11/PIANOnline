function openNav() {
    document.getElementById("nav").style.left = "0";
  }
function closeNav() {
    document.getElementById("nav").style.left = "-250px";
}

const drumPads = document.querySelectorAll('.drum-pad');

// Map each pad to a sound file
const drumSounds = {
    kick: 'sounds/kick.wav',
    snare: 'sounds/snare.wav',
    hihat: 'sounds/hi-hat.ogg',
    clap: 'sounds/clap.wav',
    tom: 'sounds/tom.wav',
    cymbal: 'sounds/cymbal.wav',
    ride: 'sounds/ride.wav',
    rimshot: 'sounds/rimshot.wav'
};

// Function to play sound
const playDrumSound = (pad) => {
    const sound = new Audio(drumSounds[pad]);
    sound.play();
};

// Event Listener for Clicks
drumPads.forEach(pad => {
    pad.addEventListener('click', () => {
        const sound = pad.dataset.sound;
        playDrumSound(sound);
        recordDrum(sound); // Record the sound
    });
});

// Event Listener for Keyboard Presses
document.addEventListener('keydown', (e) => {
    const keyMap = {
        'a': 'kick',
        's': 'snare',
        'd': 'hihat',
        'f': 'clap',
        'g': 'tom',
        'h': 'cymbal',
        'j': 'ride',
        'k': 'rimshot'
    };
    const sound = keyMap[e.key];
    if (sound) {
        playDrumSound(sound);
        document.querySelector(`[data-sound="${sound}"]`).classList.add('active');
        setTimeout(() => {
            document.querySelector(`[data-sound="${sound}"]`).classList.remove('active');
        }, 150);
        recordDrum(sound); // Record the sound
    }
});

// Recording Logic
let isRecording = false;
let drumSequence = [];
let startTime;

// Start Recording
document.querySelector('#record-btn').addEventListener('click', () => {
    isRecording = true;
    drumSequence = [];
    startTime = Date.now();
});

// Stop Recording
document.querySelector('#stop-btn').addEventListener('click', () => {
    isRecording = false;
});

// Record the played sound
const recordDrum = (sound) => {
    if (isRecording) {
        const time = Date.now() - startTime;
        drumSequence.push({ sound, time });
    }
};

// Play Recorded Sequence
document.querySelector('#play-btn').addEventListener('click', () => {
    if (drumSequence.length === 0) {
        alert('No recording to play!');
        return;
    }
    drumSequence.forEach(note => {
        setTimeout(() => {
            playDrumSound(note.sound);
            document.querySelector(`[data-sound="${note.sound}"]`).classList.add('active');
            setTimeout(() => {
                document.querySelector(`[data-sound="${note.sound}"]`).classList.remove('active');
            }, 150);
        }, note.time);
    });
});
