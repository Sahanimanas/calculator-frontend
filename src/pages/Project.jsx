// pages/ProjectPage.jsx - COMPLETE UPDATE
import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus } from "lucide-react";
import CreateGeographyModal from "../components/Project/CreateGeographyModal";
import CreateClientModal from "../components/Project/CreateClientModal";
import CreateProjectModal from "../components/CreateProjectModal";
import CreateSubProjectModal from "../components/CreateSubProjectModal";
import EditGeographyModal from "../components/Project/EditGeographyModal";
import EditClientModal from "../components/Project/EditClientModal";
import EditProjectModal from "../components/Project/EditProjectModal";
import EditSubProjectModal from "../components/Project/EditSubProjectModal";
import PageHeader from "../components/PageHeader";
import { FaUpload, FaInfoCircle } from "react-icons/fa";
import toast from "react-hot-toast";
import axios from "axios";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

const ProjectPage = () => {
  const apiUrl = import.meta.env.VITE_BACKEND_URL;

  // State for hierarchical structure
  const [geographies, setGeographies] = useState([]);
  const [expandedGeographies, setExpandedGeographies] = useState({});
  const [expandedClients, setExpandedClients] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  // Cache structures
  const [clientsCache, setClientsCache] = useState({});
  const [projectsCache, setProjectsCache] = useState({});
  const [subprojectsCache, setSubprojectsCache] = useState({});

  const [loading, setLoading] = useState(false);
  const [showCsvFormat, setShowCsvFormat] = useState(false);

  // Pagination for geographies
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreGeographies, setHasMoreGeographies] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalGeographies, setTotalGeographies] = useState(0);
  const itemsPerPage = 30;

  // Modal states
  const [isCreateGeographyModalOpen, setIsCreateGeographyModalOpen] = useState(false);
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreateSubProjectModalOpen, setIsCreateSubProjectModalOpen] = useState(false);

  const [isEditGeographyModalOpen, setIsEditGeographyModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isEditSubProjectModalOpen, setIsEditSubProjectModalOpen] = useState(false);

  const [selectedGeography, setSelectedGeography] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSubProject, setSelectedSubProject] = useState(null);

  const scrollContainerRef = useRef(null);
  const loadingRef = useRef(false);

  // Helper to get rate from request types array
  const getRequestTypeRate = (requestTypes, typeName) => {
    if (!Array.isArray(requestTypes)) return 0;
    const type = requestTypes.find(
      (t) => t.name?.toLowerCase() === typeName.toLowerCase()
    );
    return type ? type.rate : 0;
  };

  // ==================== FETCH GEOGRAPHIES ====================
  const fetchGeographies = useCallback(async (page = 1, append = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (page === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await axios.get(`${apiUrl}/geography`, {
        params: { page, limit: itemsPerPage },
      });

      const geographiesData = response.data.geographies || [];

      if (append) {
        setGeographies((prev) => [...prev, ...geographiesData]);
      } else {
        setGeographies(geographiesData);
      }

      const pagination = response.data.pagination || {};
      setCurrentPage(page);
      setTotalGeographies(pagination.totalItems || 0);
      setHasMoreGeographies(pagination.hasNextPage);
    } catch (error) {
      console.error("Error fetching geographies:", error);
      toast.error("Failed to fetch geographies");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [apiUrl, itemsPerPage]);

  // ==================== FETCH CLIENTS ====================
  const fetchClients = useCallback(async (geographyId, page = 1, append = false) => {
    const currentCache = clientsCache[geographyId];
    if (currentCache?.loading) return;

    setClientsCache((prev) => ({
      ...prev,
      [geographyId]: {
        ...prev[geographyId],
        data: prev[geographyId]?.data || [],
        loading: true,
        page: page,
        hasMore: prev[geographyId]?.hasMore ?? true,
      },
    }));

    try {
      const response = await axios.get(`${apiUrl}/client/geography/${geographyId}`, {
        params: { page, limit: 30 },
      });

      const clientsData = response.data.clients || [];
      const hasMore = response.data.pagination?.hasMore || false;

      setClientsCache((prev) => ({
        ...prev,
        [geographyId]: {
          data: append 
            ? [...(prev[geographyId]?.data || []), ...clientsData] 
            : clientsData,
          loading: false,
          page: page,
          hasMore: hasMore,
        },
      }));
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to fetch clients");
    }
  }, [apiUrl, clientsCache]);

  // ==================== FETCH PROJECTS ====================
  const fetchProjects = useCallback(async (clientId, page = 1, append = false) => {
    const currentCache = projectsCache[clientId];
    if (currentCache?.loading) return;

    setProjectsCache((prev) => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        data: prev[clientId]?.data || [],
        loading: true,
        page: page,
        hasMore: prev[clientId]?.hasMore ?? true,
      },
    }));

    try {
      const response = await axios.get(`${apiUrl}/project/client/${clientId}`, {
        params: { page, limit: 30 },
      });

      const projectsData = response.data.projects || [];
      const hasMore = response.data.pagination?.hasMore || false;

      setProjectsCache((prev) => ({
        ...prev,
        [clientId]: {
          data: append 
            ? [...(prev[clientId]?.data || []), ...projectsData] 
            : projectsData,
          loading: false,
          page: page,
          hasMore: hasMore,
        },
      }));
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to fetch projects");
    }
  }, [apiUrl, projectsCache]);

  // ==================== FETCH SUBPROJECTS ====================
  const fetchSubprojects = useCallback(async (projectId, page = 1, append = false) => {
    const currentCache = subprojectsCache[projectId];
    if (currentCache?.loading) return;

    setSubprojectsCache((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        data: prev[projectId]?.data || [],
        loading: true,
        page: page,
        hasMore: prev[projectId]?.hasMore ?? true,
      },
    }));

    try {
      const response = await axios.get(`${apiUrl}/project/${projectId}/subproject`, {
        params: { page, limit: 30 },
      });

      let subprojectsData = [];
      let hasMore = false;

      if (response.data.pagination) {
        subprojectsData = response.data.data || [];
        hasMore = response.data.pagination.hasMore || false;
      } else {
        subprojectsData = Array.isArray(response.data) ? response.data : [];
        hasMore = false;
      }

      setSubprojectsCache((prev) => ({
        ...prev,
        [projectId]: {
          data: append 
            ? [...(prev[projectId]?.data || []), ...subprojectsData] 
            : subprojectsData,
          loading: false,
          page: page,
          hasMore: hasMore,
        },
      }));
    } catch (error) {
      console.error("Error fetching subprojects:", error);
      toast.error("Failed to fetch subprojects");
    }
  }, [apiUrl, subprojectsCache]);

  // ==================== TOGGLE EXPAND ====================
  const toggleGeography = async (geographyId) => {
    const isExpanding = !expandedGeographies[geographyId];
    setExpandedGeographies((prev) => ({ ...prev, [geographyId]: isExpanding }));

    if (isExpanding && !clientsCache[geographyId]) {
      await fetchClients(geographyId, 1, false);
    }
  };

  const toggleClient = async (clientId) => {
    const isExpanding = !expandedClients[clientId];
    setExpandedClients((prev) => ({ ...prev, [clientId]: isExpanding }));

    if (isExpanding && !projectsCache[clientId]) {
      await fetchProjects(clientId, 1, false);
    }
  };

  const toggleProject = async (projectId) => {
    const isExpanding = !expandedProjects[projectId];
    setExpandedProjects((prev) => ({ ...prev, [projectId]: isExpanding }));

    if (isExpanding && !subprojectsCache[projectId]) {
      await fetchSubprojects(projectId, 1, false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchGeographies(1, false);
  }, [fetchGeographies]);

  // ==================== SCROLL HANDLER ====================
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loading || loadingMore || !hasMoreGeographies) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

    if (scrollHeight - scrollTop <= clientHeight * 1.2) {
      fetchGeographies(currentPage + 1, true);
    }
  }, [currentPage, hasMoreGeographies, loading, loadingMore, fetchGeographies]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // ==================== CRUD HANDLERS ====================
  const handleEditGeography = (geography, e) => {
    e.stopPropagation();
    setSelectedGeography(geography);
    setIsEditGeographyModalOpen(true);
  };

  const handleDeleteGeography = async (geographyId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this geography? This will affect all clients and projects under it.")) return;

    try {
      await axios.delete(`${apiUrl}/geography/${geographyId}`);
      toast.success("Geography deleted");
      refreshAll();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete geography");
    }
  };

  const handleEditClient = (client, geography, e) => {
    e.stopPropagation();
    setSelectedClient(client);
    setSelectedGeography(geography);
    setIsEditClientModalOpen(true);
  };

  const handleDeleteClient = async (clientId, geographyId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this client? This will affect all projects under it.")) return;

    try {
      await axios.delete(`${apiUrl}/client/${clientId}`);
      toast.success("Client deleted");

      // Remove from cache
      setClientsCache((prev) => ({
        ...prev,
        [geographyId]: {
          ...prev[geographyId],
          data: prev[geographyId]?.data?.filter((c) => c._id !== clientId) || [],
        },
      }));

      // Update geography's client count
      setGeographies((prev) =>
        prev.map((g) =>
          g._id === geographyId 
            ? { ...g, clientCount: Math.max(0, (g.clientCount || 1) - 1) } 
            : g
        )
      );
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete client");
    }
  };

  const handleEditProject = (project, client, e) => {
    e.stopPropagation();
    setSelectedProject(project);
    setSelectedClient(client);
    setIsEditProjectModalOpen(true);
  };

  const handleDeleteProject = async (projectId, clientId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this project? This deletes everything under it.")) return;

    try {
      await axios.delete(`${apiUrl}/project/${projectId}`);
      toast.success("Project deleted");

      // Remove from cache
      setProjectsCache((prev) => ({
        ...prev,
        [clientId]: {
          ...prev[clientId],
          data: prev[clientId]?.data?.filter((p) => p._id !== projectId) || [],
        },
      }));

      // Update client's project count
      setClientsCache((prev) => {
        const geographyId = Object.keys(prev).find(geoId =>
          prev[geoId]?.data?.some(c => c._id === clientId)
        );
        if (!geographyId) return prev;

        return {
          ...prev,
          [geographyId]: {
            ...prev[geographyId],
            data: prev[geographyId]?.data?.map((c) =>
              c._id === clientId 
                ? { ...c, projectCount: Math.max(0, (c.projectCount || 1) - 1) } 
                : c
            ) || [],
          },
        };
      });
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  const handleEditSubProject = (subproject, project, e) => {
    e.stopPropagation();
    setSelectedSubProject(subproject);
    setSelectedProject(project);
    setIsEditSubProjectModalOpen(true);
  };

  const handleDeleteSubProject = async (subprojectId, projectId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this location?")) return;

    try {
      await axios.delete(`${apiUrl}/project/subproject/${subprojectId}`);
      toast.success("Location deleted");

      // Remove from cache
      setSubprojectsCache((prev) => ({
        ...prev,
        [projectId]: {
          ...prev[projectId],
          data: prev[projectId]?.data?.filter((sp) => sp._id !== subprojectId) || [],
        },
      }));
    } catch (error) {
      toast.error("Failed to delete location");
    }
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== "text/csv") {
      toast.error("Invalid CSV file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    toast.loading("Uploading...");

    try {
      const res = await axios.post(`${apiUrl}/upload/bulk-upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });

      const isJSON = res.headers["content-type"]?.includes("application/json");

      if (isJSON) {
        const text = await res.data.text();
        const json = JSON.parse(text);
        toast.dismiss();
        toast.success(json.message || "Uploaded successfully!");
        refreshAll();
        return;
      }
    } catch (err) {
      if (err?.response?.status === 400 && err.response.headers["content-type"]?.includes("text/csv")) {
        const blob = err.response.data;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bulk-upload-errors.csv";
        a.click();
        toast.dismiss();
        toast.error("Errors found. Check downloaded CSV.");
        return;
      }
      toast.dismiss();
      toast.error("Upload failed.");
    } finally {
      event.target.value = "";
    }
  };

  const refreshAll = () => {
    setExpandedGeographies({});
    setExpandedClients({});
    setExpandedProjects({});
    setClientsCache({});
    setProjectsCache({});
    setSubprojectsCache({});
    setGeographies([]);
    setCurrentPage(1);
    setHasMoreGeographies(true);
    fetchGeographies(1, false);
  };

  // ==================== RENDER ====================
  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        heading="Project Management"
        subHeading="Manage geographies, clients, projects (process types), and locations hierarchically."
      />

      {/* Action Buttons */}
      <div className="p-8 flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={() => setIsCreateGeographyModalOpen(true)}
            className="bg-blue-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            New Geography
          </button>

          <button
            onClick={() => setIsCreateClientModalOpen(true)}
            className="bg-purple-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-purple-700 transition"
          >
            <Plus size={20} />
            New Client
          </button>

          <button
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="bg-green-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-green-700 transition"
          >
            <Plus size={20} />
            New Project
          </button>

          <button
            onClick={() => setIsCreateSubProjectModalOpen(true)}
            className="text-blue-700 border border-blue-700 inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-blue-50 transition"
          >
            <Plus size={20} />
            New Location
          </button>

          <label className="cursor-pointer bg-orange-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-orange-700 transition">
            <FaUpload size={18} />
            Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              const csvHeader = "geography,client,process type,location,request type,rate,flat rate\n";
              const blob = new Blob([csvHeader], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "project-upload-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="cursor-pointer bg-gray-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-700 transition"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Download Template
          </button>

          <button
            onClick={() => setShowCsvFormat(!showCsvFormat)}
            className="text-gray-600 inline-flex items-center gap-2 hover:text-gray-800 transition"
          >
            <FaInfoCircle size={18} />
            CSV Format Info
          </button>
        </div>

        {showCsvFormat && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm text-sm text-gray-700 animate-fadeIn">
            <h3 className="font-semibold text-gray-800 mb-2">CSV Upload Format</h3>
            <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-sm text-gray-800">
              geography,client,process type,location,request type,rate,flat rate
            </pre>
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <p><strong>geography:</strong> Geographic region </p>
              <p><strong>client:</strong> Client/Organization name</p>
              <p><strong>process type:</strong> Project/Process name</p>
              <p><strong>location:</strong> Specific location or sub-division</p>
              <p><strong>request type:</strong> Must be "New Request", "Key", or "Duplicate"</p>
              <p><strong>rate:</strong> Rate for the request type</p>
              <p><strong>flat rate:</strong> Optional flat rate for the location</p>
            </div>
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-2 text-xs">
              <strong>Example:</strong>
              <pre className="mt-1 text-gray-700">offshore/onshore/MRO,ABC Corp,Data Processing,BRONX Care,New Request,3,4</pre>
            </div>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="px-8 pb-4">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            Showing <span className="font-semibold text-gray-900">{geographies.length}</span> of{" "}
            <span className="font-semibold text-gray-900">{totalGeographies}</span> geographies
          </span>
          {hasMoreGeographies && !loading && !loadingMore && (
            <span className="text-blue-600">• Scroll down to load more</span>
          )}
          {loadingMore && (
            <span className="text-blue-600 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Loading more...
            </span>
          )}
        </div>
      </div>

      {/* Main Hierarchical Table */}
      <div className="px-8 pb-8 flex-1 min-h-0">
        {loading && geographies.length === 0 ? (
          <div className="flex justify-center items-center p-12 bg-white rounded-xl border">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : geographies.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border">
            No geographies found. Create one to get started!
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="overflow-auto rounded-xl shadow-sm border bg-white"
            style={{ maxHeight: "calc(100vh - 320px)" }}
          >
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-20">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Name</th>
                  <th className="px-6 py-3 text-left font-semibold">Description</th>
                  <th className="px-6 py-3 text-center font-semibold">Status</th>
                  <th className="px-6 py-3 text-center font-semibold">Count</th>
                  <th className="px-6 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {geographies.map((geography, geoIndex) => {
                  const isGeoExpanded = expandedGeographies[geography._id];
                  const clientCache = clientsCache[geography._id];
                  const clients = clientCache?.data || [];

                  return (
                    <>
                      {/* GEOGRAPHY ROW */}
                      <tr
                        key={geography._id}
                        className={`${
                          geoIndex % 2 === 0 ? "bg-blue-50" : "bg-blue-100"
                        } hover:bg-blue-200 cursor-pointer border-b border-blue-200`}
                        onClick={() => toggleGeography(geography._id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isGeoExpanded ? (
                              <ChevronDown size={18} className="text-blue-700" />
                            ) : (
                              <ChevronRight size={18} className="text-blue-700" />
                            )}
                            <span className="font-bold text-blue-900">{geography.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{geography.description || "—"}</td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              geography.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {geography.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-blue-900">
                          {geography.clientCount || 0} clients
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => handleEditGeography(geography, e)}
                              className="p-2 hover:bg-blue-300 rounded text-blue-700 transition"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteGeography(geography._id, e)}
                              className="p-2 hover:bg-red-200 rounded text-red-600 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* CLIENTS UNDER GEOGRAPHY */}
                      {isGeoExpanded && (
                        <>
                          {clientCache?.loading && clients.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-12 py-4 bg-purple-50">
                                <div className="flex justify-center">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                                </div>
                              </td>
                            </tr>
                          ) : clients.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-12 py-4 bg-purple-50 text-center text-gray-500">
                                No clients found in this geography
                              </td>
                            </tr>
                          ) : (
                            clients.map((client, clientIndex) => {
                              const isClientExpanded = expandedClients[client._id];
                              const projectCache = projectsCache[client._id];
                              const projects = projectCache?.data || [];

                              return (
                                <>
                                  {/* CLIENT ROW */}
                                  <tr
                                    key={client._id}
                                    className={`${
                                      clientIndex % 2 === 0 ? "bg-purple-50" : "bg-purple-100"
                                    } hover:bg-purple-200 cursor-pointer border-b border-purple-200`}
                                    onClick={() => toggleClient(client._id)}
                                  >
                                    <td className="px-12 py-3">
                                      <div className="flex items-center gap-2">
                                        {isClientExpanded ? (
                                          <ChevronDown size={16} className="text-purple-700" />
                                        ) : (
                                          <ChevronRight size={16} className="text-purple-700" />
                                        )}
                                        <span className="font-semibold text-purple-900">
                                           {client.name}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 text-gray-700">{client.description || "—"}</td>
                                    <td className="px-6 py-3 text-center">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                          client.status === "active"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-200 text-gray-700"
                                        }`}
                                      >
                                        {client.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3 text-center font-semibold text-purple-900">
                                      {client.projectCount || 0} projects
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={(e) => handleEditClient(client, geography, e)}
                                          className="p-1.5 hover:bg-purple-300 rounded text-purple-700 transition"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          onClick={(e) => handleDeleteClient(client._id, geography._id, e)}
                                          className="p-1.5 hover:bg-red-200 rounded text-red-600 transition"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* PROJECTS UNDER CLIENT */}
                                  {isClientExpanded && (
                                    <>
                                      {projectCache?.loading && projects.length === 0 ? (
                                        <tr>
                                          <td colSpan="5" className="px-16 py-4 bg-green-50">
                                            <div className="flex justify-center">
                                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                                            </div>
                                          </td>
                                        </tr>
                                      ) : projects.length === 0 ? (
                                        <tr>
                                          <td colSpan="5" className="px-16 py-4 bg-green-50 text-center text-gray-500">
                                            No projects found for this client
                                          </td>
                                        </tr>
                                      ) : (
                                        projects.map((project, projectIndex) => {
                                          const isProjectExpanded = expandedProjects[project._id];
                                          const subprojectCache = subprojectsCache[project._id];
                                          const subprojects = subprojectCache?.data || [];

                                          return (
                                            <>
                                              {/* PROJECT ROW */}
                                              <tr
                                                key={project._id}
                                                className={`${
                                                  projectIndex % 2 === 0 ? "bg-green-50" : "bg-green-100"
                                                } hover:bg-green-200 cursor-pointer border-b border-green-200`}
                                                onClick={() => toggleProject(project._id)}
                                              >
                                                <td className="px-16 py-3">
                                                  <div className="flex items-center gap-2">
                                                    {isProjectExpanded ? (
                                                      <ChevronDown size={14} className="text-green-700" />
                                                    ) : (
                                                      <ChevronRight size={14} className="text-green-700" />
                                                    )}
                                                    <span className="font-medium text-green-900">
                                                      {project.name}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-6 py-3 text-gray-700">{project.description || "—"}</td>
                                                <td className="px-6 py-3 text-center">
                                                  <span
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                      project.status === "active"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-gray-200 text-gray-700"
                                                    }`}
                                                  >
                                                    {project.status}
                                                  </span>
                                                </td>
                                                <td className="px-6 py-3 text-center font-semibold text-green-900">
                                                  {project.subprojectCount || 0} locations
                                                </td>
                                                <td className="px-6 py-3">
                                                  <div className="flex items-center justify-center gap-2">
                                                    <button
                                                      onClick={(e) => handleEditProject(project, client, e)}
                                                      className="p-1.5 hover:bg-green-300 rounded text-green-700 transition"
                                                    >
                                                      <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                      onClick={(e) => handleDeleteProject(project._id, client._id, e)}
                                                      className="p-1.5 hover:bg-red-200 rounded text-red-600 transition"
                                                    >
                                                      <Trash2 size={12} />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>

                                              {/* SUBPROJECTS (LOCATIONS) */}
                                              {isProjectExpanded && (
                                                <tr>
                                                  <td colSpan="5" className="px-20 py-4 bg-gray-50">
                                                    {subprojectCache?.loading && subprojects.length === 0 ? (
                                                      <div className="flex justify-center py-4">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
                                                      </div>
                                                    ) : subprojects.length === 0 ? (
                                                      <div className="text-center text-gray-500 py-4">
                                                        No locations found for this project
                                                      </div>
                                                    ) : (
                                                      <div className="rounded-lg overflow-hidden border border-gray-300">
                                                        <table className="min-w-full text-xs bg-white">
                                                          <thead className="bg-gray-200">
                                                            <tr>
                                                              <th className="px-4 py-2 text-left font-semibold">
                                                                Location
                                                              </th>
                                                              <th className="px-4 py-2 text-right font-semibold text-blue-600">
                                                                New Request
                                                              </th>
                                                              <th className="px-4 py-2 text-right font-semibold text-purple-600">
                                                                Key
                                                              </th>
                                                              <th className="px-4 py-2 text-right font-semibold text-orange-600">
                                                                Duplicate
                                                              </th>
                                                              <th className="px-4 py-2 text-right font-semibold">
                                                                Flat Rate
                                                              </th>
                                                              {/* <th className="px-4 py-2 text-right font-semibold bg-gray-100">
                                                                Total Rate
                                                              </th> */}
                                                              <th className="px-4 py-2 text-center font-semibold">
                                                                Actions
                                                              </th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {subprojects.map((sp, spIndex) => {
                                                              const newReqRate = getRequestTypeRate(
                                                                sp.request_types,
                                                                "New Request"
                                                              );
                                                              const keyRate = getRequestTypeRate(
                                                                sp.request_types,
                                                                "Key"
                                                              );
                                                              const dupRate = getRequestTypeRate(
                                                                sp.request_types,
                                                                "Duplicate"
                                                              );
                                                              const flatRate = sp.flatrate || 0;
                                                              const totalRowRate = newReqRate + keyRate + dupRate;

                                                              return (
                                                                <tr
                                                                  key={sp._id}
                                                                  className={`${
                                                                    spIndex % 2 === 0
                                                                      ? "bg-white"
                                                                      : "bg-gray-50"
                                                                  } hover:bg-blue-50 border-b border-gray-200`}
                                                                >
                                                                  <td className="px-4 py-2 font-medium">
                                                                    {sp.name}
                                                                    {sp.description && (
                                                                      <div className="text-xs text-gray-500 font-normal">
                                                                        {sp.description}
                                                                      </div>
                                                                    )}
                                                                  </td>
                                                                  <td className="px-4 py-2 text-right">
                                                                    {newReqRate > 0
                                                                      ? `$${newReqRate.toFixed(2)}`
                                                                      : "-"}
                                                                  </td>
                                                                  <td className="px-4 py-2 text-right">
                                                                    {keyRate > 0
                                                                      ? `$${keyRate.toFixed(2)}`
                                                                      : "-"}
                                                                  </td>
                                                                  <td className="px-4 py-2 text-right">
                                                                    {dupRate > 0
                                                                      ? `$${dupRate.toFixed(2)}`
                                                                      : "-"}
                                                                  </td>
                                                                  <td className="px-4 py-2 text-right">
                                                                    {flatRate > 0
                                                                      ? `$${flatRate.toFixed(2)}`
                                                                      : "-"}
                                                                  </td>
                                                                  {/* <td className="px-4 py-2 text-right font-bold bg-gray-50">
                                                                    ${totalRowRate.toFixed(2)}
                                                                  </td> */}
                                                                  <td className="px-4 py-2 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                      <button
                                                                        onClick={(e) =>
                                                                          handleEditSubProject(sp, project, e)
                                                                        }
                                                                        className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                                                      >
                                                                        <Edit2 size={12} />
                                                                      </button>
                                                                      <button
                                                                        onClick={(e) =>
                                                                          handleDeleteSubProject(
                                                                            sp._id,
                                                                            project._id,
                                                                            e
                                                                          )
                                                                        }
                                                                        className="p-1 hover:bg-red-100 rounded text-red-600"
                                                                      >
                                                                        <Trash2 size={12} />
                                                                      </button>
                                                                    </div>
                                                                  </td>
                                                                </tr>
                                                              );
                                                            })}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    )}
                                                  </td>
                                                </tr>
                                              )}
                                            </>
                                          );
                                        })
                                      )}
                                    </>
                                  )}
                                </>
                              );
                            })
                          )}
                        </>
                      )}
                    </>
                  );
                })}

                {/* Loading more geographies */}
                {loadingMore && (
                  <tr>
                    <td colSpan="5" className="py-6 text-center">
                      <div className="flex justify-center items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="text-gray-500">Loading more geographies...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {/* End of list */}
                {!hasMoreGeographies && geographies.length > 0 && !loadingMore && (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-sm text-gray-400">
                      — End of geographies ({totalGeographies} total) —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateGeographyModal
        refreshGeographies={refreshAll}
        isOpen={isCreateGeographyModalOpen}
        onClose={() => setIsCreateGeographyModalOpen(false)}
      />

      <CreateClientModal
        refreshClients={refreshAll}
        isOpen={isCreateClientModalOpen}
        onClose={() => setIsCreateClientModalOpen(false)}
      />

      <CreateProjectModal
        refreshProjects={refreshAll}
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />

      <CreateSubProjectModal
        refreshProjects={refreshAll}
        isOpen={isCreateSubProjectModalOpen}
        onClose={() => setIsCreateSubProjectModalOpen(false)}
      />

      {isEditGeographyModalOpen && (
        <EditGeographyModal
          geography={selectedGeography}
          refreshGeographies={refreshAll}
          isOpen={isEditGeographyModalOpen}
          onClose={() => {
            setIsEditGeographyModalOpen(false);
            setSelectedGeography(null);
          }}
        />
      )}

      {isEditClientModalOpen && (
        <EditClientModal
          client={selectedClient}
          geography={selectedGeography}
          refreshClients={refreshAll}
          isOpen={isEditClientModalOpen}
          onClose={() => {
            setIsEditClientModalOpen(false);
            setSelectedClient(null);
            setSelectedGeography(null);
          }}
        />
      )}

      {isEditProjectModalOpen && (
        <EditProjectModal
          project={selectedProject}
          client={selectedClient}
          refreshProjects={refreshAll}
          isOpen={isEditProjectModalOpen}
          onClose={() => {
            setIsEditProjectModalOpen(false);
            setSelectedProject(null);
            setSelectedClient(null);
          }}
        />
      )}

      {isEditSubProjectModalOpen && (
        <EditSubProjectModal
          subProject={selectedSubProject}
          project={selectedProject}
          refreshProjects={refreshAll}
          isOpen={isEditSubProjectModalOpen}
          onClose={() => {
            setIsEditSubProjectModalOpen(false);
            setSelectedSubProject(null);
            setSelectedProject(null);
          }}
        />
      )}
    </div>
  );
};

export default ProjectPage;