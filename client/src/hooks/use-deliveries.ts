import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useDeliveries() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deliveriesQuery = useQuery({
    queryKey: [api.deliveries.list.path],
    queryFn: async () => {
      const res = await fetch(api.deliveries.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      return api.deliveries.list.responses[200].parse(await res.json());
    },
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; status?: string; trackingInfo?: string }) => {
      const url = buildUrl(api.deliveries.update.path, { id });
      const res = await fetch(url, {
        method: api.deliveries.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update delivery");
      return api.deliveries.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.deliveries.list.path] });
      toast({ title: "Delivery updated" });
    },
  });

  return {
    deliveries: deliveriesQuery.data ?? [],
    isLoading: deliveriesQuery.isLoading,
    updateDelivery: updateDeliveryMutation.mutate,
  };
}
