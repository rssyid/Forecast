import Link from 'next/link';
import { LayoutDashboard, CalendarDays, ListTodo, FileText, BarChart2, MessageSquare, StickyNote, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-white/80 backdrop-blur-xl border-r border-white/50 flex flex-col pt-8 pb-6 px-4 z-20">
      <div className="flex items-center px-4 mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Forecastly</h1>
      </div>
      
      <nav className="flex-1 space-y-2">
        <Link href="/" className="flex items-center gap-3 px-4 py-3 bg-black text-white rounded-xl font-medium transition-transform hover:scale-[1.02]">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        
        <Link href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100/80 rounded-xl font-medium transition-colors">
          <BarChart2 size={20} />
          <span>Data Piezometer</span>
        </Link>
        
        <Link href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100/80 rounded-xl font-medium transition-colors">
          <CalendarDays size={20} />
          <span>Curah Hujan</span>
        </Link>

        <Link href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100/80 rounded-xl font-medium transition-colors">
          <Settings size={20} />
          <span>Pengaturan</span>
        </Link>
      </nav>

      <div className="mt-auto">
        <div className="px-4 py-4 bg-gradient-to-br from-brand-green/20 to-transparent rounded-2xl border border-brand-green/30">
          <p className="text-xs font-semibold text-gray-800 mb-1">Forecast Model Active</p>
          <p className="text-[10px] text-gray-500">Granular Estate-Based is running automatically.</p>
        </div>
      </div>
    </aside>
  );
}
