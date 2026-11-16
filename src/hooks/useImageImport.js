"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IMAGE_IMPORT_LIMITS } from "@/lib/constants";
import { createPreviewRegistry } from "@/services/image/previewRegistry";
import { readImageMetadata } from "@/services/image/imageMetadata";
import { inspectImageFiles } from "@/services/image/imageValidator";

const { MAX_FILES_PER_IMPORT } = IMAGE_IMPORT_LIMITS;

function corruptedEntry(name) {
  return {
    key: `${name}:corrupted`,
    name,
    reasonCode: "CORRUPTED_IMAGE",
    message: "读不到图片内容，文件可能已损坏。",
  };
}

export function useImageImport() {
  const [items, setItems] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [isReading, setIsReading] = useState(false);
  const registryRef = useRef(null);
  // React state is one render behind, so the dedupe key set lives in a ref that
  // updates the moment a file is accepted.
  const keysRef = useRef(new Set());

  if (!registryRef.current) {
    registryRef.current = createPreviewRegistry();
  }

  useEffect(() => {
    const registry = registryRef.current;

    return () => registry.releaseAll();
  }, []);

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      return { acceptedCount: 0, rejectedCount: 0 };
    }

    setIsReading(true);

    const registry = registryRef.current;

    try {
      const outcome = await inspectImageFiles(files, {
        existingFingerprints: [...keysRef.current],
      });

      for (const entry of outcome.accepted) {
        keysRef.current.add(entry.fingerprint);
      }

      if (outcome.accepted.length > 0) {
        setItems((previous) => [
          ...previous,
          ...outcome.accepted.map((entry) => ({
            key: entry.fingerprint,
            file: entry.file,
            name: entry.file.name,
            size: entry.file.size,
            mimeType: entry.mimeType,
            mimeTypeAdjusted: entry.mimeTypeAdjusted,
            width: null,
            height: null,
            previewUrl: null,
            previewSource: "none",
            status: "processing",
          })),
        ]);
      }
      if (outcome.rejected.length > 0) {
        setRejected((previous) => [
          ...previous,
          ...outcome.rejected.map((entry) => ({
            key: `${entry.file?.name ?? "file"}:${entry.reasonCode}:${previous.length}`,
            name: entry.file?.name ?? "未命名文件",
            reasonCode: entry.reasonCode,
            message: entry.message,
          })),
        ]);
      }

      // One decode at a time: a phone photo can expand to hundreds of megabytes
      // of pixels, and nine of them at once would freeze the tab.
      for (const entry of outcome.accepted) {
        const metadata = await readImageMetadata(entry.file);

        if (metadata.decodeFailed) {
          keysRef.current.delete(entry.fingerprint);
          setItems((previous) => previous.filter((item) => item.key !== entry.fingerprint));
          setRejected((previous) => [...previous, corruptedEntry(entry.file.name)]);
          continue;
        }

        const previewBlob = metadata.thumbnailBlob ?? entry.file;
        const previewUrl = registry.acquire(entry.fingerprint, previewBlob);

        setItems((previous) =>
          previous.map((item) =>
            item.key === entry.fingerprint
              ? {
                  ...item,
                  width: metadata.width,
                  height: metadata.height,
                  previewUrl,
                  previewSource: metadata.thumbnailBlob ? "thumbnail" : "original",
                  status: "ready",
                }
              : item,
          ),
        );
      }

      return {
        acceptedCount: outcome.accepted.length,
        rejectedCount: outcome.rejected.length,
      };
    } finally {
      setIsReading(false);
    }
  }, []);

  const removeItem = useCallback((key) => {
    keysRef.current.delete(key);
    registryRef.current.release(key);
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  const clear = useCallback(() => {
    keysRef.current.clear();
    registryRef.current.releaseAll();
    setItems([]);
    setRejected([]);
  }, []);

  const dismissRejected = useCallback((key) => {
    setRejected((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const readyImages = useMemo(
    () =>
      items
        .filter((item) => item.status === "ready")
        .map((item) => ({
          file: item.file,
          blob: item.file,
          mimeType: item.mimeType,
          originalName: item.name,
          width: item.width,
          height: item.height,
        })),
    [items],
  );

  return {
    items,
    rejected,
    readyImages,
    isReading,
    canAddMore: items.length < MAX_FILES_PER_IMPORT,
    remainingSlots: Math.max(MAX_FILES_PER_IMPORT - items.length, 0),
    maxFiles: MAX_FILES_PER_IMPORT,
    addFiles,
    removeItem,
    clear,
    dismissRejected,
  };
}
