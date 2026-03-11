import { useState, useEffect, useCallback, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

export interface CampaignProgress {
  campaignId: number;
  totalExpectedSends: number;
  sentCount: number;
  failedCount: number;
  status: string;
  lastContact?: string;
  lastStatus?: string;
  completed?: boolean;
}

export function useCampaignProgress() {
  const [progressMap, setProgressMap] = useState<Record<number, CampaignProgress>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "campaign-progress") {
          const data = msg.data as CampaignProgress;
          setProgressMap(prev => ({
            ...prev,
            [data.campaignId]: data,
          }));
          if (data.completed) {
            queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const getProgress = useCallback((campaignId: number) => {
    return progressMap[campaignId] || null;
  }, [progressMap]);

  return { progressMap, getProgress };
}
