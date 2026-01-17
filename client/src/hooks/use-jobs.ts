import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Types derived from schema
type Job = z.infer<typeof api.jobs.get.responses[200]>;
type CreateJobInput = z.infer<typeof api.jobs.create.input>;

export function useJob(id: number) {
  return useQuery({
    queryKey: [api.jobs.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.jobs.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch job");
      return api.jobs.get.responses[200].parse(await res.json());
    },
    // Poll while running to update logs and stats
    refetchInterval: (query) => {
      const data = query.state.data as Job | undefined;
      return data?.status === "running" || data?.status === "pending" ? 1000 : false;
    },
  });
}

export function useCreateJob() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: CreateJobInput) => {
      // Validate locally first
      const validated = api.jobs.create.input.parse(data);
      
      const res = await fetch(api.jobs.create.path, {
        method: api.jobs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.jobs.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to start job");
      }

      return api.jobs.create.responses[201].parse(await res.json());
    },
    onError: (error) => {
      toast({
        title: "Error starting job",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useStopJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.jobs.stop.path, { id });
      const res = await fetch(url, { method: api.jobs.stop.method });
      
      if (!res.ok) {
        throw new Error("Failed to stop job");
      }
      
      return api.jobs.stop.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.jobs.get.path, data.id], data);
      toast({
        title: "Job Stopped",
        description: "The automation process has been halted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not stop the job. Try again.",
        variant: "destructive",
      });
    },
  });
}
