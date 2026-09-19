(() => {
  "use strict";

  const pianoKeys = [...document.querySelectorAll(".piano-keys .key")];
  const volumeSlider = document.querySelector("#volume-slider");
  const keysCheckbox = document.querySelector("#keys-checkbox");
  const startRecBtn = document.querySelector("#start-recording");
  const stopRecBtn = document.querySelector("#stop-recording");
  const playRecBtn = document.querySelector("#play-recording");
  const saveRecBtn = document.querySelector("#save-recording");
  const statusEl = document.querySelector("#recording-status");
  const audioStatusEl = document.querySelector("#audio-status");
  const navToggle = document.querySelector("#nav-toggle");
  const navClose = document.querySelector("#nav-close");
  const nav = document.querySelector("#site-nav");

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const allKeys = new Set(pianoKeys.map((key) => key.dataset.key));
  const audioFiles = new Map(pianoKeys.map((key) => [key.dataset.key, `tunes/${key.dataset.key}.wav`]));

  let audioContext = null;
  let masterGain = null;
  let recordDestination = null;
  let decodedBuffers = new Map();
  let isLoading = false;
  let isRecording = false;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingBlob = null;
  let recordingUrl = null;
  let recordedKeys = [];
  let recordedTimes = [];
  let recordingStartTime = 0;
  let playbackTimers = [];
  let activeSources = new Set();

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function setAudioStatus(message) {
    if (audioStatusEl) audioStatusEl.textContent = message;
  }

  function openNav() {
    nav.classList.add("open");
    navToggle.setAttribute("aria-expanded", "true");
    navClose.focus();
  }

  function closeNav() {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.focus();
  }

  async function ensureAudioContext() {
    if (!AudioContextClass) {
      throw new Error("Web Audio API is not supported by this browser.");
    }

    if (!audioContext) {
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = Number(volumeSlider.value);
      masterGain.connect(audioContext.destination);

      recordDestination = audioContext.createMediaStreamDestination();
      masterGain.connect(recordDestination);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    return audioContext;
  }

  function getSupportedRecorderMimeType() {
    if (!window.MediaRecorder) return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus"
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function loadPianoSounds() {
    if (isLoading || decodedBuffers.size === audioFiles.size) return;
    isLoading = true;
    setAudioStatus("Loading piano sounds…");

    try {
      const context = await ensureAudioContext();
      const entries = [...audioFiles.entries()];

      await Promise.all(entries.map(async ([key, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        decodedBuffers.set(key, audioBuffer);
      }));

      setAudioStatus("Piano ready — use A W S E D F T G Y H U J K O L P ;");
    } catch (error) {
      console.error(error);
      setAudioStatus("Could not load the piano sounds. Check that the audio files exist.");
      throw error;
    } finally {
      isLoading = false;
    }
  }

  function markKey(keyValue) {
    const keyElement = document.querySelector(`.key[data-key="${CSS.escape(keyValue)}"]`);
    if (!keyElement) return;
    keyElement.classList.add("active");
    window.setTimeout(() => keyElement.classList.remove("active"), 120);
  }

  async function playTune(keyValue, shouldRecord = true) {
    if (!allKeys.has(keyValue)) return;

    try {
      const context = await ensureAudioContext();
      if (!decodedBuffers.has(keyValue)) {
        await loadPianoSounds();
      }

      const buffer = decodedBuffers.get(keyValue);
      if (!buffer) return;

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(masterGain);
      activeSources.add(source);
      source.addEventListener("ended", () => {
        activeSources.delete(source);
        source.disconnect();
      }, { once: true });

      source.start();
      markKey(keyValue);

      if (isRecording && shouldRecord) {
        recordedKeys.push(keyValue);
        recordedTimes.push(performance.now() - recordingStartTime);
      }
    } catch (error) {
      console.error(error);
      setAudioStatus("Audio could not start. Try clicking the piano again.");
    }
  }

  function clearPlaybackTimers() {
    playbackTimers.forEach((timer) => window.clearTimeout(timer));
    playbackTimers = [];
  }

  function stopAllSources() {
    activeSources.forEach((source) => {
      try { source.stop(); } catch (_) {}
    });
    activeSources.clear();
  }

  function resetRecordingState() {
    recordedChunks = [];
    recordedKeys = [];
    recordedTimes = [];
    recordingBlob = null;

    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      recordingUrl = null;
    }
  }

  async function startRecording() {
    if (isRecording) return;

    try {
      const context = await ensureAudioContext();
      await loadPianoSounds();

      if (!window.MediaRecorder || !recordDestination) {
        throw new Error("This browser does not support audio recording.");
      }

      const mimeType = getSupportedRecorderMimeType();
      if (!mimeType) {
        throw new Error("No supported audio recording format is available.");
      }

      resetRecordingState();
      recordingStartTime = performance.now();
      isRecording = true;
      mediaRecorder = new MediaRecorder(recordDestination.stream, { mimeType });
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) recordedChunks.push(event.data);
      });
      mediaRecorder.addEventListener("stop", finalizeRecording, { once: true });
      mediaRecorder.start(100);

      startRecBtn.disabled = true;
      stopRecBtn.disabled = false;
      playRecBtn.disabled = true;
      saveRecBtn.disabled = true;
      setStatus("Recording… play the piano.");
      setAudioStatus("Recording the piano output directly — microphone access is not used.");
    } catch (error) {
      console.error(error);
      isRecording = false;
      setStatus(error.message || "Recording could not start.");
      startRecBtn.disabled = false;
      stopRecBtn.disabled = true;
    }
  }

  function finalizeRecording() {
    const mimeType = mediaRecorder?.mimeType || "audio/webm";
    recordingBlob = new Blob(recordedChunks, { type: mimeType });

    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = URL.createObjectURL(recordingBlob);

    playRecBtn.disabled = recordingBlob.size === 0;
    saveRecBtn.disabled = recordingBlob.size === 0;
    setStatus(recordingBlob.size ? "Recording ready to play or save." : "No audio was captured.");
  }

  function stopRecording() {
    if (!isRecording) return;

    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    startRecBtn.disabled = false;
    stopRecBtn.disabled = true;
    setAudioStatus("Recording stopped.");
  }

  function playRecordedPerformance() {
    clearPlaybackTimers();

    if (recordingUrl) {
      const audio = new Audio(recordingUrl);
      audio.volume = 1;
      audio.addEventListener("ended", () => URL.revokeObjectURL(audio.src), { once: true });
      audio.play().catch((error) => {
        console.error(error);
        setStatus("Playback was blocked. Press Play Recording again.");
      });
      return;
    }

    if (!recordedKeys.length) {
      setStatus("There is no recording to play.");
      return;
    }

    const startedAt = performance.now();
    recordedKeys.forEach((keyValue, index) => {
      const timer = window.setTimeout(() => playTune(keyValue, false), Math.max(0, recordedTimes[index] - (performance.now() - startedAt)));
      playbackTimers.push(timer);
    });
  }

  function saveRecording() {
    if (!recordingBlob || !recordingBlob.size) {
      setStatus("There is no audio recording to save.");
      return;
    }

    const extension = recordingBlob.type.includes("ogg") ? "ogg" : "webm";
    const url = URL.createObjectURL(recordingBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pianonline-recording.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleKeyDown(event) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

    const keyValue = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!allKeys.has(keyValue)) return;

    event.preventDefault();
    playTune(keyValue);
  }

  pianoKeys.forEach((key) => {
    key.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      playTune(key.dataset.key);
    });
  });

  volumeSlider.addEventListener("input", () => {
    if (masterGain) masterGain.gain.value = Number(volumeSlider.value);
  });

  keysCheckbox.addEventListener("change", () => {
    document.querySelector(".piano-keys").classList.toggle("hide-labels", !keysCheckbox.checked);
  });

  startRecBtn.addEventListener("click", startRecording);
  stopRecBtn.addEventListener("click", stopRecording);
  playRecBtn.addEventListener("click", playRecordedPerformance);
  saveRecBtn.addEventListener("click", saveRecording);

  navToggle.addEventListener("click", openNav);
  navClose.addEventListener("click", closeNav);
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
  document.addEventListener("keydown", handleKeyDown);

  window.addEventListener("pagehide", () => {
    clearPlaybackTimers();
    stopAllSources();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    if (audioContext && audioContext.state !== "closed") audioContext.close();
  });

  loadPianoSounds().catch(() => {});
})();