import { useEffect, useCallback } from 'react';

import { getVsCodeApi } from './useVsCodeApi.ts';

type MessageHandler = (message: { type: string; [key: string]: unknown }) => void;

export function useIpc(onMessage: MessageHandler): {
  send: (message: unknown) => void;
} {
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      onMessage(event.data);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  const send = useCallback((message: unknown): void => {
    getVsCodeApi().postMessage(message);
  }, []);

  return { send };
}
