import { ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
}

export function AnimatedCard({ children, className = "", delay = 0, onClick }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={onClick}
      className={`
        bg-card rounded-2xl p-6 border border-border/50
        shadow-sm hover:shadow-xl hover:border-border
        transition-all duration-300 cursor-pointer
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
