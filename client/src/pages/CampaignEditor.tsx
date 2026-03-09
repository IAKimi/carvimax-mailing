import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useCampaignVersions, useGenerateVersion, useUpdateVersion } from "@/hooks/use-campaign-versions";
import { useRoute } from "wouter";
import { TipTapEditor } from "@/components/TipTapEditor";
import { Sparkles, Save, Send, ChevronLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function CampaignEditor() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = Number(params?.id);
  
  const { data: campaign, isLoading: isCampLoading } = useCampaign(campaignId);
  const { data: versions, isLoading: isVersLoading } = useCampaignVersions(campaignId);
  
  const { mutate: generateVersion, isPending: isGenerating } = useGenerateVersion();
  const { mutate: updateVersion, isPending: isSaving } = useUpdateVersion();

  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState("");

  useEffect(() => {
    if (versions && versions.length > 0 && !activeVersionId) {
      const selected = versions.find((v: any) => v.isSelected) || versions[0];
      setActiveVersionId(selected.id);
      const json = selected.contentJson as any;
      setEditorContent(json?.body || "<h1>Empiece a editar...</h1>");
    }
  }, [versions, activeVersionId]);

  const activeVersion = versions?.find((v: any) => v.id === activeVersionId);

  const handleGenerate = () => {
    generateVersion(campaignId);
  };

  const handleSave = () => {
    if (activeVersionId && activeVersion) {
      const currentJson = activeVersion.contentJson as any;
      updateVersion({ 
        id: activeVersionId, 
        contentJson: { ...(currentJson || {}), body: editorContent },
        isSelected: true
      });
    }
  };

  if (isCampLoading || isVersLoading) {
    return <Layout><div className="flex h-96 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div></Layout>;
  }

  if (!campaign) {
    return <Layout><div className="text-center py-16 text-muted-foreground">Campaña no encontrada</div></Layout>;
  }

  const needsGeneration = !versions || versions.length === 0;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/emails">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-extrabold">{campaign.name}</h2>
            <p className="text-sm text-muted-foreground capitalize">{campaign.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="button-save-campaign"
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || needsGeneration}
            className="rounded-xl gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
          <Button
            data-testid="button-schedule-campaign"
            disabled={needsGeneration}
            className="rounded-xl gap-2"
          >
            <Send className="w-4 h-4" />
            Programar Envío
          </Button>
        </div>
      </div>

      {needsGeneration ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card rounded-2xl border border-dashed border-border text-center px-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Listo para generar contenido</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Usaremos la idea, objetivo y tono para generar versiones de este correo.
          </p>
          <Button
            data-testid="button-generate-versions"
            onClick={handleGenerate}
            disabled={isGenerating}
            size="lg"
            className="rounded-xl gap-2"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isGenerating ? "Generando..." : "Generar Versiones"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-64 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold">Versiones</h3>
              <span className="text-xs font-semibold text-muted-foreground">{versions?.length}/3</span>
            </div>
            
            {versions?.map((v: any) => {
              const json = v.contentJson as any;
              return (
                <button
                  key={v.id}
                  data-testid={`button-version-select-${v.versionNumber}`}
                  onClick={() => {
                    setActiveVersionId(v.id);
                    setEditorContent(json?.body || "");
                  }}
                  className={`
                    p-3 rounded-xl text-left border transition-all
                    ${activeVersionId === v.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-card hover:border-primary/30'}
                  `}
                >
                  <h4 className="font-bold text-sm mb-0.5">Opción {v.versionNumber}</h4>
                  <p className="text-xs text-muted-foreground truncate">{json?.title || "Sin título"}</p>
                </button>
              );
            })}

            {(versions?.length || 0) < 3 && (
              <Button
                data-testid="button-generate-more"
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="rounded-xl gap-1 border-dashed"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generar otra
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-[500px]">
            <TipTapEditor 
              content={editorContent} 
              onChange={setEditorContent} 
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
