import { useTutorial } from "@/contexts/TutorialContext";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

export function TutorialTip() {
  const { tutorialActive, getCurrentStep, getCurrentSteps, currentStepIndex, nextStep, prevStep, toggleTutorial } = useTutorial();

  const step = getCurrentStep();
  const steps = getCurrentSteps();

  if (!tutorialActive || !step || steps.length === 0) return null;

  return (
    <div
      data-testid="tutorial-tip"
      className="fixed bottom-6 right-6 z-[60] max-w-sm w-full bg-white border-2 border-yellow-400 rounded-2xl shadow-2xl p-5 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold">
            {currentStepIndex + 1}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            Paso {currentStepIndex + 1} de {steps.length}
          </span>
        </div>
        <button
          data-testid="button-close-tutorial-tip"
          onClick={toggleTutorial}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <h4 className="font-semibold text-sm text-foreground mb-1">{step.label}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.description}</p>

      <div className="flex items-center justify-between">
        <button
          data-testid="button-tutorial-prev"
          onClick={prevStep}
          disabled={currentStepIndex === 0}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Anterior
        </button>
        <button
          data-testid="button-tutorial-next"
          onClick={nextStep}
          disabled={currentStepIndex >= steps.length - 1}
          className="flex items-center gap-1 text-xs font-medium bg-yellow-400 hover:bg-yellow-500 text-yellow-900 px-3 py-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
