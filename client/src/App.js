import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './styles/theme.css';  // Import our custom theme

// Context
import { AuthProvider, AuthContext } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import VoterLogin from './pages/voter/Login';
import VoterDashboard from './pages/voter/Dashboard';
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import RegisterVoter from './pages/admin/RegisterVoter';
import ManageElections from './pages/admin/ManageElections';
import ManageCandidates from './pages/admin/ManageCandidates';
import ForgotPassword from './pages/voter/ForgotPassword';
import VerifyOTP from './pages/voter/VerifyOTP';
import ResetPassword from './pages/voter/ResetPassword';
import VoterChangePassword from './pages/voter/ChangePassword';
import AdminChangePassword from './pages/admin/ChangePassword';

// Private route wrapper
const PrivateRouteWrapper = ({ children, requiredRole }) => {
  const { isAuthenticated, role, loading } = useContext(AuthContext);
  const location = useLocation();
  
  // Show loading indicator while checking authentication
  if (loading) {
    return <div className="text-center py-5"><span className="spinner-border text-primary" role="status"></span></div>;
  }
  
  // If not authenticated or wrong role, redirect
  if (!isAuthenticated || role !== requiredRole) {
    // Determine where to redirect
    const redirectPath = requiredRole === 'voter' ? '/voter/login' : 
                         requiredRole === 'admin' ? '/admin/login' : '/';
                         
    // Redirect with the intended location
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }
  
  // Render the children (protected component)
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="d-flex flex-column min-vh-100">
          <Navbar />
          <main className="flex-grow-1 py-4">
            <Container>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/voter/login" element={<VoterLogin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/voter/forgot-password" element={<ForgotPassword />} />
                <Route path="/voter/reset-password/verify-otp" element={<VerifyOTP />} />
                <Route path="/voter/reset-password/new-password" element={<ResetPassword />} />
                
                {/* Voter Routes */}
                <Route path="/voter/dashboard" element={
                  <PrivateRouteWrapper requiredRole="voter">
                    <VoterDashboard />
                  </PrivateRouteWrapper>
                } />
                <Route path="/voter/change-password" element={
                  <PrivateRouteWrapper requiredRole="voter">
                    <VoterChangePassword />
                  </PrivateRouteWrapper>
                } />
                
                {/* Admin Routes */}
                <Route path="/admin/dashboard" element={
                  <PrivateRouteWrapper requiredRole="admin">
                    <AdminDashboard />
                  </PrivateRouteWrapper>
                } />
                <Route path="/admin/register-voter" element={
                  <PrivateRouteWrapper requiredRole="admin">
                    <RegisterVoter />
                  </PrivateRouteWrapper>
                } />
                <Route path="/admin/manage-elections" element={
                  <PrivateRouteWrapper requiredRole="admin">
                    <ManageElections />
                  </PrivateRouteWrapper>
                } />
                <Route path="/admin/manage-candidates" element={
                  <PrivateRouteWrapper requiredRole="admin">
                    <ManageCandidates />
                  </PrivateRouteWrapper>
                } />
                <Route path="/admin/change-password" element={
                  <PrivateRouteWrapper requiredRole="admin">
                    <AdminChangePassword />
                  </PrivateRouteWrapper>
                } />
                
                {/* Catch-all route for 404 */}
                <Route path="*" element={<h1 className="text-center">Page Not Found</h1>} />
              </Routes>
            </Container>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
