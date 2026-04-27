import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { MessageCircle, X, Send, Trash2, Bot, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getQueryFn } from "@/lib/queryClient";
import type { AssistantSection } from "@shared/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

function detectSection(pathname: string): AssistantSection {
  if (pathname.startsWith("/brand")) return "brand";
  if (pathname.startsWith("/calendar") || pathname.startsWith("/campaigns")) return "calendar";
  if (pathname.startsWith("/templates")) return "templates";
  if (pathname.startsWith("/contacts")) return "contacts";
  if (pathname.startsWith("/emails")) return "history";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/email-provider")) return "provider";
  if (pathname.startsWith("/settings")) return "settings";
  return "general";
}

const SECTION_CONFIG: Record<AssistantSection, { label: string; hint: string; suggestions: string[] }> = {
  brand: {
    label: "Identidad de Marca",
    hint: "Pregúntame sobre tu marca, tono, colores...",
    suggestions: ["¿Cómo defino el tono de mi marca?", "¿Qué colores usar en mis emails?", "Ayúdame con mi público objetivo"],
  },
  calendar: {
    label: "Calendario de Campañas",
    hint: "Pregúntame sobre campañas y programación...",
    suggestions: ["¿Cuándo es mejor enviar emails?", "¿Con qué frecuencia enviar?", "Ayúdame a crear una campaña"],
  },
  templates: {
    label: "Plantillas",
    hint: "Pregúntame sobre diseño de plantillas...",
    suggestions: ["¿Cómo uso los placeholders?", "¿Qué estructura tiene un buen email?", "Explícame el placeholder CONTENIDO"],
  },
  contacts: {
    label: "Base de Contactos",
    hint: "Pregúntame sobre contactos y segmentación...",
    suggestions: ["¿Cómo segmento mis contactos?", "¿Cómo importar contactos CSV?", "¿Qué es el campo segmento?"],
  },
  history: {
    label: "Historial de Emails",
    hint: "Pregúntame sobre estadísticas y resultados...",
    suggestions: ["¿Cómo interpretar los envíos fallidos?", "¿Qué significa estado parcial?", "¿Cómo mejorar mis envíos?"],
  },
  dashboard: {
    label: "Dashboard",
    hint: "Pregúntame sobre métricas y análisis...",
    suggestions: ["¿Cómo leer las métricas?", "¿Qué KPIs son más importantes?", "¿Cómo mejorar mis resultados?"],
  },
  provider: {
    label: "Proveedor de Email",
    hint: "Pregúntame sobre Brevo o Mailchimp...",
    suggestions: ["¿Cómo configuro Brevo?", "¿Cuál proveedor me recomiendas?", "¿Dónde encuentro mi API key?"],
  },
  settings: {
    label: "Configuración",
    hint: "Pregúntame sobre tu cuenta y ajustes...",
    suggestions: ["¿Cómo cambio mi contraseña?", "¿Cómo funciona la verificación?", "Ayúdame con mi cuenta"],
  },
  general: {
    label: "Asistente PostIAlo",
    hint: "Pregúntame sobre email marketing...",
    suggestions: ["¿Cómo empiezo?", "¿Qué es el email marketing?", "¿Cómo crear mi primera campaña?"],
  },
};

function nanoid() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const MAX_MESSAGES = 100;

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="px-3 py-2.5 rounded-2xl rounded-tl-sm bg-muted border border-border">
        <div className="flex gap-1 items-center">
          {[0, 0.18, 0.36].map((delay, i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function serializeMessages(msgs: Message[]): Message[] {
  return msgs.map((m) => ({ ...m, isStreaming: false }));
}

export function FloatingChat() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const section = detectSection(location);
  const config = SECTION_CONFIG[section];

  const { data: currentUser } = useQuery<{ id: number; name: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const storageKey = currentUser ? `assistant_messages_${currentUser.id}_${section}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        setMessages(Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : []);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || messages.length === 0) return;
    const settled = messages.filter((m) => !m.isStreaming);
    if (settled.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(settled.slice(-MAX_MESSAGES)));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollToBottom(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, showTyping]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distFromBottom > 60);
  }

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? inputValue).trim();
    if (!msg || isSending || !currentUser) return;

    setInputValue("");

    const userMsg: Message = {
      id: nanoid(),
      role: "user",
      content: msg,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);
    setShowTyping(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let assistantMsgId: string | null = null;

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, section }),
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "Error desconocido");
        let errMsg = "Error al contactar el asistente.";
        try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
        setShowTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: nanoid(), role: "assistant", content: errMsg, timestamp: Date.now(), isStreaming: false },
        ]);
        setIsSending(false);
        return;
      }

      assistantMsgId = nanoid();
      setShowTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId!, role: "assistant", content: "", timestamp: Date.now(), isStreaming: true },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const data = JSON.parse(payload);
            if (data.type === "delta") {
              accumulatedText += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulatedText, isStreaming: true } : m
                )
              );
            } else if (data.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, isStreaming: false } : m
                )
              );
              setIsSending(false);
            } else if (data.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: data.message || "Error al procesar tu consulta.", isStreaming: false }
                    : m
                )
              );
              setIsSending(false);
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setShowTyping(false);
      if (!isAbort) {
        if (assistantMsgId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: "No se pudo obtener respuesta. Intenta de nuevo.", isStreaming: false }
                : m
            )
          );
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              role: "assistant",
              content: "No se pudo obtener respuesta. Intenta de nuevo.",
              timestamp: Date.now(),
              isStreaming: false,
            },
          ]);
        }
      }
      setIsSending(false);
    }
  }, [inputValue, isSending, currentUser, section]);

  async function handleReset() {
    if (isSending) {
      abortControllerRef.current?.abort();
      setIsSending(false);
    }
    setShowTyping(false);
    setMessages([]);
    if (storageKey) localStorage.removeItem(storageKey);
    try {
      await fetch(`/api/assistant/conversation?section=${encodeURIComponent(section)}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!currentUser) return null;

  const hasMessages = messages.length > 0 || showTyping;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-20 right-6 z-50 w-[360px] max-h-[520px] flex flex-col rounded-2xl shadow-2xl border border-border bg-background overflow-hidden"
            data-testid="floating-chat-panel"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-[#002073] text-white flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="w-4 h-4 flex-shrink-0 text-white/80" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">Asistente · {config.label}</p>
                  <p className="text-[11px] text-white/60 truncate">{config.hint}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {hasMessages && (
                  <button
                    data-testid="button-chat-reset"
                    onClick={handleReset}
                    title="Limpiar conversación"
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  data-testid="button-chat-close"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
              style={{ maxHeight: "340px" }}
            >
              {!hasMessages && (
                <div className="flex flex-col items-center justify-center h-full py-6 gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#002073]/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#002073]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">¡Hola! Soy tu asistente</p>
                    <p className="text-xs text-muted-foreground mt-1">{config.hint}</p>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    {config.suggestions.map((s) => (
                      <button
                        key={s}
                        data-testid="button-chat-suggestion"
                        onClick={() => sendMessage(s)}
                        disabled={isSending}
                        className="text-left text-xs px-3 py-2 rounded-xl border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={msg.id}
                  data-testid={`chat-message-${msg.role}-${idx}`}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#002073] text-white rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm border border-border"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      msg.isStreaming ? (
                        <span className="whitespace-pre-wrap">
                          {msg.content}
                          <motion.span
                            className="inline-block w-0.5 h-3.5 bg-gray-700 ml-0.5 align-text-bottom"
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity }}
                          />
                        </span>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0 prose-headings:my-1">
                          <ReactMarkdown>{msg.content || " "}</ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {showTyping && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {showScrollDown && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-[72px] right-4 p-1.5 rounded-full bg-background border border-border shadow-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex-shrink-0 border-t border-border px-3 py-2.5 flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                data-testid="input-chat-message"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={config.hint}
                disabled={isSending}
                rows={1}
                className="resize-none text-sm min-h-[36px] max-h-[80px] py-2 flex-1 rounded-xl border-border focus-visible:ring-1 focus-visible:ring-[#002073]"
                style={{ height: "auto", overflowY: "auto" }}
              />
              <Button
                data-testid="button-chat-send"
                size="icon"
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isSending}
                className="h-9 w-9 rounded-xl bg-[#002073] hover:bg-[#002073]/90 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        data-testid="button-floating-chat-toggle"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-[#002073] text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow"
        style={{ width: "52px", height: "52px" }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        title={isOpen ? "Cerrar asistente" : "Abrir asistente IA"}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
