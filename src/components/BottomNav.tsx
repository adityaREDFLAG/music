import React from 'react';
import { motion } from 'framer-motion';
import { Home, Search, Library } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'library', icon: Library, label: 'Library' },
  ];

  return (
    <nav className="glass absolute bottom-0 w-full pb-safe pt-2 px-6 flex justify-around items-center z-50 h-[88px]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1"
          >
            <div
              className={`
                px-5 py-1.5 rounded-full transition-all duration-300 ease-spring
                ${isActive ? 'bg-primary text-primary-on-container' : 'text-outline hover:text-on-surface'}
              `}
            >
              <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span
              className={`text-xs font-medium tracking-wide transition-colors duration-300 ${
                isActive ? 'text-on-surface' : 'text-outline'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
