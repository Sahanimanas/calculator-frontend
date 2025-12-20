import React, { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const BackendUrl = import.meta.env.VITE_BACKEND_URL;
const API_URL = `${BackendUrl}/project/project-subproject`;

const SubprojectsContent = () => {
  const [projects, setProjects] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("Failed to fetch project-subproject data");
        const data = await res.json();
        setProjects(data.data || data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate total flatrate for a project's subprojects
  const calculateTotalFlatrate = (subprojects) => {
    return subprojects.reduce((total, sp) => total + (sp.flatrate || 0), 0);
  };

  // Filter projects based on subproject search
  const filteredProjects = useMemo(() => {
    if (!search) return projects;

    return projects
      .map((project) => {
        const matchingSubprojects = project.subprojects.filter((sp) =>
          sp.name.toLowerCase().includes(search.toLowerCase())
        );
        if (matchingSubprojects.length > 0) {
          return { ...project, subprojects: matchingSubprojects };
        }
        return null;
      })
      .filter(Boolean);
  }, [search, projects]);

  // Auto-expand all projects if searching
  useEffect(() => {
    if (search) {
      const newExpanded = {};
      filteredProjects.forEach((proj) => {
        newExpanded[proj._id] = true;
      });
      setExpanded(newExpanded);
    }
  }, [search, filteredProjects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading projects and subprojects...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        Error: {error}
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">
        Project → Subprojects Overview
      </h1>

      <input
        type="text"
        placeholder="Search by subproject name..."
        className="mb-4 p-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 bg-white">
        <table className="min-w-full text-sm text-left text-gray-700">
          <thead className="bg-gray-100 text-gray-900 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-3">Project</th>
              <th className="px-6 py-3">Visibility</th>
              <th className="px-6 py-3">Created On</th>
              <th className="px-6 py-3">Updated At</th>
              <th className="px-6 py-3">Subprojects</th>
              <th className="px-6 py-3 text-right">Total Flatrate</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, index) => (
              <React.Fragment key={project._id}>
                <tr
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100 transition cursor-pointer`}
                  onClick={() => toggleExpand(project._id)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                    {expanded[project._id] ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    {project.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {project.visibility}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(project.created_on).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(project.updated_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{project.subprojects.length}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900">
                    ${calculateTotalFlatrate(project.subprojects).toFixed(2)}
                  </td>
                </tr>

                {expanded[project._id] && project.subprojects.length > 0 && (
                  <tr>
                    <td colSpan="6" className="bg-gray-50">
                      <div className="px-10 py-4">
                        <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                          <thead className="bg-gray-100 text-gray-900 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-2">Name</th>
                              <th className="px-4 py-2">Description</th>
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2 text-right">Flatrate</th>
                              <th className="px-4 py-2">Created On</th>
                              <th className="px-4 py-2">Updated At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {project.subprojects.map((sp) => (
                              <tr
                                key={sp._id}
                                className="bg-white hover:bg-gray-100 transition"
                              >
                                <td className="px-4 py-2 font-medium text-gray-900">
                                  {sp.name}
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                  {sp.description || "—"}
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                      sp.status === "active"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {sp.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-medium text-gray-900">
                                  ${(sp.flatrate || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-2">
                                  {new Date(sp.created_on).toLocaleString()}
                                </td>
                                <td className="px-4 py-2">
                                  {new Date(sp.updated_at).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubprojectsContent;