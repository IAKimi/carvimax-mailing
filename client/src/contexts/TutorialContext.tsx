import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface TutorialStep {
  fieldId: string;
  label: string;
  description: string;
}

const BRAND_STEPS: TutorialStep[] = [
  { fieldId: "companyName", label: "Nombre de la Empresa", description: "Ingrese el nombre oficial de su empresa tal como aparece en sus comunicaciones." },
  { fieldId: "industry", label: "Industria", description: "Indique el sector o industria en la que opera su empresa (ej: Tecnología, Alimentos, Servicios)." },
  { fieldId: "website", label: "Sitio Web", description: "Ingrese la dirección web de su empresa para que la IA pueda incluirla en los correos." },
  { fieldId: "whatsapp", label: "WhatsApp", description: "Número de WhatsApp para contacto directo (formato: +503 7000-0000)." },
  { fieldId: "mission", label: "Misión", description: "La misión define el propósito fundamental de su empresa. ¿Qué hace y para quién lo hace?" },
  { fieldId: "vision", label: "Visión", description: "La visión describe hacia dónde se dirige su empresa a futuro. ¿Qué aspira lograr?" },
  { fieldId: "products", label: "Productos / Servicios", description: "Liste sus principales productos o servicios. La IA los usará como referencia en el contenido." },
  { fieldId: "history", label: "Historia", description: "Resuma brevemente la trayectoria de su empresa, logros destacados y años de experiencia." },
  { fieldId: "styleGuide", label: "Guía de Estilo", description: "Describa el estilo de redacción preferido: formal, cercano, técnico, etc." },
  { fieldId: "targetAudience", label: "Público Objetivo", description: "¿A quién le habla su empresa? Describa su cliente ideal (cargo, industria, región)." },
  { fieldId: "tone", label: "Tono", description: "Seleccione el tono general que la IA debe usar al generar contenido para su marca." },
  { fieldId: "colors", label: "Colores Corporativos", description: "Seleccione los colores corporativos de su marca para que las plantillas los reflejen." },
  { fieldId: "fonts", label: "Tipografías", description: "Escoja las fuentes tipográficas que representan la identidad visual de su marca." },
  { fieldId: "logo", label: "Logotipo", description: "Suba el logotipo oficial de su empresa en formato PNG, JPG, SVG o WebP." },
  { fieldId: "visualStyle", label: "Estilo Visual", description: "Seleccione el estilo de diseño que la IA aplicará al generar sus plantillas de email: Minimalista, Corporativo, Moderno, Creativo o Elegante." },
];

const CALENDAR_STEPS: TutorialStep[] = [
  { fieldId: "calendar-overview", label: "Calendario", description: "Haz clic en cualquier día del calendario para crear una nueva campaña de correo con IA." },
  { fieldId: "idea", label: "Idea del Correo", description: "Describa de qué se trata su correo. Puede ser una idea general — la IA se encargará de desarrollarla profesionalmente." },
  { fieldId: "objective", label: "Objetivo", description: "¿Cuál es el objetivo de este correo? (ej: Generar ventas, informar, invitar a un evento)." },
  { fieldId: "targetAudience", label: "Público Objetivo", description: "Opcional: defina a quién va dirigido este correo para que la IA adapte el tono y contenido." },
  { fieldId: "template", label: "Plantilla", description: "Seleccione una plantilla compatible para dar formato profesional a su correo." },
  { fieldId: "imagePrompt", label: "Imagen", description: "Describa qué tipo de imagen desea para su correo. La IA la generará automáticamente." },
  { fieldId: "targetDatabase", label: "Base de Datos", description: "Escoja la base de datos de contactos a la que se enviará este correo." },
  { fieldId: "scheduledDate", label: "Fecha de Envío", description: "Defina la fecha y hora en que desea que se envíe su correo." },
];

const CONTACTS_STEPS: TutorialStep[] = [
  { fieldId: "contacts-overview", label: "Base de Datos", description: "Cree una base de datos de contactos y luego importe sus contactos desde un archivo CSV o Excel." },
  { fieldId: "new-database", label: "Nueva Base de Datos", description: "Haga clic aquí para crear una nueva base de datos donde almacenar sus contactos." },
  { fieldId: "import-contacts", label: "Importar Contactos", description: "Use el botón de importar para subir un archivo CSV o Excel con los datos de sus contactos." },
];

const TEMPLATES_STEPS: TutorialStep[] = [
  { fieldId: "templates-overview", label: "Plantillas", description: "Puede generar plantillas automáticamente con IA o subir sus propias plantillas HTML personalizadas." },
  { fieldId: "generate-ai", label: "Generar con IA", description: "Haga clic aquí para que la IA genere una plantilla profesional basada en su identidad de marca." },
];

const HISTORIAL_STEPS: TutorialStep[] = [
  { fieldId: "historial-overview", label: "Historial", description: "Aquí puede ver todos sus correos programados y enviados. Haga clic en cualquier tarjeta para ver los detalles, y use el filtro de fechas para buscar correos específicos." },
];

const DASHBOARD_STEPS: TutorialStep[] = [
  { fieldId: "dashboard-overview", label: "Dashboard", description: "Este panel muestra un resumen de su actividad: campañas creadas, tendencias mensuales, bases de datos más usadas y plantillas favoritas." },
];

export const TUTORIAL_SECTIONS: Record<string, TutorialStep[]> = {
  brand: BRAND_STEPS,
  calendar: CALENDAR_STEPS,
  contacts: CONTACTS_STEPS,
  templates: TEMPLATES_STEPS,
  emails: HISTORIAL_STEPS,
  dashboard: DASHBOARD_STEPS,
};

interface TutorialContextValue {
  tutorialActive: boolean;
  currentSection: string;
  currentStepIndex: number;
  toggleTutorial: () => void;
  setCurrentSection: (section: string) => void;
  setCurrentStepIndex: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  getCurrentSteps: () => TutorialStep[];
  getCurrentStep: () => TutorialStep | null;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [tutorialActive, setTutorialActive] = useState(() => {
    try {
      return localStorage.getItem("postIAlo_tutorial") === "true";
    } catch {
      return false;
    }
  });
  const [currentSection, setCurrentSectionState] = useState("");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const toggleTutorial = useCallback(() => {
    setTutorialActive(prev => {
      const next = !prev;
      try { localStorage.setItem("postIAlo_tutorial", String(next)); } catch {}
      if (next) setCurrentStepIndex(0);
      return next;
    });
  }, []);

  const setCurrentSection = useCallback((section: string) => {
    setCurrentSectionState(section);
    setCurrentStepIndex(0);
  }, []);

  const getCurrentSteps = useCallback(() => {
    return TUTORIAL_SECTIONS[currentSection] || [];
  }, [currentSection]);

  const getCurrentStep = useCallback(() => {
    const steps = TUTORIAL_SECTIONS[currentSection];
    if (!steps || currentStepIndex >= steps.length) return null;
    return steps[currentStepIndex];
  }, [currentSection, currentStepIndex]);

  const nextStep = useCallback(() => {
    setCurrentStepIndex(prev => {
      const steps = TUTORIAL_SECTIONS[currentSection] || [];
      return Math.min(prev + 1, steps.length - 1);
    });
  }, [currentSection]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  }, []);

  return (
    <TutorialContext.Provider value={{
      tutorialActive,
      currentSection,
      currentStepIndex,
      toggleTutorial,
      setCurrentSection,
      setCurrentStepIndex,
      nextStep,
      prevStep,
      getCurrentSteps,
      getCurrentStep,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
