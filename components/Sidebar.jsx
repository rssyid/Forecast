"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Waves,
  X,
} from 'lucide-react';

export default function Sidebar({
  isCollapsed = false,
  setIsCollapsed = () => {},
  mobileOpen = false,
  onCloseMobile = () => {},
}) {
  const pathname = usePathname();
  const [openSub, setOpenSub] = useState('piezometer');
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const menuGroups = [
    {
      group: 'Ringkasan',
      items: [
        { href: '/overview', icon: <Activity size={18} aria-hidden="true" />, label: 'Command Center' },
        { href: '/', icon: <LayoutDashboard size={18} aria-hidden="true" />, label: 'Dashboard' },
      ],
    },
    {
      group: 'Prediksi',
      items: [
        {
          id: 'forecast',
          icon: <BarChart2 size={18} aria-hidden="true" />,
          label: 'Forecast & AI',
          items: [
            { href: '/forecast', label: 'Dashboard Forecast' },
            { href: '/forecast/multi-company', label: 'Komparasi Multi-PT' },
            { href: '/forecast/ecmwf', label: 'ECMWF AIFS Map' },
          ],
        },
      ],
    },
    {
      group: 'Monitoring',
      items: [
        {
          id: 'piezometer',
          icon: <Waves size={18} aria-hidden="true" />,
          label: 'Piezometer',
          items: [
            { href: '/piezometer', label: 'Overview' },
            { href: '/analysis/comparison', label: 'Executive Dashboard' },
            { href: '/analysis/weekly-report', label: 'Laporan Mingguan' },
            { href: '/analysis/daily', label: 'Laporan Harian (PZO)' },
            { href: '/piezometer/comparison', label: 'Laporan Tabel' },
            { href: '/analysis/correlation', label: 'Analisis Korelasi' },
            { href: '/analysis/map', label: 'Peta Interaktif' },
          ],
        },
        { href: '/accuracy', icon: <ShieldCheck size={18} aria-hidden="true" />, label: 'Akurasi IoT' },
        {
          id: 'rainfall',
          icon: <CalendarDays size={18} aria-hidden="true" />,
          label: 'Curah Hujan',
          items: [
            { href: '/rainfall', label: 'Analisis' },
            { href: '/rainfall/daily', label: 'Laporan Harian' },
          ],
        },
      ],
    },
    {
      group: 'Sistem',
      items: [
        { href: '/settings', icon: <Settings size={18} aria-hidden="true" />, label: 'Pengaturan' },
      ],
    },
  ];

  const renderNavItems = (compactDesktop, onNavigate) => (
    <nav aria-label="Navigasi utama" className="flex-1 space-y-4 px-3 overflow-y-auto">
      {menuGroups.map((section, groupIndex) => (
        <div key={section.group} className="space-y-1">
          {!compactDesktop ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {section.group}
            </p>
          ) : groupIndex > 0 ? (
            <div className="my-2 border-t border-gray-200" aria-hidden="true" />
          ) : null}

          {section.items.map((item) => {
            if (item.items) {
              const isSubActive = item.items.some((sub) => pathname === sub.href);
              const isExpanded = !compactDesktop && openSub === item.id;
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={compactDesktop ? item.label : undefined}
                    title={compactDesktop ? item.label : undefined}
                    onClick={() => {
                      if (compactDesktop) {
                        setIsCollapsed(false);
                        setOpenSub(item.id);
                        return;
                      }
                      setOpenSub(openSub === item.id ? null : item.id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl text-sm font-medium transition-colors
                      ${
                        compactDesktop && isSubActive
                          ? 'bg-black text-white'
                          : isSubActive
                            ? 'bg-gray-100 text-gray-900 font-semibold border border-gray-200'
                            : 'text-gray-700 hover:bg-gray-100'
                      }
                      ${compactDesktop ? 'justify-center' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="shrink-0">{item.icon}</span>
                      {!compactDesktop && <span>{item.label}</span>}
                    </div>
                    {!compactDesktop &&
                      (isExpanded ? (
                        <ChevronDown size={14} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={14} aria-hidden="true" />
                      ))}
                  </button>

                  {isExpanded && (
                    <div className="ml-5 pl-3 border-l border-gray-200 space-y-1">
                      {item.items.map((sub) => {
                        const subActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={onNavigate}
                            aria-current={subActive ? 'page' : undefined}
                            className={`flex items-center min-h-10 px-3 py-2 rounded-lg text-xs font-semibold transition-colors
                              ${
                                subActive
                                  ? 'bg-black text-white'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                              }
                            `}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                aria-label={compactDesktop ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                title={compactDesktop ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                } ${compactDesktop ? 'justify-center' : ''}`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                    compactDesktop ? 'w-0 opacity-0' : 'w-auto opacity-100'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside
        className={`hidden md:flex ${
          isCollapsed ? 'w-20' : 'w-64'
        } transition-[width] duration-200 ease-in-out will-change-[width] h-screen fixed left-0 top-0 bg-white border-r border-gray-200 flex-col pt-6 pb-5 z-20 overflow-hidden print:hidden`}
      >
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center px-0' : 'justify-between px-6'
          } mb-6 transition-all duration-200`}
        >
          <span
            className={`text-xl font-bold tracking-tight text-gray-900 overflow-hidden transition-all duration-200 ${
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            WM Dashboard
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            aria-expanded={!isCollapsed}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-700 transition-colors shrink-0"
          >
            <ChevronLeft
              size={18}
              aria-hidden="true"
              className={`transition-transform duration-200 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
            />
          </button>
        </div>

        {renderNavItems(isCollapsed, undefined)}

        <div
          className={`mt-auto px-3 pt-4 overflow-hidden transition-all duration-200 ${
            isCollapsed ? 'opacity-0 h-0 pt-0' : 'opacity-100 h-auto'
          }`}
        >
          <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-900 mb-0.5 whitespace-nowrap">
              Model Forecast Aktif
            </p>
            <p className="text-[11px] text-gray-600 whitespace-nowrap">
              Granular Estate-Based siap digunakan.
            </p>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex print:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            aria-hidden="true"
            onClick={onCloseMobile}
          />
          <aside
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
            className="relative z-10 w-72 max-w-[85vw] h-full bg-white border-r border-gray-200 flex flex-col pt-5 pb-6 shadow-xl"
          >
            <div className="flex items-center justify-between px-5 mb-6">
              <span className="text-xl font-bold tracking-tight text-gray-900">
                WM Dashboard
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onCloseMobile}
                aria-label="Tutup menu navigasi"
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {renderNavItems(false, onCloseMobile)}
          </aside>
        </div>
      )}
    </>
  );
}
