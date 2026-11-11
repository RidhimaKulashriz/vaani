"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AudioFrame = { seq: number; pcm16: string };
type Options = {
  enabled: boolean;
  onFrame: (frame: AudioFrame) => boolean;
  voiceThreshold?: number;
};

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

export function useMockMicrophone({ enabled, onFrame, voiceThreshold = 0.018 }: Options) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("Microphone is off. Audio is never recorded.");
  const activeRef = useRef(false);
  const startGenerationRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  const sequenceRef = useRef(0);
  const lastStatusAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const muteNodeRef = useRef<GainNode | null>(null);

  onFrameRef.current = onFrame;

  const stop = useCallback(() => {
    startGenerationRef.current += 1;
    activeRef.current = false;
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.port.close();
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    muteNodeRef.current?.disconnect();
    muteNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => undefined);
    setActive(false);
    setStatus("Microphone stopped. Audio frames were not recorded.");
  }, []);

  const start = useCallback(async () => {
    if (!enabled) {
      setStatus("Start an active mock call before enabling the microphone.");
      return;
    }
    if (activeRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setStatus("Microphone capture requires a secure browser context and microphone permission.");
      return;
    }

    const generation = ++startGenerationRef.current;
    setStatus("Requesting microphone permission. No audio will be saved.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (generation !== startGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      const audioContext = new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = audioContext;
      await audioContext.audioWorklet.addModule("/pcm16-capture.worklet.js");
      if (generation !== startGenerationRef.current) {
        stop();
        return;
      }
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const worklet = new AudioWorkletNode(audioContext, "vaani-pcm16-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
      });
      workletNodeRef.current = worklet;
      const mute = audioContext.createGain();
      mute.gain.value = 0;
      muteNodeRef.current = mute;

      sequenceRef.current = 0;
      worklet.port.onmessage = (message: MessageEvent<{ pcm16?: ArrayBuffer; rms?: number }>) => {
        if (!activeRef.current || !message.data.pcm16 || (message.data.rms ?? 0) < voiceThreshold) return;
        const sent = onFrameRef.current({ seq: sequenceRef.current, pcm16: bufferToBase64(message.data.pcm16) });
        if (!sent) return;
        sequenceRef.current += 1;
        const now = Date.now();
        if (now - lastStatusAtRef.current > 1_000) {
          lastStatusAtRef.current = now;
          setStatus("Voice activity detected; 20 ms PCM16 frames are reaching the mock service. Speech recognition is off.");
        }
      };
      source.connect(worklet);
      worklet.connect(mute);
      mute.connect(audioContext.destination);
      await audioContext.resume();
      if (generation !== startGenerationRef.current) {
        stop();
        return;
      }
      activeRef.current = true;
      setActive(true);
      setStatus("Microphone active. Local RMS voice gate sends speech-like frames only; no transcription or recording.");
    } catch {
      if (generation === startGenerationRef.current) {
        stop();
        setStatus("Microphone unavailable. Check browser permission and try again; no audio was saved.");
      }
    }
  }, [enabled, stop, voiceThreshold]);

  useEffect(() => {
    if (!enabled && activeRef.current) stop();
  }, [enabled, stop]);
  useEffect(() => () => stop(), [stop]);

  return { active, status, start, stop, setStatus };
}
