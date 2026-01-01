import React from 'react';
import { motion } from 'framer-motion';
import BottomNav from './BottomNav';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  className = ""
}) => {
  return (
    <div className={`flex flex-col h-screen w-full bg-background text-on-background overflow-hidden relative ${className}`}>

      {/* Background Ambience */}
      <div className="fixed inset-0 -z-10 bg-background">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      <main className="flex-1 overflow-y-auto scrollbar-hide w-full max-w-[1200px] mx-auto px-4 pb-36 pt-4 md:px-8 relative z-0">
        {children}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30">
         <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};
