import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CountingInterface from './components/CountingInterface';
import Sessions from './components/Sessions';
import Results from './components/Results';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';
import UserManagement from './components/UserManagement';
// Add this import with your other component imports
import ArticlesList from './components/ArticlesList';


// API base URL
const API_BASE_URL = 'http://localhost:8000/api/v1';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get(`${API_BASE_URL}/users/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

const login = async (username, password) => {
  try {
    setError('');
    // FIXED: Remove /users from the endpoint
    const response = await axios.post(`${API_BASE_URL}/login`, {
      username,
      password
    });

    const { access_token, user: userData } = response.data;
    
    console.log('Access Token:', access_token);
    localStorage.setItem('token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setUser(userData);

    return { success: true };
  } catch (error) {
    const message = error.response?.data?.detail || 'Login failed';
    setError(message);
    return { success: false, message };
  }
};

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setError('');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="App min-h-screen bg-gray-50">
        {user && <Navbar user={user} onLogout={logout} />}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mx-4 mt-4 slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
              <button 
                onClick={() => setError('')}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <main className={user ? 'pt-16' : ''}>
          <Routes>
            <Route 
              path="/login" 
              element={
                user ? <Navigate to="/dashboard" replace /> : <Login onLogin={login} />
              } 
            />
            
            <Route 
              path="/dashboard" 
              element={
                user ? <Dashboard user={user} /> : <Navigate to="/login" replace />
              } 
            />
            
            <Route 
              path="/counting" 
              element={
                user ? <CountingInterface user={user} /> : <Navigate to="/login" replace />
              } 
            />
            
            <Route 
              path="/sessions" 
              element={
                user ? <Sessions user={user} /> : <Navigate to="/login" replace />
              } 
            />
            
            <Route 
              path="/results" 
              element={
                user ? <Results user={user} /> : <Navigate to="/login" replace />
              } 
            />

            <Route 
              path="/" 
              element={
                <Navigate to={user ? '/dashboard' : '/login'} replace />
              } 
            />
            <Route 
              path="/users" 
              element={
                user ? <UserManagement user={user} /> : <Navigate to="/login" replace />
              } 
            />
            <Route 
              path="/articles" 
              element={
                user ? <ArticlesList user={user} /> : <Navigate to="/login" replace />
              } 
            />
            <Route 
              path="*" 
              element={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="text-center fade-in">
                    <div className="bg-primary-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="text-4xl">🔍</span>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
                    <p className="text-xl text-gray-600 mb-6">Page not found</p>
                    <button 
                      onClick={() => window.history.back()}
                      className="btn-primary"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;