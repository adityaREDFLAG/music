
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation } from '../Navigation/Navigation';
import { config } from '../../utils/config';
import { Plus } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  trackCount: number;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  themeColor: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  trackCount,
  onFileUpload,
  themeColor
}) => {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => setIsLandscape(window.innerWidth > 768); // Simple breakpoint for iPad landscape
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  return (
    <div className={`flex h-screen overflow-hidden bg-[#FEF7FF] text-[#1C1B1F] safe-area-top safe-area-bottom ${isLandscape ? 'flex-row' : 'flex-col'}`}>
       <div className="fixed inset-0 -z-10 opacity-[0.12] transition-colors duration-[1500ms]" style={{ background: `radial-gradient(circle at 50% 10%, ${themeColor}, transparent 80%)` }} />

      {isLandscape && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} orientation="side" />
      )}

      <div className={`flex-1 flex flex-col h-full overflow-hidden ${isLandscape ? 'pl-[100px]' : ''}`}>
        <header className="px-10 pt-16 pb-6 flex justify-between items-end bg-gradient-to-b from-white/40 to-transparent flex-shrink-0 z-50">
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h1 className="text-6xl font-black tracking-tighter mb-1 leading-none">
              {activeTab === 'home' ? config.name.split(' - ')[0] : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h1>
            <p className="text-xl font-bold opacity-30 tracking-tight">{trackCount} tracks synced locally</p>
          </motion.div>

          <label className="h-20 w-20 rounded-[38px] bg-[#EADDFF] text-[#21005D] flex items-center justify-center cursor-pointer shadow-[0_12px_40px_rgba(103,80,164,0.2)] active:scale-90 transition-all hover:bg-[#D1C4E9]">
            <Plus className="w-10 h-10" strokeWidth={3} />
            <input type="file" multiple accept="audio/*,.zip" onChange={onFileUpload} className="hidden" />
          </label>
        </header>

        <main className={`flex-1 overflow-y-auto px-10 scrollbar-hide scroll-smooth ${isLandscape ? 'pb-10' : 'pb-48'}`}>
          {children}
        </main>

        {!isLandscape && (
          <Navigation activeTab={activeTab} setActiveTab={setActiveTab} orientation="bottom" />
        )}
      </div>
    </div>
  );
};
