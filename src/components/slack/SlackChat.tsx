import { useState, useRef, useEffect } from "react";
import { Hash, Lock, Send, RefreshCw, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSlackChannels, useSlackMessages, useSlackSendMessage } from "@/hooks/useSlack";

export function SlackChat() {
  const { channels, loading: channelsLoading, error: channelsError, refetch: refetchChannels } = useSlackChannels();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const { messages, loading: messagesLoading, error: messagesError, refetch: refetchMessages } = useSlackMessages(selectedChannel);
  const { sendMessage, sending } = useSlackSendMessage();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedChannelObj = channels.find((c) => c.id === selectedChannel);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !selectedChannel) return;
    const text = draft.trim();
    setDraft("");
    await sendMessage(selectedChannel, text);
    await refetchMessages();
  };

  if (channelsError) {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <MessageSquare className="mx-auto text-muted-foreground" size={32} />
        <p className="text-sm text-destructive">Erro ao conectar com o Slack: {channelsError}</p>
        <Button variant="outline" size="sm" onClick={refetchChannels}>
          <RefreshCw size={14} className="mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden flex" style={{ height: "520px" }}>
      {/* Channel list */}
      <div className="w-56 shrink-0 border-r border-border/50 flex flex-col">
        <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canais</span>
          <button onClick={refetchChannels} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={12} className={channelsLoading ? "animate-spin" : ""} />
          </button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {channelsLoading && channels.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">Carregando...</p>
            )}
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-left",
                  selectedChannel === ch.id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-secondary/60"
                )}
              >
                {ch.is_private ? <Lock size={12} /> : <Hash size={12} />}
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Messages area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
          {selectedChannelObj ? (
            <>
              {selectedChannelObj.is_private ? <Lock size={14} /> : <Hash size={14} />}
              <span className="text-sm font-semibold">{selectedChannelObj.name}</span>
              {selectedChannelObj.topic?.value && (
                <span className="text-xs text-muted-foreground truncate ml-2">
                  {selectedChannelObj.topic.value}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Selecione um canal</span>
          )}
          {selectedChannel && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0" onClick={refetchMessages}>
              <RefreshCw size={12} className={messagesLoading ? "animate-spin" : ""} />
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          {!selectedChannel && (
            <div className="flex items-center justify-center h-full py-20">
              <div className="text-center space-y-2">
                <MessageSquare className="mx-auto text-muted-foreground" size={28} />
                <p className="text-sm text-muted-foreground">Selecione um canal para ver as mensagens</p>
              </div>
            </div>
          )}
          {messagesError && (
            <p className="text-xs text-destructive py-4 text-center">{messagesError}</p>
          )}
          {selectedChannel && !messagesLoading && messages.length === 0 && (
            <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma mensagem neste canal</p>
          )}
          <div className="space-y-3 py-3">
            {messages.map((msg) => (
              <div key={msg.ts} className="group">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">
                      {(msg.username || msg.user || "U")?.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {msg.username || msg.user || "Usuário"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {msg.reply_count && msg.reply_count > 0 && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                          {msg.reply_count} respostas
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        {selectedChannel && (
          <div className="border-t border-border/50 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Mensagem para #${selectedChannelObj?.name || "canal"}...`}
                className="text-sm h-9"
                disabled={sending}
              />
              <Button type="submit" size="sm" className="h-9 px-3" disabled={!draft.trim() || sending}>
                <Send size={14} />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
