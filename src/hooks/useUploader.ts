import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadManager, type UploadItem } from "../lib/uploader";

export function useUploader(
  onSuccessBatch: () => void,
  onFailed: (message: string) => void,
): { items: UploadItem[]; manager: UploadManager } {
  const manager = useMemo(() => new UploadManager(), []);
  const [items, setItems] = useState<UploadItem[]>([]);

  useEffect(() => {
    const unsubscribe = manager.subscribe(() => setItems([...manager.items]));
    return unsubscribe;
  }, [manager]);

  const successRef = useRef(onSuccessBatch);
  successRef.current = onSuccessBatch;
  const failedRef = useRef(onFailed);
  failedRef.current = onFailed;

  useEffect(() => {
    manager.onUploaded = () => successRef.current();
    manager.onFailed = (message) => failedRef.current(message);
    return () => {
      manager.onUploaded = undefined;
      manager.onFailed = undefined;
    };
  }, [manager]);

  const enqueue = useCallback(
    (blob: Blob, name: string, contentType?: string) => {
      manager.enqueue(blob, name, contentType);
    },
    [manager],
  );

  // enqueue 返回 manager 以便面板读取计数；items 用于渲染
  return { items, manager };
}
