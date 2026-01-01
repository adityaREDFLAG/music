import React from 'react';
import { motion } from 'framer-motion';
import BottomNav from './BottomNav';
import { BackgroundAmbience } from './BackgroundAmbience';
import { Track } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentTrack?: Track | null;
  className?: string;
  isVisible?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  currentTrack,
  className = "",
  isVisible = true
}) => {
  return (
    <div className={`flex flex-col h-screen w-full bg-background text-on-background overflow-hidden relative ${className}`}>

      <BackgroundAmbience coverArt={currentTrack?.coverArt} />

      <main className="flex-1 overflow-y-auto scrollbar-hide w-full max-w-[1200px] mx-auto px-4 pb-36 pt-4 md:px-8 relative z-0">
        {children}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30">
         <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} isVisible={isVisible} />
      </div>
    </div>
  );
};
