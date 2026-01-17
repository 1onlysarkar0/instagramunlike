import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TerminalProps {
  logs: string[];
  className?: string;
  status: "pending" | "running" | "completed" | "failed" | "stopped";
}

export function Terminal({ logs, className, status }: TerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "running" && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, status]);

  return (
    <div className={cn("rounded-xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl font-mono text-xs md:text-sm ring-1 ring-white/5", className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
        </div>
        <div className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
          {status === "running" && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          ig-automation-cli — {status}
        </div>
      </div>
      
      <ScrollArea className="h-[450px] w-full p-4 selection:bg-green-500/30">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {logs.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-muted-foreground animate-pulse"
              >
                &gt; INITIALIZING_SYSTEM_CORE...
                <br />
                &gt; WAITING_FOR_PAYLOAD...
              </motion.div>
            ) : (
              logs.map((log, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2 text-green-400/90 font-mono leading-relaxed group"
                >
                  <span className="text-muted-foreground select-none opacity-30 group-hover:opacity-60 transition-opacity whitespace-nowrap">
                    [{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                  </span>
                  <span className="break-all drop-shadow-[0_0_2px_rgba(74,222,128,0.3)]">
                    &gt; {log}
                  </span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          {status === "running" && (
            <motion.div 
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="h-4 w-2 bg-green-500 mt-2" 
            />
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
