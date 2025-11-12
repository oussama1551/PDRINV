import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../logo.png';

const Navbar = ({ user, onLogout }) => {
  const location = useLocation();
  const [showMenu, setShowMenu] = React.useState(false);

  const isActive = (path) => location.pathname === path;

  const getRoleColor = (role) => {
    const colors = {
      'admin': 'bg-red-500',
      'compteur_1': 'bg-green-500',
      'compteur_2': 'bg-blue-500', 
      'compteur_3': 'bg-purple-500',
      'viewer': 'bg-gray-500'
    };
    return colors[role] || 'bg-gray-500';
  };

  return (
    <nav className="bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg fixed top-0 w-full z-50">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-0 justify-between items-stretch sm:items-center h-auto sm:h-16 py-2 sm:py-0">
          {/* Logo/Brand */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform overflow-hidden">
                <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
              </div>
              <div className="text-left">
                <h1 className="font-bold text-lg leading-tight">PDR Inventory</h1>
                <p className="text-primary-100 text-xs">Management System</p>
              </div>
            </Link>
            {/* Hamburger for mobile */}
            <button className="sm:hidden ml-2 p-2 focus:outline-none" onClick={() => setShowMenu(m => !m)}>
              <span className="block w-6 h-0.5 bg-primary-100 mb-1"></span>
              <span className="block w-6 h-0.5 bg-primary-100 mb-1"></span>
              <span className="block w-6 h-0.5 bg-primary-100"></span>
            </button>
          </div>

          {/* Navigation Links & User Info */}
          <div className={`flex-col sm:flex-row flex w-full sm:w-auto items-stretch sm:items-center justify-between sm:justify-end transition-all duration-200 ${showMenu ? 'flex' : 'hidden sm:flex'}`}>
            <div className="flex flex-col sm:flex-row gap-1 items-stretch sm:items-center w-full sm:w-auto">
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>📊 Dashboard</Link>
              <Link to="/counting" className={`nav-link ${isActive('/counting') ? 'active' : ''}`}>🔢 Counting</Link>
              <Link to="/sessions" className={`nav-link ${isActive('/sessions') ? 'active' : ''}`}>📋 Sessions</Link>
              <Link to="/results" className={`nav-link ${isActive('/results') ? 'active' : ''}`}>📈 Results</Link>
              {user.role === 'admin' && (
                <Link to="/users" className={`nav-link ${isActive('/users') ? 'active' : ''}`}>👥 Users</Link>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 border-t sm:border-t-0 sm:border-l border-primary-400 pt-2 sm:pt-0 pl-0 sm:pl-3 mt-2 sm:mt-0 ml-0 sm:ml-3 w-full sm:w-auto">
              <div className="text-right">
                <p className="text-sm font-medium">{user.full_name || user.username}</p>
                <span className={`${getRoleColor(user.role)} text-white px-2 py-1 rounded-full text-xs font-medium`}>
                  {user.role}
                </span>
              </div>
              <button 
                onClick={onLogout}
                className="bg-white text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md w-full sm:w-auto text-xs sm:text-base"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;