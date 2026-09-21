import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { SessionPage } from './pages/SessionPage';
import { SOAPEditorPage } from './pages/SOAPEditorPage';
import { JobQueuePage } from './pages/JobQueuePage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/clients" replace />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:clientId" element={<ClientDetailPage />} />
          <Route path="sessions/:sessionId" element={<SessionPage />} />
          <Route path="sessions/:sessionId/soap" element={<SOAPEditorPage />} />
          <Route path="jobs" element={<JobQueuePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
