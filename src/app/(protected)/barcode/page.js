"use client";

import { useEffect, useRef, useState } from "react";
import useSplashRouter from "@/lib/useSplashRouter";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useAuth } from "@/context/AuthContext";
import { findProductByBarcode } from "@/lib/inventory";
import styles from "./barcode.module.css";

const HINTS = new Map([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ],
  ],
]);

export default function BarcodePage() {
  const router = useSplashRouter();
  const { profile } = useAuth();
  const orgId = profile?.orgId;

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const busyRef = useRef(false); // stops one scan firing many lookups
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  const [status, setStatus] = useState("Starting camera...");
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");

  const handleCode = async (raw) => {
    const code = raw.trim();
    if (!code || busyRef.current || !orgIdRef.current) return;
    busyRef.current = true;
    setStatus(`Looking up ${code}...`);

    try {
      const product = await findProductByBarcode(orgIdRef.current, code);

      // Successful scan: play the beep (ignore autoplay rejections)
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }

      router.push(
        product
          ? `/inventory/${product.id}`
          : `/inventory/add?barcode=${encodeURIComponent(code)}`,
      );
    } catch (err) {
      console.error("Barcode lookup failed:", err);
      setStatus("Lookup failed. Try again.");
      busyRef.current = false;
    }
  };

  useEffect(() => {
    const audio = new Audio("/assets/audio/success.mp3");
    audio.preload = "auto";
    audioRef.current = audio;
  }, []);

  useEffect(() => {
    busyRef.current = false;
    setManual("");
    setStatus("Starting camera...");
    setCameraError("");
    let cancelled = false;
    let stream = null;
    let controls = null;

    async function start() {
      try {
        // Plain constraints only. No advanced options, so nothing for the
        // device to reject.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Optional continuous autofocus. Failing here is fine.
        try {
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities?.() ?? {};
          if (caps.focusMode?.includes("continuous")) {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" }],
            });
          }
        } catch {
          /* ignore */
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        setStatus("Point the camera at a barcode");

        // Decode from the <video> element only; ZXing never touches the stream.
        const reader = new BrowserMultiFormatReader(HINTS);
        controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) handleCode(result.getText());
        });
        if (cancelled) controls.stop();
      } catch (err) {
        console.error("Camera failed:", err);
        if (cancelled) return;
        setCameraError(
          err?.name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser settings, or enter the barcode below."
            : "Couldn't start the camera. You can enter the barcode below.",
        );
        setStatus("");
      }
    }

    start();

    return () => {
      cancelled = true;
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={styles.barcodePage}>
      {/* Full-screen camera */}
      <video ref={videoRef} className={styles.video} muted playsInline />
      <div className={styles.frame} aria-hidden="true" />

      {/* Floating back button */}
      <button
        type="button"
        className={styles.backBtn}
        onClick={() => router.back()}
        aria-label="Back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          width={22}
          height={22}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
      </button>

      {/* Floating status */}
      {(cameraError || status) && (
        <p
          className={`${styles.statusPill} ${cameraError ? styles.statusError : ""}`}
          role={cameraError ? "alert" : undefined}
        >
          {cameraError || status}
        </p>
      )}

      {/* Floating manual entry */}
      <form
        className={styles.floatingBar}
        onSubmit={(e) => {
          e.preventDefault();
          handleCode(manual);
        }}
      >
        <input
          className={styles.barInput}
          name="barcode"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Enter barcode manually"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button
          type="submit"
          className={styles.barBtn}
          disabled={!manual.trim()}
        >
          Look up
        </button>
      </form>
    </main>
  );
}
