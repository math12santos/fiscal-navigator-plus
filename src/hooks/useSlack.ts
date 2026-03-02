import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  topic?: { value: string };
  purpose?: { value: string };
  num_members?: number;
}

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  username?: string;
  bot_id?: string;
  type: string;
  thread_ts?: string;
  reply_count?: number;
}

async function callSlack(action: string, params?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("slack-proxy", {
    body: { action, params },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok && data?.error) throw new Error(data.error);
  return data;
}

export function useSlackChannels() {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callSlack("channels.list");
      setChannels(data.channels || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return { channels, loading, error, refetch: fetchChannels };
}

export function useSlackMessages(channelId: string | null) {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!channelId) return;
    try {
      const data = await callSlack("channels.history", { channel: channelId, limit: 50 });
      setMessages((data.messages || []).reverse());
    } catch (e: any) {
      setError(e.message);
    }
  }, [channelId]);

  // Initial load
  useEffect(() => {
    if (!channelId) { setMessages([]); return; }
    setLoading(true);
    setError(null);
    callSlack("channels.history", { channel: channelId, limit: 50 })
      .then((data) => setMessages((data.messages || []).reverse()))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [channelId]);

  // Polling every 5s
  useEffect(() => {
    if (!channelId) return;
    intervalRef.current = setInterval(fetchMessages, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [channelId, fetchMessages]);

  return { messages, loading, error, refetch: fetchMessages };
}

export function useSlackSendMessage() {
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(
    async (channel: string, text: string) => {
      setSending(true);
      try {
        await callSlack("chat.postMessage", {
          channel,
          text,
          username: "Colli FinCore",
          icon_emoji: ":chart_with_upwards_trend:",
        });
      } finally {
        setSending(false);
      }
    },
    []
  );

  return { sendMessage, sending };
}
