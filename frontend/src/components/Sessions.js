import React, { useState, useEffect, useCallback } from 'react';
import { TrashIcon, ArrowPathIcon, FunnelIcon, EyeIcon, PencilSquareIcon, XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// --- Utility Functions (Reusing structure from previous files) ---
const API_BASE_URL = 'http://localhost:8000/api/v1';
const getToken = () => localStorage.getItem('token');

const fetchData = async (endpoint, options = {}) => {
  const token = getToken();
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    }
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
        const errorBody = await response.json();
        errorDetail = errorBody.detail || errorBody.detail.join(', ') || errorDetail;
    } catch (e) {
        // Ignore if response body is not JSON
    }
    throw new Error(`API call failed (${response.status}): ${errorDetail}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const formatTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
};
// --- End Utility Functions ---

const StatusMessage = ({ type, message }) => {
    if (!message) return null;
    const isSuccess = type === 'success';
    const Icon = isSuccess ? CheckCircleIcon : XCircleIcon;
    const color = isSuccess ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700';

    return (
      <div className={`p-3 border rounded-lg flex items-center mb-4 ${color}`} role="alert">
        <Icon className="h-5 w-5 mr-2 flex-shrink-0" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    );
};

// Modal for Count Correction
const CorrectionModal = ({ count, onClose, onCorrect }) => {
    const [newQuantity, setNewQuantity] = useState(count.quantity_counted);
    const [correctionReason, setCorrectionReason] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!correctionReason) {
            alert("Correction reason is required.");
            return;
        }
        setLoading(true);
        await onCorrect(count.id, newQuantity, correctionReason, notes);
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <h3 className="text-lg font-bold mb-4">Correct Count ID: {count.id}</h3>
                <p className="text-sm text-gray-600 mb-4">Article: {count.article_numero} ({count.article_description})</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Original Quantity</label>
                        <p className="text-xl font-bold text-blue-600">{count.quantity_counted}</p>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="newQuantity" className="block text-sm font-medium text-gray-700">New Quantity</label>
                        <input
                            id="newQuantity"
                            type="number"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 0)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="correctionReason" className="block text-sm font-medium text-gray-700">Correction Reason</label>
                        <input
                            id="correctionReason"
                            type="text"
                            value={correctionReason}
                            onChange={(e) => setCorrectionReason(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
                        />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Correcting...' : 'Submit Correction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const Sessions = ({ user }) => {
    const [counts, setCounts] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [users, setUsers] = useState([]);
    const [articlesMap, setArticlesMap] = useState({}); // Map to store article details: {id: {numero, description}}
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [selectedCount, setSelectedCount] = useState(null);

    const [filters, setFilters] = useState({
        sessionId: '',
        articleId: '', // Still allow article ID filtering
        round: '',
        countedByUserId: ''
    });

    const clearMessages = useCallback(() => {
        setTimeout(() => {
          setError(null);
          setSuccessMessage(null);
        }, 5000);
    }, []);

    // --- Data Fetching for Selectors ---
    const fetchStaticData = useCallback(async () => {
        try {
            // 1. Fetch Sessions
            const fetchedSessions = await fetchData('/sessions/');
            setSessions(fetchedSessions);

            // 2. Fetch Users (Assuming /users/ endpoint exists and returns id, username, full_name)
            // If /users/ doesn't exist, this will fail, and we'll rely on data from counts.
            try {
                const fetchedUsers = await fetchData('/users/');
                setUsers(fetchedUsers);
            } catch (e) {
                console.warn("Could not fetch /users/ endpoint. Relying on user data from counts.");
                setUsers([]);
            }
            
        } catch (err) {
            console.error("Failed to fetch static data:", err);
            // Do not set global error, as counts might still load
        }
    }, []);

    // --- Main Count Fetching Logic ---
    const fetchCounts = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const queryParams = new URLSearchParams();
            if (filters.sessionId) queryParams.append('session_id', filters.sessionId);
            if (filters.articleId) queryParams.append('article_id', filters.articleId);
            if (filters.round) queryParams.append('round_number', filters.round);
            if (filters.countedByUserId) queryParams.append('counted_by_user_id', filters.countedByUserId);

            // Endpoint: GET /api/v1/counts/
            const rawCounts = await fetchData(`/counts/?limit=1000&${queryParams.toString()}`);
            
            // --- Data Enrichment ---
            
            // 1. Collect unique Article IDs
            const articleIds = [...new Set(rawCounts.map(c => c.article_id))];
            
            // 2. Fetch Article Details (Assuming a bulk or efficient way to get article details)
            // Since we don't have a bulk endpoint, we'll fetch them one by one or rely on the search endpoint
            // For simplicity and to avoid too many requests, we'll assume a GET /articles/{id} or rely on the search endpoint.
            // A better approach is to assume the backend has an endpoint to get article details by ID list.
            // For now, we'll use the search endpoint to get the details we need for the map.
            
            // A more robust way: fetch all articles if the list is small, or fetch details for each ID.
            // Given the lack of a bulk article detail endpoint, we'll fetch the article details for each unique ID.
            
            const newArticlesMap = { ...articlesMap };
            const articlePromises = articleIds.map(async (id) => {
                if (!newArticlesMap[id]) {
                    try {
                        // Assuming an endpoint to get article by ID exists
                        const articleDetail = await fetchData(`/articles/${id}`);
                        newArticlesMap[id] = {
                            numero: articleDetail.numero_article,
                            description: articleDetail.description_article
                        };
                    } catch (e) {
                        newArticlesMap[id] = { numero: `ID ${id}`, description: 'Details unavailable' };
                    }
                }
            });
            await Promise.all(articlePromises);
            setArticlesMap(newArticlesMap);

            // 3. Enrich Counts
            const enrichedCounts = rawCounts.map(count => {
                const articleInfo = newArticlesMap[count.article_id] || { numero: `ID ${count.article_id}`, description: 'Loading...' };
                const userInfo = users.find(u => u.id === count.counted_by_user_id) || { username: `User ${count.counted_by_user_id}`, full_name: 'Unknown User' };
                const sessionInfo = sessions.find(s => s.id === count.session_id) || { nom_session: `Session ${count.session_id}` };

                return {
                    ...count,
                    article_numero: articleInfo.numero,
                    article_description: articleInfo.description,
                    user_username: userInfo.username,
                    user_full_name: userInfo.full_name,
                    session_name: sessionInfo.nom_session
                };
            });

            setCounts(enrichedCounts);
        } catch (err) {
            console.error("Failed to fetch counts:", err);
            setError(`Failed to load counts: ${err.message}`);
            setCounts([]);
        } finally {
            setLoading(false);
            clearMessages();
        }
    }, [filters, clearMessages, sessions, users, articlesMap]);

    // --- Action Handlers ---
    const handleDeleteCount = useCallback(async (countId) => {
        if (!window.confirm(`Are you sure you want to delete count ID ${countId}? This action is irreversible.`)) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Endpoint: DELETE /api/v1/counts/{count_id}
            await fetchData(`/counts/${countId}`, { method: 'DELETE' });
            
            setSuccessMessage(`Count ID ${countId} deleted successfully.`);
            // Re-fetch the list to update the UI
            await fetchCounts();

        } catch (err) {
            console.error("Failed to delete count:", err);
            setError(`Failed to delete count ID ${countId}: ${err.message}`);
        } finally {
            setLoading(false);
            clearMessages();
        }
    }, [fetchCounts, clearMessages]);

    const handleCorrectCount = async (countId, newQuantity, correctionReason, notes) => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        const payload = {
            new_quantity: newQuantity,
            correction_reason: correctionReason,
            notes: notes
        };

        try {
            // Endpoint: PUT /api/v1/counts/{count_id}/correct
            await fetchData(`/counts/${countId}/correct`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            
            setSuccessMessage(`Count ID ${countId} corrected successfully to ${newQuantity}.`);
            // Re-fetch the list to update the UI
            await fetchCounts();

        } catch (err) {
            console.error("Failed to correct count:", err);
            setError(`Failed to correct count ID ${countId}: ${err.message}`);
        } finally {
            setLoading(false);
            clearMessages();
        }
    };

    // --- Effects ---
    useEffect(() => {
        // Initial fetch of static data
        fetchStaticData();
    }, [fetchStaticData]);

    useEffect(() => {
        // Initial fetch of counts after static data is loaded
        // This will run once after static data is fetched and populated
        if (sessions.length > 0 || users.length > 0) {
            fetchCounts();
        }
    }, [sessions.length, users.length]);


    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const openCorrectionModal = (count) => {
        setSelectedCount(count);
        setCorrectionModalOpen(true);
    };

    return (
        <div className="p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Session & Count Management</h1>
                <p className="text-sm text-gray-500 mb-4">
                    User: {user.username} | Role: {user.role}
                </p>

                <StatusMessage type="error" message={error} />
                <StatusMessage type="success" message={successMessage} />

                {/* Correction Modal */}
                {correctionModalOpen && selectedCount && (
                    <CorrectionModal 
                        count={selectedCount} 
                        onClose={() => setCorrectionModalOpen(false)} 
                        onCorrect={handleCorrectCount}
                    />
                )}

                {/* Filter Section */}
                <div className="bg-white shadow-lg rounded-xl p-4 mb-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <FunnelIcon className="h-5 w-5 mr-2" /> Filter Counts
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Session Selector */}
                        <select
                            name="sessionId"
                            value={filters.sessionId}
                            onChange={handleFilterChange}
                            className="block w-full rounded-lg border-gray-300 p-2 text-sm"
                        >
                            <option value="">All Sessions</option>
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>{s.nom_session} (ID: {s.id})</option>
                            ))}
                        </select>
                        
                        {/* User Selector */}
                        <select
                            name="countedByUserId"
                            value={filters.countedByUserId}
                            onChange={handleFilterChange}
                            className="block w-full rounded-lg border-gray-300 p-2 text-sm"
                        >
                            <option value="">All Users</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.full_name || u.username} (ID: {u.id})</option>
                            ))}
                        </select>

                        {/* Article ID Filter (Still useful for specific lookups) */}
                        <input
                            type="number"
                            name="articleId"
                            placeholder="Article ID"
                            value={filters.articleId}
                            onChange={handleFilterChange}
                            className="block w-full rounded-lg border-gray-300 p-2 text-sm"
                        />
                        
                        {/* Round Filter */}
                        <input
                            type="number"
                            name="round"
                            placeholder="Round"
                            value={filters.round}
                            onChange={handleFilterChange}
                            className="block w-full rounded-lg border-gray-300 p-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={fetchCounts}
                        disabled={loading}
                        className="mt-4 w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {loading ? (
                            <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                            <EyeIcon className="h-5 w-5 mr-2" />
                        )}
                        {loading ? 'Loading...' : 'Apply Filters / Refresh'}
                    </button>
                </div>

                {/* Counts List */}
                <div className="bg-white shadow-lg rounded-xl p-4 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">
                        Total Counts Found: {counts.length}
                    </h2>
                    
                    {loading && counts.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            <ArrowPathIcon className="h-8 w-8 mx-auto mb-2 animate-spin" />
                            <p>Loading counts...</p>
                        </div>
                    ) : counts.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
                            <p className="font-medium">No counts match the current filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Article No.</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Counted By</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {counts.map((count) => (
                                        <tr key={count.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{count.id}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{count.session_name}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{count.article_numero}</td>
                                            <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">{count.article_description}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{count.round}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-gray-900">{count.quantity_counted}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{count.user_full_name || count.user_username}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatTime(count.counted_at)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                {/* Correction Button */}
                                                <button
                                                    onClick={() => openCorrectionModal(count)}
                                                    disabled={loading || user.role !== 'admin'}
                                                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                                    title="Correct Count"
                                                >
                                                    <PencilSquareIcon className="h-5 w-5 inline" />
                                                </button>
                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => handleDeleteCount(count.id)}
                                                    disabled={loading || user.role !== 'admin'}
                                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                    title="Delete Count"
                                                >
                                                    <TrashIcon className="h-5 w-5 inline" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sessions;