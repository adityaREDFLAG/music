
import React from 'react';
import { motion } from 'framer-motion';
import { Home, Library, Search } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  orientation?: 'bottom' | 'side'; // Adaptive navigation
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, orientation = 'bottom' }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'library', icon: Library, label: 'Library' },
    { id: 'search', icon: Search, label: 'Search' },
  ];

  if (orientation === 'side') {
    return (
      <nav className="fixed left-0 top-0 bottom-0 w-[100px] bg-white/90 backdrop-blur-3xl border-r border-black/[0.02] flex flex-col items-center justify-center gap-8 py-safe z-[60]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-2 group relative w-full h-20"
            >
              <div className="relative h-12 w-12 flex items-center justify-center rounded-full overflow-hidden">
                {isActive && (
                   <motion.div layoutId="nav-pill-side" className="absolute inset-0 bg-[#EADDFF]" transition={{ type: 'spring', damping: 20, stiffness: 200 }} />
                )}
                <Icon className={`w-6 h-6 relative z-10 transition-colors ${isActive ? 'text-[#21005D]' : 'text-[#49454F]'}`} strokeWidth={isActive ? 3 : 2} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? 'text-[#21005D]' : 'text-[#49454F] opacity-40'}`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[110px] bg-white/90 backdrop-blur-3xl border-t border-black/[0.02] flex items-center justify-around px-8 z-[60] pb-safe">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center gap-2 group relative w-1/4 h-full"
          >
            <div className="relative h-12 w-20 flex items-center justify-center">
              {isActive && (
                <motion.div layoutId="nav-pill" className="absolute inset-0 bg-[#EADDFF] rounded-[30px]" transition={{ type: 'spring', damping: 20, stiffness: 200 }} />
              )}
              <Icon className={`w-8 h-8 relative z-10 transition-colors ${isActive ? 'text-[#21005D]' : 'text-[#49454F]'}`} strokeWidth={isActive ? 3 : 2} />
            </div>
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? 'text-[#21005D]' : 'text-[#49454F] opacity-40'}`}>
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
};
