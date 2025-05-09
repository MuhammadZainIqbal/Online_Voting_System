import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on app startup
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      const storedToken = localStorage.getItem('token');
      const storedRole = localStorage.getItem('role');
      
      if (storedToken && storedRole) {
        // Only try to validate if we're not in a fresh session
        const freshSession = sessionStorage.getItem('freshSession') !== 'false';
        
        if (freshSession) {
          // This is a fresh session (app restart), so clear authentication
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          setToken(null);
          setRole(null);
          setIsAuthenticated(false);
          setUser(null);
          // Mark that we've handled the fresh session
          sessionStorage.setItem('freshSession', 'false');
        } else {
          // Not a fresh session, validate normally
          setToken(storedToken);
          setRole(storedRole);
          
          try {
            // Validate token with the server
            const config = {
              headers: { Authorization: `Bearer ${storedToken}` }
            };
            
            // Different endpoints for admin and voter validation
            const endpoint = storedRole === 'admin' 
              ? 'http://localhost:5000/api/auth/admin/validate'
              : 'http://localhost:5000/api/auth/voter/validate';
              
            const response = await axios.get(endpoint, config);
            
            if (response.data.user) {
              setUser(response.data.user);
              setIsAuthenticated(true);
            } else {
              // Clear invalid auth state
              localStorage.removeItem('token');
              localStorage.removeItem('role');
              setToken(null);
              setRole(null);
              setIsAuthenticated(false);
              setUser(null);
            }
          } catch (error) {
            console.error('Token validation error:', error);
            // Clear invalid token
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            setToken(null);
            setRole(null);
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } else {
        // No token found, ensure auth state is cleared
        setToken(null);
        setRole(null);
        setIsAuthenticated(false);
        setUser(null);
        // Mark that we're not in a fresh session anymore
        sessionStorage.setItem('freshSession', 'false');
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Login voter
  const loginVoter = async (cnic, password, privateKey) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('http://localhost:5000/api/auth/voter/login', {
        cnic,
        password,
        privateKey
      });
      
      const { token: authToken, user: voter } = response.data;
      
      // Store token and role in localStorage
      localStorage.setItem('token', authToken);
      localStorage.setItem('role', 'voter');
      
      // Mark that this is not a fresh session anymore
      sessionStorage.setItem('freshSession', 'false');
      
      // Update state
      setToken(authToken);
      setRole('voter');
      setUser(voter);
      setIsAuthenticated(true);
      setLoading(false);
      
      return true;
    } catch (error) {
      console.error('Voter login error:', error);
      setError(error.response?.data?.message || 'Login failed. Please check your credentials.');
      setLoading(false);
      return false;
    }
  };

  // Login admin
  const loginAdmin = async (cnic, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('http://localhost:5000/api/auth/admin/login', {
        cnic,
        password
      });
      
      // Server returns { token, user: { cnic, email } }
      const { token: authToken, user: admin } = response.data;
      
      // Store token and role in localStorage
      localStorage.setItem('token', authToken);
      localStorage.setItem('role', 'admin');
      
      // Mark that this is not a fresh session anymore
      sessionStorage.setItem('freshSession', 'false');
      
      // Update state
      setToken(authToken);
      setRole('admin');
      setUser(admin);
      setIsAuthenticated(true);
      setLoading(false);
      
      return true;
    } catch (error) {
      console.error('Admin login error:', error);
      
      // Log more detailed error info
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      
      setError(error.response?.data?.message || 'Login failed. Please check your credentials.');
      setLoading(false);
      return false;
    }
  };

  // Logout
  const logout = () => {
    // Remove token from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    
    // Clear any sensitive session data
    sessionStorage.clear();
    
    // Update state
    setToken(null);
    setRole(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  // Verify token is still valid (use this when sensitive operations are performed)
  const verifyToken = async () => {
    if (!token || !role) {
      return false;
    }
    
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const endpoint = role === 'admin' 
        ? 'http://localhost:5000/api/auth/admin/validate'
        : 'http://localhost:5000/api/auth/voter/validate';
        
      const response = await axios.get(endpoint, config);
      return !!response.data.user;
    } catch (error) {
      console.error('Token verification failed:', error);
      // If verification fails, logout user
      logout();
      return false;
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        role,
        loading,
        error,
        loginVoter,
        loginAdmin,
        logout,
        verifyToken,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};