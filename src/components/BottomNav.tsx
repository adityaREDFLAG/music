import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Search, Library, BarChart2 } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isVisible: boolean; // Control visibility when FullPlayer is open
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, isVisible }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'library', icon: Library, label: 'Library' },
    { id: 'stats', icon: BarChart2, label: 'Stats' },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
          className="fixed bottom-0 w-full z-40 h-[92px] pb-safe"
        >
          {/* Blur Background Layer */}
          <div className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-[32px] saturate-[180%] border-t border-white/5" />

          {/* Nav Items */}
          <div className="relative flex justify-around items-center h-full px-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex-1 h-full flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
                >
                  {/* Pill Indicator */}
                  <div className="relative h-9 w-[64px] flex items-center justify-center">
                    {isActive && (
                      <motion.div 
                        layoutId="nav-pill"
                        className="absolute inset-0 bg-primary rounded-full shadow-[0_4px_12px_rgba(var(--color-primary),0.4)]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <Icon
                      size={24}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-on-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`}
                    />
                  </div>
                  
                  {/* Label */}
                  <span
                    className={`text-[11px] font-bold tracking-tight transition-colors duration-200 ${
                      isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
};

export default BottomNav;
