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
    { id: 'search', icon: SearchIcon, label: 'Search' },
    { id: 'library', icon: LibraryIcon, label: 'Library' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[80px] bg-surface-container/90 backdrop-blur-xl border-t border-outline/10 flex items-center justify-around px-4 z-50 pb-safe safe-area-bottom">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center gap-1 group relative flex-1 h-full pt-3 pb-4"
          >
            <div className={`relative px-5 py-1 rounded-full transition-colors duration-300 ${isActive ? 'bg-secondary-container' : 'bg-transparent'}`}>
              <Icon className={`w-6 h-6 transition-colors duration-300 ${isActive ? 'text-secondary-on-container' : 'text-surface-on-variant'}`} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`text-label-small transition-all duration-300 ${isActive ? 'text-secondary-on-container font-bold' : 'text-surface-on-variant font-medium'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
