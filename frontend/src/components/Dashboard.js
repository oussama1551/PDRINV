import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChartBarIcon, 
  ClipboardDocumentListIcon, 
  CubeIcon, 
  UsersIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// --- Utility Functions and Constants ---
const API_BASE_URL = 'http://localhost:8000/api/v1';
const getToken = () => localStorage.getItem('token');

const fetchData = async (endpoint) => {
  const token = getToken();
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Handle 401/403 specifically if needed, but a generic error is fine for now
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error(`Error fetching data from ${endpoint}:`, error);
    throw error;
  }
};
// --- End Utility Functions ---


const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSessions: 0,
    itemsCounted: 0,
    activeUsers: 0,
    pendingCounts: 0,
    varianceRate: 0,
    completedRounds: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Data fetching logic
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      
      try {
        // 1. Fetch Article Statistics
        const articleStats = await fetchData('/articles/statistics/summary');
        
        // 2. Fetch Sessions (to get total sessions)
        const sessions = await fetchData('/sessions/');
        
        // 3. Fetch Users (to get total users, used as a proxy for active users)
        const users = await fetchData('/users/');
        
        // 4. Fetch Variance Summary (Assuming a recent session ID, using 1 as a placeholder)
        // NOTE: This endpoint requires a session ID. We'll use the first session's ID if available.
        let varianceRate = 0;
        if (sessions && sessions.length > 0) {
            try {
                const latestSessionId = sessions[0].id;
                const varianceSummary = await fetchData(`/results/session/${latestSessionId}/variance-summary`);
                // Assuming varianceSummary returns a rate or a list from which a rate can be derived
                // For simplicity, we'll assume it returns a 'total_variance_rate' field.
                varianceRate = varianceSummary.total_variance_rate || 0;
            } catch (e) {
                console.warn("Could not fetch variance summary for latest session. Using 0%.", e);
            }
        }

        // Map all fetched data to dashboard stats
        setStats(prevStats => ({
          ...prevStats,
          itemsCounted: articleStats.total_articles || 0,
          totalSessions: sessions.length || 0,
          activeUsers: users.length || 0, // Using total users as a proxy for active users
          varianceRate: varianceRate,
          // pendingCounts and completedRounds remain 0 as there are no clear endpoints for them
        }));

        // 5. Fetch Recent Activity (Simulated for now, as there is no single 'activity log' endpoint)
        // In a real app, this would be a dedicated endpoint like /activity/recent
        setRecentActivity([
          { id: 1, action: 'Session created', user: 'Admin', time: '5 min ago', type: 'session' },
          { id: 2, action: 'Count submitted', user: 'Compteur_1', time: '12 min ago', type: 'count' },
          { id: 3, action: 'Results finalized', user: 'Admin', time: '1 hour ago', type: 'results' },
          { id: 4, action: 'SAP sync completed', user: 'System', time: '2 hours ago', type: 'sync' }
        ]);
        
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        // Optionally set an error state here
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, change, changeType = 'neutral', description }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">
            {isLoading ? '...' : value}
          </p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
          {change && (
            <p className={`text-xs font-medium mt-1 ${
              changeType === 'positive' ? 'text-green-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    </div>
  );

  const QuickAction = ({ title, description, icon: Icon, onClick, color = 'primary' }) => (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-lg border transition-all hover:shadow-md ${
        color === 'primary' 
          ? 'border-blue-200 bg-blue-50 hover:bg-blue-100' 
          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <Icon className={`h-8 w-8 mb-2 ${
        color === 'primary' ? 'text-blue-600' : 'text-gray-600'
      }`} />
      <h4 className="font-semibold text-gray-900">{title}</h4>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </button>
  );

  const getRoleBasedActions = () => {
    const baseActions = [
      {
        title: 'View Sessions',
        description: 'Browse all counting sessions',
        icon: ClipboardDocumentListIcon,
        action: () => navigate('/sessions')
      },
      {
        title: 'Manage Articles',
        description: 'View and edit inventory items',
        icon: CubeIcon,
        action: () => navigate('/articles')
      }
    ];

    if (user.role === 'admin') {
      return [
        ...baseActions,
        {
          title: 'Manage Users',
          description: 'Add or modify users',
          icon: UsersIcon,
          action: () => navigate('/users')
        },
        {
          title: 'Sync SAP Data',
          description: 'Manual SAP synchronization',
          icon: ArrowTrendingUpIcon,
          action: () => {
            // Implement SAP sync functionality
            console.log('Trigger SAP sync');
            // You can add API call here later
          }
        }
      ];
    }

    if (user.role?.startsWith('Compteur')) {
      const roundNumber = user.role.split('_')[1];
      return [
        ...baseActions,
        {
          title: `Submit Round ${roundNumber} Counts`,
          description: `Enter counting data for round ${roundNumber}`,
          icon: CubeIcon,
          action: () => navigate('/counting')
        },
        {
          title: 'My Progress',
          description: 'View your counting progress',
          icon: ChartBarIcon,
          action: () => navigate('/results')
        }
      ];
    }

    return baseActions;
  };

  const getActivityIcon = (type) => {
    const baseClasses = "w-2 h-2 mt-2 rounded-full";
    switch (type) {
      case 'session': return `${baseClasses} bg-blue-500`;
      case 'count': return `${baseClasses} bg-green-500`;
      case 'results': return `${baseClasses} bg-purple-500`;
      case 'sync': return `${baseClasses} bg-orange-500`;
      default: return `${baseClasses} bg-gray-500`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user.full_name || user.username}! 
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full capitalize">
                  {user.role?.replace('_', ' ') || 'User'}
                </span>
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <div className="text-sm text-gray-500">
                Last SAP sync: Today, 08:00 AM
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Sessions"
            value={stats.totalSessions}
            icon={ClipboardDocumentListIcon}
            description="Total counting sessions"
          />
          <StatCard
            title="Total Articles"
            value={stats.itemsCounted.toLocaleString()}
            icon={CubeIcon}
            description="Total items in inventory"
          />
          <StatCard
            title="Total Users"
            value={stats.activeUsers}
            icon={UsersIcon}
            description="Registered system users"
          />
          <StatCard
            title="Variance Rate"
            value={`${stats.varianceRate.toFixed(2)}%`}
            icon={ExclamationTriangleIcon}
            description="Latest session variance"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {getRoleBasedActions().map((action, index) => (
                  <QuickAction
                    key={index}
                    title={action.title}
                    description={action.description}
                    icon={action.icon}
                    onClick={action.action}
                    color={index < 2 ? 'primary' : 'default'}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={getActivityIcon(activity.type)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action}
                      </p>
                      <p className="text-xs text-gray-500">
                        by {activity.user} • {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Role-specific alerts */}
        {user.role?.startsWith('Compteur') && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CubeIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Counting Reminder
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    You have access to {user.role.replace('_', ' ')}. 
                    Please complete your counts before the session deadline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin-specific alerts */}
        {user.role === 'admin' && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Admin Overview
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    You have full system access. Monitor sessions, manage users, and review counting results.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;