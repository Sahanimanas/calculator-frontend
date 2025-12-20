// Updated ProjectPage.jsx with lazy loading

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus } from "lucide-react";
import CreateProjectModal from "../components/CreateProjectModal";
import CreateSubProjectModal from "../components/CreateSubProjectModal";
import EditProjectModal from "../components/Project/EditProjectModal";
import EditSubProjectModal from "../components/Project/EditSubProjectModal";
import PageHeader from "../components/PageHeader";
import { FaUpload, FaInfoCircle } from "react-icons/fa";
import toast from "react-hot-toast";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

const ProjectPage = () => {
  const apiUrl = import.meta.env.VITE_BACKEND_URL;

  // State management
  const [projects, setProjects] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [subprojectsCache, setSubprojectsCache] = useState({});
  const [loadingSubprojects, setLoadingSubprojects] = useState({});
  const [loading, setLoading] = useState(false);
  const [showCsvFormat, setShowCsvFormat] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Modal states
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const [isCreateSubProjectModalOpen, setIsCreateSubProjectModalOpen] =
    useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isEditSubProjectModalOpen, setIsEditSubProjectModalOpen] =
    useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSubProject, setSelectedSubProject] = useState(null);

  // Fetch projects with totals only (lightweight)
  const fetchProjects = async (page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${apiUrl}/project/projects-with-totals`,
        {
          params: { page, limit },
        }
      );
// console.log(response)
      const projectsData = Array.isArray(response.data.projects) ? response.data.projects : [];
      setProjects(projectsData);

      // Extract pagination from headers
      const paginationData = {
        currentPage: parseInt(response.data.pagination.currentPage) || page,
        totalPages: parseInt(response.data.pagination.totalPages) || 1,
        totalItems:
          parseInt(response.data.pagination.totalItems) || projectsData.length,
        itemsPerPage: parseInt(response.data.pagination.itemsPerPage) || limit,
        hasNextPage: response.data.pagination.hasNextPage === "true",
        hasPrevPage: response.data.pagination.hasPrevPage === "true",
      };
      setPagination(paginationData);
    } catch (error) {
      toast.error("Failed to fetch projects");
     
    } finally {
      setLoading(false);
    }
  };

  // Fetch subprojects for a specific project (on-demand)
  const fetchSubprojects = async (projectId) => {
    // Check if already loaded
    if (subprojectsCache[projectId]) {
      return;
    }

    setLoadingSubprojects((prev) => ({ ...prev, [projectId]: true }));
    try {
      const response = await axios.get(
        `${apiUrl}/project/${projectId}/subproject`
      );
      setSubprojectsCache((prev) => ({
        ...prev,
        [projectId]: response.data,
      }));
    } catch (error) {
      toast.error("Failed to fetch subprojects");
      console.error(error);
      setSubprojectsCache((prev) => ({
        ...prev,
        [projectId]: [],
      }));
    } finally {
      setLoadingSubprojects((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  // Toggle project expansion and load subprojects
  const toggleExpand = async (projectId) => {
    const isExpanding = !expandedProjects[projectId];

    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: isExpanding,
    }));

    // Load subprojects only when expanding
    if (isExpanding) {
      await fetchSubprojects(projectId);
    }
  };

  useEffect(() => {
    fetchProjects(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage]);

  // Pagination handlers
  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setCurrentPage(page);
      // Clear expanded state and cache when changing pages
      setExpandedProjects({});
      setSubprojectsCache({});
    }
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
    setExpandedProjects({});
    setSubprojectsCache({});
  };

  // CRUD handlers
  const handleEditProject = (project, e) => {
    e.stopPropagation();
    setSelectedProject(project);
    setIsEditProjectModalOpen(true);
  };

  const handleEditSubProject = (subproject, project, e) => {
    e.stopPropagation();
    setSelectedSubProject(subproject);
    setSelectedProject(project);
    setIsEditSubProjectModalOpen(true);
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Are you sure you want to delete this project and all its subprojects?"
      )
    )
      return;

    try {
      await axios.delete(`${apiUrl}/project/${projectId}`);
      toast.success("Project deleted successfully");

      // Clear cache for deleted project
      const newCache = { ...subprojectsCache };
      delete newCache[projectId];
      setSubprojectsCache(newCache);

      fetchProjects();
    } catch (error) {
      toast.error("Failed to delete project");
      console.error(error);
    }
  };

  const handleDeleteSubProject = async (subprojectId, projectId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this subproject?"))
      return;

    try {
      await axios.delete(`${apiUrl}/project/subproject/${subprojectId}`);
      toast.success("Subproject deleted successfully");

      // Clear cache for this project to force reload
      const newCache = { ...subprojectsCache };
      delete newCache[projectId];
      setSubprojectsCache(newCache);

      // Reload both projects list and subprojects
      await fetchProjects();
      if (expandedProjects[projectId]) {
        await fetchSubprojects(projectId);
      }
    } catch (error) {
      toast.error("Failed to delete subproject");
      console.error(error);
    }
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv") {
      toast.error("Please upload a valid CSV file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    toast.loading("Uploading CSV...");

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
        toast.success(json.message || "CSV uploaded successfully!");

        setCurrentPage(1);
        setExpandedProjects({});
        setSubprojectsCache({});
        fetchProjects(1, itemsPerPage);
        return;
      }
    } catch (err) {
      if (
        err?.response?.status === 400 &&
        err.response.headers["content-type"]?.includes("text/csv")
      ) {
        const blob = err.response.data;
        const fileName =
          err.response.headers["content-disposition"]?.split("filename=")[1] ||
          "bulk-upload-errors.csv";

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
      toast.error("Upload failed. Please try again.");
      console.error(err);
    } finally {
      event.target.value = "";
    }
  };

  const refreshProjects = () => {
    setExpandedProjects({});
    setSubprojectsCache({});
    fetchProjects();
  };

  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const endIndex = Math.min(
    startIndex + pagination.itemsPerPage,
    pagination.totalItems
  );

  return (
    <div>
      <PageHeader
        heading="Project Management"
        subHeading="Manage your projects and sub-projects with timelines and budgets"
      />

      <div className="p-8 flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="bg-blue-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            New Project
          </button>

          <button
            onClick={() => setIsCreateSubProjectModalOpen(true)}
            className="text-blue-700 border border-blue-700 inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-blue-50 transition"
          >
            <Plus size={20} />
            New Sub Project
          </button>

          <label className="cursor-pointer bg-green-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-green-700 transition">
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
              const csvHeader =
                "project_name,project_description,visibility,status,flatrate,subproject_name,subproject_description,subproject_status\n";
              const blob = new Blob([csvHeader], {
                type: "text/csv;charset=utf-8;",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "project-subproject-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="cursor-pointer bg-purple-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-purple-700 transition"
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
            <h3 className="font-semibold text-gray-800 mb-2">
              CSV Format Guide
            </h3>
            <p className="mb-2">
              The CSV file must include the following columns (exact order
              required):
            </p>
            <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-sm text-gray-800">
              project_name,project_description,visibility,status,flatrate,subproject_name,subproject_description,subproject_status
            </pre>
            <ul className="list-disc list-inside mt-3 text-gray-600 space-y-1">
              <li>
                <strong>project_name</strong>: Name of the project (required)
              </li>
              <li>
                <strong>project_description</strong>: Description of the project
                (optional)
              </li>
              <li>
                <strong>visibility</strong>: Must be <em>"visible"</em> or{" "}
                <em>"hidden"</em>
              </li>
              <li>
                <strong>status</strong>: Must be <em>"active"</em> or{" "}
                <em>"inactive"</em>
              </li>
              <li>
                <strong>flatrate</strong>: Numeric value (e.g., 0, 99.99, 120)
              </li>
              <li>
                <strong>subproject_name</strong>: Name of the subproject
                (required)
              </li>
              <li>
                <strong>subproject_description</strong>: Description of the
                subproject (optional)
              </li>
              <li>
                <strong>subproject_status</strong>: Must be <em>"active"</em> or{" "}
                <em>"inactive"</em>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Compact Table View */}
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
            No projects found
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 bg-white">
            <table className="min-w-full text-sm text-left text-gray-700">
              <thead className="bg-gray-100 text-gray-900 uppercase text-xs tracking-wider sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold">Project</th>
                  <th className="px-6 py-3 font-semibold">Description</th>
                  <th className="px-6 py-3 font-semibold">Visibility</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Created On</th>
                  <th className="px-6 py-3 font-semibold text-right">
                    Subprojects
                  </th>
                  <th className="px-6 py-3 font-semibold text-right">
                    Total Flatrate
                  </th>
                  <th className="px-6 py-3 font-semibold text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project, index) => {
                  const isExpanded = expandedProjects[project._id];
                  const isLoadingSub = loadingSubprojects[project._id];
                  const subprojects = subprojectsCache[project._id] || [];

                  return (
                    <>
                      <tr
                        key={project._id}
                        className={`${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        } hover:bg-blue-50 transition cursor-pointer border-b border-gray-200`}
                        onClick={() => toggleExpand(project._id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              className="hover:bg-gray-200 p-1 rounded transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(project._id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown
                                  size={16}
                                  className="text-gray-600"
                                />
                              ) : (
                                <ChevronRight
                                  size={16}
                                  className="text-gray-600"
                                />
                              )}
                            </button>
                            <span className="font-medium text-gray-900">
                              {project.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                          {project.description || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              project.visibility === "visible"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {project.visibility}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              project.status === "active"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(project.created_on).toLocaleDateString(
                            "en-US",
                            {
                              month: "2-digit",
                              day: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900 font-medium">
                          {project.subprojectCount}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          ${project.totalFlatrate.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => handleEditProject(project, e)}
                              className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition"
                              title="Edit Project"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={(e) =>
                                handleDeleteProject(project._id, e)
                              }
                              className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition"
                              title="Delete Project"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${project._id}-expanded`}>
                          <td
                            colSpan="8"
                            className="bg-gray-50 px-10 py-4 border-b border-gray-200"
                          >
                            {isLoadingSub ? (
                              <div className="flex justify-center py-6">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              </div>
                            ) : subprojects.length > 0 ? (
                              <div className="rounded-lg overflow-hidden border border-gray-300">
                                <table className="min-w-full text-sm bg-white">
                                  <thead className="bg-gray-200 text-gray-900 text-xs uppercase tracking-wider">
                                    <tr>
                                      <th className="px-4 py-3 text-left font-semibold">
                                        Subproject Name
                                      </th>
                                      <th className="px-4 py-3 text-left font-semibold">
                                        Description
                                      </th>
                                      <th className="px-4 py-3 text-center font-semibold">
                                        Status
                                      </th>
                                      <th className="px-4 py-3 text-right font-semibold">
                                        Flatrate
                                      </th>
                                      <th className="px-4 py-3 text-left font-semibold">
                                        Created On
                                      </th>
                                      <th className="px-4 py-3 text-center font-semibold">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subprojects.map((sp, spIndex) => (
                                      <tr
                                        key={sp._id}
                                        className={`${
                                          spIndex % 2 === 0
                                            ? "bg-white"
                                            : "bg-gray-50"
                                        } hover:bg-blue-50 transition border-b border-gray-200 last:border-b-0`}
                                      >
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                          {sp.name}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                                          {sp.description || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                              sp.status === "active"
                                                ? "bg-green-100 text-green-700"
                                                : "bg-gray-200 text-gray-700"
                                            }`}
                                          >
                                            {sp.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                                          ${(sp.flatrate || 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                          {new Date(
                                            sp.created_on
                                          ).toLocaleDateString("en-US", {
                                            month: "2-digit",
                                            day: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center justify-center gap-2">
                                            <button
                                              onClick={(e) =>
                                                handleEditSubProject(
                                                  sp,
                                                  project,
                                                  e
                                                )
                                              }
                                              className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition"
                                              title="Edit Subproject"
                                            >
                                              <Edit2 size={14} />
                                            </button>
                                            <button
                                              onClick={(e) =>
                                                handleDeleteSubProject(
                                                  sp._id,
                                                  project._id,
                                                  e
                                                )
                                              }
                                              className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition"
                                              title="Delete Subproject"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-6 text-gray-500">
                                No subprojects found for this project
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalItems > 0 && (
        <div className="px-8 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Show</span>
            <select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries per page</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              Showing {pagination.totalItems > 0 ? startIndex + 1 : 0} to{" "}
              {endIndex} of {pagination.totalItems} entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={!pagination.hasPrevPage || loading}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>

            <div className="flex gap-1">
              {[...Array(pagination.totalPages)].map((_, index) => {
                const page = index + 1;
                if (
                  page === 1 ||
                  page === pagination.totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      disabled={loading}
                      className={`px-3 py-1 rounded-lg transition ${
                        currentPage === page
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 hover:bg-gray-100"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return (
                    <span key={page} className="px-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={!pagination.hasNextPage || loading}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateProjectModal
        refreshProjects={refreshProjects}
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />

      <CreateSubProjectModal
        refreshProjects={refreshProjects}
        isOpen={isCreateSubProjectModalOpen}
        onClose={() => setIsCreateSubProjectModalOpen(false)}
      />

      {isEditProjectModalOpen && (
        <EditProjectModal
          project={selectedProject}
          refreshProjects={refreshProjects}
          isOpen={isEditProjectModalOpen}
          onClose={() => {
            setIsEditProjectModalOpen(false);
            setSelectedProject(null);
          }}
        />
      )}

      {isEditSubProjectModalOpen && (
        <EditSubProjectModal
          subProject={selectedSubProject}
          project={selectedProject}
          refreshProjects={() => {
            // Clear cache for this project and reload
            const newCache = { ...subprojectsCache };
            delete newCache[selectedProject._id];
            setSubprojectsCache(newCache);
            fetchProjects();
            if (expandedProjects[selectedProject._id]) {
              fetchSubprojects(selectedProject._id);
            }
          }}
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
