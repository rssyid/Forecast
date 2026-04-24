"use client";

import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main className={`${isCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300 relative z-10 flex flex-col min-h-screen`}>
        <Topbar />
        <div className="flex-1 p-8 pt-4">
          {children}
        </div>
      </main>
    </>
  );
}
