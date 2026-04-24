import './globals.css';
import AppLayout from '../components/AppLayout';

export const metadata = {
  title: 'WM - Water Management Dashboard',
  description: 'Dashboard Monitoring Piezometer & Curah Hujan',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen relative overflow-x-hidden selection:bg-brand-green/30" suppressHydrationWarning>
        
        {/* Soft Background Gradients */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-green/20 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
          <div className="absolute top-40 -left-40 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl opacity-40 mix-blend-multiply"></div>
        </div>

        <AppLayout>
          {children}
        </AppLayout>
        
      </body>
    </html>
  );
}
