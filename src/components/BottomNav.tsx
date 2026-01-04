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
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          // Changed to fixed so it stays at bottom of viewport
          className="fixed bottom-0 w-full glass pb-safe pt-2 px-6 flex justify-around items-center z-40 h-[88px] border-t border-white/5"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center justify-center flex-1 h-full group"
              >
                {/* Active Indicator Background */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={`
                      relative z-10 px-6 py-1.5 rounded-full transition-all duration-300
                      ${isActive 
                        ? 'text-white' 
                        : 'text-white/40 group-hover:text-white/70'}
                    `}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="nav-pill"
                        className="absolute inset-0 bg-primary rounded-full -z-10"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  
                  <span
                    className={`text-[11px] mt-1 font-bold tracking-tight transition-colors duration-300 ${
                      isActive ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}
        </motion.nav>
      )}
    </AnimatePresence>
  );
};

export default BottomNav;
