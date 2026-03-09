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
      queryClient.invalidateQueries({ queryKey: [api.campaignVersions.list.path, data.campaignId] });
    },
  });
}

export function useRegenerateText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, corrections }: { campaignId: number; corrections: string }) => {
      const url = buildUrl(api.campaignVersions.regenerateText.path, { id: campaignId });
      const res = await fetch(url, {
        method: api.campaignVersions.regenerateText.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrections }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Error regenerando texto" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: [api.campaignVersions.list.path, campaignId] });
    },
  });
}

export function useRegenerateImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, imagePrompt }: { campaignId: number; imagePrompt: string }) => {
      const url = buildUrl(api.campaignVersions.regenerateImage.path, { id: campaignId });
      const res = await fetch(url, {
        method: api.campaignVersions.regenerateImage.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompt }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Error regenerando imagen" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: [api.campaignVersions.list.path, campaignId] });
    },
  });
}

export function useEditImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, editPrompt }: { campaignId: number; editPrompt: string }) => {
      const url = buildUrl(api.campaignVersions.editImage.path, { id: campaignId });
      const res = await fetch(url, {
        method: api.campaignVersions.editImage.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editPrompt }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Error editando imagen" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: [api.campaignVersions.list.path, campaignId] });
    },
  });
}
