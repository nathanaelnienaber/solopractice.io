import { useState, useRef, useCallback } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
}

export interface AudioRecorderControls {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(): [AudioRecorderState, AudioRecorderControls] {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];
      setAudioBlob(null);
      setDuration(0);
      pausedDurationRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // WebKitGTK/Firefox don't support MediaRecorder with webm for audio
      // (confirmed: isTypeSupported returns false for every webm variant on
      // this engine family). Try candidates in order of whisper.cpp
      // friendliness, but fall back to whatever MediaRecorder picks with no
      // mimeType at all rather than forcing an unsupported one -- the old
      // code always passed webm as the last resort even when nothing on the
      // candidate list was actually supported, which threw
      // "mimeType is not supported" instead of degrading gracefully.
      const candidates = [
        "audio/wav",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
      ];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType
          ? { mimeType, audioBitsPerSecond: 128000 }
          : { audioBitsPerSecond: 128000 }
      );

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setError("Recording failed. Please check microphone permissions.");
        setIsRecording(false);
      };

      // Request data every second for progress tracking
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (!isPaused) {
          const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
          setDuration(Math.floor(elapsed / 1000));
        }
      }, 100);

      console.log("[AudioRecorder] Started recording with mimeType:", mimeType);
    } catch (err) {
      console.error("Failed to start recording:", err);
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access denied. Please allow microphone access in your system settings.");
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone and try again.");
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError("Failed to start recording. Please try again.");
      }
      throw err;
    }
  }, [isPaused]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        reject(new Error("No active recording"));
        return;
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      mediaRecorder.onstop = () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setIsRecording(false);
        setIsPaused(false);

        console.log("[AudioRecorder] Stopped. Blob size:", blob.size, "bytes");
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      setIsPaused(true);
      pausedDurationRef.current = Date.now() - startTimeRef.current - (duration * 1000);
      console.log("[AudioRecorder] Paused");
    }
  }, [duration]);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now() - (duration * 1000);
      console.log("[AudioRecorder] Resumed");
    }
  }, [duration]);

  const resetRecording = useCallback(() => {
    // Stop any active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Reset state
    chunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    setError(null);

    console.log("[AudioRecorder] Reset");
  }, []);

  return [
    { isRecording, isPaused, duration, audioBlob, error },
    { startRecording, stopRecording, pauseRecording, resumeRecording, resetRecording },
  ];
}
