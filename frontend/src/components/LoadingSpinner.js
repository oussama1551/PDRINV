import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-50 to-gray-100">
      <div className="text-center fade-in">
        <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary-200 border-t-primary-500 mx-auto mb-6 loading-spinner"></div>
        <div className="bg-primary-500 w-12 h-1 rounded-full mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">PDR Inventory System</h2>
        <p className="text-gray-600">Loading your dashboard...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;