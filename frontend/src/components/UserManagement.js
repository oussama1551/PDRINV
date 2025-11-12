import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserManagement = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    role: 'compteur_1',
    password: '',
    is_active: true
  });

  // Add filter state for inactive users
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  // Add notification state
  const [notification, setNotification] = useState(null);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:8000/api/v1/users/');
      setUsers(response.data);
    } catch (error) {
      setError('Failed to fetch users: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  // Auto-dismiss notification after 2 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Create new user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/api/v1/users/', formData);
      setShowCreateForm(false);
      setFormData({
        username: '',
        full_name: '',
        role: 'compteur_1',
        password: '',
        is_active: true
      });
      fetchUsers();
      setError('');
      setNotification({ type: 'success', message: 'User created successfully!' });
    } catch (error) {
      setError('Failed to create user: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Update user
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:8000/api/v1/users/${editingUser.id}`, formData);
      setEditingUser(null);
      setFormData({
        username: '',
        full_name: '',
        role: 'compteur_1',
        password: '',
        is_active: true
      });
      fetchUsers();
      setError('');
      setNotification({ type: 'success', message: 'User updated successfully!' });
    } catch (error) {
      setError('Failed to update user: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`http://localhost:8000/api/v1/users/${userId}`);
        fetchUsers();
        setError('');
        setNotification({ type: 'success', message: 'User deleted successfully!' });
      } catch (error) {
        setError('Failed to delete user: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  // Activate/Deactivate user
  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const endpoint = currentStatus ? 'deactivate' : 'activate';
      await axios.put(`http://localhost:8000/api/v1/users/${userId}/${endpoint}`);
      fetchUsers();
      setError('');
      setNotification({ type: 'success', message: currentStatus ? 'User deactivated.' : 'User activated.' });
    } catch (error) {
      setError('Failed to update user status: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Start editing user
  const startEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      password: '', // Don't pre-fill password
      is_active: user.is_active
    });
    setShowCreateForm(false);
  };

  // Cancel forms
  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      role: 'compteur_1',
      password: '',
      is_active: true
    });
  };

  // Role colors (matching your Navbar)
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

  // Role options
  const roleOptions = [
    { value: 'admin', label: 'Administrator' },
    { value: 'compteur_1', label: 'Counter 1' },
    { value: 'compteur_2', label: 'Counter 2' },
    { value: 'compteur_3', label: 'Counter 3' },
    { value: 'viewer', label: 'Viewer' }
  ];

  if (user.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="card text-center">
          <div className="text-red-500 text-xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need administrator privileges to access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto w-full sm:w-full md:w-11/12 lg:w-4/5 xl:w-3/4">
        {/* Notification */}
        {notification && (
          <div className={`mb-4 px-4 py-3 rounded-lg shadow-sm text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
               onClick={() => setNotification(null)}
               style={{ cursor: 'pointer' }}>
            {notification.message}
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600">Manage system users and permissions</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <span>➕</span>
            <span>Add User</span>
          </button>
        </div>

        {/* Filter for inactive users */}
        <div className="mb-4 flex items-center">
          <input
            id="showInactiveOnly"
            type="checkbox"
            checked={showInactiveOnly}
            onChange={() => setShowInactiveOnly(v => !v)}
            className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="showInactiveOnly" className="text-sm text-gray-700 select-none">
            Show only inactive accounts
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {(showCreateForm || editingUser) && (
          <div className="card mb-6 animate-slide-up">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h2>
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="input-primary"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    required
                    className="input-primary"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className="input-primary"
                  >
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingUser && <span className="text-xs text-gray-400">(leave blank to keep current)</span>}</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!editingUser}
                    className="input-primary"
                    placeholder={editingUser ? "••••••" : "Enter password"}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">Active User</label>
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button type="button" onClick={cancelForm} className="btn-outline">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="card">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              {(() => {
                const filteredUsers = showInactiveOnly
                  ? users.filter(userItem => !userItem.is_active)
                  : users;
                return filteredUsers.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Updated
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUsers.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {userItem.full_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                @{userItem.username}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getRoleColor(userItem.role)}`}>
                              {roleOptions.find(r => r.value === userItem.role)?.label || userItem.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              userItem.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {userItem.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                            {userItem.created_at ? new Date(userItem.created_at).toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                            {userItem.updated_at ? new Date(userItem.updated_at).toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => startEditUser(userItem)}
                              className="text-primary-600 hover:text-primary-900 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(userItem.id, userItem.is_active)}
                              className={`${
                                userItem.is_active 
                                  ? 'text-yellow-600 hover:text-yellow-900' 
                                  : 'text-green-600 hover:text-green-900'
                              } transition-colors`}
                            >
                              {userItem.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(userItem.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              disabled={userItem.id === user.id}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No users found. Create the first user to get started.
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;