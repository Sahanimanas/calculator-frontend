import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  ChevronDownIcon,
  ArchiveBoxIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import ConfirmDeleteProjectModal from "../components/Project/ConfirmDeleteProjectModal";
import toast from "react-hot-toast";
import debounce from "lodash.debounce"; // Ensure you install: npm i lodash.debounce

// --- API CONFIGURATION ---
const apiBaseUrl = import.meta.env.VITE_BACKEND_URL;

// --- API SERVICE LAYER ---
const apiService = {
  // ✅ Pagination params support
  getResources: (params) => axios.get(`${apiBaseUrl}/resource`, { params }),
  
  // ✅ Fetch projects (supports search/pagination if needed, currently fetching list)
  getProjects: () => axios.get(`${apiBaseUrl}/project`),
  
  // ✅ NEW: Fetch subprojects SPECIFIC to a project
  getSubprojectsByProject: (projectId) => axios.get(`${apiBaseUrl}/project/${projectId}/subproject`),
  
  addResource: (data) => axios.post(`${apiBaseUrl}/resource`, data),
  updateResource: (id, data) => axios.put(`${apiBaseUrl}/resource/${id}`, data),
  deleteResource: (id) => axios.delete(`${apiBaseUrl}/resource/${id}`),
  uploadResourceCSV: (formData) =>
    axios.post(`${apiBaseUrl}/upload-resource/bul`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
    }),
};

// --- OPTIMIZED DROPDOWN LIST ---
const DropdownList = ({ items, label }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });
  const ref = useRef(null);

  // Safely handle if items is null or undefined
  const arr = !items ? [] : Array.isArray(items) ? items : [items];
  
  // Only attach listener when open
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

  const toggleDropdown = () => {
    if (!open && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setCoords({
            left: rect.left,
            top: rect.bottom + window.scrollY + 4,
            width: rect.width
        });
    }
    setOpen((v) => !v);
  }

  if (!arr.length) return <span className="text-gray-400 text-sm italic">None</span>;

  const displayText = arr.length === 1 ? arr[0] : `${arr[0]} +${arr.length - 1}`;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white transition-colors max-w-[200px]"
      >
        <span className="truncate text-sm text-gray-700 block text-left flex-1">
          {displayText}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          style={{
            position: "fixed",
            left: `${coords.left}px`,
            top: `${coords.top}px`,
            zIndex: 9999,
            minWidth: "200px"
          }}
          className="bg-white rounded-lg shadow-xl border border-gray-100 py-1 animate-in fade-in zoom-in-95 duration-100"
        >
           <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
             <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label || 'Items'}</span>
           </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {arr.map((item, idx) => (
              <li key={idx} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">
                {item}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
};

// --- MODAL COMPONENT (Optimized for On-Demand Fetching) ---
const ResourceModal = ({
  isOpen,
  onClose,
  resource,
  onSave,
  projects, // Pass full list of projects
}) => {
  const initialFormState = {
    name: "",
    email: "",
    role: "",
    assigned_projects: [],
    assigned_subprojects: [],
  };
  const [formData, setFormData] = useState(initialFormState);
  
  // ✅ Store available subprojects mapped by Project ID: { projectId: [sub1, sub2] }
  const [availableSubprojects, setAvailableSubprojects] = useState({});
  const [loadingSubprojects, setLoadingSubprojects] = useState(false);
  
  const isEditMode = !!resource;

  // Initialize Form Data
  useEffect(() => {
    if (isEditMode && resource) {
      setFormData({
        name: resource.name || "",
        email: resource.email || "",
        role: resource.role || "",
        // Store IDs
        assigned_projects: resource.assigned_projects?.map((p) => p._id || p) || [],
        assigned_subprojects: resource.assigned_subprojects?.map((sp) => sp._id || sp) || [],
      });
    } else {
      setFormData(initialFormState);
    }
  }, [resource, isEditMode, isOpen]);

  // ✅ Fetch subprojects when a project is selected (if not already fetched)
  useEffect(() => {
    const fetchSubForSelectedProjects = async () => {
        if (!isOpen) return;
        
        // Find projects that we haven't fetched subprojects for yet
        const projectsToFetch = formData.assigned_projects.filter(pid => !availableSubprojects[pid]);
        
        if (projectsToFetch.length === 0) return;

        setLoadingSubprojects(true);
        const newSubprojects = { ...availableSubprojects };

        await Promise.all(projectsToFetch.map(async (pid) => {
            try {
                const res = await apiService.getSubprojectsByProject(pid);
                newSubprojects[pid] = res.data;
            } catch (err) {
                console.error(`Failed to fetch subprojects for project ${pid}`, err);
                newSubprojects[pid] = [];
            }
        }));

        setAvailableSubprojects(newSubprojects);
        setLoadingSubprojects(false);
    };

    fetchSubForSelectedProjects();
  }, [formData.assigned_projects, isOpen]);

  const handleStandardChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProjectSelect = (e) => {
    const projectId = e.target.value;
    if (!projectId || formData.assigned_projects.includes(projectId)) return;
    
    setFormData(prev => ({
        ...prev,
        assigned_projects: [...prev.assigned_projects, projectId]
    }));
    e.target.value = "";
  };

  const handleSubprojectSelect = (e) => {
    const subId = e.target.value;
    if (!subId || formData.assigned_subprojects.includes(subId)) return;
    
    setFormData(prev => ({
        ...prev,
        assigned_subprojects: [...prev.assigned_subprojects, subId]
    }));
    e.target.value = "";
  };

  const removeAssignment = (type, id) => {
    if (type === 'project') {
        setFormData(prev => ({
            ...prev,
            assigned_projects: prev.assigned_projects.filter(p => p !== id),
            // Optional: Remove subprojects associated with this project? 
            // For now, keeping them is safer or implementing complex logic to filter them out.
        }));
    } else {
        setFormData(prev => ({
            ...prev,
            assigned_subprojects: prev.assigned_subprojects.filter(sp => sp !== id)
        }));
    }
  };

  const handleSubmit = () => {
    onSave(formData, resource?._id);
    onClose();
  };

  if (!isOpen) return null;

  // Flatten available subprojects for the dropdown based on assigned projects
  const activeSubprojectOptions = formData.assigned_projects.flatMap(pid => availableSubprojects[pid] || []);
  
  // Filter out already selected
  const availableProjectsList = projects.filter(p => !formData.assigned_projects.includes(p._id));
  const availableSubprojectsList = activeSubprojectOptions.filter(sp => !formData.assigned_subprojects.includes(sp._id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEditMode ? "Edit Resource" : "Add New Resource"}
        </h2>

        <div className="space-y-6">
          {/* Projects */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Projects</label>
              <select onChange={handleProjectSelect} className="w-full border rounded-lg px-3 py-2 mb-2">
                <option value="">Select Project...</option>
                {availableProjectsList.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {formData.assigned_projects.map(pid => {
                    const pName = projects.find(p => p._id === pid)?.name || 'Unknown';
                    return (
                        <span key={pid} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                            {pName}
                            <XMarkIcon onClick={() => removeAssignment('project', pid)} className="w-3 h-3 cursor-pointer" />
                        </span>
                    )
                })}
              </div>
          </div>

          {/* Subprojects - Dependent on Projects */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Sub-projects 
                  {loadingSubprojects && <span className="text-xs text-gray-500 ml-2">(Loading options...)</span>}
              </label>
              <select 
                onChange={handleSubprojectSelect} 
                className="w-full border rounded-lg px-3 py-2 mb-2"
                disabled={formData.assigned_projects.length === 0}
              >
                <option value="">
                    {formData.assigned_projects.length === 0 ? "Select a Project first" : "Select Sub-project..."}
                </option>
                {availableSubprojectsList.map(sp => (
                  <option key={sp._id} value={sp._id}>{sp.name}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {formData.assigned_subprojects.map(spId => {
                    // Try to find name in fetched options, or fallback to 'Loading/Unknown' if filtering old data
                    const spObj = activeSubprojectOptions.find(o => o._id === spId) 
                                  || resource?.assigned_subprojects?.find(r => r._id === spId);
                    return (
                        <span key={spId} className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                            {spObj ? spObj.name : '...'}
                            <XMarkIcon onClick={() => removeAssignment('subproject', spId)} className="w-3 h-3 cursor-pointer" />
                        </span>
                    )
                })}
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input name="name" value={formData.name} onChange={handleStandardChange} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input name="role" value={formData.role} onChange={handleStandardChange} className="w-full border rounded-lg px-3 py-2" required />
            </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleStandardChange} className="w-full border rounded-lg px-3 py-2" required />
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button onClick={onClose} className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {isEditMode ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [projects, setProjects] = useState([]);
  
  // ✅ Removed `subprojects` state (too big). We fetch specific lists for filters.
  const [filterSubprojects, setFilterSubprojects] = useState([]); 

  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [resourceId, setResourceId] = useState();
  const [confirmDeleteResource, setConfirmDeleteResource] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    project_id: "",
    subproject_id: "",
    search: "",
  });

  // 1. Initial Load: Get Projects only
  useEffect(() => {
    const fetchProjects = async () => {
        try {
            const res = await apiService.getProjects();
            setProjects(res.data);
        } catch (e) { console.error("Project fetch failed", e); }
    };
    fetchProjects();
  }, []);

  // 2. Fetch Resources (Paginated)
  const fetchResources = async () => {
    setIsLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: 20,
        ...filters
      };
      const res = await apiService.getResources(params);
      setResources(res.data.data || []); 
      setPagination(prev => ({ ...prev, ...res.data.pagination }));
    } catch (error) {
      toast.error("Failed to load resources");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search
  const debouncedFetch = useCallback(debounce(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchResources();
  }, 500), [filters]);

  useEffect(() => {
     fetchResources();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]); 

  // 3. Handle Filter Changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    // If project changes, reset subproject filter
    if (name === 'project_id') {
        setFilters(prev => ({ ...prev, project_id: value, subproject_id: "" }));
        setPagination(prev => ({ ...prev, page: 1 }));
        // Fetch subprojects for this specific filter
        if (value) {
            apiService.getSubprojectsByProject(value)
                .then(res => setFilterSubprojects(res.data))
                .catch(() => setFilterSubprojects([]));
        } else {
            setFilterSubprojects([]);
        }
    } else {
        setFilters(prev => ({ ...prev, [name]: value }));
        if (name === 'search') debouncedFetch();
        else setPagination(prev => ({ ...prev, page: 1 }));
    }
  };

  // Trigger fetch on dropdown change (non-search)
  useEffect(() => {
      if (!filters.search) fetchResources();
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.project_id, filters.subproject_id]);


  const handleSaveResource = async (formData, id) => {
    try {
      if (id) await apiService.updateResource(id, formData);
      else await apiService.addResource(formData);
      fetchResources();
      toast.success(id ? "Resource updated" : "Resource created");
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    }
  };

  const handleDelete = async () => {
    try {
        await apiService.deleteResource(resourceId);
        fetchResources();
        toast.success("Deleted successfully");
    } catch(e) { toast.error("Delete failed"); }
    setConfirmDeleteResource(false);
  }

  const handlePageChange = (newPage) => {
      if (newPage > 0 && newPage <= pagination.totalPages) {
          setPagination(prev => ({ ...prev, page: newPage }));
      }
  };

  return (
    <>
      <ResourceModal
        isOpen={!!modalState.type}
        onClose={() => setModalState({ type: null, data: null })}
        resource={modalState.data}
        onSave={handleSaveResource}
        projects={projects} 
        // Note: We do NOT pass subprojects list here anymore. The modal fetches what it needs.
      />

      <div className="flex-1 p-4">
        {/* Header */}
        <header className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Resource Assignment</h1>
            <button onClick={() => setModalState({ type: "add", data: null })} className="bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-600">
                <PlusIcon className="w-5 h-5" /> Add Resource
            </button>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 grid grid-cols-3 gap-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                <select name="project_id" value={filters.project_id} onChange={handleFilterChange} className="w-full border rounded-xl px-4 py-2">
                    <option value="">All Projects</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Project</label>
                <select 
                    name="subproject_id" 
                    value={filters.subproject_id} 
                    onChange={handleFilterChange} 
                    className="w-full border rounded-xl px-4 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={!filters.project_id} // ✅ Disable if no project selected
                >
                    <option value="">{filters.project_id ? "All Sub-Projects" : "Select Project First"}</option>
                    {filterSubprojects.map(sp => <option key={sp._id} value={sp._id}>{sp.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input type="text" name="search" onChange={handleFilterChange} placeholder="Search..." className="w-full border rounded-xl px-4 py-2" />
            </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col border">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Resource</th>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Projects</th>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Sub-Projects</th>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {isLoading ? <tr><td colSpan="4" className="text-center py-8">Loading...</td></tr> : 
                         resources.map(res => (
                            <tr key={res._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <img src={res.avatar_url || "https://placehold.co/40"} className="w-8 h-8 rounded-full mr-3" alt="" />
                                        <div>
                                            <div className="text-sm font-medium">{res.name}</div>
                                            <div className="text-xs text-gray-500">{res.role}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {/* ✅ Use populated data directly */}
                                    <DropdownList items={res.assigned_projects?.map(p => p.name)} label="Projects" />
                                </td>
                                <td className="px-6 py-4">
                                    <DropdownList items={res.assigned_subprojects?.map(sp => sp.name)} label="Sub-Projects" />
                                </td>
                                <td className="px-6 py-4 flex gap-3">
                                    <button onClick={() => setModalState({ type: "edit", data: res })} className="text-blue-600"><PencilSquareIcon className="w-5 h-5"/></button>
                                    <button onClick={() => { setConfirmDeleteResource(true); setResourceId(res._id); }} className="text-red-500"><TrashIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="bg-gray-50 border-t px-6 py-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">Page {pagination.page} of {pagination.totalPages}</span>
                <div className="flex gap-2">
                    <button disabled={pagination.page <= 1} onClick={() => handlePageChange(pagination.page - 1)} className="p-2 border rounded hover:bg-gray-200 disabled:opacity-50"><ChevronLeftIcon className="w-4 h-4"/></button>
                    <button disabled={pagination.page >= pagination.totalPages} onClick={() => handlePageChange(pagination.page + 1)} className="p-2 border rounded hover:bg-gray-200 disabled:opacity-50"><ChevronRightIcon className="w-4 h-4"/></button>
                </div>
            </div>
        </div>
      </div>
      
      <ConfirmDeleteProjectModal 
        isOpen={confirmDeleteResource} 
        onClose={() => setConfirmDeleteResource(false)} 
        projectName="Resource" 
        onConfirm={handleDelete} 
      />
    </>
  );
}