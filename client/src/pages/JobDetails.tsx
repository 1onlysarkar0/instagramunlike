import { useRoute } from "wouter";
import { useJob, useStopJob } from "@/hooks/use-jobs";
import { Terminal } from "@/components/Terminal";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, ThumbsDown, AlertTriangle, PlayCircle, Trophy } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect, useState } from "react";

export default function JobDetails() {
  const [match, params] = useRoute("/jobs/:id");
  const id = parseInt(params?.id || "0");
  const { data: job, isLoading, error } = useJob(id);
  const { mutate: stopJob, isPending: isStopping } = useStopJob();
  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    if (job?.status === "completed" && !hasCelebrated) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#10b981', '#ffffff']
      });
      setHasCelebrated(true);
    }
  }, [job?.status, hasCelebrated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground animate-pulse">Connecting to server node...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card className="max-w-md w-full border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Job Not Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">Unable to retrieve job details.</p>
              <Link href="/" className="block">
                <Button className="w-full">Return Home</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const isRunning = job.status === "running" || job.status === "pending";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-5xl mx-auto space-y-8"
      >
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <motion.h1 
                layoutId={`job-title-${job.id}`}
                className="text-3xl font-bold tracking-tight"
              >
                Automation Job #{job.id}
              </motion.h1>
              <StatusBadge status={job.status as any} />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="text-muted-foreground">Started at {new Date(job.createdAt!).toLocaleString()}</p>
              <AnimatePresence>
                {job.totalToProcess > 0 && isRunning && (
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-mono font-medium text-primary">
                      QUEUE: {job.totalUnliked + job.totalErrors} / {job.totalToProcess}+
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {!isRunning ? (
               <Link href="/">
                 <Button variant="outline" className="gap-2 hover-elevate active-elevate-2">
                   <PlayCircle className="w-4 h-4" />
                   Start New Job
                 </Button>
               </Link>
             ) : (
               <Button 
                 variant="destructive" 
                 onClick={() => stopJob(job.id)}
                 disabled={isStopping}
                 className="gap-2 shadow-lg shadow-red-900/20 hover-elevate active-elevate-2"
               >
                 {isStopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                 Stop Unliking
               </Button>
             )}
          </div>
        </header>

        <Separator className="bg-white/10" />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Unliked", value: job.totalUnliked, color: "text-green-400", bg: "bg-green-500/5", border: "border-green-500/20" },
            { label: "Skipped", value: job.totalSkipped, color: "text-yellow-400", bg: "bg-yellow-500/5", border: "border-yellow-500/20" },
            { label: "Errors", value: job.totalErrors, color: "text-red-400", bg: "bg-red-500/5", border: "border-red-500/20" }
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`glass-card ${stat.bg} ${stat.border} hover:scale-[1.02] transition-transform`}>
                <CardContent className="pt-6">
                  <div className={`text-sm font-medium ${stat.color} mb-1`}>{stat.label}</div>
                  <motion.div 
                    key={stat.value}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className={`text-4xl font-mono font-bold ${stat.color} tabular-nums`}
                  >
                    {stat.value}
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Terminal Output */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Live Logs
            {job.speed && <span className="text-xs text-muted-foreground font-mono ml-2">[{job.speed}x MODE]</span>}
          </h2>
          <Terminal 
            logs={job.logs || []} 
            status={job.status as any} 
            className="min-h-[500px] shadow-2xl"
          />
        </motion.div>

        {job.status === "completed" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-8 rounded-2xl bg-primary/10 border border-primary/20 text-center space-y-4"
          >
            <Trophy className="w-12 h-12 text-primary mx-auto" />
            <h3 className="text-2xl font-bold">Sequence Completed Successfully</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              The unlike automation has finished. Your feed activity has been cleaned up at high speed.
            </p>
            <Link href="/">
              <Button size="lg" className="bg-primary hover:scale-105 transition-transform">
                Start Another Sequence
              </Button>
            </Link>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
