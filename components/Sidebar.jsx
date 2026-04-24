"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, BarChart2, Settings, ChevronLeft } from 'lucide-react';

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const pathname = usePathname();

  const links = [
    { href: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { href: '/forecast', icon: <BarChart2 size={20} />, label: 'Forecast & AI' },
    { href: '#', icon: <CalendarDays size={20} />, label: 'Curah Hujan' },
    { href: '#', icon: <Settings size={20} />, label: 'Pengaturan' }
  ];

  return (
    <aside className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } transition-[width] duration-300 ease-in-out will-change-[width] h-screen fixed left-0 top-0 bg-white/80 backdrop-blur-xl border-r border-white/50 flex flex-col pt-8 pb-6 z-20 overflow-hidden`}>
      <div className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'} mb-10 transition-all duration-300`}>
        <span className={`text-2xl font-bold tracking-tight text-gray-900 overflow-hidden transition-all duration-300 ${
            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}>WM</span>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
        >
          <ChevronLeft size={18} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>
      
      <nav className="flex-1 space-y-1.5 px-3">
        {links.map((link) => {
           const isActive = pathname === link.href;
           return (
             <Link 
                key={link.label} 
                href={link.href} 
                title={link.label} 
                className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                        ? 'bg-black text-white shadow-md' 
                        : 'text-gray-600 hover:bg-gray-100/80'
                } ${isCollapsed ? 'justify-center' : ''}`}
             >
               <span className="shrink-0">{link.icon}</span>
               <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                   isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
               }`}>{link.label}</span>
             </Link>
           );
        })}
      </nav>

      <div className={`mt-auto px-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0' : 'opacity-100 h-auto'}`}>
        <div className="px-4 py-4 bg-gradient-to-br from-brand-green/20 to-transparent rounded-2xl border border-brand-green/30">
          <p className="text-xs font-semibold text-gray-800 mb-1 whitespace-nowrap">Forecast Model Active</p>
          <p className="text-[10px] text-gray-500 whitespace-nowrap">Granular Estate-Based is running.</p>
        </div>
      </div>
    </aside>
  );
}
