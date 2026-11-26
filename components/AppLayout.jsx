"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuTriggerRef = useRef(null);

  const handleCloseMobile = () => {
    setMobileOpen(false);
    // Restore keyboard focus to the mobile trigger after drawer dismissal.
    requestAnimationFrame(() => {
      mobileMenuTriggerRef.current?.focus();
    });
  };

  return (
    <>
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={handleCloseMobile}
      />

      <div className="md:hidden sticky top-0 z-30 bg-white/95 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between print:hidden">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-gray-900 min-h-11 inline-flex items-center px-1"
        >
          WM Dashboard
        </Link>
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
          aria-label="Buka menu navigasi"
          className="inline-flex items-center gap-2 min-h-11 px-3.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <Menu size={18} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </div>

      <main
        className={`${isCollapsed ? 'md:ml-20' : 'md:ml-64'} ml-0 print:ml-0 transition-all duration-300 relative z-10 flex flex-col min-h-screen`}
      >
        <Topbar />
        <div className="flex-1 p-4 sm:p-6 lg:p-8 pt-4 print:p-0">
          {children}
        </div>
      </main>
    </>
  );
}
