import { useState } from "react";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ScheduledEmail {
  id: number;
  date: string;
  idea: string;
  objective: string;
  templateId: string;
  scheduledDate: string;
}

const AVAILABLE_TEMPLATES = [
  { id: "1", name: "Promoción Simple" },
  { id: "2", name: "Newsletter Corporativo" },
  { id: "3", name: "Bienvenida al Cliente" },
];

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function CalendarView() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [emails, setEmails] = useState<ScheduledEmail[]>([
    { id: 1, date: "2026-03-15", idea: "Promoción de primavera", objective: "Aumentar ventas", templateId: "1", scheduledDate: "2026-03-15" },
    { id: 2, date: "2026-03-22", idea: "Newsletter semanal", objective: "Informar clientes", templateId: "2", scheduledDate: "2026-03-22" },
  ]);
  const [form, setForm] = useState({ idea: "", objective: "", templateId: "", scheduledDate: "" });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function openDay(day: number) {
    setSelectedDay(day);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setForm({ idea: "", objective: "", templateId: "", scheduledDate: dateStr });
    setShowDialog(true);
  }

  function getEmailsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return emails.filter(e => e.date === dateStr);
  }

  function handleGenerate() {
    if (!form.idea.trim()) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay!).padStart(2, "0")}`;
    const newEmail: ScheduledEmail = {
      id: Date.now(),
      date: dateStr,
      idea: form.idea,
      objective: form.objective,
      templateId: form.templateId,
      scheduledDate: form.scheduledDate || dateStr,
    };
    setEmails(prev => [...prev, newEmail]);
    setShowDialog(false);
    toast({ title: "Correo creado", description: "Se ha generado el contenido y enviado a Mis Correos." });
    setLocation("/emails");
  }

  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  for (let day = 1; day <= totalDays; day++) {
    const dayEmails = getEmailsForDay(day);
    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
    calendarCells.push(
      <motion.button
        key={day}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => openDay(day)}
        data-testid={`calendar-day-${day}`}
        className={`
          aspect-square rounded-xl border border-border p-1.5 flex flex-col items-start justify-start
          text-sm transition-all duration-200 relative
          ${isToday ? "bg-primary/10 border-primary/30 font-bold" : "bg-card hover:border-primary/30 hover:shadow-sm"}
        `}
      >
        <span className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>{day}</span>
        {dayEmails.length > 0 && (
          <div className="mt-auto w-full">
            {dayEmails.slice(0, 2).map((e) => (
              <div key={e.id} className="w-full bg-primary/15 text-primary text-[10px] font-medium rounded px-1 py-0.5 truncate mt-0.5">
                {e.idea}
              </div>
            ))}
            {dayEmails.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{dayEmails.length - 2} más</span>
            )}
          </div>
        )}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
          <Plus className="w-3 h-3 text-muted-foreground" />
        </div>
      </motion.button>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold">Calendario</h1>
          <p className="text-muted-foreground mt-1">Haga clic en un día para programar un nuevo correo.</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <Button data-testid="button-prev-month" variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold">{MONTHS[month]} {year}</h2>
            <Button data-testid="button-next-month" variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells}
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-5 h-5 text-primary" />
              Nuevo Correo — {selectedDay} de {MONTHS[month]} {year}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-3">
            <div className="space-y-2">
              <Label>Idea / Tema</Label>
              <Textarea
                data-testid="input-calendar-idea"
                placeholder="Ej: Promoción de verano con 30% de descuento en todo el catálogo"
                value={form.idea}
                onChange={e => setForm(f => ({ ...f, idea: e.target.value }))}
                className="rounded-xl min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Textarea
                data-testid="input-calendar-objective"
                placeholder="Ej: Aumentar ventas del catálogo nuevo, generar tráfico al sitio web"
                value={form.objective}
                onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                className="rounded-xl min-h-[70px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Plantilla</Label>
              <Select value={form.templateId} onValueChange={(v) => setForm(f => ({ ...f, templateId: v }))}>
                <SelectTrigger data-testid="select-calendar-template" className="rounded-xl">
                  <SelectValue placeholder="Seleccione una plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Elija una de sus plantillas guardadas para aplicar al correo.</p>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Programación</Label>
              <Input
                data-testid="input-calendar-date"
                type="date"
                value={form.scheduledDate}
                onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Seleccione en qué fecha desea que se envíe el correo.</p>
            </div>
            <Button
              data-testid="button-generate-email"
              onClick={handleGenerate}
              className="w-full rounded-xl gap-2"
              size="lg"
              disabled={!form.idea.trim()}
            >
              <Sparkles className="w-4 h-4" />
              Generar Correo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
