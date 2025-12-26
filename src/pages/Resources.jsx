import React, { useState, useRef, useEffect } from "react";
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
} from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import ConfirmDeleteProjectModal from "../components/Project/ConfirmDeleteProjectModal";
import toast from "react-hot-toast";
// --- API CONFIGURATION ---
const apiBaseUrl = import.meta.env.VITE_BACKEND_URL; // Your backend URL

// --- API SERVICE LAYER ---
const apiService = {
  getResources: () => axios.get(`${apiBaseUrl}/resource`),
  getProjects: () => axios.get(`${apiBaseUrl}/project`),
  getSubprojects: () => axios.get(`${apiBaseUrl}/project/sub-project`),
  addResource: (resourceData) =>
    axios.post(`${apiBaseUrl}/resource`, resourceData),
  updateResource: (id, resourceData) =>
    axios.put(`${apiBaseUrl}/resource/${id}`, resourceData),
  deleteResource: (id) => axios.delete(`${apiBaseUrl}/resource/${id}`),
  uploadResourceCSV: (formData) =>
    axios.post(`${apiBaseUrl}/upload-resource/bul`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
    }),
};

// --- HELPER COMPONENTS ---



// --- MODAL COMPONENT (GENERIC FOR ADD/EDIT) ---
// --- MODAL COMPONENT (GENERIC FOR ADD/EDIT) ---
const ResourceModal = ({
  isOpen,
  onClose,
  resource,
  onSave,
  projects,
  subprojects,
}) => {
  const initialFormState = {
    name: "",
    email: "",
    role: "",
    avatar_url: "",
    assigned_projects: [],
    assigned_subprojects: [],
    isBillable: true,
  };
  const [formData, setFormData] = useState(initialFormState);
  const [filteredSubprojects, setFilteredSubprojects] = useState([]);
  const [isFormValid, setIsFormValid] = useState(false); // ✅ form validity
  const isEditMode = !!resource;

  useEffect(() => {
    if (isEditMode && resource) {
      setFormData({
        name: resource.name || "",
        email: resource.email || "",
        role: resource.role || "",
        avatar_url: resource.avatar_url || "",
        assigned_projects:
          resource.assigned_projects?.map((p) => p._id || p) || [],
        assigned_subprojects:
          resource.assigned_subprojects?.map((sp) => sp._id || sp) || [],
        isBillable:
          resource.isBillable !== undefined ? resource.isBillable : true,
      });
    } else {
      setFormData(initialFormState);
    }
  }, [resource, isEditMode, isOpen]);

  useEffect(() => {
    if (formData.assigned_projects.length > 0) {
      const related = subprojects.filter((sp) =>
        formData.assigned_projects.includes(sp.project_id)
      );
      setFilteredSubprojects(related);
    } else {
      setFilteredSubprojects([]);
    }
  }, [formData.assigned_projects, subprojects]);

  // ✅ Email validation
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ✅ Enable/disable submit button
  useEffect(() => {
    const { name, role, email } = formData;
    if (name.trim() && role.trim() && validateEmail(email)) {
      setIsFormValid(true);
    } else {
      setIsFormValid(false);
    }
  }, [formData]);

  if (!isOpen) return null;

  const handleStandardChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssignmentChange = (type, e) => {
    const id = e.target.value;
    const formKey =
      type === "project" ? "assigned_projects" : "assigned_subprojects";
    if (!id || formData[formKey].includes(id)) return;
    setFormData((prev) => ({ ...prev, [formKey]: [...prev[formKey], id] }));
    e.target.value = "";
  };

  const removeAssignment = (type, idToRemove) => {
    const formKey =
      type === "project" ? "assigned_projects" : "assigned_subprojects";
    setFormData((prev) => ({
      ...prev,
      [formKey]: prev[formKey].filter((id) => id !== idToRemove),
    }));
  };

  const handleSubmit = () => {
    if (!isFormValid) return; // prevent submit if invalid
    onSave(formData, resource?._id);
    onClose();
  };

  const unassignedProjects = projects.filter(
    (p) => !formData.assigned_projects.includes(p._id)
  );
  const unassignedSubProjects = filteredSubprojects.filter(
    (sp) => !formData.assigned_subprojects.includes(sp._id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEditMode ? "Edit Resource" : "Add New Resource"}
        </h2>

        <div className="space-y-4">
          {/* Project & Subproject selection */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Projects
                <sup className="relative left-1 text-[12px] text-red-700">
                  *
                </sup>
              </label>
              <select
                onChange={(e) => handleAssignmentChange("project", e)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary mb-2"
              >
                <option value="">Assign Project...</option>
                {unassignedProjects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {formData.assigned_projects.map((projectId) => (
                  <div
                    key={projectId}
                    className="flex items-center justify-between bg-gray-100 rounded-md px-3 py-1 text-sm"
                  >
                    <span>
                      {projects.find((p) => p._id === projectId)?.name}
                    </span>
                    <button
                      onClick={() => removeAssignment("project", projectId)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Sub-projects
                <sup className="relative left-1 text-[12px] text-red-700">
                  *
                </sup>
              </label>
              <select
                onChange={(e) => handleAssignmentChange("subproject", e)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary mb-2"
              >
                <option value="">Assign Sub-project...</option>
                {unassignedSubProjects.length > 0 ? (
                  unassignedSubProjects.map((sp) => (
                    <option key={sp._id} value={sp._id}>
                      {sp.name}
                    </option>
                  ))
                ) : (
                  <option disabled>No subprojects available</option>
                )}
              </select>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {formData.assigned_subprojects.map((subProjectId) => (
                  <div
                    key={subProjectId}
                    className="flex items-center justify-between bg-gray-100 rounded-md px-3 py-1 text-sm"
                  >
                    <span>
                      {subprojects.find((sp) => sp._id === subProjectId)?.name}
                    </span>
                    <button
                      onClick={() =>
                        removeAssignment("subproject", subProjectId)
                      }
                      className="text-gray-500 hover:text-red-500"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Other inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm required font-medium text-gray-700 mb-1">
                Full Name
                <sup className="relative left-1 text-[12px] text-red-700">
                  *
                </sup>
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
                <sup className="relative left-1 text-[12px] text-red-700">
                  *
                </sup>
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
                <sup className="relative left-1 text-[12px] text-red-700">
                  *
                </sup>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleStandardChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              {!validateEmail(formData.email) && formData.email && (
                <p className="text-red-500 text-xs mt-1">
                  Invalid email address
                </p>
              )}
            </div>
          </div>

          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL (Optional)</label>
            <input type="text" name="avatar_url" value={formData.avatar_url} onChange={handleStandardChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="https://example.com/avatar.jpg" />
          </div> */}
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
              isFormValid
                ? "bg-blue-500 hover:bg-blue-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {isEditMode ? "Update Resource" : "Add Resource"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DropdownList = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState("bottom");
  const [coords, setCoords] = useState(null); // To store button coordinates for the portal
  const ref = useRef(null);
  const menuRef = useRef(null); // Ref for the menu itself

  const arr = !items ? [] : Array.isArray(items) ? items : [items];

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate position when the dropdown is opened
  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

      // A reasonable estimate for menu height to decide placement
      const estimatedMenuHeight = 150;

      // Decide whether to open above or below
      const newPosition =
        spaceBelow < estimatedMenuHeight && rect.top > spaceBelow
          ? "top"
          : "bottom";
      setPosition(newPosition);

      // Set coordinates for the portal
      setCoords({
        left: rect.left,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
      });
    }
  }, [open]);

  if (!arr.length) return <span className="text-gray-500">Unassigned</span>;

  const displayText =
    arr.length === 1 ? arr[0] : `${arr[0]} +${arr.length - 1}`;

  const DropdownMenu = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: `${coords?.left ?? 0}px`,
        // Position below the button or above it
        top: position === "bottom" ? `${(coords?.bottom ?? 0) + 4}px` : "",
        bottom:
          position === "top"
            ? `${window.innerHeight - (coords?.top ?? 0) + 4}px`
            : "",
        width: "224px", // 14rem, from original w-56 class
        zIndex: 10000, // Ensure it's above everything
      }}
      className="bg-white border border-gray-200 rounded-md shadow-lg"
    >
      <ul
        className="text-sm text-gray-800"
        style={{
          maxHeight: "12rem",
          overflowY: "auto",
        }}
      >
        {arr.map((item, idx) => (
          <li key={idx} className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
            {item}
          </li>
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
        <span className="truncate max-w-[180px] font-semibold block">
          {displayText}
        </span>
        <ChevronDownIcon className="w-4 h-4 text-gray-500" />
      </button>

      {open && coords && createPortal(DropdownMenu, document.body)}
    </div>
  );
};

// --- MAIN CONTENT COMPONENT ---
export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [resourceId, setResourceId] = useState();
  const [projects, setProjects] = useState([]);
  const [subprojects, setSubprojects] = useState([]);
  const [confirmDeleteResource, setConfirmDeleteResource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState({ type: null, data: null }); // type: 'add' or 'edit'
  const [filters, setFilters] = useState({
    project: "",
    subProject: "",
    billableStatus: "",
    search: "", // ✅ NEW
  });
  const [subprojectOptions, setSubprojectOptions] = useState([]);
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [res, proj, subproj] = await Promise.all([
        apiService.getResources(),
        apiService.getProjects(),
        apiService.getSubprojects(),
      ]);
      setResources(res.data);
      setProjects(proj.data);
      setSubprojects(subproj.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  // console.log(projects)
  const handleSaveResource = async (formData, resourceId) => {
    try {
      if (resourceId) {
        // Update mode
        await apiService.updateResource(resourceId, formData);
      } else {
        // Add mode
        await apiService.addResource(formData);
      }
      fetchData(); // Refresh data after save
    } catch (error) {
      console.error("Failed to save resource:", error);
    }
  };
  function getResourceName(resourceId) {
    console.log("callee");

    const found = resources.find(
      (r) => r._id== resourceId
    );

    return found ? found.name : "Unknown";
  }

  const handleDeleteResource = async (id) => {
    try {
      await apiService.deleteResource(id);
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Failed to delete resource:", error);
    }
    setConfirmDeleteResource(false);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };
  useEffect(() => {
    if (filters.project) {
      const relatedSubprojects = subprojects.filter(
        (sp) => sp.project_id === filters.project
      );
      setSubprojectOptions(relatedSubprojects);
    } else {
      setSubprojectOptions(subprojects);
    }
  }, [filters.project, subprojects]);

  // utils.js (or within component)
  const getDisplayNames = (ids, allItems) => {
    // Normalize: if ids is a single value, wrap it in an array
    if (!ids) return [];

    const idArray = Array.isArray(ids) ? ids : [ids];

    return idArray.map((id) => {
      // id could be an object with _id, or just an id string
      const rawId = (id && (id._id || id.id)) || id;
      if (!rawId) return "Unknown";

      const found = Array.isArray(allItems)
        ? allItems.find((item) => (item._id || item.id || item) == rawId)
        : null;

      return found ? found.name || String(found) : "Unknown";
    });
  };
  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv") {
      alert("Please upload a valid CSV file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

  toast.loading("Uploading CSV...");
    try {
      const res = await apiService.uploadResourceCSV(formData);

      const contentType = res.headers["content-type"];

      // ---- SUCCESS CASE ----
      if (contentType.includes("application/json")) {
        const text = await res.data.text();
        const json = JSON.parse(text);

         toast.dismiss();
      toast.success("CSV uploaded successfully!");
        fetchData();
        return;
      }
    } catch (err) {
      // ---- ERROR CSV FILE ----
      if (
        err?.response?.status === 400 &&
        err.response.headers["content-type"]?.includes("text/csv")
      ) {
        const blob = err.response.data;

        const fileName =
          err.response.headers["content-disposition"]?.split("filename=")[1] ||
          "resource-upload-errors.csv";

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
         toast.dismiss();
         toast.error("CSV contains errors. Please check the downloaded file.");
        return;
      }
       toast.dismiss();
       toast.error("err");
    } finally {
      event.target.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const csvHeader = "name,email,role,projects,subprojects\n";

    const blob = new Blob([csvHeader], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "resource-template.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const filteredResources = resources.filter((res) => {
    const { project, subProject, billableStatus, search } = filters;

    if (
      project &&
      !(res.assigned_projects || []).map((p) => p._id).includes(project)
    )
      return false;
    if (
      subProject &&
      !(res.assigned_subprojects || []).map((sp) => sp._id).includes(subProject)
    )
      return false;
    if (billableStatus) {
      const isBillable = billableStatus === "billable";
      if (res.isBillable !== isBillable) return false;
    }

    // ✅ Search filter (case-insensitive)
    if (search.trim()) {
      const s = search.toLowerCase();
      const matches =
        res.name?.toLowerCase().includes(s) ||
        res.email?.toLowerCase().includes(s) ||
        res.role?.toLowerCase().includes(s);
      if (!matches) return false;
    }

    return true;
  });

  const billableCount = filteredResources.filter(
    (res) => res.isBillable
  ).length;
  const nonBillableCount = filteredResources.length - billableCount;

  return (
    <>
      <ResourceModal
        isOpen={!!modalState.type}
        onClose={() => setModalState({ type: null, data: null })}
        resource={modalState.data}
        onSave={handleSaveResource}
        projects={projects}
        subprojects={subprojects}
      />
      <div id="main-content" className="flex-1 p-4">
        <header id="header" className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Resource Assignment
              </h1>
              <p className="text-gray-500">
                Assign resources to projects and sub-projects, and toggle their
                inclusion in billing
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* 📥 DOWNLOAD TEMPLATE */}
              <button
                onClick={handleDownloadTemplate}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-gray-200"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                <span>Download Template</span>
              </button>

              {/* 📤 UPLOAD CSV */}
              <label className="cursor-pointer bg-gray-100 text-gray-700 px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-gray-200">
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Upload CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
              </label>

              {/* ➕ ADD NEW RESOURCE */}
              <button
                onClick={() => setModalState({ type: "add", data: null })}
                className="bg-blue-300 text-gray-900 px-4 py-2 rounded-xl text-lg flex items-center space-x-2 hover:bg-blue-400"
              >
                <PlusIcon className="w-7 h-7" />
                <span>Add Resource</span>
              </button>

              <button className="bg-accent text-white px-4 py-2 rounded-xl flex items-center space-x-2">
                <ArchiveBoxIcon className="w-5 h-5" />
                <span>Save All</span>
              </button>
            </div>
          </div>
        </header>

        <div
          id="filters-section"
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-4 gap-6 flex-1">
              {" "}
              {/* changed from 3 to 4 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project
                </label>
                <select
                  name="project"
                  value={filters.project}
                  onChange={handleFilterChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub-Project
                </label>
                <select
                  name="subProject"
                  value={filters.subProject}
                  onChange={handleFilterChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All Sub-Projects</option>
                  {subprojectOptions.map((sp) => (
                    <option key={sp._id} value={sp._id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* ✅ NEW: Resource search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Resource
                </label>
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search by name, role, or email..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="ml-6">
              <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                Total: {filteredResources.length} Resources
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden max-h-[67vh]  flex flex-col border">
          <div className="overflow-y-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 z-99 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Project
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Sub-Project
                  </th>
                  {/* <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Billable Toggle</th> */}
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      Loading resources...
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((res) => (
                    <tr key={res._id} className="hover:bg-gray-50">
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={
                              res.avatar_url ||
                              "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-0.jpg"
                            }
                            alt="User"
                            className="w-8 h-8 rounded-full mr-3"
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {res.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4  whitespace-nowrap text-sm text-gray-800">
                        <DropdownList
                          items={getDisplayNames(
                            res.assigned_projects,
                            projects
                          )}
                          label="Projects"
                        />
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        <DropdownList
                          items={getDisplayNames(
                            res.assigned_subprojects,
                            subprojects
                          )}
                          label="Sub-Projects"
                        />
                      </td>

                      {/* <td className="px-6 py-2 whitespace-nowrap">
                                                <BillableToggle isBillable={res.isBillable} onChange={(val) => handleSaveResource({ ...res, isBillable: val }, res._id)} />
                                            </td> */}
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() =>
                              setModalState({ type: "edit", data: res })
                            }
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
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                {/* <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-accent rounded-full"></div><span className="text-sm font-medium text-gray-700">Billable: <span className="text-accent font-semibold">{billableCount}</span></span></div>
                                <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-gray-400 rounded-full"></div><span className="text-sm font-medium text-gray-700">Non-Billable: <span className="text-gray-600 font-semibold">{nonBillableCount}</span></span></div> */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">
                    Total:{" "}
                    <span className="text-gray-900 font-semibold">
                      {filteredResources.length}
                    </span>
                  </span>
                </div>
              </div>
              {/* <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>Inherited: 20</span>
                                <span>Overridden: 4</span>
                            </div> */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
