import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

import Login from './pages/Login';
import Home from './pages/Home';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Conversations from './pages/Conversations';
import ConversationDetail from './pages/ConversationDetail';
import Knowledge from './pages/Knowledge';
import Introductions from './pages/Introductions';
import Applications from './pages/Applications';
import ApplicationDetail from './pages/ApplicationDetail';
import AddApplication from './pages/AddApplication';
import DealFlow from './pages/DealFlow';
import Portfolio from './pages/Portfolio';
import AddPortfolioCompany from './pages/AddPortfolioCompany';
import Investments from './pages/Investments';
import Funds from './pages/Funds';
import Documents from './pages/Documents';
import AddDocument from './pages/AddDocument';
import Discussions from './pages/Discussions';
import AddDiscussion from './pages/AddDiscussion';
import AddCompany from './pages/AddCompany';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Activities from './pages/Activities';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/new" element={<AddCompany />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/conversations/:id" element={<ConversationDetail />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/introductions" element={<Introductions />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/new" element={<AddApplication />} />
            <Route path="/applications/:id" element={<ApplicationDetail />} />
            <Route path="/deals" element={<DealFlow />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/portfolio/new" element={<AddPortfolioCompany />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/funds" element={<Funds />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/new" element={<AddDocument />} />
            <Route path="/discussions" element={<Discussions />} />
            <Route path="/discussions/new" element={<AddDiscussion />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
