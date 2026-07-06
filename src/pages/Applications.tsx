import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InvestorApplications from './InvestorApplications';

export default function Applications() {
  const { isFounder } = useAuth();

  if (isFounder) return <Navigate to="/applications/track" replace />;

  return <InvestorApplications />;
}
