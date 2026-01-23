// pages/ResourcesPage.jsx - With assignment count badges and full view modal
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import ConfirmDeleteProjectModal from "../components/Project/ConfirmDeleteProjectModal";
import toast from "react-hot-toast";

const apiBaseUrl = import.meta.env.VITE_BACKEND_URL;

// --- API SERVICE ---
const apiService = {
  getResources: (params) => axios.get(`${apiBaseUrl}/resource`, { params }),
  addResource: (resourceData) => axios.post(`${apiBaseUrl}/resource`, resourceData),
  updateResource: (id, resourceData) => axios.put(`${apiBaseUrl}/resource/${id}`, resourceData),
  deleteResource: (id) => axios.delete(`${apiBaseUrl}/resource/${id}`),
  
  uploadResourceCSV: (formData) =>
    axios.post(`${apiBaseUrl}/upload-resource/bulk`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadResourceCSVReplace: (formData) =>
    axios.post(`${apiBaseUrl}/upload-resource/bulk-replace`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
    
  getGeographies: (params) => axios.get(`${apiBaseUrl}/geography`, { params }),
  getClients: (geoId, params) => axios.get(`${apiBaseUrl}/client/geography/${geoId}`, { params }),
  getProjects: (clientId, params) => axios.get(`${apiBaseUrl}/project/client/${clientId}`, { params }),
};

// --- DEBOUNCE HOOK ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

// --- FILTER SELECT COMPONENT ---
const FilterSelect = React.memo(({
  placeholder,
  value,
  onChange,
  options = [],
  disabled = false,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(o => 
      o.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const found = options.find(o => o.value === value);
    return found?.label || value;
  }, [value, options]);

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white cursor-pointer ${
          disabled ? "bg-gray-100 cursor-not-allowed" : "hover:border-gray-400"
        }`}
      >
        <span className={`text-sm ${value ? "text-gray-900" : "text-gray-500"}`}>
          {loading ? "Loading..." : (selectedLabel || placeholder)}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-auto">
            <div
              onClick={() => { onChange(""); setIsOpen(false); setSearch(""); }}
              className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 cursor-pointer"
            >
              {placeholder}
            </div>
            
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">No results</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => { onChange(option.value); setIsOpen(false); setSearch(""); }}
                  className={`px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer ${
                    value === option.value ? "bg-blue-50 text-blue-700" : ""
                  }`}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

FilterSelect.displayName = "FilterSelect";

// --- ASSIGNMENT COUNT BADGE ---
const AssignmentBadge = React.memo(({ assignments, onClick }) => {
  const counts = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) {
      return { projects: 0, locations: 0 };
    }
    
    let locationCount = 0;
    const projectCount = assignments.length;
    
    for (const assignment of assignments) {
      if (assignment.subprojects && Array.isArray(assignment.subprojects)) {
        locationCount += assignment.subprojects.length;
      }
    }
    
    return { projects: projectCount, locations: locationCount };
  }, [assignments]);

  if (counts.locations === 0) {
    return <span className="text-gray-400 text-sm">No assignments</span>;
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition text-sm font-medium"
    >
      <span>{counts.projects} Project{counts.projects !== 1 ? 's' : ''}</span>
      <span className="text-blue-400">•</span>
      <span>{counts.locations} Location{counts.locations !== 1 ? 's' : ''}</span>
      <EyeIcon className="w-4 h-4 ml-1" />
    </button>
  );
});

AssignmentBadge.displayName = "AssignmentBadge";

// --- VIEW ASSIGNMENTS MODAL ---
const ViewAssignmentsModal = React.memo(({ isOpen, onClose, resource }) => {
  if (!isOpen || !resource) return null;

  const assignments = resource.assignments || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <img 
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(resource.name)}&background=3b82f6&color=fff`} 
              alt={resource.name} 
              className="w-10 h-10 rounded-full" 
            />
            <div>
              <h2 className="text-lg font-bold text-gray-900">{resource.name}</h2>
              <p className="text-sm text-gray-500">{resource.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-lg transition">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MapPinIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No assignments found</p>
              <p className="text-sm mt-1">Upload a CSV to assign locations to this resource</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Assignment Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Geography:</span>
                        <span className="font-medium text-gray-900">{assignment.geography_name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Client:</span>
                        <span className="font-medium text-gray-900">{assignment.client_name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FolderIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Process Type:</span>
                        <span className="font-medium text-blue-600">{assignment.project_name || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPinIcon className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-gray-700">
                        Locations ({assignment.subprojects?.length || 0})
                      </span>
                    </div>
                    
                    {assignment.subprojects && assignment.subprojects.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {assignment.subprojects.map((sp, spIdx) => (
                          <span 
                            key={spIdx}
                            className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200"
                          >
                            {sp.subproject_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No locations assigned</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Total: {assignments.length} Project{assignments.length !== 1 ? 's' : ''}, {' '}
              {assignments.reduce((acc, a) => acc + (a.subprojects?.length || 0), 0)} Location{assignments.reduce((acc, a) => acc + (a.subprojects?.length || 0), 0) !== 1 ? 's' : ''}
            </div>
            <button 
              onClick={onClose}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ViewAssignmentsModal.displayName = "ViewAssignmentsModal";

// --- MAIN COMPONENT ---
export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [resourceId, setResourceId] = useState();
  const [confirmDeleteResource, setConfirmDeleteResource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  
  // View assignments modal
  const [viewAssignmentsModal, setViewAssignmentsModal] = useState({ isOpen: false, resource: null });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Hierarchical filter data
  const [geographies, setGeographies] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState({ geo: false, client: false, project: false });

  const [filters, setFilters] = useState({ 
    geography: "",
    client: "",
    project: "", 
    search: "" 
  });
  
  const debouncedSearch = useDebounce(filters.search, 400);

  // Fetch geographies on mount
  useEffect(() => {
    const fetchGeographies = async () => {
      setLoadingFilters(prev => ({ ...prev, geo: true }));
      try {
        const res = await apiService.getGeographies({ limit: 100 });
        const geos = res.data.geographies || [];
        setGeographies(geos.map(g => ({ value: g._id, label: g.name })));
      } catch (err) {
        console.error("Failed to fetch geographies:", err);
      } finally {
        setLoadingFilters(prev => ({ ...prev, geo: false }));
      }
    };
    fetchGeographies();
  }, []);

  // Fetch clients when geography changes
  useEffect(() => {
    if (!filters.geography) {
      setClients([]);
      return;
    }

    const fetchClients = async () => {
      setLoadingFilters(prev => ({ ...prev, client: true }));
      try {
        const res = await apiService.getClients(filters.geography, { limit: 100 });
        const clientsData = res.data.clients || [];
        setClients(clientsData.map(c => ({ value: c._id, label: c.name })));
      } catch (err) {
        console.error("Failed to fetch clients:", err);
      } finally {
        setLoadingFilters(prev => ({ ...prev, client: false }));
      }
    };
    fetchClients();
  }, [filters.geography]);

  // Fetch projects when client changes
  useEffect(() => {
    if (!filters.client) {
      setProjects([]);
      return;
    }

    const fetchProjects = async () => {
      setLoadingFilters(prev => ({ ...prev, project: true }));
      try {
        const res = await apiService.getProjects(filters.client, { limit: 100 });
        const projectsData = res.data.projects || [];
        setProjects(projectsData.map(p => ({ value: p._id, label: p.name })));
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setLoadingFilters(prev => ({ ...prev, project: false }));
      }
    };
    fetchProjects();
  }, [filters.client]);

  // Fetch resources
  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = {
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
      };

      const res = await apiService.getResources(queryParams);

      if (res.data?.resources) {
        setResources(res.data.resources);
        setTotalPages(res.data.pagination?.pages || Math.ceil(res.data.pagination?.total / itemsPerPage) || 1);
        setTotalItems(res.data.pagination?.total || res.data.resources.length);
      } else {
        setResources([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (error) {
      console.error("Failed to fetch resources:", error);
      toast.error("Failed to load resources");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const getResourceName = useCallback((resourceId) => {
    const found = resources.find((r) => r._id === resourceId);
    return found ? found.name : "Unknown";
  }, [resources]);

  const handleDeleteResource = useCallback(async (id) => {
    try {
      await apiService.deleteResource(id);
      toast.success("Resource deleted successfully");
      fetchResources();
    } catch (error) {
      console.error("Failed to delete resource:", error);
      toast.error("Failed to delete resource");
    }
    setConfirmDeleteResource(false);
  }, [fetchResources]);

  const handleSearchChange = useCallback((e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
    setCurrentPage(1);
  }, []);

  const handleCSVUpload = useCallback(async (event, replaceMode = false) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      toast.error("Please upload a valid CSV file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Uploading CSV...");
    try {
      const uploadFn = replaceMode 
        ? apiService.uploadResourceCSVReplace 
        : apiService.uploadResourceCSV;
      
      const res = await uploadFn(formData);
      
      if (res.status === 207) {
        const blob = new Blob([res.data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resource-upload-errors.csv";
        a.click();
        URL.revokeObjectURL(url);
        
        const stats = JSON.parse(res.headers["x-stats"] || "{}");
        toast.error(`Some rows failed. Created: ${stats.created || 0}, Updated: ${stats.updated || 0}. Check downloaded CSV.`, { id: toastId, duration: 5000 });
      } else {
        const { stats } = res.data;
        toast.success(`Created: ${stats.created}, Updated: ${stats.updated}, Assignments: ${stats.assignments}`, { id: toastId });
      }
      
      fetchResources();
    } catch (err) {
      console.error("CSV upload error:", err);
      
      if (err.response?.status === 207) {
        const blob = new Blob([err.response.data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resource-upload-errors.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast.error("Some rows failed. Check downloaded CSV.", { id: toastId });
        fetchResources();
      } else {
        toast.error(err.response?.data?.error || "Error uploading CSV", { id: toastId });
      }
    } finally {
      event.target.value = "";
    }
  }, [fetchResources]);

  const handleDownloadTemplate = useCallback(() => {
    const csvContent = `Name,Location,Process Type,Client,Geography,Email ID
Rashmi Kottachery,Christus Health,Complete logging,MRO,US,rashmi@valerionhealth.us
Rashmi Kottachery,Banner Health,Complete logging,MRO,US,rashmi@valerionhealth.us
Rashmi Kottachery,Duke_Processing,Processing,MRO,US,rashmi@valerionhealth.us
Farheen Hasham,Banner Health_Processing,Processing,MRO,US,farheen@valerionhealth.us
Farheen Hasham,Christus Health,Complete logging,MRO,US,farheen@valerionhealth.us`;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resource-upload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handlePageChange = useCallback((newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ geography: "", client: "", project: "", search: "" });
    setCurrentPage(1);
  }, []);

  return (
    <>
      {/* View Assignments Modal */}
      <ViewAssignmentsModal
        isOpen={viewAssignmentsModal.isOpen}
        onClose={() => setViewAssignmentsModal({ isOpen: false, resource: null })}
        resource={viewAssignmentsModal.resource}
      />
      
      <div id="main-content" className="flex-1 p-4">
        <header id="header" className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Resource Assignment</h1>
              <p className="text-gray-500">Assign resources to projects and locations</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleDownloadTemplate} 
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-gray-200 text-sm"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                <span>Template</span>
              </button>
              
              <label className="cursor-pointer bg-green-100 text-green-700 px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-green-200 text-sm">
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" onChange={(e) => handleCSVUpload(e, false)} className="hidden" />
              </label>
              
              <label className="cursor-pointer bg-orange-100 text-orange-700 px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-orange-200 text-sm" title="Replaces existing assignments">
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Replace CSV</span>
                <input type="file" accept=".csv" onChange={(e) => handleCSVUpload(e, true)} className="hidden" />
              </label>
            </div>
          </div>
        </header>

        {/* Filters Section */}
        <div id="filters-section" className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
            {(filters.geography || filters.client || filters.project || filters.search) && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Geography</label>
              <FilterSelect
                placeholder="All Geographies"
                value={filters.geography}
                onChange={(value) => {
                  setFilters(prev => ({ ...prev, geography: value, client: "", project: "" }));
                  setCurrentPage(1);
                }}
                options={geographies}
                loading={loadingFilters.geo}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
              <FilterSelect
                placeholder="All Clients"
                value={filters.client}
                onChange={(value) => {
                  setFilters(prev => ({ ...prev, client: value, project: "" }));
                  setCurrentPage(1);
                }}
                options={clients}
                disabled={!filters.geography}
                loading={loadingFilters.client}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Process Type</label>
              <FilterSelect
                placeholder="All Process Types"
                value={filters.project}
                onChange={(value) => {
                  setFilters(prev => ({ ...prev, project: value }));
                  setCurrentPage(1);
                }}
                options={projects}
                disabled={!filters.client}
                loading={loadingFilters.project}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Search Resource</label>
              <input 
                type="text" 
                name="search" 
                value={filters.search} 
                onChange={handleSearchChange} 
                placeholder="Name or email..." 
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              />
            </div>
            <div className="flex items-end">
              <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-700">
                {totalItems} Resource{totalItems !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* CSV Format Info */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-green-800">📋 CSV Upload Format</h3>
            <button
              onClick={() => setShowFormatInfo(!showFormatInfo)}
              className="text-sm text-green-700 hover:text-green-900"
            >
              {showFormatInfo ? "Hide Details" : "Show Details"}
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2 text-xs mt-3">
            <div className="bg-white rounded px-2 py-1.5 text-center font-medium border border-green-200">Name</div>
            <div className="bg-white rounded px-2 py-1.5 text-center font-medium border border-green-200">Location</div>
            <div className="bg-white rounded px-2 py-1.5 text-center font-medium border border-green-200">Process Type</div>
            <div className="bg-white rounded px-2 py-1.5 text-center font-medium border border-green-200">Client</div>
            <div className="bg-white rounded px-2 py-1.5 text-center font-medium border border-green-200">Geography</div>
            <div className="bg-white rounded px-2 py-1.5 text-center font-medium border border-green-200">Email ID</div>
          </div>
          {showFormatInfo && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-green-200 text-xs text-gray-700">
              <p className="mb-2"><strong>Example rows:</strong></p>
              <code className="block bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                Rashmi Kottachery,Christus Health,Complete logging,MRO,US,rashmi@valerionhealth.us<br/>
                Farheen Hasham,Banner Health_Processing,Processing,MRO,US,farheen@valerionhealth.us
              </code>
              <ul className="mt-3 space-y-1">
                <li>• <strong>Process Type:</strong> "Complete logging" maps to "Logging", "Processing" maps to "Processing"</li>
                <li>• <strong>Location:</strong> Must match exact subproject name in the system</li>
                <li>• <strong>Upload CSV:</strong> Merges with existing assignments</li>
                <li>• <strong>Replace CSV:</strong> Replaces all existing assignments for each resource</li>
              </ul>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden max-h-[55vh] flex flex-col border">
          <div className="overflow-y-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assignments</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <span className="ml-3">Loading resources...</span>
                      </div>
                    </td>
                  </tr>
                ) : resources.length > 0 ? (
                  resources.map((res) => (
                    <tr key={res._id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(res.name)}&background=random`} 
                            alt={res.name} 
                            className="w-9 h-9 rounded-full mr-3" 
                          />
                          <span className="text-sm font-medium text-gray-900">{res.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                        {res.email}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                          {res.role || "associate"}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <AssignmentBadge 
                          assignments={res.assignments}
                          onClick={() => setViewAssignmentsModal({ isOpen: true, resource: res })}
                        />
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          <button 
                            onClick={() => setViewAssignmentsModal({ isOpen: true, resource: res })}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="View Assignments"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => { 
                              setConfirmDeleteResource(true); 
                              setResourceId(res._id); 
                            }} 
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"
                            title="Delete"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      No resources found. Upload a CSV to add resources.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <ConfirmDeleteProjectModal 
            isOpen={confirmDeleteResource} 
            onClose={() => setConfirmDeleteResource(false)} 
            projectName={getResourceName(resourceId)} 
            onConfirm={() => handleDeleteResource(resourceId)} 
          />

          {/* Pagination */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{" "}
                <span className="font-medium">{totalItems}</span>
              </div>
              <div className="flex items-center space-x-2">
                <select 
                  value={itemsPerPage} 
                  onChange={handleItemsPerPageChange} 
                  className="border border-gray-300 rounded-md text-sm px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <div className="flex rounded-md shadow-sm">
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1} 
                    className={`inline-flex items-center px-2 py-1.5 rounded-l-md border border-gray-300 bg-white text-sm ${
                      currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <span className="inline-flex items-center px-4 py-1.5 border-t border-b border-gray-300 bg-white text-sm text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages || totalPages === 0} 
                    className={`inline-flex items-center px-2 py-1.5 rounded-r-md border border-gray-300 bg-white text-sm ${
                      currentPage === totalPages || totalPages === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}