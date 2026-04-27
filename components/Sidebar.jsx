"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, BarChart2, Settings, ChevronLeft, ChevronDown, ChevronRight, Waves } from 'lucide-react';

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const pathname = usePathname();
  const [openSub, setOpenSub] = useState('piezometer');

  const menuItems = [
    { href: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { href: '/forecast', icon: <BarChart2 size={18} />, label: 'Forecast & AI' },
    { 
      id: 'piezometer',
      icon: <Waves size={18} />, 
      label: 'Piezometer',
      items: [
        { href: '/piezometer', label: 'Overview' },
        { href: '/analysis/comparison', label: 'Executive Dashboard' },
        { href: '/piezometer/comparison', label: 'Laporan Tabel' },
        { href: '/analysis/correlation', label: 'Analisis Korelasi' },
        { href: '/analysis/map', label: 'Peta Interaktif' }
      ]
    }, // GIS Integration Ready
    { 
      id: 'rainfall',
      icon: <CalendarDays size={18} />, 
      label: 'Curah Hujan',
      items: [
        { href: '/rainfall', label: 'Analisis' },
        { href: '/rainfall/daily', label: 'Laporan Harian' }
      ]
    },
    { href: '/settings', icon: <Settings size={18} />, label: 'Pengaturan' }
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
      
      <nav className="flex-1 space-y-1 px-3">
        {menuItems.map((item) => {
          if (item.items) {
            const isSubActive = item.items.some(sub => pathname === sub.href);
            return (
              <div key={item.label} className="space-y-1">
                <button
                  onClick={() => !isCollapsed && setOpenSub(openSub === item.id ? null : item.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-medium transition-all duration-200
                    ${isSubActive ? 'bg-gray-100/50 text-black' : 'text-gray-600 hover:bg-gray-100/80'}
                    ${isCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="shrink-0">{item.icon}</span>
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && (
                    openSub === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  )}
                </button>
                
                {!isCollapsed && openSub === item.id && (
                  <div className="ml-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {item.items.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={`block px-3 py-2 rounded-lg text-xs font-bold transition-all
                          ${pathname === sub.href ? 'text-black bg-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}
                        `}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link 
               key={item.label} 
               href={item.href} 
               className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-200 ${
                   isActive 
                       ? 'bg-black text-white shadow-md' 
                       : 'text-gray-600 hover:bg-gray-100/80'
               } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                  isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              }`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto px-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0' : 'opacity-100 h-auto'}`}>
        <div className="px-4 py-4 bg-linear-to-br from-blue-50 to-transparent rounded-2xl border border-blue-100">
          <p className="text-xs font-semibold text-gray-800 mb-1 whitespace-nowrap">Forecast Model Active</p>
          <p className="text-[10px] text-gray-500 whitespace-nowrap">Granular Estate-Based is running.</p>
        </div>
      </div>
    </aside>
  );
}
