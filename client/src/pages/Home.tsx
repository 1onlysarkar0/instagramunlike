import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateJob } from "@/hooks/use-jobs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, ShieldAlert, Zap, Lock, Info, RefreshCcw, Gauge, Rocket, Loader2, MessageSquare, Heart } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [, setLocation] = useLocation();
  const [cookies, setCookies] = useState("");
  const [speed, setSpeed] = useState(20);
  const [targetType, setTargetType] = useState<"like" | "comment">("like");
  const { mutate: createJob, isPending } = useCreateJob();
  const [error, setError] = useState<string | null>(null);

  const { data: savedData, isLoading: isLoadingCookies } = useQuery<{
    cookies: string;
  }>({
    queryKey: [api.settings.getCookies.path],
  });

  useEffect(() => {
    if (savedData?.cookies) {
      setCookies(savedData.cookies);
    }
  }, [savedData]);

  const handleClearSession = async () => {
    try {
      await apiRequest("POST", api.settings.clearCookies.path);
      setCookies("");
      queryClient.invalidateQueries({
        queryKey: [api.settings.getCookies.path],
      });
    } catch (e) {
      setError("Failed to clear session.");
    }
  };

  const handleSubmit = () => {
    if (!cookies.trim()) {
      setError("Please paste your JSON cookies first.");
      return;
    }

    try {
      JSON.parse(cookies);
      setError(null);

      createJob(
        { cookies, speed, targetType },
        {
          onSuccess: (job) => {
            setLocation(`/jobs/${job.id}`);
          },
        },
      );
    } catch (e) {
      setError("Invalid JSON format. Please ensure you copied the full array.");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
      />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-4xl mx-auto w-full relative z-10 space-y-8"
      >
        <div className="text-center space-y-4">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4 ring-1 ring-primary/20 cursor-pointer"
          >
            <Zap className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Instagram Cleanup Automation
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Automate the process of unliking posts or deleting comments to clean up your feed.
          </p>
        </div>

        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          <Card className="glass-card border-white/10 p-2 inline-flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20">
              <Label htmlFor="target-toggle" className="flex items-center gap-2 cursor-pointer">
                <Heart className={`w-4 h-4 ${targetType === "like" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={targetType === "like" ? "text-primary font-bold" : "text-muted-foreground"}>Likes</span>
              </Label>
              <Switch
                id="target-toggle"
                checked={targetType === "comment"}
                onCheckedChange={(checked) => setTargetType(checked ? "comment" : "like")}
              />
              <Label htmlFor="target-toggle" className="flex items-center gap-2 cursor-pointer">
                <MessageSquare className={`w-4 h-4 ${targetType === "comment" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={targetType === "comment" ? "text-primary font-bold" : "text-muted-foreground"}>Comments</span>
              </Label>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Alert
            variant="destructive"
            className="glass-card border-red-500/20 text-red-400"
          >
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle className="font-bold">Use At Your Own Risk</AlertTitle>
            <AlertDescription className="mt-2 text-red-400/90 leading-relaxed">
              This tool uses automation which may violate Instagram's Terms of
              Service. 200x speed is EXTREMELY high and will likely trigger rate
              limits. Proceed with extreme caution.
            </AlertDescription>
          </Alert>
        </motion.div>

        <Card className="glass-card border-white/10 shadow-2xl overflow-hidden hover:border-primary/20 transition-colors duration-500">
          <CardHeader className="border-b border-white/5 bg-black/20 pb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-mono flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  SESSION_CONFIG
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Lock className="w-3 h-3" />
                  Paste your session cookies JSON array below
                </CardDescription>
              </div>
              <div className="flex-1 max-w-xs space-y-3 relative z-50">
                <div className="flex items-center justify-between text-sm font-mono">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Gauge className="w-4 h-4" />
                    SPEED_CTRL
                  </div>
                  <motion.span
                    key={speed}
                    initial={{ scale: 1.5, color: "#fff" }}
                    animate={{ scale: 1, color: "var(--primary)" }}
                    className="text-primary font-bold"
                  >
                    {speed}x
                  </motion.span>
                </div>
                <Slider
                  value={[speed]}
                  onValueChange={([val]) => setSpeed(val)}
                  min={1}
                  max={200}
                  step={1}
                  className="cursor-pointer"
                />
                {speed > 100 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-red-400 font-mono text-center animate-pulse"
                  >
                    DANGER: HIGH SPEED
                  </motion.div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative group">
              <Textarea
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
                placeholder="["
                className="min-h-[300px] w-full bg-black/50 border-0 rounded-none p-6 font-mono text-xs md:text-sm text-green-400 placeholder:text-green-900/50 focus-visible:ring-0 resize-none selection:bg-green-900/30"
              />
            </div>
            <div className="p-6 bg-white/5 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Use a browser extension to export JSON</span>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleClearSession}
                  className="w-full md:w-auto border-white/10 hover:bg-white/5"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Clear Session
                </Button>
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isPending || isLoadingCookies}
                  className="w-full md:w-auto min-w-[200px] bg-primary text-primary-foreground font-bold shadow-lg"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {isPending ? "Initializing..." : `Start ${targetType === "like" ? "Unlike" : "Delete"} Sequence`}
                </Button>
              </div>
            </div>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-6 pb-6 text-red-400 text-sm font-medium"
                >
                  ⚠ {error}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
