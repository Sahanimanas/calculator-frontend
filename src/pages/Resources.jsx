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
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import ConfirmDeleteProjectModal from "../components/Project/ConfirmDeleteProjectModal";
import toast from "react-hot-toast";

const apiBaseUrl = import.meta.env.VITE_BACKEND_URL;

// --- OPTIMIZED API SERVICE ---
const apiService = {
  getResources: (params) => axios.get(`${apiBaseUrl}/resource`, { params }),
  
  // NEW: Search endpoints with pagination
  searchProjects: (params) => axios.get(`${apiBaseUrl}/resource/search-projects`, { params }),
  searchSubprojects: (params) => axios.get(`${apiBaseUrl}/resource/search-subprojects`, { params }),
  
  addResource: (resourceData) => axios.post(`${apiBaseUrl}/resource`, resourceData),
  updateResource: (id, resourceData) => axios.put(`${apiBaseUrl}/resource/${id}`, resourceData),
  deleteResource: (id) => axios.delete(`${apiBaseUrl}/resource/${id}`),
  uploadResourceCSV: (formData) =>
    axios.post(`${apiBaseUrl}/upload-resource/bul`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
    }),
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

// --- ASYNC SEARCHABLE SELECT COMPONENT ---
const AsyncSearchSelect = React.memo(({
  placeholder = "Search...",
  value = [], // Array of { value, label }
  onChange,
  fetchOptions, // async function(search) => { options: [], hasMore: bool }
  isMulti = false,
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  
  const debouncedSearch = useDebounce(search, 300);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch options on search change
  useEffect(() => {
    if (!isOpen) return;
    
    const loadOptions = async () => {
      setIsLoading(true);
      try {
        const result = await fetchOptions(debouncedSearch);
        setOptions(result.options || []);
        setHasMore(result.hasMore || false);
      } catch (err) {
        console.error("Failed to fetch options:", err);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadOptions();
  }, [debouncedSearch, isOpen, fetchOptions]);

  const handleSelect = useCallback((option) => {
    if (isMulti) {
      const exists = value.some(v => v.value === option.value);
      if (!exists) {
        onChange([...value, option]);
      }
    } else {
      onChange([option]);
      setIsOpen(false);
    }
    setSearch("");
  }, [isMulti, value, onChange]);

  const handleRemove = useCallback((optionValue) => {
    onChange(value.filter(v => v.value !== optionValue));
  }, [value, onChange]);

  const filteredOptions = useMemo(() => {
    const selectedIds = new Set(value.map(v => v.value));
    return options.filter(opt => !selectedIds.has(opt.value));
  }, [options, value]);

  const displayValue = useMemo(() => {
    if (!isMulti && value.length > 0) return value[0].label;
    return "";
  }, [isMulti, value]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Tags (Multi) */}
      {isMulti && value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {value.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
            >
              <span className="truncate max-w-[150px]">{item.label}</span>
              <button
                type="button"
                onClick={() => handleRemove(item.value)}
                className="text-blue-600 hover:text-blue-800"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className={`flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white cursor-pointer ${
          disabled ? "bg-gray-100 cursor-not-allowed" : "hover:border-gray-400"
        }`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : displayValue}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={value.length === 0 ? placeholder : isMulti ? "Add more..." : placeholder}
          disabled={disabled}
          className="flex-1 outline-none text-sm bg-transparent min-w-0"
        />
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              Loading...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {search ? "No results found" : "Type to search..."}
            </div>
          ) : (
            <>
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                >
                  {option.label}
                </div>
              ))}
              {hasMore && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center border-t">
                  Type more to refine results...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

AsyncSearchSelect.displayName = "AsyncSearchSelect";

// --- SIMPLE FILTER SELECT (for page filters - loads first 20 on open) ---
const FilterSelect = React.memo(({
  placeholder,
  value,
  onChange,
  fetchOptions,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);
  
  const debouncedSearch = useDebounce(search, 300);

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

  useEffect(() => {
    if (!isOpen) return;
    
    const loadOptions = async () => {
      setIsLoading(true);
      try {
        const result = await fetchOptions(debouncedSearch);
        setOptions(result.options || []);
      } catch (err) {
        console.error("Failed to fetch options:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadOptions();
  }, [debouncedSearch, isOpen, fetchOptions]);

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
          disabled ? "bg-gray-100" : "hover:border-gray-400"
        }`}
      >
        <span className={`text-sm ${value ? "text-gray-900" : "text-gray-500"}`}>
          {selectedLabel || placeholder}
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
            {/* Clear option */}
            <div
              onClick={() => { onChange(""); setIsOpen(false); setSearch(""); }}
              className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 cursor-pointer"
            >
              {placeholder}
            </div>
            
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">No results</div>
            ) : (
              options.map((option) => (
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

// --- MEMOIZED DROPDOWN COMPONENT (for table cells) ---
const DropdownList = React.memo(({ items }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState("bottom");
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);

  const arr = useMemo(() => {
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedMenuHeight = 150;
      const newPosition = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow ? "top" : "bottom";
      setPosition(newPosition);
      setCoords({ left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width });
    }
  }, [open]);

  const displayText = useMemo(() => {
    if (!arr.length) return null;
    return arr.length === 1 ? arr[0] : `${arr[0]} +${arr.length - 1}`;
  }, [arr]);

  if (!arr.length) return <span className="text-gray-500">Unassigned</span>;

  const DropdownMenu = coords && (
    <div
      style={{
        position: "fixed",
        left: `${coords.left}px`,
        top: position === "bottom" ? `${coords.bottom + 4}px` : "",
        bottom: position === "top" ? `${window.innerHeight - coords.top + 4}px` : "",
        width: "224px",
        zIndex: 10000,
      }}
      className="bg-white border border-gray-200 rounded-md shadow-lg"
    >
      <ul className="text-sm text-gray-800" style={{ maxHeight: "12rem", overflowY: "auto" }}>
        {arr.map((item, idx) => (
          <li key={idx} className="px-3 py-2 hover:bg-gray-100 cursor-pointer">{item}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="inline-block" ref={ref}>
      <button 
        type="button" 
        onClick={() => setOpen((v) => !v)} 
        className="flex items-center align-left gap-1 px-4 py-1 border border-gray-300 rounded-md hover:bg-gray-100 text-sm text-gray-700"
      >
        <span className="truncate max-w-[180px] font-semibold block">{displayText}</span>
        <ChevronDownIcon className="w-4 h-4 text-gray-500" />
      </button>
      {open && createPortal(DropdownMenu, document.body)}
    </div>
  );
});

DropdownList.displayName = 'DropdownList';

// --- OPTIMIZED MODAL COMPONENT ---
const ResourceModal = React.memo(({
  isOpen,
  onClose,
  resource,
  onSave,
}) => {
  const initialFormState = useMemo(() => ({
    name: "",
    email: "",
    role: "",
    avatar_url: "",
    assigned_projects: [], // Array of { value, label }
    assigned_subprojects: [], // Array of { value, label }
    isBillable: true,
  }), []);

  const [formData, setFormData] = useState(initialFormState);
  const [isFormValid, setIsFormValid] = useState(false);
  const isEditMode = !!resource;

  // Load existing data when editing
  useEffect(() => {
    if (!isOpen) return;
    
    const loadResourceData = async () => {
      if (isEditMode && resource) {
        const projectIds = resource.assigned_projects?.map((p) => p._id || p).filter(Boolean) || [];
        const subprojectIds = resource.assigned_subprojects?.map((sp) => sp._id || sp).filter(Boolean) || [];
        
        // Fetch labels for existing IDs
        const [projectsRes, subprojectsRes] = await Promise.all([
          projectIds.length > 0 
            ? apiService.searchProjects({ ids: projectIds.join(',') })
            : Promise.resolve({ data: { projects: [] } }),
          subprojectIds.length > 0
            ? apiService.searchSubprojects({ ids: subprojectIds.join(',') })
            : Promise.resolve({ data: { subprojects: [] } }),
        ]);

        setFormData({
          name: resource.name || "",
          email: resource.email || "",
          role: resource.role || "",
          avatar_url: resource.avatar_url || "",
          assigned_projects: projectsRes.data.projects || [],
          assigned_subprojects: subprojectsRes.data.subprojects || [],
          isBillable: resource.isBillable !== undefined ? resource.isBillable : true,
        });
      } else {
        setFormData(initialFormState);
      }
    };
    
    loadResourceData();
  }, [resource, isEditMode, isOpen, initialFormState]);

  const validateEmail = useCallback((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), []);

  useEffect(() => {
    const { name, role, email } = formData;
    setIsFormValid(name.trim() && role.trim() && validateEmail(email));
  }, [formData, validateEmail]);

  const handleStandardChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Fetch functions for async selects
  const fetchProjects = useCallback(async (search) => {
    const res = await apiService.searchProjects({ search, limit: 20 });
    return { options: res.data.projects, hasMore: res.data.hasMore };
  }, []);

  const fetchSubprojects = useCallback(async (search) => {
    const projectIds = formData.assigned_projects.map(p => p.value).join(',');
    const res = await apiService.searchSubprojects({ 
      search, 
      limit: 20,
      project_ids: projectIds || undefined 
    });
    return { options: res.data.subprojects, hasMore: res.data.hasMore };
  }, [formData.assigned_projects]);

  const handleSubmit = useCallback(() => {
    if (!isFormValid) return;
    
    // Convert to IDs only for API
    const submitData = {
      ...formData,
      assigned_projects: formData.assigned_projects.map(p => p.value),
      assigned_subprojects: formData.assigned_subprojects.map(sp => sp.value),
    };
    
    onSave(submitData, resource?._id);
    onClose();
  }, [isFormValid, formData, resource, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEditMode ? "Edit Resource" : "Add New Resource"}
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Projects</label>
              <AsyncSearchSelect
                placeholder="Search projects..."
                value={formData.assigned_projects}
                onChange={(projects) => setFormData(prev => ({ 
                  ...prev, 
                  assigned_projects: projects,
                  // Clear subprojects when projects change
                  assigned_subprojects: prev.assigned_subprojects.filter(sp => 
                    projects.some(p => p.value === sp.project_id)
                  )
                }))}
                fetchOptions={fetchProjects}
                isMulti={true}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Sub-projects</label>
              <AsyncSearchSelect
                placeholder={formData.assigned_projects.length === 0 ? "Select projects first..." : "Search sub-projects..."}
                value={formData.assigned_subprojects}
                onChange={(subprojects) => setFormData(prev => ({ ...prev, assigned_subprojects: subprojects }))}
                fetchOptions={fetchSubprojects}
                isMulti={true}
                disabled={formData.assigned_projects.length === 0}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name*</label>
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleStandardChange} 
                required 
                className="w-full border border-gray-300 rounded-lg px-3 py-2" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role*</label>
              <input 
                type="text" 
                name="role" 
                value={formData.role} 
                onChange={handleStandardChange} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2" 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email*</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleStandardChange} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2" 
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-4 mt-8">
          <button 
            onClick={onClose} 
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={!isFormValid} 
            className={`px-6 py-2 rounded-lg font-semibold text-white ${
              isFormValid ? "bg-blue-500 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {isEditMode ? "Update Resource" : "Add Resource"}
          </button>
        </div>
      </div>
    </div>
  );
});

ResourceModal.displayName = 'ResourceModal';

// --- MAIN COMPONENT ---
export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [resourceId, setResourceId] = useState();
  const [confirmDeleteResource, setConfirmDeleteResource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState({ type: null, data: null });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [filters, setFilters] = useState({ 
    project: "", 
    subProject: "", 
    billableStatus: "", 
    search: "" 
  });
  
  const debouncedSearch = useDebounce(filters.search, 400);

  // Fetch resources when filters or pagination changes
  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = {
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        project_id: filters.project || undefined,
        subproject_id: filters.subProject || undefined,
        billable_status: filters.billableStatus || undefined,
      };

      const res = await apiService.getResources(queryParams);

      if (res.data?.resources) {
        setResources(res.data.resources);
        setTotalPages(res.data.totalPages || 1);
        setTotalItems(res.data.totalResources || 0);
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
  }, [currentPage, itemsPerPage, debouncedSearch, filters.project, filters.subProject, filters.billableStatus]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleSaveResource = useCallback(async (formData, resourceId) => {
    try {
      if (resourceId) {
        await apiService.updateResource(resourceId, formData);
        toast.success("Resource updated successfully");
      } else {
        await apiService.addResource(formData);
        toast.success("Resource added successfully");
      }
      fetchResources();
    } catch (error) {
      console.error("Failed to save resource:", error);
      toast.error("Failed to save resource");
    }
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

  // Fetch functions for filter dropdowns
  const fetchProjectsForFilter = useCallback(async (search) => {
    const res = await apiService.searchProjects({ search, limit: 20 });
    return { options: res.data.projects };
  }, []);

  const fetchSubprojectsForFilter = useCallback(async (search) => {
    const res = await apiService.searchSubprojects({ 
      search, 
      limit: 20,
      project_ids: filters.project || undefined 
    });
    return { options: res.data.subprojects };
  }, [filters.project]);

  const handleCSVUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv") {
      toast.error("Please upload a valid CSV file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Uploading CSV...");
    try {
      await apiService.uploadResourceCSV(formData);
      toast.success("CSV uploaded successfully", { id: toastId });
      fetchResources();
    } catch (err) {
      console.error("CSV upload error:", err);
      toast.error("Error uploading CSV", { id: toastId });
    } finally {
      event.target.value = "";
    }
  }, [fetchResources]);

  const handleDownloadTemplate = useCallback(() => {
    const csvHeader = "name,email,role,projects\n";
    const blob = new Blob([csvHeader], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resource-template.csv";
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

  return (
    <>
      <ResourceModal
        isOpen={!!modalState.type}
        onClose={() => setModalState({ type: null, data: null })}
        resource={modalState.data}
        onSave={handleSaveResource}
      />
      
      <div id="main-content" className="flex-1 p-4">
        <header id="header" className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Resource Assignment</h1>
              <p className="text-gray-500">Assign resources to projects and sub-projects</p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleDownloadTemplate} 
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-gray-200"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                <span>Download Template</span>
              </button>
              <label className="cursor-pointer bg-gray-100 text-gray-700 px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-gray-200">
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              </label>
              <button 
                onClick={() => setModalState({ type: "add", data: null })} 
                className="bg-blue-300 text-gray-900 px-4 py-2 rounded-xl text-lg flex items-center space-x-2 hover:bg-blue-400"
              >
                <PlusIcon className="w-7 h-7" />
                <span>Add Resource</span>
              </button>
            </div>
          </div>
        </header>

        <div id="filters-section" className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-4 gap-6 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                <FilterSelect
                  placeholder="All Projects"
                  value={filters.project}
                  onChange={(value) => {
                    setFilters(prev => ({ ...prev, project: value, subProject: "" }));
                    setCurrentPage(1);
                  }}
                  fetchOptions={fetchProjectsForFilter}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Project</label>
                <FilterSelect
                  placeholder="All Sub-Projects"
                  value={filters.subProject}
                  onChange={(value) => {
                    setFilters(prev => ({ ...prev, subProject: value }));
                    setCurrentPage(1);
                  }}
                  fetchOptions={fetchSubprojectsForFilter}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Resource</label>
                <input 
                  type="text" 
                  name="search" 
                  value={filters.search} 
                  onChange={handleSearchChange} 
                  placeholder="Search by name, role, or email..." 
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent" 
                />
              </div>
            </div>
            <div className="ml-6">
              <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                Total: {totalItems} Resources
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden max-h-[67vh] flex flex-col border">
          <div className="overflow-y-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 z-99 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Assigned Project</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Sub-Project</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <span className="ml-3">Loading resources...</span>
                      </div>
                    </td>
                  </tr>
                ) : resources.length > 0 ? (
                  resources.map((res) => (
                    <tr key={res._id} className="hover:bg-gray-50">
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <img 
                            src={res.avatar_url || "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-0.jpg"} 
                            alt={res.name} 
                            className="w-8 h-8 rounded-full mr-3" 
                          />
                          <span className="text-sm font-medium text-gray-900">{res.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        <DropdownList items={res.project_names} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        <DropdownList items={res.subproject_names} />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <button 
                            onClick={() => setModalState({ type: "edit", data: res })} 
                            className="text-primary hover:text-blue-700"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => { 
                              setConfirmDeleteResource(true); 
                              setResourceId(res._id); 
                            }} 
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-gray-500">No resources found.</td>
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

          <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">
                  Showing <span className="font-medium">{totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{" "}
                  <span className="font-medium">{totalItems}</span> results
                </span>
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
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages} 
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
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