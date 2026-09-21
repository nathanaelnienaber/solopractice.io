import { Outlet, NavLink } from 'react-router-dom';
import { useJobQueueStore } from '../stores/jobQueueStore';
import clsx from 'clsx';

const navItems = [
  { to: '/clients', label: 'Clients' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  const { pendingJobs } = useJobQueueStore();
  const activeJobs = pendingJobs.filter((j) => j.status !== 'completed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-primary-600">solopractice</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                Desktop
              </span>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    )
                  }
                >
                  {label}
                  {to === '/jobs' && activeJobs > 0 && (
                    <span className="ml-1.5 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {activeJobs}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-gray-500 text-center">
            All clinical data stored locally only. SOAP, diagnoses, CPT codes, recordings, and
            transcripts never leave this device.
          </p>
        </div>
      </footer>
    </div>
  );
}
