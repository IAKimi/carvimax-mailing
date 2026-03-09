import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Image, CalendarDays, Send, Palette, PenTool, LayoutTemplate, Rocket, ChevronDown, Package } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

const features = [
  {
    icon: PenTool,
    title: "Copys generados por IA",
    description: "Textos adaptados a su identidad de marca. Ideas, tonos y variaciones listas para utilizar, según lo que usted defina."
  },
  {
    icon: Image,
    title: "Generación de Imágenes",
    description: "Diseños visuales con el estilo de su negocio, creados a partir de lo que usted desea comunicar."
  },
  {
    icon: CalendarDays,
    title: "Programación",
    description: "Calendario de envíos con vista mensual, recordatorios automáticos y control total de su contenido."
  },
  {
    icon: Send,
    title: "Envío automático",
    description: "Despacho automático de correos a través de su plataforma de email marketing favorita."
  }
];

const steps = [
  {
    icon: Palette,
    number: "1",
    title: "Defina su marca",
    description: "Ingrese su logotipo, colores, sitio web y datos de contacto. Esta información será la base para todo el contenido que se generará."
  },
  {
    icon: PenTool,
    number: "2",
    title: "Personalice su correo",
    description: "Indique el tema, el objetivo de comunicación y cómo desea que se vea la imagen del correo."
  },
  {
    icon: LayoutTemplate,
    number: "3",
    title: "Escoja su plantilla",
    description: "Seleccione una de las plantillas disponibles. Estas se ajustarán automáticamente a la identidad visual que usted definió."
  },
  {
    icon: Rocket,
    number: "4",
    title: "Programe y envíe",
    description: "Revise y apruebe el contenido. Luego, decida si desea programar el envío o despacharlo de inmediato."
  }
];

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function DropdownSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  testId
}: {
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Card className="overflow-visible">
      <button
        data-testid={testId}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold">{title}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function Home() {
  const { data: user } = useQuery<{ id: number; name: string; email: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const userName = user?.name || "Usuario";
  const [productOpen, setProductOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  return (
    <Layout>
      <div className="space-y-16">
        <FadeInSection>
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
              Bienvenido, <span className="text-primary">{userName}</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Este es tu centro de email marketing inteligente. Crea correos profesionales
              con inteligencia artificial, programa envíos y monitorea resultados.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Link href="/brand">
                <Button data-testid="button-start-brand" size="lg" className="rounded-xl gap-2">
                  <Palette className="w-4 h-4" />
                  Configurar Marca
                </Button>
              </Link>
              <Link href="/calendar">
                <Button data-testid="button-start-calendar" variant="outline" size="lg" className="rounded-xl gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Ir al Calendario
                </Button>
              </Link>
            </div>
          </div>
        </FadeInSection>

        <FadeInSection delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DropdownSection
              title="Mi Producto"
              icon={Package}
              isOpen={productOpen}
              onToggle={() => setProductOpen(!productOpen)}
              testId="button-toggle-product"
            >
              <p className="text-sm font-semibold text-primary/80 uppercase tracking-wider mb-4">Beneficios</p>
              <div className="space-y-4">
                {features.map((feature, i) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <div key={i} className="flex items-start gap-3" data-testid={`feature-item-${i}`}>
                      <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FeatureIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-0.5">{feature.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DropdownSection>

            <DropdownSection
              title="¿Cómo funciona?"
              icon={Rocket}
              isOpen={howOpen}
              onToggle={() => setHowOpen(!howOpen)}
              testId="button-toggle-how"
            >
              <div className="space-y-5">
                {steps.map((step, i) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={i} className="flex items-start gap-3" data-testid={`step-item-${i}`}>
                      <div className="relative flex flex-col items-center">
                        <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                          <StepIcon className="w-5 h-5 text-primary-foreground" />
                        </div>
                        {i < steps.length - 1 && (
                          <div className="w-0.5 h-5 bg-primary/20 mt-1" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-primary/60 uppercase tracking-widest">Paso {step.number}</span>
                        <h4 className="text-sm font-bold mb-0.5">{step.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DropdownSection>
          </div>
        </FadeInSection>

        <FadeInSection delay={0.3}>
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-md p-8 border border-primary/10 text-center">
            <Sparkles className="w-8 h-8 text-accent mx-auto mb-3" />
            <h3 className="text-xl font-bold mb-2">¿Listo para empezar?</h3>
            <p className="text-muted-foreground mb-4">Comience definiendo su identidad de marca para que la IA pueda crear contenido a su medida.</p>
            <Link href="/brand">
              <Button data-testid="button-cta-brand" className="rounded-xl gap-2">
                <Palette className="w-4 h-4" />
                Ir a Identidad de Marca
              </Button>
            </Link>
          </div>
        </FadeInSection>
      </div>
    </Layout>
  );
}
