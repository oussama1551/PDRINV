import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  FunnelIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

// --- 1. Utility Functions and Constants ---

const API_BASE_URL = 'http://localhost:8000/api/v1/articles';

const API_UNIQUE_VALUES_URL = 'http://localhost:8000/api/v1/articles/unique_values'; 

const getToken = () => localStorage.getItem('token');

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// --- 2. Article Form Component ---

const ArticleForm = ({ article, onSave, onCancel, isEditing = false }) => {
  const [formData, setFormData] = useState({
    numero_article: article?.numero_article || '',
    description_article: article?.description_article || '',
    code_emplacement: article?.code_emplacement || '',
    code_entrepot: article?.code_entrepot || '',
    quantite_en_stock: article?.quantite_en_stock || 0,
    catalogue_fournisseur: article?.catalogue_fournisseur || '',
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    if (!formData.numero_article.trim()) {
      setFormError('Article Number is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const token = getToken();
      const url = isEditing 
        ? `${API_BASE_URL}/${article.id}`
        : API_BASE_URL;
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSave();
      } else {
        const errorData = await response.json();
        setFormError(errorData.detail || `Failed to ${isEditing ? 'update' : 'create'} article.`);
      }
    } catch (error) {
      setFormError('Network error. Please try again.');
      console.error('Error saving article:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit Article' : 'Create New Article'}
          </h2>
          <button 
            onClick={onCancel} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Article Number *
              </label>
              <input
                type="text"
                required
                value={formData.numero_article}
                onChange={(e) => setFormData(prev => ({ ...prev, numero_article: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description_article}
                onChange={(e) => setFormData(prev => ({ ...prev, description_article: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Code
              </label>
              <input
                type="text"
                value={formData.code_emplacement}
                onChange={(e) => setFormData(prev => ({ ...prev, code_emplacement: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse Code
              </label>
              <input
                type="text"
                value={formData.code_entrepot}
                onChange={(e) => setFormData(prev => ({ ...prev, code_entrepot: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Quantity
              </label>
              <input
                type="number"
                step="0.001"
                value={formData.quantite_en_stock}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  quantite_en_stock: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Catalog
              </label>
              <input
                type="text"
                value={formData.catalogue_fournisseur}
                onChange={(e) => setFormData(prev => ({ ...prev, catalogue_fournisseur: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button 
              type="button" 
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Article' : 'Create Article'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- 3. Improved Column Filter Dropdown Component ---

const ColumnFilterDropdown = ({ 
  column, 
  uniqueValues, 
  filterValues,
  setFilterValues, 
  applyFilters, 
  clearFilter, 
  isOpen, 
  setOpen,
  reference
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localSelected, setLocalSelected] = useState(filterValues);

  useEffect(() => {
    if (isOpen) {
      setLocalSelected(filterValues);
      setSearchTerm('');
    }
  }, [isOpen, filterValues]);

  // Handle the case where uniqueValues might be undefined or empty
  const safeUniqueValues = uniqueValues || [];
  const filteredValues = safeUniqueValues.filter(value => 
    String(value).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (value) => {
    setLocalSelected(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const handleSelectAll = (shouldSelect) => {
    if (shouldSelect && safeUniqueValues.length > 0) {
      setLocalSelected(safeUniqueValues.map(v => String(v)));
    } else {
      setLocalSelected([]);
    }
  };

  const handleApply = () => {
    setFilterValues(column, localSelected);
    applyFilters(column);
  };

  const handleClear = () => {
    setLocalSelected([]);
    clearFilter(column);
  };

  const isAllSelected = safeUniqueValues.length > 0 && localSelected.length === safeUniqueValues.length;
  const isFiltered = filterValues.length > 0;

  return (
    <div className="relative inline-block" ref={reference}>
      <button 
        onClick={() => setOpen(isOpen ? null : column)}
        className={`p-1 rounded transition-colors ${isFiltered ? 'text-blue-600 bg-blue-100' : 'text-gray-500 hover:bg-gray-100'}`}
        title={`Filter by ${column}`}
      >
        <FunnelIcon className="h-5 w-5" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-50 border border-gray-200 p-3">
          <div className="mb-2">
            <input
              type="text"
              placeholder="Search values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-between items-center mb-2 border-b pb-1">
            <button 
              onClick={() => handleSelectAll(!isAllSelected)}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
              disabled={safeUniqueValues.length === 0}
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-gray-500">
              {localSelected.length} / {safeUniqueValues.length} selected
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {safeUniqueValues.length === 0 ? (
              <p className="text-sm text-gray-500 px-2 py-1">No values available.</p>
            ) : filteredValues.length > 0 ? (
              filteredValues.map((value, index) => {
                const stringValue = String(value);
                return (
                  <div key={index} className="flex items-center hover:bg-gray-50 p-1 rounded cursor-pointer" onClick={() => handleToggle(stringValue)}>
                    <input
                      type="checkbox"
                      readOnly
                      checked={localSelected.includes(stringValue)}
                      onChange={() => handleToggle(stringValue)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded pointer-events-none"
                    />
                    <label className="ml-2 text-sm text-gray-700 truncate">
                      {stringValue || '(Empty)'}
                    </label>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 px-2 py-1">No matching values.</p>
            )}
          </div>

          <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 px-2">
            <button
              onClick={handleClear}
              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              disabled={!isFiltered}
            >
              Clear Filter
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 4. Main ArticlesList Component (Fixed) ---

const ArticlesList = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // State for server-side pagination and global search
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [hasStockFilter, setHasStockFilter] = useState('all');
  const [showServerFilters, setShowServerFilters] = useState(false);
  
  // Global lists for filter dropdowns
  const [globalLocationCodes, setGlobalLocationCodes] = useState([]);
  const [globalClientFilterValues, setGlobalClientFilterValues] = useState({});

  // State to store the raw, unfiltered articles from the server response
  const [unfilteredArticles, setUnfilteredArticles] = useState([]);

  const [hiddenColumns, setHiddenColumns] = useState({
    code_entrepot: false,
    created_at: true
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5000,
    total: 0,
    pages: 0
  });

  // State for column filtering
  const columnKeys = useMemo(() => [
    'numero_article', 
    'description_article', 
    'code_emplacement',
    'code_entrepot', 
    'quantite_en_stock', 
    'catalogue_fournisseur'
  ], []);

  const SERVER_FILTERED_COLUMNS = useMemo(() => ['code_emplacement'], []);
  const CLIENT_FILTERED_COLUMNS = useMemo(() => columnKeys.filter(key => !SERVER_FILTERED_COLUMNS.includes(key)), [columnKeys, SERVER_FILTERED_COLUMNS]);

  const columnFilterDefaults = useMemo(() => {
    const defaults = {};
    columnKeys.forEach(key => defaults[key] = []);
    return defaults;
  }, [columnKeys]);

  const [columnFilters, setColumnFilters] = useState(columnFilterDefaults);
  const [openFilter, setOpenFilter] = useState(null);
  const filterDropdownRefs = useRef({});

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'numero_article', direction: 'ascending' });

  const canEdit = useMemo(() => ['admin', 'Compteur_1', 'Compteur_2', 'Compteur_3'].includes(user?.role), [user?.role]);
  const canDelete = useMemo(() => user?.role === 'admin', [user?.role]);

  // --- Data Fetching Logic ---

  // Fetch all unique filter values once on mount
  useEffect(() => {
    const fetchUniqueValues = async () => {
      try {
        const token = getToken();
        
        console.log('Fetching unique values...');
        
        // Fetch all required unique values (including server-side filters like code_emplacement)
        const allFilterColumns = [...CLIENT_FILTERED_COLUMNS, ...SERVER_FILTERED_COLUMNS].join(',');
        console.log('Fetching all filter columns:', allFilterColumns);
        
        const allValuesResponse = await fetch(`${API_UNIQUE_VALUES_URL}?columns=${allFilterColumns}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('All unique values response status:', allValuesResponse.status);

        if (allValuesResponse.ok) {
          const data = await allValuesResponse.json();
          console.log('All unique values data received:', data);
          
          const sortedData = {};
          for (const key in data) {
            sortedData[key] = data[key].map(String).sort();
          }
          
          // Separate server-side (location) and client-side values
          setGlobalLocationCodes(sortedData['code_emplacement'] || []);
          
          // Filter out server-side columns from client-side state
          const clientData = {};
          for (const key in sortedData) {
            if (CLIENT_FILTERED_COLUMNS.includes(key)) {
              clientData[key] = sortedData[key];
            }
          }
          setGlobalClientFilterValues(clientData);
          
        } else {
          console.error("Failed to fetch all unique filter values:", allValuesResponse.status);
          // If API fails, we'll rely on fallback to current page data
        }

      } catch (error) {
        console.error("Error fetching unique filter values:", error);
      }
    };
    fetchUniqueValues();
  }, [CLIENT_FILTERED_COLUMNS, SERVER_FILTERED_COLUMNS]);

  // Build query parameters for server-side calls
  const buildQueryParams = useCallback((page, limit, currentHasStockFilter, currentColumnFilters) => {
    const params = new URLSearchParams({
      skip: ((page - 1) * limit).toString(),
      limit: limit.toString()
    });

    // 1. Stock Filter
    if (currentHasStockFilter === 'with') params.append('has_stock', 'true');
    if (currentHasStockFilter === 'without') params.append('has_stock', 'false');

    // 2. Server-Side Column Filters (Location Code)
    SERVER_FILTERED_COLUMNS.forEach(key => {
      const selectedValues = currentColumnFilters[key];
      if (selectedValues && selectedValues.length > 0) {
        // Ensure values are joined by comma for the backend API
        params.append(key, selectedValues.join(','));
      }
    });

    return params;
  }, [SERVER_FILTERED_COLUMNS]);

  // Main data fetching function
  const fetchArticles = useCallback(async (page, limit, currentHasStockFilter, currentColumnFilters, currentGlobalSearchTerm) => {
    setLoading(true);
    setError('');
    
    try {
      const token = getToken();
      const queryParams = buildQueryParams(page, limit, currentHasStockFilter, currentColumnFilters);
      
      let url;
      if (currentGlobalSearchTerm.trim()) {
        url = `${API_BASE_URL}/search/?q=${encodeURIComponent(currentGlobalSearchTerm.trim())}&${queryParams}`;
      } else {
        url = `${API_BASE_URL}/?${queryParams}`;
      }

      console.log('Fetching from URL:', url);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`Failed to fetch articles: ${response.status}`);
      
      const data = await response.json();
      let items, total, pageNum, pagesNum;

      // Normalize response structure
      if (Array.isArray(data)) {
        items = data;
        total = data.length;
        pageNum = 1;
        pagesNum = Math.ceil(data.length / limit);
      } else {
        items = data.items || [];
        total = data.total || 0;
        pageNum = data.page || 1;
        pagesNum = data.pages || Math.ceil((data.total || 0) / limit);
      }
      
      // Store the raw articles from the server
      setUnfilteredArticles(items);
      
      setPagination(prev => ({
        ...prev,
        page: pageNum,
        limit: limit,
        total: total,
        pages: pagesNum
      }));
      
    } catch (err) {
      setError(err.message);
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  // --- Unique Values and Client-Side Filtering/Sorting ---

  // Memoize unique values for each column (WITH FALLBACK)
  const uniqueColumnValues = useMemo(() => {
    const values = {};
    columnKeys.forEach(key => {
      if (key === 'code_emplacement') {
        // Use global locations, fallback to current page data
        values[key] = globalLocationCodes.length > 0 
          ? globalLocationCodes 
          : [...new Set(unfilteredArticles.map(article => String(article[key] ?? '')))].sort();
      } else if (CLIENT_FILTERED_COLUMNS.includes(key)) {
        // Use global client values, fallback to current page data
        values[key] = (globalClientFilterValues[key] && globalClientFilterValues[key].length > 0)
          ? globalClientFilterValues[key]
          : [...new Set(unfilteredArticles.map(article => String(article[key] ?? '')))].sort();
      } else {
        // For non-filterable columns, use current page data
        const unique = new Set();
        unfilteredArticles.forEach(article => {
          const value = String(article[key] ?? ''); 
          unique.add(value);
        });
        values[key] = Array.from(unique).sort((a, b) => {
          if (key === 'quantite_en_stock') {
            return parseFloat(a) - parseFloat(b);
          }
          return a.localeCompare(b);
        });
      }
    });
    console.log('Computed unique values:', values);
    return values;
  }, [unfilteredArticles, columnKeys, globalLocationCodes, globalClientFilterValues, CLIENT_FILTERED_COLUMNS]);

  // Memoize the final filtered and sorted list for display
  const filteredAndSortedArticles = useMemo(() => {
    let filtered = unfilteredArticles;

    // 1. Client-Side Filtering (Only for columns NOT server-filtered)
    filtered = filtered.filter(article => {
      for (const key of CLIENT_FILTERED_COLUMNS) {
        const selectedValues = columnFilters[key];
        
        if (selectedValues.length === 0) {
          continue;
        }

        const articleValue = String(article[key] ?? '');

        if (!selectedValues.includes(articleValue)) {
          return false;
        }
      }
      
      return true;
    });

    // 2. Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === 'quantite_en_stock') {
          const numA = parseFloat(aValue);
          const numB = parseFloat(bValue);
          if (numA < numB) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (numA > numB) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filtered;
  }, [unfilteredArticles, columnFilters, sortConfig, CLIENT_FILTERED_COLUMNS]);

  // --- Handlers and Effects ---

  // Effect to fetch data when pagination, stock filter, or column filters change
  useEffect(() => { 
    fetchArticles(pagination.page, pagination.limit, hasStockFilter, columnFilters, globalSearchTerm);
  }, [pagination.page, pagination.limit, hasStockFilter, columnFilters, globalSearchTerm, fetchArticles]);

  // Handler for column filter application
  const applyColumnFilters = (column) => {
    setOpenFilter(null);
    
    // If the applied filter is a server-side filter, we must re-fetch data from page 1
    if (SERVER_FILTERED_COLUMNS.includes(column)) {
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        // If already on page 1, force refetch
        fetchArticles(pagination.page, pagination.limit, hasStockFilter, columnFilters, globalSearchTerm);
      }
    }
  };

  // New handler to set the array of selected values
  const setColumnFilterValues = (column, values) => {
    setColumnFilters(prev => ({ ...prev, [column]: values }));
  };

  const clearColumnFilter = (col) => {
    setColumnFilters(prev => ({ ...prev, [col]: [] })); 
    setOpenFilter(null);
    
    if (SERVER_FILTERED_COLUMNS.includes(col)) {
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        fetchArticles(pagination.page, pagination.limit, hasStockFilter, columnFilters, globalSearchTerm);
      }
    }
  };

  const clearAllFilters = () => {
    setHasStockFilter('all');
    setColumnFilters(columnFilterDefaults);
    setGlobalSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // CRUD Handlers
  const handleSave = () => {
    setShowCreateForm(false);
    setEditingArticle(null);
    fetchArticles(pagination.page, pagination.limit, hasStockFilter, columnFilters, globalSearchTerm); 
  };

  const handleEdit = (article) => {
    setEditingArticle(article);
    setShowCreateForm(true);
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingArticle(null);
  };

  const handleDelete = async (articleId) => {
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE_URL}/${articleId}`, 
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        fetchArticles(pagination.page, pagination.limit, hasStockFilter, columnFilters, globalSearchTerm);
        setDeleteConfirm(null);
      } else {
        throw new Error('Failed to delete article');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error deleting article:', err);
    }
  };

  // Column Visibility Handler
  const toggleColumn = (column) => {
    setHiddenColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      const openCol = openFilter;
      if (openCol && filterDropdownRefs.current[openCol] && !filterDropdownRefs.current[openCol].contains(event.target)) {
        setOpenFilter(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFilter]);

  // --- UI Rendering ---

  if (loading && unfilteredArticles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="w-full mx-auto">
          <div className="flex justify-center items-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />;
  };

  const TableHeader = ({ columnKey, title, isSortable = true }) => {
    const isHidden = hiddenColumns[columnKey];
    if (isHidden) return null;

    const isClientFilterable = CLIENT_FILTERED_COLUMNS.includes(columnKey);
    const isServerFilterable = SERVER_FILTERED_COLUMNS.includes(columnKey);
    const isFilterable = isClientFilterable || isServerFilterable;

    return (
      <th 
        scope="col" 
        className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap"
      >
        <div className="flex items-center space-x-1">
          {isSortable ? (
            <button 
              onClick={() => requestSort(columnKey)}
              className="flex items-center hover:text-gray-900 transition-colors"
            >
              <span>{title}</span>
              {renderSortIcon(columnKey)}
            </button>
          ) : (
            <span>{title}</span>
          )}
          
          {isFilterable && (
            <ColumnFilterDropdown
              column={columnKey}
              uniqueValues={uniqueColumnValues[columnKey] || []}
              filterValues={columnFilters[columnKey] || []}
              setFilterValues={setColumnFilterValues}
              applyFilters={applyColumnFilters}
              clearFilter={clearColumnFilter}
              isOpen={openFilter === columnKey}
              setOpen={setOpenFilter}
              reference={el => filterDropdownRefs.current[columnKey] = el}
            />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {showCreateForm && (
        <ArticleForm 
          article={editingArticle} 
          onSave={handleSave} 
          onCancel={handleCancel} 
          isEditing={!!editingArticle} 
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-red-600 mb-4">Confirm Deletion</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete article <strong>{deleteConfirm.numero_article}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full mx-auto"> 
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Articles Management</h1>
              <p className="text-gray-600 mt-1">
                Managing {pagination.total.toLocaleString()} articles • Server-side pagination
              </p>
            </div>
            <div className="flex items-center space-x-3 mt-4 sm:mt-0">
              {/* Column Visibility Toggle */}
              <div className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700">Columns:</span>
                <button
                  onClick={() => toggleColumn('code_entrepot')}
                  className={`p-1 rounded ${
                    hiddenColumns.code_entrepot ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'
                  }`}
                  title={hiddenColumns.code_entrepot ? 'Show Warehouse' : 'Hide Warehouse'}
                >
                  {hiddenColumns.code_entrepot ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => toggleColumn('created_at')}
                  className={`p-1 rounded ${
                    hiddenColumns.created_at ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'
                  }`}
                  title={hiddenColumns.created_at ? 'Show Created Date' : 'Hide Created Date'}
                >
                  {hiddenColumns.created_at ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>

              {canEdit && (
                <button 
                  onClick={() => { setShowCreateForm(true); setEditingArticle(null); }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  New Article
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                placeholder="Global search (triggers server search)..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowServerFilters(!showServerFilters)}
                className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                  showServerFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FunnelIcon className="h-5 w-5 mr-2" />
                Server Filters
              </button>
              <button
                onClick={() => {
                  fetchArticles(pagination.page, pagination.limit, hasStockFilter, columnFilters, globalSearchTerm);
                }}
                className="flex items-center px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Refresh
              </button>
            </div>
          </div>

          {/* Server Filters (Only for Stock Status) */}
          {showServerFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Status (Server Filter)
                </label>
                <select
                  value={hasStockFilter}
                  onChange={(e) => {
                    setHasStockFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All Articles</option>
                  <option value="with">With Stock (quantite_en_stock &gt; 0)</option>
                  <option value="without">Without Stock (quantite_en_stock = 0)</option>
                </select>
              </div>
            </div>
          )}

          {/* Clear All Filters Button */}
          {(hasStockFilter !== 'all' || globalSearchTerm || Object.values(columnFilters).some(f => f.length > 0)) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={clearAllFilters}
                className="text-sm text-red-600 hover:text-red-700 flex items-center"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Clear All Filters and Search
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <TableHeader columnKey="numero_article" title="Article Number" />
                  <TableHeader columnKey="description_article" title="Description" />
                  <TableHeader columnKey="code_emplacement" title="Location Code" />
                  <TableHeader columnKey="code_entrepot" title="Warehouse Code" />
                  <TableHeader columnKey="quantite_en_stock" title="Stock Qty" />
                  <TableHeader columnKey="catalogue_fournisseur" title="Supplier Catalog" />
                  <TableHeader columnKey="created_at" title="Created At" isSortable={false} />
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedArticles.length > 0 ? (
                  filteredAndSortedArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {article.numero_article}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {article.description_article}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {article.code_emplacement}
                      </td>
                      {!hiddenColumns.code_entrepot && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {article.code_entrepot}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {article.quantite_en_stock}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {article.catalogue_fournisseur}
                      </td>
                      {!hiddenColumns.created_at && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(article.created_at)}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(article)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirm(article)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columnKeys.length + 2} className="px-4 py-10 text-center text-gray-500 text-lg">
                      No articles found matching the current criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeftIcon className="h-5 w-5 mr-2" /> Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next <ChevronRightIcon className="h-5 w-5 ml-2" />
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-500 focus:z-20 focus:outline-offset-0">
                      {pagination.page}
                    </span>
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                      of {pagination.pages}
                    </span>

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticlesList;