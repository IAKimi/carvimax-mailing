import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Sparkles, Image, CalendarDays, Send, Palette, PenTool, LayoutTemplate, Rocket } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

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

export default function Home() {
  const userName = localStorage.getItem("postIAlo_user") || "Usuario";

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card rounded-2xl border border-border p-6 shadow-sm"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </FadeInSection>

        <FadeInSection delay={0.2}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold mb-2">¿Cómo funciona?</h2>
            <p className="text-muted-foreground">Siga estos pasos para crear sus campañas de email</p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-12 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-0.5 bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <FadeInSection key={i} delay={0.1 * i}>
                    <div className="flex flex-col items-center text-center">
                      <div className="relative z-10 w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
                        <Icon className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <span className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-1">Paso {step.number}</span>
                      <h3 className="font-bold mb-2">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </FadeInSection>
                );
              })}
            </div>
          </div>
        </FadeInSection>

        <FadeInSection delay={0.3}>
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 border border-primary/10 text-center">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
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
