import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, CubeIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';

// --- Utility Functions (Reusing structure from dashboard.js) ---
// Assuming API_BASE_URL and fetchData are defined elsewhere or passed as props, 
// but for a standalone file, we keep the original definition.
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
        errorDetail = errorBody.detail || errorDetail;
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
// --- End Utility Functions ---

// Helper function to extract the counting round from the user role
const getCountingRound = (userRole) => {
    if (userRole && userRole.toLowerCase().startsWith('compteur_')) {
        const parts = userRole.split('_');
        const round = parseInt(parts[1], 10);
        return isNaN(round) ? null : round;
    }
    return null; // Admin or Viewer roles don't have a specific round
};

// Helper function for time formatting
const formatTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    // Use user's locale for better time display
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
};


const CountingInterface = ({ user, currentSessionId = 2 }) => {
  // State for the main form
  const [articleNumber, setArticleNumber] = useState('');
  const [countQuantity, setCountQuantity] = useState(0);
  
  // State for data and status
  const [lastCounts, setLastCounts] = useState({});
  const [article, setArticle] = useState(null);
  // History now uses the more detailed endpoint /counting-history/session/{id}/article/{id}
  const [articleHistory, setArticleHistory] = useState([]); 
  const [searchResults, setSearchResults] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const articleInputRef = useRef(null);
  const searchTimeoutRef = useRef(null); 
  
  // Determine the counting round based on the user's role
  const countingRound = getCountingRound(user.role);
  const isCompteur = countingRound !== null;

  // Helper to clear messages after a delay
  const clearMessages = useCallback(() => {
    setTimeout(() => {
      setError(null);
      setSuccessMessage(null);
    }, 5000);
  }, []);

  // NEW: Fetch Last Counts for all counters in the session
  const fetchLastCounts = useCallback(async (sessionId) => {
    if (!sessionId) return;
    try {
      // Endpoint: GET /api/v1/counts/last-counted/{session_id}
      const counts = await fetchData(`/counts/last-counted/${sessionId}`);
      setLastCounts(counts);
    } catch (err) {
      console.error("Failed to fetch last counts:", err);
      // Do not set global error, just log it
    }
  }, []);

  // NEW: Fetch Count History for the current article and session
  const fetchArticleHistory = useCallback(async (articleId, sessionId) => {
    if (!articleId || !sessionId) return;
    
    try {
        // Endpoint: GET /api/v1/counting-history/session/{session_id}/article/{article_id}
        const history = await fetchData(`/counting-history/session/${sessionId}/article/${articleId}`);
        setArticleHistory(history);
    } catch (err) {
        console.error("Failed to fetch article history:", err);
        // Do not set global error, just log it
    }
  }, []);

  // 1. Fetch Article Details and History
  const fetchArticleAndHistory = useCallback(async (number) => {
    if (!number) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setArticle(null);
    setCountQuantity(0);
    setArticleHistory([]); // Clear history on new search
    setSearchResults([]); // Clear search results

    try {
      // Endpoint: GET /api/v1/articles/by-number/{numero_article} (Assuming this endpoint exists from context)
      const fetchedArticle = await fetchData(`/articles/by-number/${number}`);
      setArticle(fetchedArticle);
      
      // Immediately fetch history for the newly found article
      await fetchArticleHistory(fetchedArticle.id, currentSessionId);

    } catch (err) {
      setError(`Article not found or API error: ${err.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [clearMessages, currentSessionId, fetchArticleHistory]);

  // Initial fetch of last counts and re-fetch on session change
  useEffect(() => {
    fetchLastCounts(currentSessionId);
    // Set up a refresh interval (e.g., every 30 seconds)
    const intervalId = setInterval(() => {
        fetchLastCounts(currentSessionId);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount or session change
  }, [currentSessionId, fetchLastCounts]);

  // Type-ahead search logic
  const handleArticleSearchChange = (value) => {
    setArticleNumber(value);
    setArticle(null); // Clear article details when typing starts
    setArticleHistory([]); // Clear history

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Endpoint: GET /api/v1/articles/search/?q={query} (Assuming this endpoint exists from context)
        const results = await fetchData(`/articles/search/?q=${encodeURIComponent(value.trim())}`);
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      }
    }, 300); // Debounce for 300ms
  };

  // Handle selection from search results
  const handleSelectArticle = (selectedArticle) => {
    setArticleNumber(selectedArticle.numero_article);
    setSearchResults([]); // Clear results
    fetchArticleAndHistory(selectedArticle.numero_article); // Fetch full details and history
  };

  // Handle key down for immediate search on Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission if in a form
      if (articleNumber.trim()) {
        fetchArticleAndHistory(articleNumber.trim());
      }
    }
  };

  // Handle form submission for article search (used for button click)
  const handleArticleSearch = (e) => {
    e.preventDefault();
    fetchArticleAndHistory(articleNumber.trim());
  };

  // 2. Submit Count
  const handleSubmitCount = async () => {
    if (!article) {
      setError('Please find an article first.');
      clearMessages();
      return;
    }
    if (countQuantity <= 0) {
      setError('Count quantity must be greater than zero.');
      clearMessages();
      return;
    }
    if (!user || !user.id) {
        setError('User information is missing. Cannot submit count.');
        clearMessages();
        return;
    }
    if (!currentSessionId) {
        setError('No active session ID found. Cannot submit count.');
        clearMessages();
        return;
    }
    
    // Check for Compteur role and round
    const roundToSubmit = countingRound || 1; // Default to round 1 if not a specific compteur role
    if (isCompteur && !countingRound) {
        // This case should ideally not happen if getCountingRound works, but kept for safety
        setError('Could not determine counting round from user role. Cannot submit count.');
        clearMessages();
        return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const payload = {
      session_id: currentSessionId,
      article_id: article.id,
      round: roundToSubmit,
      quantity_counted: countQuantity,
      counted_by_user_id: user.id,
      notes: "Submitted via mobile interface",
    };

    try {
      // Endpoint: POST /api/v1/counts/
      await fetchData('/counts/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      setSuccessMessage(`Count of ${countQuantity} for article ${article.numero_article} submitted successfully in Round ${roundToSubmit}!`);
      
      // Immediately re-fetch last counts to update the widget
      fetchLastCounts(currentSessionId);

      // We need to re-fetch the article details to get the latest history
      // Note: We use the article's number to re-fetch, which will also clear the form.
      // If the user wants to count the same article again, they will need to re-scan/re-enter.
      // To keep the article details on screen, we would call fetchArticleHistory directly.
      // Based on the original logic (lines 237-240), the form is cleared.
      
      // Reset form for next count
      setArticleNumber('');
      setCountQuantity(0);
      setArticle(null);
      setArticleHistory([]);
      
      // Focus back on the article input for the next scan/entry
      articleInputRef.current?.focus();

    } catch (err) {
      setError(`Failed to submit count: ${err.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  // Mobile-First UI Components

  const LastCountsWidget = () => {
    const countsArray = Object.values(lastCounts);
    if (countsArray.length === 0) return null;

    // Filter for the current user's last count to display it prominently
    const currentUserCount = countsArray.find(c => c.user_id === user.id);
    const otherCounts = countsArray.filter(c => c.user_id !== user.id);

    return (
      <div className="bg-white shadow-lg rounded-xl p-4 mb-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">Last Counts by Counter</h3>
        
        {currentUserCount && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-700">Your Last Count:</p>
                <p className="text-lg font-bold text-blue-900 truncate">{currentUserCount.article_numero}</p>
                <p className="text-xs text-gray-600">
                    {currentUserCount.quantity_counted} units in Round {currentUserCount.round} at {formatTime(currentUserCount.counted_at)}
                </p>
            </div>
        )}

        {otherCounts.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-gray-700">Other Counters:</p>
                {otherCounts.map((count) => (
                    <div key={count.user_id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0 mr-2">
                            <p className="font-semibold text-gray-800 truncate">{count.username}</p>
                            <p className="text-xs text-gray-500 truncate">{count.article_numero} ({count.quantity_counted})</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-xs text-gray-600">R{count.round}</p>
                            <p className="text-xs text-gray-600">{formatTime(count.counted_at)}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    );
  };



  const ArticleDetailsCard = () => {
    if (!article) return null;

    return (
      <div className="bg-white shadow-lg rounded-xl p-4 mb-6 border border-gray-200">
        <div className="flex items-center mb-3">
          <CubeIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900 truncate">{article.numero_article}</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">{article.description_article || 'No description available'}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500">Warehouse</p>
            <p className="font-semibold text-gray-800">{article.code_entrepot || 'N/A'}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500">Location</p>
            <p className="font-semibold text-gray-800">{article.code_emplacement || 'N/A'}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg col-span-2">
            <p className="text-xs font-medium text-gray-500">System Stock</p>
            <p className="font-semibold text-gray-800">{article.quantite_en_stock !== undefined ? article.quantite_en_stock : 'N/A'}</p>
          </div>
        </div>
      </div>
    );
  };
  
  const ArticleHistoryCard = () => {
      if (articleHistory.length === 0) return null;
      
      // Sort by round and then by time (most recent first)
      const sortedHistory = [...articleHistory].sort((a, b) => {
          if (a.round !== b.round) {
              return a.round - b.round;
          }
          return new Date(b.counted_at) - new Date(a.counted_at);
      });

      return (
          <div className="bg-white shadow-lg rounded-xl p-4 mb-6 border border-gray-200">
              <div className="flex items-center mb-3 border-b pb-2">
                  <ClockIcon className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Article History ({sortedHistory.length})</h3>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                  {sortedHistory.map((historyEntry) => (
                      <div key={historyEntry.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                              <p className="font-semibold text-gray-800">
                                {historyEntry.action === 'corrected' ? 
                                    `Correction: ${historyEntry.previous_quantity} → ${historyEntry.quantity_counted}` :
                                    `Count: ${historyEntry.quantity_counted}`
                                }
                              </p>
                              <p className="text-xs text-gray-500">
                                Round {historyEntry.round} | 
                                User: {historyEntry.user_full_name || historyEntry.user_username || `ID: ${historyEntry.counted_by_user_id}`}
                                {historyEntry.action === 'corrected' && <span className="ml-1 text-red-500 font-medium">(Corrected)</span>}
                              </p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs text-gray-600">{formatTime(historyEntry.counted_at)}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Count Entry</h1>
	        <p className="text-sm text-gray-500 mb-4">
            Session ID: {currentSessionId} 
            {isCompteur && countingRound && <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">Round {countingRound}</span>}
            <span className="ml-2">| User: {user.username}</span>
        </p>

	      

	        {/* NEW: Last Counts Widget */}
	        <LastCountsWidget />

        {/* 1. Article Search/Scan Form (Always visible) */}
        <form onSubmit={handleArticleSearch} className="mb-6">
          <label htmlFor="article-number" className="block text-sm font-medium text-gray-700 mb-2">
            Scan or Enter Article Number
          </label>
          <div className="flex shadow-sm rounded-lg">
            <input
              ref={articleInputRef}
              type="text"
              id="article-number"
              value={articleNumber}
              onChange={(e) => handleArticleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown} 
              placeholder="e.g., 10001234 or search by description"
              className="flex-1 block w-full rounded-l-lg border-gray-300 p-3 text-lg focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={loading}
            />
            <button
              type="submit"
              className="inline-flex items-center px-4 py-3 border border-transparent rounded-r-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={loading || !articleNumber.trim()}
            >
              {loading && !article ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <MagnifyingGlassIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {/* Article Search Results Dropdown */}
          {searchResults.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <li
                  key={result.id}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                  onClick={() => handleSelectArticle(result)}
                >
                  <p className="font-semibold text-gray-900">{result.numero_article}</p>
                  <p className="text-xs text-gray-500 truncate">{result.description_article}</p>
                </li>
              ))}
            </ul>
          )}
        </form>

        {/* 2. Article Details (Visible after successful fetch) */}
        {article && <ArticleDetailsCard />}
        
        {/* 3. Count History (Visible after successful fetch) */}
        {article && <ArticleHistoryCard />}

        {/* 4. Quantity Input and Submit (Visible after article is found) */}
        {article && (
          <div className="bg-white shadow-lg rounded-xl p-4 border border-gray-200">
            <label htmlFor="count-quantity" className="block text-sm font-medium text-gray-700 mb-2">
              Enter Count Quantity
            </label>
            <input
              type="number"
              id="count-quantity"
              value={countQuantity}
              onChange={(e) => setCountQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              className="block w-full rounded-lg border-gray-300 p-4 text-3xl font-bold text-center mb-4 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              required
              autoFocus
              disabled={loading}
            />

            <button
              onClick={handleSubmitCount}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              disabled={loading || countQuantity <= 0}
            >
              {loading ? (
                <ArrowPathIcon className="h-6 w-6 mr-2 animate-spin" />
              ) : (
                <CheckCircleIcon className="h-6 w-6 mr-2" />
              )}
              Submit Count (Round {countingRound || 1})
            </button>
          </div>
        )}

        {/* Loading/Placeholder */}
        {loading && !article && (
            <div className="text-center p-8 text-gray-500">
                <ArrowPathIcon className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p>Loading article details...</p>
            </div>
        )}
        
        {!article && !loading && !error && (
            <div className="text-center p-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
                <MagnifyingGlassIcon className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">Ready to count. Scan or enter an article number above.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default CountingInterface;