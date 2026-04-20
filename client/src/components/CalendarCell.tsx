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
  isPast: boolean;
  campaigns: Campaign[];
  thumbnails: Record<number, string | null>;
  onDayClick: (day: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-500",
  cancelled: "bg-red-400",
  scheduled: "bg-blue-500",
  draft: "bg-gray-400",
};

const STATUS_BORDER: Record<string, string> = {
  sent: "border-l-emerald-500",
  cancelled: "border-l-red-400",
  scheduled: "border-l-blue-500",
  draft: "border-l-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Enviado",
  cancelled: "Cancelado",
  scheduled: "Programado",
  draft: "Borrador",
};

function CalendarCellInner({ day, isToday, isPast, campaigns, thumbnails, onDayClick }: CalendarCellProps) {
  const maxVisible = 2;
  const visibleCampaigns = campaigns.slice(0, maxVisible);
  const overflow = campaigns.length - maxVisible;

  return (
    <motion.button
      whileHover={isPast ? {} : { scale: 1.02 }}
      whileTap={isPast ? {} : { scale: 0.98 }}
      onClick={() => !isPast && onDayClick(day)}
      disabled={isPast}
      data-testid={`calendar-day-${day}`}
      className={`
        min-h-[80px] md:min-h-[110px] rounded-xl border border-border p-1.5 flex flex-col items-start justify-start
        text-sm transition-all duration-200 relative w-full
        ${isPast ? "bg-muted/30 cursor-not-allowed opacity-50" : isToday ? "bg-primary/10 border-primary/30 font-bold" : "bg-card hover:border-primary/30 hover:shadow-sm"}
      `}
    >
      <span className={`text-xs font-semibold ${isToday && !isPast ? "text-primary" : ""}`}>{day}</span>
      {campaigns.length > 0 && (
        <div className="mt-1 w-full flex flex-col gap-1 overflow-hidden flex-1">
          <TooltipProvider delayDuration={200}>
            {visibleCampaigns.map((c) => {
              const thumb = thumbnails[c.id];
              const hasImage = thumb && !thumb.includes("placehold.co");
              return (
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <div
                      data-testid={`calendar-campaign-${c.id}`}
                      className={`flex items-center gap-1 w-full min-w-0 cursor-pointer rounded-md border-l-2 ${STATUS_BORDER[c.status] || STATUS_BORDER.draft} bg-muted/40 px-1 py-0.5`}
                    >
                      {hasImage && (
                        <img
                          src={thumb}
                          alt=""
                          className="w-5 h-5 rounded object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      {!hasImage && (
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}
                        />
                      )}
                      <span className="text-[9px] md:text-[10px] leading-tight truncate text-left font-medium text-foreground/80">
                        {c.name || c.idea || "Sin título"}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[280px] p-2">
                    {hasImage && (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-20 rounded-md object-cover mb-1.5"
                      />
                    )}
                    <p className="font-semibold">{c.name || c.idea}</p>
                    <p className="text-muted-foreground">{STATUS_LABELS[c.status] || c.status}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
          {overflow > 0 && (
            <span className="text-[9px] text-muted-foreground font-medium pl-2">+{overflow} más</span>
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
    prev.isPast === next.isPast &&
    prev.thumbnails === next.thumbnails &&
    prev.campaigns.length === next.campaigns.length &&
    prev.campaigns.every((c, i) => c.id === next.campaigns[i]?.id && c.status === next.campaigns[i]?.status && c.name === next.campaigns[i]?.name)
  );
});
