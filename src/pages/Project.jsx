import { useEffect, useState } from "react";
import CreateProjectModal from "../components/CreateProjectModal";
import PageHeader from "../components/PageHeader";
import { FaFile, FaUpload, FaInfoCircle } from "react-icons/fa";
import CreateSubProjectModal from "../components/CreateSubProjectModal";
import { fetchProjectsWithSubProjects } from "../services/projectService.js";
import ProjectTable from "../components/Project/ProjectTable.jsx";
import toast from "react-hot-toast";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  
} from "@heroicons/react/24/outline";
const ProjectPage = () => {
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreateSubProjectModalOpen, setIsCreateSubProjectModalOpen] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [showCsvFormat, setShowCsvFormat] = useState(false); // ✅ toggle for format info

  const fetchData = async () => {
    try {
      const { data } = await fetchProjectsWithSubProjects();
      setTableData(data);
    } catch (error) {
      toast.error("There was an error while fetching table data");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ CSV Upload Handler
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
    const res = await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/upload/bulk-upload`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      }
    );

    // ---- SUCCESS CASE ----
    const isJSON = res.headers["content-type"]?.includes("application/json");

    if (isJSON) {
      // Parse JSON success response
      const text = await res.data.text();
      const json = JSON.parse(text);

      toast.dismiss();
      toast.success(json.message || "CSV uploaded successfully!");

      fetchData();
      return;
    }

  } catch (err) {

    // ---- CSV ERROR FILE FROM BACKEND ----
    if (err?.response?.status === 400 &&
        err.response.headers["content-type"]?.includes("text/csv")) 
    {
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

    // ---- UNEXPECTED ERRORS ----
    toast.dismiss();
    toast.error("Upload failed. Please try again.");
    console.error(err);

  } finally {
    event.target.value = ""; // reset input
  }
};


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
            className="bg-blue-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-blue-700"
          >
            <FaFile size={20} />
            New Project
          </button>

          <button
            onClick={() => setIsCreateSubProjectModalOpen(true)}
            className="text-blue-700 border border-blue-700 inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-200"
          >
            <FaFile size={20} />
            New Sub Project
          </button>

          {/* ✅ Upload CSV Button */}
          <label className="cursor-pointer bg-green-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-green-700">
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

    const blob = new Blob([csvHeader], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "project-subproject-template.csv";
    a.click();

    URL.revokeObjectURL(url);
  }}
  className="cursor-pointer bg-purple-600 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-purple-700"
>
 <ArrowDownTrayIcon className="w-5 h-5"/>
  Download Template
</button>

          {/* ✅ Info toggle */}
          <button
            onClick={() => setShowCsvFormat(!showCsvFormat)}
            className="text-gray-600 inline-flex items-center gap-2 hover:text-gray-800"
          >
            <FaInfoCircle size={18} />
            CSV Format Info
          </button>
        </div>

        {/* ✅ Format info box */}
        {showCsvFormat && (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm text-sm text-gray-700 animate-fadeIn">

    <h3 className="font-semibold text-gray-800 mb-2">CSV Format Guide</h3>
    <p className="mb-2">
      The CSV file must include the following columns (exact order required):
    </p>

    <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-sm text-gray-800">
project_name,project_description,visibility,status,flatrate,subproject_name,subproject_description,subproject_status
    </pre>

    <ul className="list-disc list-inside mt-3 text-gray-600">
      <li><strong>project_name</strong>: Name of the project (required)</li>
      <li><strong>project_description</strong>: Description of the project (optional)</li>

      <li><strong>visibility</strong>: Must be <em>“visible”</em> or <em>“hidden”</em></li>
      <li><strong>status</strong>: Must be <em>“active”</em> or <em>“inactive”</em></li>

      <li><strong>flatrate</strong>: Numeric value (e.g., 0, 99.99, 120)</li>

      <li><strong>subproject_name</strong>: Name of the subproject (required)</li>
      <li><strong>subproject_description</strong>: Description of the subproject (optional)</li>

      <li><strong>subproject_status</strong>: Must be <em>“active”</em> or <em>“inactive”</em></li>
    </ul>

    <p className="mt-4 text-gray-700 font-medium">Example CSV:</p>
    <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-sm text-gray-800">
project_name,project_description,visibility,status,flatrate,subproject_name,subproject_description,subproject_status
Alpha Project,Main Alpha project,visible,active,100,Sub A,Alpha sub A,active
Alpha Project,Main Alpha project,visible,active,100,Sub B,Alpha sub B,inactive
Beta Project,,hidden,active,50,Sub X,First sub of Beta,active
Gamma Project,Description here,visible,active,0,Sub G,,active
    </pre>
  </div>
)}

      </div>

      <div>
        <ProjectTable refreshProjects={fetchData} data={tableData} />
      </div>

      <CreateProjectModal
        refreshProjects={fetchData}
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />

      <CreateSubProjectModal
        refreshProjects={fetchData}
        isOpen={isCreateSubProjectModalOpen}
        onClose={() => setIsCreateSubProjectModalOpen(false)}
      />
    </div>
  );
};

export default ProjectPage;
