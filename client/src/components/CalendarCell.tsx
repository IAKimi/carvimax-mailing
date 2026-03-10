import { memo } from "react";
import { motion } from "framer-motion";
import type { Campaign } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalendarCellProps {
  day: number;
  isToday: boolean;
  campaigns: Campaign[];
  onDayClick: (day: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-500",
  cancelled: "bg-red-400",
  scheduled: "bg-blue-500",
  draft: "bg-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Enviado",
  cancelled: "Cancelado",
  scheduled: "Programado",
  draft: "Borrador",
};

function CalendarCellInner({ day, isToday, campaigns, onDayClick }: CalendarCellProps) {
  const maxDots = 3;
  const visibleCampaigns = campaigns.slice(0, maxDots);
  const overflow = campaigns.length - maxDots;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onDayClick(day)}
      data-testid={`calendar-day-${day}`}
      className={`
        aspect-square rounded-xl border border-border p-1.5 flex flex-col items-start justify-start
        text-sm transition-all duration-200 relative
        ${isToday ? "bg-primary/10 border-primary/30 font-bold" : "bg-card hover:border-primary/30 hover:shadow-sm"}
      `}
    >
      <span className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>{day}</span>
      {campaigns.length > 0 && (
        <div className="mt-auto w-full flex items-center gap-1 flex-wrap">
          <TooltipProvider delayDuration={200}>
            {visibleCampaigns.map((c) => (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <span
                    data-testid={`calendar-campaign-${c.id}`}
                    className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 cursor-pointer ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                  <p className="font-semibold truncate">{c.idea || c.name}</p>
                  <p className="text-muted-foreground">{STATUS_LABELS[c.status] || c.status}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
          {overflow > 0 && (
            <span className="text-[9px] text-muted-foreground font-medium">+{overflow}</span>
          )}
        </div>
      )}
    </motion.button>
  );
}

export const CalendarCell = memo(CalendarCellInner, (prev, next) => {
  return (
    prev.day === next.day &&
    prev.isToday === next.isToday &&
    prev.campaigns.length === next.campaigns.length &&
    prev.campaigns.every((c, i) => c.id === next.campaigns[i]?.id && c.status === next.campaigns[i]?.status)
  );
});
