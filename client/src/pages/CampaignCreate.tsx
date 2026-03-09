import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useCreateCampaign } from "@/hooks/use-campaigns";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Lightbulb, Target, Palette } from "lucide-react";

export default function CampaignCreate() {
  const [, setLocation] = useLocation();
  const { mutate: createCampaign, isPending } = useCreateCampaign();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    idea: "",
    objective: "",
    tone: "",
    layoutPreference: "Hero_Centered",
    userId: 1, // Mock authenticated user
  });

  const updateForm = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const handleSubmit = () => {
    // In a real app, validation should be more robust
    createCampaign(formData, {
      onSuccess: (data) => {
        setLocation(`/campaigns/${data.id}`);
      }
    });
  };

  const steps = [
    { num: 1, title: "The Idea", icon: Lightbulb },
    { num: 2, title: "The Goal", icon: Target },
    { num: 3, title: "The Vibe", icon: Palette },
  ];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-12">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent font-bold text-sm mb-4">New Campaign Wizard</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">Let's create something <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">magic</span></h1>
          <p className="text-lg text-muted-foreground">Give the AI a few hints, and it will write and design the perfect email.</p>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute left-0 top-1/2 w-full h-1 bg-border -z-10 rounded-full" />
          <div className="absolute left-0 top-1/2 h-1 bg-accent -z-10 rounded-full transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }} />
          
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = step >= s.num;
            return (
              <div key={s.num} className="flex flex-col items-center gap-3 bg-background px-4">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 shadow-md
                  ${isActive ? 'bg-primary text-white scale-110' : 'bg-card text-muted-foreground border-2 border-border'}
                `}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-sm font-bold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{s.title}</span>
              </div>
            );
          })}
        </div>

        {/* Form Container */}
        <div className="bg-card rounded-3xl p-8 md:p-10 shadow-xl border border-border/50 relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-lg font-bold text-foreground mb-2">Campaign Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Summer Sale Announcement"
                    className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-accent focus:ring-0 transition-colors text-lg"
                    value={formData.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-lg font-bold text-foreground mb-2">What's the core idea?</label>
                  <textarea 
                    placeholder="We are launching a new line of organic cotton t-shirts this Friday..."
                    className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-accent focus:ring-0 transition-colors text-lg min-h-[150px] resize-none"
                    value={formData.idea}
                    onChange={(e) => updateForm('idea', e.target.value)}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-lg font-bold text-foreground mb-4">What do you want them to do?</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {["Click a link to buy", "Read an article", "Reply to email", "Register for event"].map((obj) => (
                      <button
                        key={obj}
                        onClick={() => updateForm('objective', obj)}
                        className={`
                          p-4 rounded-xl text-left font-semibold border-2 transition-all
                          ${formData.objective === obj ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-transparent text-foreground hover:border-slate-300'}
                        `}
                      >
                        {obj}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <input 
                      type="text" 
                      placeholder="Or type a custom objective..."
                      className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-accent focus:ring-0 transition-colors"
                      value={formData.objective}
                      onChange={(e) => updateForm('objective', e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-lg font-bold text-foreground mb-4">What's the tone of voice?</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {["Professional", "Friendly", "Urgent", "Humorous", "Educational", "Luxury"].map((tone) => (
                      <button
                        key={tone}
                        onClick={() => updateForm('tone', tone)}
                        className={`
                          p-4 rounded-xl text-center font-semibold border-2 transition-all
                          ${formData.tone === tone ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-transparent text-foreground hover:border-slate-300'}
                        `}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 flex justify-end">
            <button
              onClick={handleNext}
              disabled={isPending || (step === 1 && !formData.name)}
              className="
                flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-bold
                bg-gradient-to-r from-primary to-slate-800 text-white
                shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                transition-all duration-300
              "
            >
              {isPending ? "Starting Engine..." : step === 3 ? "Generate Magic" : "Next Step"}
              {step < 3 ? <ArrowRight className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
