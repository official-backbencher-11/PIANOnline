(() => {
  "use strict";

  const pads = [...document.querySelectorAll(".drum-pad")];
  const statusEl = document.querySelector("#drum-status");
  const recordBtn = document.querySelector("#record-btn");
  const stopBtn = document.querySelector("#stop-btn");
  const playBtn = document.querySelector("#play-btn");
  const nav = document.querySelector("#nav");

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const sounds = new Map([
    ["kick", "sounds/kick.wav"],
    ["snare", "sounds/snare.wav"],
    ["hihat", "sounds/hi-hat.ogg"],
    ["clap", "sounds/clap.wav"],
    ["tom", "sounds/tom.wav"],
    ["cymbal", "sounds/cymbal.wav"],
    ["ride", "sounds/ride.wav"],
    ["rimshot", "sounds/rimshot.wav"]
  ]);
  const keyMap = new Map([
    ["a", "kick"], ["s", "snare"], ["d", "hihat"], ["f", "clap"],
    ["g", "tom"], ["h", "cymbal"], ["j", "ride"], ["k", "rimshot"]
  ]);

  let context = null;
  let masterGain = null;
  let recordDestination = null;
  let buffers = new Map();
  let loadPromise = null;
  let mediaRecorder = null;
  let chunks = [];
  let recordingBlob = null;
  let recordingUrl = null;
  let sequence = [];
  let recordingStart = 0;
  let isRecording = false;
  let timers = [];

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  async function ensureAudio() {
    if (!AudioContextClass) throw new Error("Web Audio is not supported by this browser.");
    if (!context) {
      context = new AudioContextClass();
      masterGain = context.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(context.destination);
      recordDestination = context.createMediaStreamDestination();
      masterGain.connect(recordDestination);
    }
    if (context.state === "suspended") await context.resume();
  }

  function mimeType() {
    if (!window.MediaRecorder) return "";
    return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  function loadSounds() {
    if (buffers.size === sounds.size) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      await ensureAudio();
      setStatus("Loading drum sounds…");
      await Promise.all([...sounds.entries()].map(async ([name, url]) => {
        if (buffers.has(name)) return;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}`);
        const data = await response.arrayBuffer();
        buffers.set(name, await context.decodeAudioData(data));
      }));
      setStatus("Drum pad ready — use A S D F G H J K.");
    })().catch((error) => {
      console.error(error);
      setStatus("Could not load the drum sounds.");
      throw error;
    }).finally(() => { loadPromise = null; });
    return loadPromise;
  }

  function flashPad(name) {
    const pad = document.querySelector(`.drum-pad[data-sound="${CSS.escape(name)}"]`);
    if (!pad) return;
    pad.classList.add("active");
    setTimeout(() => pad.classList.remove("active"), 120);
  }

  async function playSound(name, shouldRecord = true) {
    if (!sounds.has(name)) return;
    try {
      await loadSounds();
      const source = context.createBufferSource();
      source.buffer = buffers.get(name);
      source.connect(masterGain);
      source.start();
      flashPad(name);

      if (isRecording && shouldRecord) {
        sequence.push({ sound: name, time: performance.now() - recordingStart });
      }
    } catch (error) {
      console.error(error);
      setStatus("The drum sound could not be loaded.");
    }
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function resetRecording() {
    chunks = [];
    sequence = [];
    recordingBlob = null;
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = null;
  }

  async function startRecording() {
    if (isRecording) return;
    try {
      await loadSounds();
      const type = mimeType();
      if (!recordDestination || !type) throw new Error("Audio recording is not supported by this browser.");

      resetRecording();
      isRecording = true;
      recordingStart = performance.now();
      mediaRecorder = new MediaRecorder(recordDestination.stream, { mimeType: type });
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      mediaRecorder.addEventListener("stop", () => {
        recordingBlob = new Blob(chunks, { type: mediaRecorder.mimeType || type });
        recordingUrl = URL.createObjectURL(recordingBlob);
        playBtn.disabled = !recordingBlob.size;
        setStatus(recordingBlob.size ? "Recording ready." : "No audio was captured.");
      }, { once: true });
      mediaRecorder.start(100);

      recordBtn.disabled = true;
      stopBtn.disabled = false;
      playBtn.disabled = true;
      setStatus("Recording…");
    } catch (error) {
      console.error(error);
      isRecording = false;
      setStatus(error.message);
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    if (mediaRecorder?.state !== "inactive") mediaRecorder.stop();
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    setStatus("Recording stopped.");
  }

  function playRecording() {
    clearTimers();

    if (recordingUrl) {
      const audio = new Audio(recordingUrl);
      audio.play().catch(() => setStatus("Press Play again to start playback."));
      return;
    }

    if (!sequence.length) {
      setStatus("There is no recording to play.");
      return;
    }

    const started = performance.now();
    sequence.forEach((note) => {
      const delay = Math.max(0, note.time - (performance.now() - started));
      timers.push(setTimeout(() => playSound(note.sound, false), delay));
    });
  }

  function saveRecording() {
    if (!recordingBlob?.size) return;
    const extension = recordingBlob.type.includes("ogg") ? "ogg" : recordingBlob.type.includes("mp4") ? "m4a" : "webm";
    const url = URL.createObjectURL(recordingBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pianonline-drums.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  pads.forEach((pad) => {
    pad.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      playSound(pad.dataset.sound);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const sound = keyMap.get(event.key.toLowerCase());
    if (!sound) return;
    event.preventDefault();
    playSound(sound);
  });

  recordBtn.addEventListener("click", startRecording);
  stopBtn.addEventListener("click", stopRecording);
  playBtn.addEventListener("click", playRecording);

  window.openNav = () => { if (nav) nav.style.left = "0"; };
  window.closeNav = () => { if (nav) nav.style.left = "-250px"; };

  window.addEventListener("pagehide", () => {
    clearTimers();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    if (context && context.state !== "closed") context.close();
  });

})();