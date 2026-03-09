import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useCampaignVersions, useGenerateVersion, useUpdateVersion } from "@/hooks/use-campaign-versions";
import { useRoute } from "wouter";
import { TipTapEditor } from "@/components/TipTapEditor";
import { Sparkles, Save, Send, ChevronLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function CampaignEditor() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = Number(params?.id);
  
  const { data: campaign, isLoading: isCampLoading } = useCampaign(campaignId);
  const { data: versions, isLoading: isVersLoading } = useCampaignVersions(campaignId);
  
  const { mutate: generateVersion, isPending: isGenerating } = useGenerateVersion();
  const { mutate: updateVersion, isPending: isSaving } = useUpdateVersion();
  const { mutate: updateCampaign } = useUpdateCampaign();

  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState("");

  // Set initial active version when versions load
  useEffect(() => {
    if (versions && versions.length > 0 && !activeVersionId) {
      const selected = versions.find((v: any) => v.isSelected) || versions[0];
      setActiveVersionId(selected.id);
      // Assuming contentJson has a 'body' field with HTML for this simplified demo
      setEditorContent(selected.contentJson?.body || "<h1>Start editing...</h1>");
    }
  }, [versions, activeVersionId]);

  const activeVersion = versions?.find((v: any) => v.id === activeVersionId);

  const handleGenerate = () => {
    generateVersion(campaignId);
  };

  const handleSave = () => {
    if (activeVersionId) {
      updateVersion({ 
        id: activeVersionId, 
        contentJson: { ...activeVersion.contentJson, body: editorContent },
        isSelected: true
      });
    }
  };

  if (isCampLoading || isVersLoading) {
    return <Layout><div className="flex h-96 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-accent" /></div></Layout>;
  }

  if (!campaign) {
    return <Layout><div>Campaign not found</div></Layout>;
  }

  const needsGeneration = !versions || versions.length === 0;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/campaigns" className="p-2 rounded-xl bg-card border border-border hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> {campaign.status.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving || needsGeneration}
            className="px-5 py-2.5 rounded-xl font-bold border-2 border-border bg-card hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button 
            disabled={needsGeneration}
            className="px-6 py-2.5 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5 hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50 disabled:transform-none transition-all"
          >
            <Send className="w-4 h-4" />
            Proceed to Schedule
          </button>
        </div>
      </div>

      {needsGeneration ? (
        <div className="flex flex-col items-center justify-center py-32 bg-card rounded-3xl border border-dashed border-border text-center px-4">
          <div className="w-24 h-24 bg-accent/10 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-12 h-12 text-accent" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Ready to generate content</h2>
          <p className="text-lg text-muted-foreground max-w-lg mb-8">
            We'll use your idea, objective, and tone to generate 3 unique versions of this email campaign.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="
              px-8 py-4 rounded-2xl font-extrabold text-lg text-white bg-gradient-to-r from-accent to-purple-600
              shadow-xl shadow-accent/30 hover:shadow-2xl hover:-translate-y-1 transition-all
              flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
            "
          >
            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
            {isGenerating ? "AI is writing..." : "Generate 3 Versions"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Versions */}
          <div className="w-full lg:w-72 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">AI Versions</h3>
              <span className="text-xs font-bold px-2 py-1 bg-secondary rounded-md">{versions?.length}/3</span>
            </div>
            
            {versions?.map((v: any, index: number) => (
              <button
                key={v.id}
                onClick={() => {
                  setActiveVersionId(v.id);
                  setEditorContent(v.contentJson?.body || "");
                }}
                className={`
                  p-4 rounded-2xl text-left border-2 transition-all relative overflow-hidden group
                  ${activeVersionId === v.id 
                    ? 'border-accent bg-accent/5 ring-4 ring-accent/10' 
                    : 'border-border bg-card hover:border-slate-300'}
                `}
              >
                {v.isSelected && (
                  <div className="absolute top-0 right-0 w-8 h-8 bg-accent text-white flex items-center justify-center rounded-bl-xl font-bold text-xs">
                    ★
                  </div>
                )}
                <h4 className={`font-bold mb-1 ${activeVersionId === v.id ? 'text-accent' : 'text-foreground'}`}>
                  Option {v.versionNumber}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">Generated {new Date(v.createdAt).toLocaleTimeString()}</p>
                <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden relative">
                  {/* Miniature representation */}
                  <div className="absolute inset-0 p-2 transform scale-50 origin-top-left opacity-50" dangerouslySetInnerHTML={{ __html: v.contentJson?.body?.substring(0, 100) }} />
                </div>
              </button>
            ))}

            {(versions?.length || 0) < 3 && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="p-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:bg-slate-50 hover:text-foreground hover:border-slate-300 font-bold flex items-center justify-center gap-2 transition-all"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate another
              </button>
            )}
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col min-h-[600px]">
            <div className="bg-card border border-border p-4 rounded-t-2xl flex items-center justify-between">
              <span className="font-bold text-sm text-muted-foreground uppercase tracking-wider">HTML Editor</span>
              <button className="text-sm font-semibold text-accent flex items-center gap-1 hover:underline">
                <ImageIcon className="w-4 h-4" /> Change Hero Image
              </button>
            </div>
            
            {/* The TipTap Editor handles its own styling, making it look like a seamless document */}
            <div className="flex-1 bg-slate-100 dark:bg-black/20 p-4 md:p-8 rounded-b-2xl border-x border-b border-border overflow-y-auto">
               <div className="max-w-2xl mx-auto shadow-2xl rounded-2xl">
                 <TipTapEditor 
                   content={editorContent} 
                   onChange={setEditorContent} 
                 />
               </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
