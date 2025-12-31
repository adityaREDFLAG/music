import React from 'react';
import { motion } from 'framer-motion';
import { Home as HomeIcon, Library as LibraryIcon, Search as SearchIcon } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'home', icon: HomeIcon, label: 'Home' },
    { id: 'library', icon: LibraryIcon, label: 'Library' },
    { id: 'search', icon: SearchIcon, label: 'Search' },
  ];

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

export default BottomNav;
