"use client";

import { useEffect, useRef, useState } from "react";

type ProductQrScannerProps = {
  active: boolean;
  onScan: (decodedText: string) => void;
};

export function ProductQrScanner({ active, onScan }: ProductQrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  // Serializes start/stop so a new start always waits for the previous stop
  // to fully release the camera first — that overlap was the original bug.
  const lifecycleRef = useRef(Promise.resolve());
  const pausedUntilRef = useRef(0);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  onScanRef.current = onScan;

  useEffect(() => {
    lifecycleRef.current = lifecycleRef.current.then(async () => {
      if (active) {
        if (scannerRef.current || !containerRef.current) return;
        setError("");
        setStarting(true);

        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(containerRef.current.id);

        try {
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              // A fixed 250px box is wider than the viewfinder on a small phone,
              // which pushes the preview off screen. Size it to the viewfinder.
              qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                const edge = Math.floor(
                  Math.min(viewfinderWidth, viewfinderHeight) * 0.7,
                );
                return { width: Math.max(edge, 120), height: Math.max(edge, 120) };
              },
            },
            (decodedText) => {
              const now = Date.now();
              if (now < pausedUntilRef.current) return;
              pausedUntilRef.current = now + 1200;
              onScanRef.current(decodedText);
            },
            () => {
              // Per-frame decode failures are expected constantly — ignore silently.
            },
          );
          scannerRef.current = scanner;
        } catch {
          setError(
            "Couldn't access the camera. Check camera permissions for this site, or use search instead.",
          );
        } finally {
          setStarting(false);
        }
      } else {
        const scanner = scannerRef.current;
        if (!scanner) return;
        scannerRef.current = null;

        try {
          await scanner.stop();
          await scanner.clear();
        } catch {
          // Already stopped — nothing to clean up.
        }
      }
    });
  }, [active]);

  // Release the camera if the whole form unmounts mid-session.
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className={active ? "block" : "hidden"}>
      <div className="rounded-[1.25rem] border border-black/8 bg-black p-3">
        {/*
          html5-qrcode injects a <video> (and a shim <canvas>) sized to the
          camera's own resolution, so on a phone it spilled past the card and
          scrolled the page sideways. Force whatever it injects to fit.
        */}
        <div
          id="counter-sale-qr-reader"
          ref={containerRef}
          className="w-full max-w-full overflow-hidden rounded-[0.85rem] [&_canvas]:!h-auto [&_canvas]:!w-full [&_img]:!max-w-full [&_video]:!h-auto [&_video]:!w-full"
        />
        {error ? (
          <p className="mt-3 rounded-[1rem] border border-[#e6b4b4] bg-[#fff0ef] px-4 py-3 text-sm leading-6 text-[#9b3d32]">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-center text-xs text-white/60">
            {starting ? "Starting camera..." : "Point the camera at a product's QR label."}
          </p>
        )}
      </div>
    </div>
  );
}
