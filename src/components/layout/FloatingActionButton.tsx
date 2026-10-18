import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick?: () => void;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  className?: string;
  label?: string;
}

export function FloatingActionButton({ 
  onClick, 
  icon = <Plus className="h-6 w-6" />,
  className,
  label = "Create new"
}: FloatingActionButtonProps) {
  const renderedIcon = React.isValidElement(icon)
    ? icon
    : typeof icon === 'function'
    ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: "h-6 w-6" })
    : <Plus className="h-6 w-6" />;

  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        "fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        "transition-transform hover:scale-105 active:scale-95",
        className
      )}
    >
      {renderedIcon}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
