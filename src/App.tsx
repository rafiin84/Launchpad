import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

import Home from './pages/Home';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Conversations from './pages/Conversations';
import ConversationDetail from './pages/ConversationDetail';
import Knowledge from './pages/Knowledge';
import Introductions from './pages/Introductions';
import Applications from './pages/Applications';
import DealFlow from './pages/DealFlow';
import Portfolio from './pages/Portfolio';
import Investments from './pages/Investments';
import Funds from './pages/Funds';
import Documents from './pages/Documents';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/conversations/:id" element={<ConversationDetail />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/introductions" element={<Introductions />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/deals" element={<DealFlow />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/funds" element={<Funds />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
