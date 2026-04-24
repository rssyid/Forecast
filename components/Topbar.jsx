import { Search, Bell, User } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="h-20 flex items-center justify-between px-8 bg-transparent z-10 w-full relative">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400 group-focus-within:text-brand-orange transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Search dashboard..." 
            className="w-full pl-11 pr-4 py-3 bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:bg-white/90 shadow-sm transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6 ml-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Admin WM</span>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-orange to-amber-300 flex items-center justify-center shadow-md border-2 border-white">
            <User size={18} className="text-white" />
          </div>
        </div>
        
        <button className="relative w-10 h-10 bg-white/80 backdrop-blur-md border border-white rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm">
          <Bell size={18} className="text-gray-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
      </div>
    </header>
  );
}
