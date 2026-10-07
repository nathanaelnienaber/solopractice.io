import { useState, useRef, useCallback } from "react";
import { acquireAudioStream, classifyMicFailure, micFailureUserMessage } from "../lib/audioCapture";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
  /** True when MediaRecorder.pause is available on this engine. */
  canPause: boolean;
}

export interface AudioRecorderControls {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

function mediaRecorderSupportsPause(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.prototype.pause === "function" &&
    typeof MediaRecorder.prototype.resume === "function"
  );
}

export function useAudioRecorder(): [AudioRecorderState, AudioRecorderControls] {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canPause] = useState(mediaRecorderSupportsPause);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAccumulatedRef = useRef<number>(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const isPausedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startDurationTimer = () => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = Date.now() - startTimeRef.current - pausedAccumulatedRef.current;
      setDuration(Math.max(0, Math.floor(elapsed / 1000)));
    }, 100);
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];
      setAudioBlob(null);
      setDuration(0);
      pausedAccumulatedRef.current = 0;
      pauseStartedAtRef.current = null;
      isPausedRef.current = false;

      const stream = await acquireAudioStream();

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
        isPausedRef.current = false;
        setIsPaused(false);
      };

      // Request data every second for progress tracking
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);

      startTimeRef.current = Date.now();
      startDurationTimer();

      console.log("[AudioRecorder] Started recording with mimeType:", mimeType);
    } catch (err) {
      console.error("Failed to start recording:", err);
      const kind = classifyMicFailure(err);
      setError(micFailureUserMessage(kind, err));
      throw err;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        reject(new Error("No active recording"));
        return;
      }

      clearTimer();
      if (pauseStartedAtRef.current !== null) {
        pausedAccumulatedRef.current += Date.now() - pauseStartedAtRef.current;
        pauseStartedAtRef.current = null;
      }

      mediaRecorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setIsRecording(false);
        isPausedRef.current = false;
        setIsPaused(false);

        console.log("[AudioRecorder] Stopped. Blob size:", blob.size, "bytes");
        resolve(blob);
      };

      // If paused, resume briefly so some engines flush the final chunk cleanly.
      if (mediaRecorder.state === "paused") {
        try {
          mediaRecorder.resume();
        } catch {
          // ignore — stop() below still runs
        }
      }
      mediaRecorder.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;
    if (!mediaRecorderSupportsPause()) {
      setError("Pause is not supported on this system. Stop when you are ready.");
      return;
    }
    try {
      mediaRecorder.pause();
      isPausedRef.current = true;
      setIsPaused(true);
      pauseStartedAtRef.current = Date.now();
      console.log("[AudioRecorder] Paused");
    } catch (err) {
      console.error("Pause failed:", err);
      setError("Could not pause recording on this system.");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state !== "paused") return;
    try {
      mediaRecorder.resume();
      if (pauseStartedAtRef.current !== null) {
        pausedAccumulatedRef.current += Date.now() - pauseStartedAtRef.current;
        pauseStartedAtRef.current = null;
      }
      isPausedRef.current = false;
      setIsPaused(false);
      console.log("[AudioRecorder] Resumed");
    } catch (err) {
      console.error("Resume failed:", err);
      setError("Could not resume recording.");
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // already stopping
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    clearTimer();
    chunksRef.current = [];
    pausedAccumulatedRef.current = 0;
    pauseStartedAtRef.current = null;
    isPausedRef.current = false;
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    setError(null);

    console.log("[AudioRecorder] Reset");
  }, []);

  return [
    { isRecording, isPaused, duration, audioBlob, error, canPause },
    { startRecording, stopRecording, pauseRecording, resumeRecording, resetRecording },
  ];
}
