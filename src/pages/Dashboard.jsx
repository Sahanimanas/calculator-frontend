// pages/BillingDashboard.jsx - WITH GEOGRAPHY FILTER

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';

const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

// =============================================
// HELPER COMPONENTS (Same as before)
// =============================================

const PageHeader = ({ heading, subHeading }) => (
  <div className="p-6 bg-white border-b border-gray-200">
    <h1 className="text-3xl font-extrabold text-gray-900">{heading}</h1>
    <p className="text-sm text-gray-500 mt-1">{subHeading}</p>
  </div>
);

const Loader = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center py-10">
    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-3 text-sm text-gray-500">{message}</p>
  </div>
);

// Async Searchable Select Component
const AsyncSelect = ({ 
  value, 
  onChange, 
  fetchOptions, 
  placeholder = "Search...",
  disabled = false,
  labelKey = "name",
  valueKey = "_id"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || disabled) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetchOptions(search);
        setOptions(results || []);
      } catch (error) {
        console.error('Error fetching options:', error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, isOpen, fetchOptions, disabled]);

  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      return;
    }
    const found = options.find(opt => opt[valueKey] === value);
    if (found) {
      setSelectedLabel(found[labelKey]);
    }
  }, [value, options, labelKey, valueKey]);

  const handleSelect = (option) => {
    onChange(option[valueKey]);
    setSelectedLabel(option[labelKey]);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSelectedLabel('');
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between cursor-pointer ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-blue-400'
        }`}
      >
        <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center space-x-1">
          {value && !disabled && (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 p-1"
            >
              ✕
            </button>
          )}
          <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 text-center text-gray-500">Loading...</div>
            ) : options.length === 0 ? (
              <div className="p-3 text-center text-gray-500">
                {search ? 'No results found' : 'Type to search'}
              </div>
            ) : (
              options.map((option) => (
                <div
                  key={option[valueKey]}
                  onClick={() => handleSelect(option)}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                    option[valueKey] === value ? 'bg-blue-100 text-blue-700' : ''
                  }`}
                >
                  {option[labelKey]}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// CSV Format Modal (same as before)
const CSVFormatModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sampleCSV = `Allocation Date,Name,Request Type,Location,Process Type,Geography
11/1/2025,John Smith,New Request,Bronx-Care,Verisma Complete Logging,US
11/1/2025,Jane Doe,Duplicate,Mumbai Office,Data Processing,IND
11/2/2025,Bob Johnson,Key,New York Office,Medical Coding,US`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h2 className="text-xl font-semibold text-gray-900">CSV Upload Format</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Required Columns</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium text-gray-700">Allocation Date:</div>
                <div className="text-gray-600">MM/DD/YYYY or YYYY-MM-DD format</div>
                
                <div className="font-medium text-gray-700">Name:</div>
                <div className="text-gray-600">Resource/Employee name</div>
                
                <div className="font-medium text-gray-700">Request Type:</div>
                <div className="text-gray-600">New Request, Key, or Duplicate</div>
                
                <div className="font-medium text-gray-700">Location:</div>
                <div className="text-gray-600">Subproject/Location name</div>
                
                <div className="font-medium text-gray-700">Process Type:</div>
                <div className="text-gray-600">Project/Process name</div>
                
                <div className="font-medium text-gray-700">Geography:</div>
                <div className="text-gray-600">Exact name from your database</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Sample CSV Content</h3>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre">{sampleCSV}</pre>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">📝 Important Notes:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li>Geography must match EXACT name in your database</li>
              <li>Request Type must be: "New Request", "Key", or "Duplicate"</li>
              <li>Each row represents one allocation occurrence</li>
              <li>System will count occurrences and calculate billing based on rates</li>
              <li>Existing data for the same date range will be replaced</li>
            </ul>
          </div>

          <div className="flex justify-end pt-3 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Upload Modal (same as before - keeping it short for space)
const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
      } else {
        toast.error('Please upload a CSV file');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiBaseUrl}/allocation/upload-allocations`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/csv')) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'allocation-upload-errors.csv';
          a.click();
          toast.error('Upload failed. Check the downloaded error file.');
          setUploading(false);
          return;
        }

        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      toast.success(`Successfully uploaded ${data.summary.totalRecords} records!`);
      onUploadSuccess();
      onClose();
      setFile(null);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h2 className="text-xl font-semibold text-gray-900">Upload Allocation Data</h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="text-6xl mb-3">📄</div>
            
            {file ? (
              <div className="space-y-2">
                <div className="text-green-600 font-medium">✓ File selected</div>
                <div className="text-sm text-gray-600">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-red-600 hover:text-red-700 underline"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-gray-700 font-medium">
                  Drag and drop your CSV file here
                </div>
                <div className="text-sm text-gray-500">or</div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="text-sm text-yellow-800">
              <strong>Note:</strong> Uploading will replace existing data for the same date range in the CSV.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <span>📤</span>
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// MAIN DASHBOARD COMPONENT
// =============================================

const BillingDashboard = () => {
  // ALL State declarations
  const [geographiesData, setGeographiesData] = useState([]); // NEW
  const [projectsData, setProjectsData] = useState([]);
  const [filters, setFilters] = useState({
    geography: '', // NEW
    project: '',
    subProject: '',
    month: 'all',
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardData, setDashboardData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [grandTotals, setGrandTotals] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'location', direction: 'asc' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [useAllocationData, setUseAllocationData] = useState(true);
  const [latestUpload, setLatestUpload] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 50
  });

  // Helpers
  const formatCurrency = (amount) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 2 
    }).format(amount || 0);

  const formatNumber = (num) => 
    new Intl.NumberFormat('en-US').format(num || 0);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Fetch geographies and projects on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [geoResponse, projResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/geography`),
          fetch(`${apiBaseUrl}/project`)
        ]);
        
        const geographies = await geoResponse.json();
        const projects = await projResponse.json();
        
        setGeographiesData(Array.isArray(geographies) ? geographies.geographies : geographies.geographies || []);
        setProjectsData(Array.isArray(projects) ? projects : projects.data || []);
        // console.log(geographies.geographies)
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch latest upload info
  const fetchLatestUpload = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/allocation/latest-upload`);
      const data = await response.json();
      
      if (data.upload) {
        setLatestUpload(data.upload);
      }
    } catch (error) {
      console.error('Error fetching latest upload:', error);
    }
  }, []);

  useEffect(() => {
    if (useAllocationData) {
      fetchLatestUpload();
    }
  }, [useAllocationData, fetchLatestUpload]);

  // Fetch subprojects function
  const fetchSubprojects = useCallback(async (search = '') => {
    if (!filters.project) return [];
    
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50'
      });
      
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(
        `${apiBaseUrl}/project/${filters.project}/subproject?${params}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch subprojects');
      
      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      console.error("Error fetching subprojects:", error);
      return [];
    }
  }, [filters.project]);

  // Clear subproject when project changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, subProject: '' }));
  }, [filters.project]);

  // Fetch billing dashboard data
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        year: filters.year
      });

      if (filters.month !== 'all') {
        params.append('month', filters.month);
      }
      if (filters.geography) {
        params.append('geography_id', filters.geography);
      }
      if (filters.project) {
        params.append('project_id', filters.project);
      }
      if (filters.subProject) {
        params.append('subproject_id', filters.subProject);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`${apiBaseUrl}/dashboard/billing-summary?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch dashboard data');
      }

      setDashboardData(data.data || []);
      setTotals(data.totals || null);

    } catch (error) {
      console.error("Error loading dashboard:", error);
      setDashboardData([]);
      setTotals(null);
    } finally {
      setIsLoading(false);
    }
  }, [filters, searchTerm]);

  // Fetch allocation summary data WITH PAGINATION AND GEOGRAPHY FILTER
  const fetchAllocationData = useCallback(async (page = 1) => {
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        year: filters.year,
        page: page.toString(),
        limit: '50'
      });

      if (filters.month !== 'all') {
        params.append('month', filters.month);
      }
      if (filters.geography) {
        params.append('geography_id', filters.geography);
      }
      if (filters.project) {
        params.append('project_id', filters.project);
      }
      if (filters.subProject) {
        params.append('subproject_id', filters.subProject);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (filters.startDate) {
        params.append('start_date', filters.startDate);
      }
      if (filters.endDate) {
        params.append('end_date', filters.endDate);
      }

      const response = await fetch(`${apiBaseUrl}/allocation/allocation-summary?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch allocation data');
      }

      setDashboardData(data.data || []);
      setTotals(data.totals || null);
      setGrandTotals(data.grandTotals || null);
      setPagination(data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 50
      });

    } catch (error) {
      console.error("Error loading allocation data:", error);
      setDashboardData([]);
      setTotals(null);
      setGrandTotals(null);
    } finally {
      setIsLoading(false);
    }
  }, [filters, searchTerm]);

  // Fetch data when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (useAllocationData) {
        fetchAllocationData(1);
      } else {
        fetchDashboardData();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, searchTerm, useAllocationData, fetchAllocationData, fetchDashboardData]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { id, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleGeographyChange = (value) => {
    setFilters(prev => ({
      ...prev,
      geography: value,
      project: '',
      subProject: ''
    }));
  };

  const handleProjectChange = (value) => {
    setFilters(prev => ({
      ...prev,
      project: value,
      subProject: ''
    }));
  };

  const handleSubprojectChange = (value) => {
    setFilters(prev => ({
      ...prev,
      subProject: value
    }));
  };

  const handleUploadSuccess = () => {
    if (useAllocationData) {
      fetchAllocationData(1);
      fetchLatestUpload();
    }
  };

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = [...dashboardData].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    
    if (typeof aVal === 'string') {
      return sortConfig.direction === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Export to CSV
  // pages/BillingDashboard.jsx - UPDATE exportToCSV FUNCTION

const exportToCSV = async () => {
  try {
    toast.loading('Preparing export...');
    
    // Fetch ALL data for export (no pagination)
    const params = new URLSearchParams({
      year: filters.year
    });

    if (filters.month !== 'all') {
      params.append('month', filters.month);
    }
    if (filters.geography) {
      params.append('geography_id', filters.geography);
    }
    if (filters.project) {
      params.append('project_id', filters.project);
    }
    if (filters.subProject) {
      params.append('subproject_id', filters.subProject);
    }
    if (searchTerm) {
      params.append('search', searchTerm);
    }
    if (filters.startDate) {
      params.append('start_date', filters.startDate);
    }
    if (filters.endDate) {
      params.append('end_date', filters.endDate);
    }

    const response = await fetch(`${apiBaseUrl}/allocation/allocation-summary-export?${params}`);
    const exportData = await response.json();

    if (!response.ok) {
      throw new Error(exportData.message || 'Failed to export data');
    }

    const allData = exportData.data || [];
    const exportTotals = exportData.totals || null;

    toast.dismiss();
    
    if (allData.length === 0) {
      toast.error('No data to export');
      return;
    }

    toast.success(`Exporting ${allData.length} records...`);

    const headers = [
      'Sr No', 'Locations', 'Process Type', 
      'Duplicate', 'Total (Duplicate)', 
      'Key', 'Total (Key)', 
      'New Request', 'Total (New Request)',
      'Total Cases/Hours', 'Total Billing', 'Geography'
    ];

    const rows = allData.map((row, idx) => [
      idx + 1,
      row.location,
      row.processType,
      row.duplicateHours,
      row.duplicateTotal?.toFixed(2) || '0.00',
      row.keyHours,
      row.keyTotal?.toFixed(2) || '0.00',
      row.newRequestHours,
      row.newRequestTotal?.toFixed(2) || '0.00',
      row.totalCasesHours,
      row.totalBilling?.toFixed(2) || '0.00',
      row.geographyType === 'onshore' ? 'US' : 'IND'
    ]);

    if (exportTotals) {
      rows.push([
        '', 'TOTALS', '',
        exportTotals.duplicateHours,
        exportTotals.duplicateTotal?.toFixed(2) || '0.00',
        exportTotals.keyHours,
        exportTotals.keyTotal?.toFixed(2) || '0.00',
        exportTotals.newRequestHours,
        exportTotals.newRequestTotal?.toFixed(2) || '0.00',
        exportTotals.totalCasesHours,
        exportTotals.totalBilling?.toFixed(2) || '0.00',
        ''
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateRange = filters.startDate && filters.endDate 
      ? `${filters.startDate}-to-${filters.endDate}`
      : `${filters.year}-${filters.month || 'all'}`;
    a.download = `billing-dashboard-${dateRange}-${allData.length}-records.csv`;
    a.click();
    
    toast.success(`Successfully exported ${allData.length} records!`);

  } catch (error) {
    console.error('Export error:', error);
    toast.dismiss();
    toast.error(error.message || 'Failed to export data');
  }
};

  // Column definitions
  const columns = [
    { key: 'srNo', header: 'Sr No', sortable: false, className: 'w-16' },
    { key: 'location', header: 'Locations', sortable: true, className: 'min-w-[180px]' },
    { key: 'processType', header: 'Process Type', sortable: true, className: 'min-w-[150px]' },
    { key: 'duplicateHours', header: 'Duplicate', sortable: true, className: 'w-24 text-right', isNumber: true },
    { key: 'duplicateTotal', header: 'Total', sortable: true, className: 'w-28 text-right', isCurrency: true },
    { key: 'keyHours', header: 'Key', sortable: true, className: 'w-24 text-right', isNumber: true },
    { key: 'keyTotal', header: 'Total', sortable: true, className: 'w-28 text-right', isCurrency: true },
    { key: 'newRequestHours', header: 'New Request', sortable: true, className: 'w-28 text-right', isNumber: true },
    { key: 'newRequestTotal', header: 'Total', sortable: true, className: 'w-32 text-right', isCurrency: true },
    { key: 'totalCasesHours', header: 'Total Cases/Hours', sortable: true, className: 'w-36 text-right', isNumber: true },
    { key: 'totalBilling', header: 'Total Billing', sortable: true, className: 'w-36 text-right', isCurrency: true },
    { key: 'geography', header: 'Geography', sortable: true, className: 'w-24 text-center' }
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader 
        heading="Billing Dashboard" 
        subHeading="Aggregated view of billing by Location, Process Type, and Request Type" 
      />

      <div className="p-4 space-y-4">
        {/* Latest Upload Info Banner */}
        {useAllocationData && latestUpload && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* <div className="text-blue-600 text-2xl">📅</div> */}
                <div>
                  <div className="text-sm font-semibold text-blue-900">
                    Latest Upload Data Range
                  </div>
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">
                      {formatDate(latestUpload.start_date)} 
                    </span>
                    {' '} to {' '}
                    <span className="font-medium">
                      {formatDate(latestUpload.end_date)}
                    </span>
                    {' '}
                    <span className="text-blue-600">
                      ({latestUpload.total_records} records)
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-blue-600">
                Uploaded: {new Date(latestUpload.upload_date).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4">
          {/* Data Source Toggle */}
          <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">Data Source:</label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setUseAllocationData(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    useAllocationData
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Allocation Upload (Count + Billing)
                </button>
                <button
                  onClick={() => setUseAllocationData(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !useAllocationData
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Billing Data (Hours/Cost)
                </button>
              </div>
            </div>

            {useAllocationData && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFormatModal(true)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  {/* <span>📋</span> */}
                  <span>CSV Format</span>
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center space-x-2"
                >
                  {/* <span>📤</span> */}
                  <span>Upload CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* Filters Grid - WITH GEOGRAPHY FILTER */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            {/* Geography Filter - NEW */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geography</label>
              <select
                id="geography"
                value={filters.geography}
                onChange={(e) => handleGeographyChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Geographies</option>
                {geographiesData.map(g => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Process Type (Project)</label>
              <select
                id="project"
                value={filters.project}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Projects</option>
                {projectsData.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Subproject Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (Sub-Project)</label>
              <AsyncSelect
                value={filters.subProject}
                onChange={handleSubprojectChange}
                fetchOptions={fetchSubprojects}
                placeholder={!filters.project ? "Select project first" : "Search locations..."}
                disabled={!filters.project}
                labelKey="name"
                valueKey="_id"
              />
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select
                id="month"
                value={filters.month}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Months</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                id="year"
                value={filters.year}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="2027">2027</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

            {/* START DATE FILTER */}
            {useAllocationData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* END DATE FILTER */}
            {useAllocationData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date Range Display */}
          {useAllocationData && (filters.startDate || filters.endDate) && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 text-sm text-green-800">
                <span className="font-semibold">📅 Filtered Date Range:</span>
                <span>
                  {filters.startDate || 'Beginning'} to {filters.endDate || 'End'}
                </span>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))}
                  className="ml-auto text-red-600 hover:text-red-800 font-medium"
                >
                  Clear Dates
                </button>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{sortedData.length}</span> records
              {useAllocationData && latestUpload && !filters.startDate && !filters.endDate && (
                <span className="ml-2 text-gray-500">
                  • Data till {formatDate(latestUpload.end_date)}
                </span>
              )}
            </div>
            <button
              onClick={exportToCSV}
              disabled={sortedData.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {/* <span>📥</span> */}
              <span>Export CSV</span>
            </button>
          </div>

          {/* Pagination Controls */}
          {useAllocationData && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Page {pagination.currentPage} of {pagination.totalPages} 
                <span className="ml-2">
                  (Showing {dashboardData.length} of {pagination.totalItems} total records)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fetchAllocationData(1)}
                  disabled={pagination.currentPage === 1 || isLoading}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => fetchAllocationData(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage || isLoading}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const startPage = Math.max(1, pagination.currentPage - 2);
                  const pageNum = startPage + i;
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchAllocationData(pageNum)}
                      disabled={isLoading}
                      className={`px-3 py-1 border rounded ${
                        pagination.currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-100'
                      } disabled:opacity-50`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => fetchAllocationData(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage || isLoading}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => fetchAllocationData(pagination.totalPages)}
                  disabled={pagination.currentPage === pagination.totalPages || isLoading}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Data Table - Same as before */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th colSpan={3} className="py-2 px-3 text-left text-xs font-bold text-gray-600 uppercase"></th>
                  <th colSpan={2} className="py-2 px-3 text-center text-xs font-bold text-orange-600 uppercase bg-orange-50 border-l">
                    Duplicate
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center text-xs font-bold text-purple-600 uppercase bg-purple-50 border-l">
                    Key
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center text-xs font-bold text-blue-600 uppercase bg-blue-50 border-l">
                    New Request
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center text-xs font-bold text-green-600 uppercase bg-green-50 border-l">
                    Totals
                  </th>
                  <th className="py-2 px-3 text-center text-xs font-bold text-gray-600 uppercase border-l"></th>
                </tr>
                <tr className="bg-gray-50 border-b">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`py-3 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${col.className || ''} ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${col.key.includes('duplicate') ? 'bg-orange-50/50' : ''} ${col.key.includes('key') && !col.key.includes('duplicate') ? 'bg-purple-50/50' : ''} ${col.key.includes('newRequest') ? 'bg-blue-50/50' : ''} ${col.key.includes('total') && !col.key.includes('duplicate') && !col.key.includes('key') && !col.key.includes('newRequest') ? 'bg-green-50/50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-gray-400 ml-1">
                            {sortConfig.key === col.key 
                              ? (sortConfig.direction === 'asc' ? '↑' : '↓') 
                              : '↕'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <Loader message="Loading dashboard data..." />
                    </td>
                  </tr>
                ) : sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-10 text-center">
                      <div className="text-gray-500">
                        <div className="text-4xl mb-2">📊</div>
                        <p className="font-medium">No data found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {sortedData.map((row, idx) => (
                      <tr 
                        key={`${row.projectId}-${row.subprojectId}`} 
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-3 text-sm text-gray-600">{idx + 1}</td>
                        <td className="py-3 px-3 text-sm font-medium text-gray-900">{row.location}</td>
                        <td className="py-3 px-3 text-sm text-gray-700">{row.processType}</td>
                        
                        <td className="py-3 px-3 text-sm text-right bg-orange-50/30 font-medium">
                          {formatNumber(row.duplicateHours)}
                        </td>
                        <td className="py-3 px-3 text-sm text-right bg-orange-50/30 text-orange-700 font-semibold">
                          {formatCurrency(row.duplicateTotal || 0)}
                        </td>
                        
                        <td className="py-3 px-3 text-sm text-right bg-purple-50/30 font-medium">
                          {formatNumber(row.keyHours)}
                        </td>
                        <td className="py-3 px-3 text-sm text-right bg-purple-50/30 text-purple-700 font-semibold">
                          {formatCurrency(row.keyTotal || 0)}
                        </td>
                        
                        <td className="py-3 px-3 text-sm text-right bg-blue-50/30 font-medium">
                          {formatNumber(row.newRequestHours)}
                        </td>
                        <td className="py-3 px-3 text-sm text-right bg-blue-50/30 text-blue-700 font-semibold">
                          {formatCurrency(row.newRequestTotal || 0)}
                        </td>
                        
                        <td className="py-3 px-3 text-sm text-right bg-green-50/30 font-bold text-gray-900">
                          {formatNumber(row.totalCasesHours)}
                        </td>
                        <td className="py-3 px-3 text-sm text-right bg-green-50/30 font-bold text-green-700">
                          {formatCurrency(row.totalBilling || 0)}
                        </td>
                        
                        <td className="py-3 px-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            row.geographyType === 'onshore' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {row.geographyType === 'onshore' ? 'US' : 'IND'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    
                    {totals && (
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td className="py-4 px-3"></td>
                        <td className="py-4 px-3 text-sm text-gray-900 uppercase">
                          {useAllocationData && pagination.totalPages > 1 ? 'Page Total' : 'Grand Total'}
                        </td>
                        <td className="py-4 px-3"></td>
                        
                        <td className="py-4 px-3 text-sm text-right bg-orange-100">
                          {formatNumber(totals.duplicateHours)}
                        </td>
                        <td className="py-4 px-3 text-sm text-right bg-orange-100 text-orange-800">
                          {formatCurrency(totals.duplicateTotal || 0)}
                        </td>
                        
                        <td className="py-4 px-3 text-sm text-right bg-purple-100">
                          {formatNumber(totals.keyHours)}
                        </td>
                        <td className="py-4 px-3 text-sm text-right bg-purple-100 text-purple-800">
                          {formatCurrency(totals.keyTotal || 0)}
                        </td>
                        
                        <td className="py-4 px-3 text-sm text-right bg-blue-100">
                          {formatNumber(totals.newRequestHours)}
                        </td>
                        <td className="py-4 px-3 text-sm text-right bg-blue-100 text-blue-800">
                          {formatCurrency(totals.newRequestTotal || 0)}
                        </td>
                        
                        <td className="py-4 px-3 text-sm text-right bg-green-100 text-gray-900">
                          {formatNumber(totals.totalCasesHours)}
                        </td>
                        <td className="py-4 px-3 text-sm text-right bg-green-100 text-green-800">
                          {formatCurrency(totals.totalBilling || 0)}
                        </td>
                        
                        <td className="py-4 px-3"></td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        {useAllocationData && grandTotals ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-orange-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Duplicate (Total)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(grandTotals.duplicateHours)} cases
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Across all {pagination.totalItems} locations
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Key (Total)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(grandTotals.keyHours)} cases
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Across all {pagination.totalItems} locations
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">New Request (Total)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(grandTotals.newRequestHours)} cases
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Across all {pagination.totalItems} locations
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Grand Total</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(grandTotals.totalCasesHours)} cases
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Across all {pagination.totalItems} locations
              </div>
            </div>
          </div>
        ) : totals && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-orange-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Duplicate</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(totals.duplicateHours)} cases
              </div>
              <div className="text-lg font-semibold text-orange-600">
                {formatCurrency(totals.duplicateTotal)}
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Key</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(totals.keyHours)} cases
              </div>
              <div className="text-lg font-semibold text-purple-600">
                {formatCurrency(totals.keyTotal)}
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">New Request</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(totals.newRequestHours)} cases
              </div>
              <div className="text-lg font-semibold text-blue-600">
                {formatCurrency(totals.newRequestTotal)}
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500 uppercase tracking-wider">Total Billing</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(totals.totalCasesHours)} cases
              </div>
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency(totals.totalBilling)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
      />
      
      <CSVFormatModal
        isOpen={showFormatModal}
        onClose={() => setShowFormatModal(false)}
      />
    </div>
  );
};

export default BillingDashboard;