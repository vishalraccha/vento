import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
  showBottomNav?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
  showBackButton?: boolean;
  className?: string;
}

export function AppLayout({
  children,
  title,
  showHeader = true,
  showBottomNav = true,
  showSearch = true,
  showNotifications = true,
  showBackButton = false,
  className,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {showHeader && (
        <Header 
          title={title} 
          showSearch={showSearch} 
          showNotifications={showNotifications}
          showBackButton={showBackButton}
        />
      )}
      
      <main 
        className={cn(
          "flex-1 overflow-y-auto",
          showBottomNav && "pb-20",
          className
        )}
      >
        {children}
      </main>
      
      {showBottomNav && <BottomNav />}
    </div>
  );
}