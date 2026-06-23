import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

// Redirects to /login if not authenticated
function ProtectedLayout() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

import Login from './pages/Login';
import Callback from './pages/Callback';
import PortalCallback from './pages/PortalCallback';
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
import EditApplication from './pages/EditApplication';
import Portfolio from './pages/Portfolio';
import AddPortfolioCompany from './pages/AddPortfolioCompany';
import PortfolioCompanyDetail from './pages/PortfolioCompanyDetail';
import EditPortfolioCompany from './pages/EditPortfolioCompany';
import Funds from './pages/Funds';
import Documents from './pages/Documents';
import AddDocument from './pages/AddDocument';
import Discussions from './pages/Discussions';
import AddDiscussion from './pages/AddDiscussion';
import AddCompany from './pages/AddCompany';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Settings from './pages/Settings';
import Activities from './pages/Activities';
import AddActivity from './pages/AddActivity';
import ActivityDetail from './pages/ActivityDetail';
import EditActivity from './pages/EditActivity';
import FounderCompany from './pages/FounderCompany';
import Notifications from './pages/Notifications';
import FounderApplicationForm from './pages/FounderApplicationForm';
import FounderApplicationTracker from './pages/FounderApplicationTracker';
import InvestorApplications from './pages/InvestorApplications';
import Founders from './pages/Founders';
import FounderDetail from './pages/FounderDetail';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/portal/callback" element={<PortalCallback />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/activities/new" element={<AddActivity />} />
            <Route path="/activities/:id" element={<ActivityDetail />} />
            <Route path="/activities/:id/edit" element={<EditActivity />} />
            <Route path="/company" element={<FounderCompany />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/new" element={<AddCompany />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/conversations/:id" element={<ConversationDetail />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/introductions" element={<Introductions />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/apply" element={<FounderApplicationForm />} />
            <Route path="/applications/track" element={<FounderApplicationTracker />} />
            <Route path="/applications/review" element={<InvestorApplications />} />
            <Route path="/applications/new" element={<AddApplication />} />
            <Route path="/applications/:id" element={<ApplicationDetail />} />
            <Route path="/applications/:id/edit" element={<EditApplication />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/portfolio/new" element={<AddPortfolioCompany />} />
            <Route path="/portfolio/:id" element={<PortfolioCompanyDetail />} />
            <Route path="/portfolio/:id/edit" element={<EditPortfolioCompany />} />
            <Route path="/founders" element={<Founders />} />
            <Route path="/founders/:id" element={<FounderDetail />} />
            <Route path="/funds" element={<Funds />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/new" element={<AddDocument />} />
            <Route path="/discussions" element={<Discussions />} />
            <Route path="/discussions/new" element={<AddDiscussion />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
