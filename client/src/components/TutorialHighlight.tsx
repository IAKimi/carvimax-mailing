import { type ReactNode } from "react";
import { useTutorial } from "@/contexts/TutorialContext";

interface TutorialHighlightProps {
  fieldId: string;
  children: ReactNode;
  className?: string;
}

export function TutorialHighlight({ fieldId, children, className = "" }: TutorialHighlightProps) {
  const { tutorialActive, getCurrentStep } = useTutorial();
  const currentStep = getCurrentStep();
  const isActive = tutorialActive && currentStep?.fieldId === fieldId;

  return (
    <div
      data-tutorial-field={fieldId}
      className={`relative transition-all duration-300 rounded-lg ${
        isActive ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background" : ""
      } ${className}`}
    >
      {children}
      {isActive && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
      )}
    </div>
  );
}
