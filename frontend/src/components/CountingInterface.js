import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, CubeIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon, ClockIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';

// --- Utility Functions (Reusing structure from dashboard.js) ---
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

// --- API Functions (Integrated from ui_functions.js concept) ---

// 1. Submit Count (POST /counts/)
const submitCount = async (payload) => {
    return fetchData('/counts/', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

// 2. Get Last Counts for Current User (GET /counts/last-for-user/)
const fetchLastCountsForUser = async () => {
    // Endpoint: GET /api/v1/counts/last-for-user/
    // This endpoint returns a list of LastCountedArticleForUser
    return fetchData(`/counts/last-for-user/`);
};

// 3. Update Count Quantity by Delta (PATCH /counts/{count_id}/update_quantity)
const updateCountQuantity = async (countId, quantityChange) => {
    const payload = {
        quantity_change: quantityChange,
        notes: `Update by ${quantityChange > 0 ? '+' : ''}${quantityChange} from interface button`
    };
    return fetchData(`/counts/${countId}/update_quantity`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
};

// --- End API Functions ---


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
  const [lastCounts, setLastCounts] = useState([]); 
  const [article, setArticle] = useState(null);
  const [showNewArticleButton, setShowNewArticleButton] = useState(false);
  const [articleHistory, setArticleHistory] = useState([]); 
  const [searchResults, setSearchResults] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  // NEW: State to hold the existing count for the current user/article/round
  const [existingCount, setExistingCount] = useState(null); 

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

  // NEW: Function to fetch an existing count for the current user/article/round
  const fetchExistingCount = useCallback(async (articleId, sessionId, userId, round) => {
    if (!articleId || !sessionId || !userId || !round) return null;
    
    try {
        // Endpoint: GET /api/v1/counts/?session_id={id}&article_id={id}&counted_by_user_id={id}&round={round}
        // Assuming the API endpoint /counts/ supports filtering by all these parameters
        const counts = await fetchData(`/counts/?session_id=${sessionId}&article_id=${articleId}&counted_by_user_id=${userId}&round=${round}`);
        // The API returns a list, we expect at most one result for this combination
        return counts.length > 0 ? counts[0] : null;
    } catch (err) {
        console.error("Failed to fetch existing count:", err);
        return null;
    }
  }, []);

  // MODIFIED: Fetch Last Counts for the current user
  const fetchLastCounts = useCallback(async () => {
    try {
      // Use the new API function
      const counts = await fetchLastCountsForUser();
      setLastCounts(counts);
    } catch (err) {
      console.error("Failed to fetch last counts for user:", err);
      // Do not set global error, just log it
    }
  }, []);

  // NEW: Function to handle the +1/-1 update
  const handleUpdateCount = useCallback(async (countId, delta) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
        const updatedCount = await updateCountQuantity(countId, delta);
        setSuccessMessage(`Count for article ${updatedCount.article_id} updated to ${updatedCount.quantity_counted}.`);
        
        // Re-fetch last counts to update the widget
        fetchLastCounts();

        // If the updated count is the one currently displayed in the history, refresh history
        if (article && article.id === updatedCount.article_id) {
            // Re-fetch history for the currently displayed article
            await fetchArticleHistory(article.id, currentSessionId);
            // Also update the existingCount state if it matches the updated count
            if (existingCount && existingCount.id === updatedCount.id) {
                setExistingCount(updatedCount);
                setCountQuantity(updatedCount.quantity_counted);
            }
        }

    } catch (err) {
        setError(`Failed to update count: ${err.message}`);
    } finally {
        setLoading(false);
        clearMessages();
    }
  }, [clearMessages, fetchLastCounts, article, currentSessionId, fetchArticleHistory, existingCount]);


  // 1. Fetch Article Details and History
  const fetchArticleAndHistory = useCallback(async (number) => {
    if (!number) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setArticle(null);
    setCountQuantity(1);
    setArticleHistory([]); // Clear history on new search
    setSearchResults([]); // Clear search results
    setExistingCount(null); // NEW: Clear existing count

    try {
      // Endpoint: GET /api/v1/articles/by-number/{numero_article}
      const fetchedArticle = await fetchData(`/articles/by-number/${number}`);
      setArticle(fetchedArticle);
      
      // Immediately fetch history for the newly found article
      await fetchArticleHistory(fetchedArticle.id, currentSessionId);

      // NEW: Check for existing count for the current user and round
      const roundToCheck = countingRound || 1;
      const existing = await fetchExistingCount(fetchedArticle.id, currentSessionId, user.id, roundToCheck);
      
      if (existing) {
          setExistingCount(existing);
          // Pre-fill the form with the existing quantity for correction
          setCountQuantity(existing.quantity_counted);
          setSuccessMessage(`Article déjà compté (Rond ${roundToCheck}). Prêt pour la correction.`);
      } else {
          // Reset quantity to 0 for a new count
          setCountQuantity(1);
      }

    } catch (err) {
            setError(`Article not found or API error: ${err.message}`)
      if (err.message.includes("404")) {
        setShowNewArticleButton(true);
      }
    } finally {
      setLoading(false);
      clearMessages();
    }
  }, [clearMessages, currentSessionId, fetchArticleHistory, fetchExistingCount, countingRound, user.id]);

  // Initial fetch of last counts and re-fetch on session change
  useEffect(() => {
    fetchLastCounts(); // No session ID needed for the user-specific endpoint
    // Set up a refresh interval (e.g., every 30 seconds)
    const intervalId = setInterval(() => {
        fetchLastCounts();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount or session change
  }, [fetchLastCounts]);

  // Type-ahead search logic
  const handleArticleSearchChange = (e) => {
    const value = e.target.value;
    setArticleNumber(value);
    setArticle(null); // Clear article details when typing starts
    setArticleHistory([]); // Clear history
    setExistingCount(null); // NEW: Clear existing count

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Endpoint: GET /api/v1/articles/search/?q={query}
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
    setSearchResults([]);
    fetchArticleAndHistory(selectedArticle.numero_article);
    articleInputRef.current.focus();
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
  const handleCreateNewArticle = async () => {
    if (!articleNumber.trim()) {
      setError('Le numéro d\'article ne peut pas être vide.');
      clearMessages();
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const newArticle = await fetchData('/articles/', {
        method: 'POST',
        body: JSON.stringify({ numero_article: articleNumber.trim() }),
      });
      setSuccessMessage(`Article "${newArticle.numero_article}" créé avec succès.`);
      setArticle(newArticle);
      setShowNewArticleButton(false);
      fetchArticleAndHistory(newArticle.numero_article);
    } catch (err) {
      setError(`Erreur lors de la création de l'article: ${err.message}`);
    } finally {
      setLoading(false);
      clearMessages();
    }
  };

  const handleSubmitCount = async (e) => {
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
      notes: existingCount ? "Correction via interface" : "Submitted via mobile interface",
    };

    try {
      // Use the integrated API function
      const result = await submitCount(payload);
      
      // MODIFIED: Use the success message returned by the API
      setSuccessMessage(result.message || `Count of ${countQuantity} for article ${article.numero_article} submitted successfully in Round ${roundToSubmit}!`);
      
      // Immediately re-fetch last counts to update the widget
      fetchLastCounts();

      // Re-fetch article history to show the correction/new count
      await fetchArticleHistory(article.id, currentSessionId);

      // Reset form for next count
      setArticleNumber('');
      setCountQuantity(1);
      setArticle(null);
      setArticleHistory([]);
      setExistingCount(null); // NEW: Clear existing count state
      
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
    // MODIFIED: lastCounts is now an array of the current user's last counts
    if (!lastCounts || lastCounts.length === 0) return null;

    // We display the last 3 counts for the current user
    const countsToDisplay = lastCounts.slice(0, 3);

    return (
      <div className="bg-white shadow-lg rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Vos Derniers Comptages</h2>
        <div className="space-y-3">
          {countsToDisplay.map((count, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-indigo-600 truncate">
                  {count.article_numero} (Rond {count.round})
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {count.article_description}
                </p>
                <p className="text-xs text-gray-500">
                  Emplacement: {count.article_location || 'N/A'}
                </p>
              </div>
              <div className="ml-4 flex items-center space-x-2">
                <span className="text-lg font-bold text-gray-900">
                  {count.quantity_counted}
                </span>
                {/* NEW: Update buttons */}
                <button
                  onClick={() => handleUpdateCount(count.count_id, -1)}
                  disabled={loading || count.quantity_counted <= 0}
                  className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Diminuer de 1"
                >
                  <MinusIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleUpdateCount(count.count_id, 1)}
                  disabled={loading}
                  className="p-1 text-green-500 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Augmenter de 1"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ArticleSearchForm = () => {
    return (
      <div className="bg-white shadow-lg rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recherche d'Article</h2>
        <div className="relative">
          <input
            ref={articleInputRef}
            type="text"
            placeholder="Scanner ou saisir le numéro d'article"
            value={articleNumber}
            onChange={handleArticleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && articleNumber.trim()) {
                fetchArticleAndHistory(articleNumber.trim());
                setSearchResults([]);
              }
            }}
            className="w-full py-3 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
          />
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <button
            onClick={() => fetchArticleAndHistory(articleNumber.trim())}
            className="absolute right-0 top-0 bottom-0 px-4 text-white bg-indigo-600 rounded-r-lg hover:bg-indigo-700 disabled:bg-indigo-400"
            disabled={loading || !articleNumber.trim()}
          >
            <CubeIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100"
                onClick={() => handleSelectArticle(result)}
              >
                <p className="font-medium text-gray-900">{result.numero_article}</p>
                <p className="text-xs text-gray-500">{result.description_article}</p>
              </div>
            ))}
          </div>
        )}

        {/* New Article Button */}
        <div className="mt-4 p-4 border-t border-gray-200">
          {showNewArticleButton && (
            <div className="text-center my-4">
              <p className="text-red-500 mb-2">Cet article n'existe pas.</p>
              <button
                onClick={handleCreateNewArticle}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <PlusIcon className="h-5 w-5 inline-block mr-2" />
                Créer un nouvel article
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ArticleDetails = () => {
    if (!article) return null;

    const handleLocationChange = (e) => {
      setArticle(prev => ({ ...prev, code_emplacement: e.target.value }));
    };

    return (
      <div className="bg-white shadow-lg rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Détails de l'Article</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <p><strong>Numéro:</strong> {article.numero_article}</p>
          <p><strong>Description:</strong> {article.description_article || 'N/A'}</p>
          <p><strong>Fournisseur:</strong> {article.catalogue_fournisseur || 'N/A'}</p>
          <p><strong>Stock Théorique:</strong> {article.quantite_en_stock}</p>
          <div className="col-span-2">
            <label htmlFor="articleLocation" className="block text-sm font-medium text-gray-700">
              Emplacement (à mettre à jour si nécessaire):
            </label>
            <input
              id="articleLocation"
              type="text"
              value={article.code_emplacement || ''}
              onChange={handleLocationChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>
    );
  };





  const CountForm = () => {
    if (!article) return null;

    const isCorrection = existingCount !== null;
    const formTitle = isCorrection 
        ? `Correction du Comptage (Rond ${countingRound || 1})`
        : `Saisie du Comptage (Rond ${countingRound || 1})`;
    const submitButtonText = isCorrection 
        ? `Valider la Correction (${countQuantity})`
        : `Valider le Comptage`;

    return (
      <div className="bg-white shadow-lg rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{formTitle}</h2>
        
        <div className="flex items-center justify-between mb-4">
          <label htmlFor="countQuantity" className="text-sm font-medium text-gray-700">
            Quantité {isCorrection ? 'Actuelle' : 'Comptée'}:
          </label>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setCountQuantity(prev => Math.max(0, prev - 1))}
              className="p-2 border border-gray-300 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              disabled={loading || countQuantity <= 0}
            >
              <MinusIcon className="w-5 h-5" />
            </button>
            <input
              id="countQuantity"
              type="number"
              min="0"
              value={countQuantity}
              onChange={(e) => setCountQuantity(parseInt(e.target.value) || 0)}
              className="w-20 text-center py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setCountQuantity(prev => prev + 1)}
              className="p-2 border border-gray-300 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              disabled={loading}
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isCorrection && existingCount && (
            <p className="text-sm text-gray-500 mb-3">
                Comptage initial: <span className="font-medium">{existingCount.quantity_counted}</span>. Modifiez la quantité ci-dessus pour corriger.
            </p>
        )}

        <button onClick={handleSubmitCount}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400"
          disabled={loading || countQuantity <= 0}
        >
          {loading ? <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" /> : <CheckCircleIcon className="h-5 w-5 mr-2" />}
          {submitButtonText}
        </button>
      </div>
    );
  };

  const ArticleHistory = () => {
    if (!article || articleHistory.length === 0) return null;

    return (
      <div className="bg-white shadow-lg rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Historique de Comptage pour {article.numero_article}</h2>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {articleHistory.map((history, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  Rond {history.round}: <span className="font-bold text-indigo-600">{history.quantity_counted}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Par {history.user_username}
                </p>
              </div>
              <div className="ml-4 flex items-center text-xs text-gray-500">
                <ClockIcon className="w-4 h-4 mr-1" />
                {formatTime(history.counted_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const StatusMessages = () => (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50">
      {error && (
        <div className="flex items-center p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 shadow-md" role="alert">
          <XCircleIcon className="flex-shrink-0 inline w-4 h-4 mr-3" />
          <span className="sr-only">Erreur</span>
          <div>{error}</div>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 shadow-md" role="alert">
          <CheckCircleIcon className="flex-shrink-0 inline w-4 h-4 mr-3" />
          <span className="sr-only">Succès</span>
          <div>{successMessage}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Interface de Comptage</h1>
        <p className="text-sm text-gray-600">
          Utilisateur: <span className="font-medium">{user.username} ({user.role})</span> | Session: <span className="font-medium">{currentSessionId}</span>
        </p>
      </header>

      <ArticleSearchForm />
      <ArticleDetails />
      <CountForm />
      <LastCountsWidget />
      <ArticleHistory />
      
      <StatusMessages />
    </div>
  );
};

export default CountingInterface;