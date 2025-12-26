import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

const PageHeader = ({ heading, subHeading }) => (
  <div className="p-6 bg-white border-b border-gray-200">
    <h1 className="text-3xl font-extrabold text-gray-900">{heading}</h1>
    <p className="text-sm text-gray-500 mt-1">{subHeading}</p>
  </div>
);

const Loader = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center py-6">
    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-3 text-sm text-gray-500 animate-pulse">{message}</p>
  </div>
);

const Costing = () => {
  // State Management
  const [projectsData, setProjectsData] = useState([]);
  const [subprojects, setSubprojects] = useState([]);
  const [subprojectsData, setSubprojectsData] = useState([]);
  const [filters, setFilters] = useState({
    project: '',
    subProject: '',
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString()
  });
  
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showNonBillable, setShowNonBillable] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'resource', direction: 'ascending' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  // Pagination & Infinite Scroll
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;
  
  // Totals (fetched separately)
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, profit: 0 });
  
  // Refs
  const scrollContainerRef = useRef(null);
  const loadingRef = useRef(false);
  const pendingUpdates = useRef(new Map());
  const saveTimeouts = useRef(new Map());

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
      setResources([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch projects & subprojects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const [projectRes, subprojectRes] = await Promise.all([
          fetch(`${apiBaseUrl}/project`),
          fetch(`${apiBaseUrl}/project/project-subproject`)
        ]);
        const projects = await projectRes.json();
        const subData = await subprojectRes.json();
        setProjectsData(projects);
        setSubprojects(subData.data || subData);
      } catch (error) {
        console.error("Error fetching projects:", error);
        showToast(`Error: ${error.message}`, 'error');
      }
    };
    fetchProjects();
  }, []);

  // Update subprojects dropdown when project changes
  useEffect(() => {
    if (filters.project) {
      const selectedProject = subprojects.find(sp => sp._id === filters.project);
      setSubprojectsData(selectedProject?.subprojects || []);
    } else {
      setSubprojectsData([]);
    }
  }, [filters.project, subprojects]);

  // Fetch totals separately (doesn't need pagination)
  const fetchTotals = useCallback(async () => {
    const { project, subProject, month, year } = filters;
    
    try {
      const params = new URLSearchParams({
        month,
        year,
        show_non_billable: showNonBillable.toString()
      });
      
      if (project) params.append('project_id', project);
      if (subProject) params.append('subproject_id', subProject);

      const response = await fetch(`${apiBaseUrl}/billing/totals?${params}`);
      if (!response.ok) throw new Error('Failed to fetch totals');
      
      const data = await response.json();
      setTotals({
        revenue: data.revenue || 0,
        cost: data.cost || 0,
        profit: data.profit || 0
      });
    } catch (error) {
      console.error("Error fetching totals:", error);
    }
  }, [filters, showNonBillable]);

  // Main paginated data fetch
  const fetchBillingData = useCallback(async (page = 1, append = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    const { project, subProject, month, year } = filters;

    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        month,
        year,
        sort_by: sortConfig.key,
        sort_order: sortConfig.direction,
        show_non_billable: showNonBillable.toString()
      });

      if (project) params.append('project_id', project);
      if (subProject) params.append('subproject_id', subProject);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const response = await fetch(`${apiBaseUrl}/billing/paginated?${params}`);
      const data = await response.json();
      
      // Handle missing productivity error
      if (!response.ok) {
        if (data.error_type === 'MISSING_PRODUCTIVITY') {
          const subprojectNames = data.missing_productivity.map(m => m.subproject_name).join(', ');
          showToast(
            `Missing productivity rates for: ${subprojectNames}. Please configure productivity rates in settings.`,
            'error'
          );
          setResources([]);
          setTotalRecords(0);
          return;
        }
        throw new Error(data.message || 'Failed to fetch billing data');
      }
      
      if (append) {
        setResources(prev => [...prev, ...data.records]);
      } else {
        setResources(data.records);
      }
      
      setTotalRecords(data.total);
      setTotalPages(data.totalPages);
      setCurrentPage(page);
      setHasMore(data.hasMore);
      
      if (data.records.length > 0 && !append) {
        showToast(`Loaded ${data.records.length} of ${data.total} records`);
      }
    } catch (error) {
      console.error("Error loading billing data:", error);
      showToast(error.message, 'error');
      setResources([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [filters, debouncedSearch, sortConfig, showNonBillable]);

  // Fetch data when filters change
  useEffect(() => {
    setResources([]);
    setCurrentPage(1);
    fetchBillingData(1, false);
    fetchTotals();
  }, [filters, debouncedSearch, sortConfig, showNonBillable]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    if (scrollHeight - scrollTop <= clientHeight * 1.2) {
      fetchBillingData(currentPage + 1, true);
    }
  }, [currentPage, hasMore, isLoading, fetchBillingData]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Optimistic update with debounced API call
  const handleResourceChange = useCallback((uniqueId, field, value) => {
    // Immediate UI update
    setResources(prev => prev.map(r => {
      if (r.uniqueId === uniqueId) {
        const updated = { ...r, [field]: value };
        
        // Update rate if productivity changes
        if (field === 'productivity') {
          // Rate update would be handled by backend
          // For now, keep existing rate
        }
        
        return updated;
      }
      return r;
    }));

    // Store pending update
    const existing = pendingUpdates.current.get(uniqueId) || {};
    pendingUpdates.current.set(uniqueId, { ...existing, [field]: value });

    // Clear existing timeout
    if (saveTimeouts.current.has(uniqueId)) {
      clearTimeout(saveTimeouts.current.get(uniqueId));
    }

    // Debounced save (1 second after last change)
    const timeout = setTimeout(async () => {
      const updates = pendingUpdates.current.get(uniqueId);
      if (!updates) return;

      try {
        const resource = resources.find(r => r.uniqueId === uniqueId);
        if (!resource) return;

        const payload = {
          billingId: resource.billingId,
          isMonthlyRecord: resource.isMonthlyRecord,
          project_id: resource.projectId,
          subproject_id: resource.subprojectId,
          resource_id: resource._id,
          hours: updates.hours !== undefined ? Number(updates.hours) : resource.hours,
          productivity_level: updates.productivity || resource.productivity,
          rate: resource.rate,
          flatrate: resource.flatrate,
          description: resource.description,
          billable_status: resource.isBillable ? 'Billable' : 'Non-Billable',
          month: filters.month,
          year: filters.year
        };

        const response = await fetch(`${apiBaseUrl}/billing/bulk-update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: [payload] })
        });

        if (!response.ok) throw new Error('Update failed');
        
        const data = await response.json();
        
        // Update billingId if it was a new record
        if (data.results && data.results[0]) {
          setResources(prev => prev.map(r => 
            r.uniqueId === uniqueId 
              ? { ...r, billingId: data.results[0]._id, isMonthlyRecord: true }
              : r
          ));
        }
        
        pendingUpdates.current.delete(uniqueId);
        fetchTotals(); // Refresh totals
        
      } catch (error) {
        showToast('Failed to save changes', 'error');
        console.error('Update error:', error);
        // Optionally revert the change
      }
    }, 1000);

    saveTimeouts.current.set(uniqueId, timeout);
  }, [resources, filters, fetchTotals]);

  const handleFilterChange = (e) => {
    const { id, value } = e.target;
    const newFilters = { ...filters, [id]: value };
    if (id === 'project') {
      newFilters.subProject = '';
    }
    setFilters(newFilters);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const formatCurrency = (amount) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 0 
    }).format(amount || 0);

  const columnMap = [
    { header: 'Project', key: 'projectName' },
    { header: 'Sub-Project', key: 'subProjectName' },
    { header: 'Resource', key: 'resource' },
    { header: 'Role', key: 'role' },
    { header: 'Hours', key: 'hours' },
    { header: 'Productivity', key: 'productivity' },
    { header: 'Cost Rate ($)', key: 'rate' },
    { header: 'Costing ($)', key: 'costing' },
    { header: 'Flat Rate ($)', key: 'flatrate' },
    { header: 'Total Bill ($)', key: 'totalbill' },
    { header: 'Billable', key: 'isBillable' }
  ];

  const sortableKeys = ['projectName', 'subProjectName', 'resource', 'hours', 'rate', 'costing', 'flatrate', 'totalbill'];

  return (
    <div className="bg-gray-50 min-h-screen">
      {toast.show && (
        <div className={`fixed top-4 right-4 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-6 py-3 rounded-xl shadow-lg z-50`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>
          {toast.message}
        </div>
      )}

      <PageHeader heading="Costing Dashboard" subHeading="Optimized for 10 Lakh+ records with server-side processing" />

      <div className="p-4 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
              <select 
                id="project" 
                value={filters.project} 
                onChange={handleFilterChange} 
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600"
              >
                <option value="">All Projects</option>
                {projectsData.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Project</label>
              <select 
                id="subProject" 
                value={filters.subProject} 
                onChange={handleFilterChange} 
                disabled={!filters.project}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
              >
                <option value="">All Sub-Projects</option>
                {subprojectsData.map(sp => <option key={sp._id} value={sp._id}>{sp.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select 
                id="month" 
                value={filters.month} 
                onChange={handleFilterChange}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select 
                id="year" 
                value={filters.year} 
                onChange={handleFilterChange}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-600"
              >
                <option>2026</option>
                <option>2025</option>
                <option>2024</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{resources.length}</span> of <span className="font-medium">{totalRecords}</span> records 
              {totalPages > 1 && ` (Page ${currentPage}/${totalPages})`}
            </div>
            <div className="flex space-x-3">
              <input 
                type="text" 
                placeholder="Search resources..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 w-48"
              />
              <button 
                onClick={() => setShowNonBillable(!showNonBillable)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-2"
              >
                <i className={`fas ${showNonBillable ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                <span>{showNonBillable ? 'Hide' : 'Show'} Non-Billable</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg flex flex-col" style={{ height: '60vh' }}>
          <div 
            ref={scrollContainerRef}
            className="overflow-auto flex-1"
          >
            <table className="w-full">
              <thead className="sticky top-0 bg-white border-b z-10">
                <tr>
                  {columnMap.map(({ header, key }) => {
                    const isSortable = sortableKeys.includes(key);
                    return (
                      <th 
                        key={key}
                        onClick={() => isSortable && requestSort(key)}
                        className={`text-left py-4 px-4 font-semibold text-gray-700 ${isSortable ? 'cursor-pointer hover:text-blue-600' : ''}`}
                      >
                        {header}
                        {isSortable && <i className="fas fa-sort ml-1 text-xs"></i>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {resources.map(res => (
                  <tr 
                    key={res.uniqueId} 
                    className={`border-b transition-colors ${res.isBillable ? 'hover:bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <td className="py-3 px-4 text-sm">{res.projectName}</td>
                    <td className="py-3 px-4 text-sm">{res.subProjectName}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <img src={res.avatar_url} alt={res.name} className="w-8 h-8 rounded-full" />
                        <span className="font-medium text-sm">{res.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{res.role}</td>
                    <td className="py-3 px-4">
                      <input 
                        type="number" 
                        value={res.hours}
                        onChange={(e) => handleResourceChange(res.uniqueId, 'hours', e.target.value)}
                        disabled={!res.isEditable}
                        className="w-20 px-2 py-1 border rounded text-sm disabled:bg-gray-200"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <select 
                        value={res.productivity}
                        onChange={(e) => handleResourceChange(res.uniqueId, 'productivity', e.target.value)}
                        disabled={!res.isEditable}
                        className="px-2 py-1 border rounded text-sm disabled:bg-gray-200"
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Best</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 font-semibold text-red-600 text-sm">{formatCurrency(res.rate)}</td>
                    <td className="py-3 px-4 font-bold text-red-700 text-sm">{formatCurrency(res.costing)}</td>
                    <td className="py-3 px-4 font-semibold text-blue-600 text-sm">{formatCurrency(res.flatrate)}</td>
                    <td className="py-3 px-4 font-bold text-blue-700 text-sm">{formatCurrency(res.totalBill)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${res.isBillable ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {res.isBillable ? '✅' : '🚫'}
                      </span>
                    </td>
                  </tr>
                ))}
                
                {isLoading && (
                  <tr>
                    <td colSpan={columnMap.length} className="py-4">
                      <Loader message="Loading more records..." />
                    </td>
                  </tr>
                )}
                
                {!isLoading && resources.length === 0 && (
                  <tr>
                    <td colSpan={columnMap.length} className="text-center py-10">
                      <div className="text-gray-500">
                        <i className="fas fa-folder-open fa-3x mb-3"></i>
                        <h3 className="text-lg font-semibold">No Records Found</h3>
                        <p className="text-sm">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with Totals */}
          <div className="border-t p-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex space-x-8">
                <div className="text-center">
                  <div className="flex items-center space-x-1 mb-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="text-xs text-blue-600 font-medium">Revenue</div>
                  </div>
                  <div className="text-xl font-bold text-blue-700">{formatCurrency(totals.revenue)}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center space-x-1 mb-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="text-xs text-red-600 font-medium">Cost</div>
                  </div>
                  <div className="text-xl font-bold text-red-700">{formatCurrency(totals.cost)}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center space-x-1 mb-1">
                    <div className={`w-3 h-3 ${totals.profit >= 0 ? 'bg-green-500' : 'bg-orange-500'} rounded-full`}></div>
                    <div className={`text-xs ${totals.profit >= 0 ? 'text-green-600' : 'text-orange-600'} font-medium`}>Profit/Loss</div>
                  </div>
                  <div className={`text-xl font-bold ${totals.profit >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
                    {formatCurrency(totals.profit)}
                  </div>
                </div>
              </div>
              <button 
                className="bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 shadow-lg transition-all flex items-center space-x-2"
                onClick={() => showToast('Invoice generation coming soon!')}
              >
                <i className="fas fa-file-invoice"></i>
                <span>Generate Invoice</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Costing;