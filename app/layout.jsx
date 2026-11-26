import './globals.css';
import AppLayout from '../components/AppLayout';

export const metadata = {
  title: 'WM - Water Management Dashboard',
  description: 'Dashboard Monitoring Piezometer & Curah Hujan',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased min-h-screen relative overflow-x-hidden selection:bg-brand-orange/20" suppressHydrationWarning>
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
