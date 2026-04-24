import './globals.css';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export const metadata = {
  title: 'Forecastly - Piezometer AI Dashboard',
  description: 'Premium AI Forecast Dashboard for Water Management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen relative overflow-x-hidden selection:bg-brand-green/30">
        
        {/* Soft Background Gradients */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-green/20 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
          <div className="absolute top-40 -left-40 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl opacity-40 mix-blend-multiply"></div>
        </div>

        <Sidebar />
        
        <main className="ml-64 relative z-10 flex flex-col min-h-screen">
          <Topbar />
          <div className="flex-1 p-8">
            {children}
          </div>
        </main>
        
      </body>
    </html>
  );
}
