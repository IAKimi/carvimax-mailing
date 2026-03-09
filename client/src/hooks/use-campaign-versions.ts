import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useCampaignVersions(campaignId: number) {
  return useQuery({
    queryKey: [api.campaignVersions.list.path, campaignId],
    queryFn: async () => {
      const url = buildUrl(api.campaignVersions.list.path, { id: campaignId });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error("Failed to fetch versions");
      return api.campaignVersions.list.responses[200].parse(await res.json());
    },
    enabled: !!campaignId,
  });
}

export function useGenerateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: number) => {
      const url = buildUrl(api.campaignVersions.generate.path, { id: campaignId });
      const res = await fetch(url, {
        method: api.campaignVersions.generate.method,
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const err = api.campaignVersions.generate.responses[400].parse(await res.json());
          throw new Error(err.message);
        }
        throw new Error("Failed to generate version");
      }
      return api.campaignVersions.generate.responses[201].parse(await res.json());
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: [api.campaignVersions.list.path, campaignId] });
    },
  });
}

export function useUpdateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & z.infer<typeof api.campaignVersions.update.input>) => {
      const url = buildUrl(api.campaignVersions.update.path, { id });
      const res = await fetch(url, {
        method: api.campaignVersions.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update version");
      return api.campaignVersions.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Invalidate the versions list for this specific campaign
      queryClient.invalidateQueries({ queryKey: [api.campaignVersions.list.path, data.campaignId] });
    },
  });
}
