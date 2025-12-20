import { useState, useEffect, useMemo, useCallback } from 'react';

// Assume PageHeader is correctly defined or removed if not needed in the single file structure
const PageHeader = ({ heading, subHeading }) => (
  <div className="p-6 bg-white border-b border-gray-200">
    <h1 className="text-3xl font-extrabold text-gray-900">{heading}</h1>
    <p className="text-sm text-gray-500 mt-1">{subHeading}</p>
  </div>
);

// This component now uses API calls instead of initial dummy data.
// *** IMPORTANT: Update this string with your actual API base URL. ***
const apiBaseUrl = import.meta.env.VITE_BACKEND_URL;

// ++ NEW: Reusable Loader Component
const Loader = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center py-6">
    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-3 text-sm text-gray-500 animate-pulse">{message}</p>
  </div>
);
// ---- CACHE (persists during page session, no rerenders) ----
const productivityRatesCache = new Map(); 
let resourcesCache = null;
let resourcesCacheTime = 0;

const Costing = () => {
  // State for managing filters, data, and UI
  const [projectsData, setProjectsData] = useState([]);
  const [subprojectsData, setSubprojectsData] = useState([]);
  const [subprojects, setSubprojects] = useState([]);
  const [filters, setFilters] = useState({
    project: '',
    subProject: '',
    month: (new Date().getMonth() + 1).toString(), // Default to current month
    year: new Date().getFullYear().toString()  // Default to current year
  });
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNonBillable, setShowNonBillable] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [productivityRatesMap, setProductivityRatesMap] = useState({});
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false); // ++ NEW: State for modal loader

  // --- API & DATA HANDLING ---

  // Function to show a toast message
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Effect to fetch projects and subprojects on initial component mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/project`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        const res = await fetch(`${apiBaseUrl}/project/project-subproject`);
        const subdata = await res.json();
        const data = await response.json();
        setProjectsData(data);
        setSubprojects(subdata.data);
      } catch (error) {
        console.error("Error fetching projects:", error);
        showToast(`Error fetching projects: ${error.message}`, 'error');
      }
    };
    fetchProjects();
  }, []);
 const fetchBillingData = useCallback(async () => {
    const { project, subProject, month, year } = filters;

    if (projectsData.length === 0 || subprojects.length === 0) {
      return;
    }

    // Determine which subprojects to load productivity rates for.
    let subprojectIdsToFetchRates = [];
    const allSubprojectsFlat = subprojects.flatMap(p => p.subprojects || []).map(sp => ({
      ...sp,
      // Store the parent projectId for easier lookup later
      projectId: subprojects.find(p => p.subprojects?.some(s => s._id === sp._id))?._id
    }));


    if (subProject) {
      subprojectIdsToFetchRates = [subProject];
    } else {
      // All projects view: fetch rates for all subprojects
      subprojectIdsToFetchRates = allSubprojectsFlat.map(sp => sp._id);
    }

    // Fetch all productivity rates required
    // const productivityPromises = subprojectIdsToFetchRates.map(spId =>
    //   fetch(`${apiBaseUrl}/productivity?subproject_id=${spId}`).then(res => res.ok ? res.json() : [])
    // );
    const productivityPromises = subprojectIdsToFetchRates.map(async (spId) => {

  // ✔ If cache exists, return cached value
  if (productivityRatesCache.has(spId)) {
    return productivityRatesCache.get(spId);
  }

  // ❌ If not cached, fetch once
  const res = await fetch(`${apiBaseUrl}/productivity?subproject_id=${spId}`);
  const data = res.ok ? await res.json() : [];

  // ✔ Store to cache
  productivityRatesCache.set(spId, data);

  return data;
});

    const allProductivityRatesNested = await Promise.all(productivityPromises);
    const ratesMap = subprojectIdsToFetchRates.reduce((acc, spId, index) => {
      acc[spId] = allProductivityRatesNested[index];
      return acc;
    }, {});
    setProductivityRatesMap(ratesMap);

    if (!project) {
      // --- ALL PROJECTS VIEW (Combined Active Assignments + Monthly Records) ---
      setIsLoading(true);
      setIsDataLoaded(false);
      setInvoiceInfo(null);
      setResources([]);
      try {
        // Fetch ALL resources
        // ---- RESOURCES CACHE LOGIC ----
let allResources;

if (resourcesCache) {
  // ✔ Already cached → reuse
  allResources = resourcesCache;
} else {
  // ❌ First time → fetch and cache
  const resourcesRes = await fetch(`${apiBaseUrl}/resource`);
  if (!resourcesRes.ok) throw new Error('Could not fetch resources.');

  allResources = await resourcesRes.json();

  // Store in cache
  resourcesCache = allResources;
  resourcesCacheTime = Date.now();
}

        const allResourcesMap = new Map(allResources.map(r => [r._id, r])); // Map for quick lookup

        // Fetch ALL billing records for the CURRENT month/year AND records with NULL month
        const currentMonthBillingRes = await fetch(`${apiBaseUrl}/billing?month=${month}&year=${year}`);
        if (!currentMonthBillingRes.ok) throw new Error('Could not fetch current month billing records.');
        const currentMonthBillingRecords = await currentMonthBillingRes.json();

        // const nullMonthBillingRes = await fetch(`${apiBaseUrl}/billing?month=null`);
        // if (!nullMonthBillingRes.ok) throw new Error('Could not fetch initial billing records.');
        const nullMonthBillingRecords = [];

        // Combine monthly records and initial (null month) records, prioritizing monthly records
        const billingRecordsMap = new Map();

        // 1. Add current month records (highest priority)
        currentMonthBillingRecords.forEach(billing => {
          const key = `${billing.subproject_id?._id || billing.subproject_id}-${billing.resource_id}`;
          billingRecordsMap.set(key, billing);
        });

        // 2. Add null month records if no monthly record exists yet for that subproject/resource
        nullMonthBillingRecords.forEach(billing => {
          const key = `${billing.subproject_id?._id || billing.subproject_id}-${billing.resource_id}`;
          if (!billingRecordsMap.has(key)) {
            billingRecordsMap.set(key, billing);
          }
        });

        const finalDataMap = new Map();

        // Pass 1: Active Assignments (Current Resources)
        allResources.forEach(resource => {
          (resource.assigned_subprojects || []).forEach(assignedSubproject => {

            const subProjectInfo = allSubprojectsFlat.find(sp => sp._id === assignedSubproject._id);
            if (!subProjectInfo) return; 

            const projectInfo = projectsData.find(p => p._id === subProjectInfo.projectId);
            if (!projectInfo) return;

            const subprojectId = subProjectInfo._id;
            const uniqueKey = `${subprojectId}-${resource._id}`;

            const billing = billingRecordsMap.get(uniqueKey);
            const ratesForSubproject = ratesMap[subprojectId] || [];
            let rowData;
            const defaultProductivity = 'Medium';
            const rateRecord = ratesForSubproject.find(r => r.level.toLowerCase() === defaultProductivity.toLowerCase());

            if (billing) {
              const currentRate = ratesForSubproject.find(
                r => r.level.toLowerCase() === billing.productivity_level.toLowerCase()
              )?.base_rate || 0;
              rowData = {
                ...resource,
                billingId: billing._id,
                isMonthlyRecord: billing.month !== null, // ++ FIX: Track if this is a real record
                hours: billing.hours,
                rate: currentRate,
                flatrate: subProjectInfo.flatrate ?? 0,
                productivity: billing.productivity_level,
                description: billing.description || '',
                isBillable: billing.billable_status === 'Billable'
              };
            } else {
              rowData = {
                ...resource,
                billingId: null,
                isMonthlyRecord: false, // ++ FIX: This is not a real record
                hours: 0,
                rate: rateRecord?.base_rate ?? 0,
                flatrate: subProjectInfo.flatrate ?? 0,
                productivity: defaultProductivity,
                description: '',
                isBillable: true
              };
            }

            finalDataMap.set(uniqueKey, {
              ...rowData,
              uniqueId: `${projectInfo._id}-${subprojectId}-${resource._id}`,
              projectName: projectInfo.name,
              subProjectName: subProjectInfo.name,
              projectId: projectInfo._id,
              subprojectId: subprojectId,
              isEditable: true
            });
          });
        });

        // Pass 2: Historical/Orphaned Records
        billingRecordsMap.forEach(billing => {
          const subprojectId = billing.subproject_id?._id || billing.subproject_id;
          const uniqueKey = `${subprojectId}-${billing.resource_id}`;

          if (finalDataMap.has(uniqueKey)) return;
          if (billing.month === null) return;

          const resourceInfo = allResourcesMap.get(billing.resource_id);
          const subProjectInfo = allSubprojectsFlat.find(sp => sp._id === subprojectId);
          const projectInfo = subProjectInfo ? projectsData.find(p => p._id === subProjectInfo.projectId) : null;
          
          const ratesForSubproject = ratesMap[subprojectId] || [];
          billing.rate = ratesForSubproject.find(r => r.level.toLowerCase() === billing.productivity_level.toLowerCase())?.base_rate || 0;

          if (!projectInfo || !subProjectInfo) return;

          const baseRecord = {
            uniqueId: `${projectInfo._id}-${subprojectId}-${billing.resource_id}`,
            billingId: billing._id,
            isMonthlyRecord: billing.month !== null, // ++ FIX: Track if this is a real record
            hours: billing.hours,
            rate: billing.rate,
            flatrate: subProjectInfo.flatrate ?? 0,
            productivity: billing.productivity_level,
            description: billing.description || '',
            isBillable: billing.billable_status === 'Billable',
            projectName: projectInfo.name,
            subProjectName: subProjectInfo.name,
            projectId: projectInfo._id,
            subprojectId: subprojectId,
            isEditable: false
          };

          if (!resourceInfo) {
            finalDataMap.set(uniqueKey, {
              ...baseRecord,
              name: billing.resource_name || `Deleted Resource (${billing.resource_id})`,
              avatar_url: 'https://placehold.co/40x40/f3f4f6/374151?text=DLT',
              role: 'N/A',
            });
          } else {
            finalDataMap.set(uniqueKey, {
              ...resourceInfo,
              ...baseRecord
            });
          }
        });

        setResources(Array.from(finalDataMap.values()));
        setIsDataLoaded(true);
        if (finalDataMap.size > 0) showToast('All project data loaded!');

      } catch (error) {
        console.error("Error loading linked resource data:", error);
        showToast(error.message, 'error');
      } finally {
        setIsLoading(false);
      }
    } else if (project && subProject) {
      // --- FILTERED VIEW LOGIC (Specific Subproject) ---
      setIsLoading(true);
      setIsDataLoaded(false);
      setInvoiceInfo(null);
      setResources([]);
      try {
        const [productivityRes, resourcesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/productivity?subproject_id=${subProject}`),
          fetch(`${apiBaseUrl}/resource`)
        ]);

        if (!productivityRes.ok) throw new Error('Could not fetch productivity rates.');
        if (!resourcesRes.ok) throw new Error('Could not fetch resources.');

        let subProjectFlatRate = 0;
        const selectedProjectContainer = subprojects.find(p => p._id === project);
        const selectedSubProject = selectedProjectContainer?.subprojects.find(sp => sp._id === subProject);

        if (selectedSubProject) {
          subProjectFlatRate = selectedSubProject.flatrate ?? 0;
        }

        const ratesData = await productivityRes.json();
        const allResources = await resourcesRes.json();
        const allResourcesMap = new Map(allResources.map(r => [r._id, r]));
        setProductivityRatesMap({ [subProject]: ratesData });

        const linkedResources = allResources.filter(r => (r.assigned_subprojects || []).some(sp => sp._id === subProject));

        const monthlyParams = new URLSearchParams({ subproject_id: subProject, month, year });
        const nullMonthParams = new URLSearchParams({ subproject_id: subProject, month: 'null' });

        const [monthlyBillingRes, nullMonthBillingRes] = await Promise.all([
          fetch(`${apiBaseUrl}/billing?${monthlyParams.toString()}`),
          fetch(`${apiBaseUrl}/billing?${nullMonthParams.toString()}`)
        ]);

        if (!monthlyBillingRes.ok || !nullMonthBillingRes.ok) throw new Error('Could not fetch billing data.');

        const monthlyBillingRecords = await monthlyBillingRes.json();
        const nullMonthBillingRecords = await nullMonthBillingRes.json();

        const billingRecordsMap = new Map();
        monthlyBillingRecords.forEach(billing => billingRecordsMap.set(billing.resource_id, billing));
        nullMonthBillingRecords.forEach(billing => {
          if (!billingRecordsMap.has(billing.resource_id)) {
            billingRecordsMap.set(billing.resource_id, billing);
          }
        });

        const finalDataMap = new Map();

        // Pass 1: Current Assignments (Editable)
        linkedResources.forEach(resource => {
          const billing = billingRecordsMap.get(resource._id);
          let rowData;

          const defaultProductivity = 'Medium';
          const rateRecord = ratesData.find(r => r.level.toLowerCase() === defaultProductivity.toLowerCase());

          if (billing) {
            const currentRate = ratesData.find(
              r => r.level.toLowerCase() === billing.productivity_level.toLowerCase()
            )?.base_rate || 0;
            rowData = {
              ...resource,
              billingId: billing._id,
              isMonthlyRecord: billing.month !== null, // ++ FIX: Track if this is a real record
              hours: billing.hours,
              rate: currentRate,
              flatrate: subProjectFlatRate,
              productivity: billing.productivity_level,
              description: billing.description || '',
              isBillable: billing.billable_status === 'Billable'
            };
          } else {
            rowData = {
              ...resource,
              billingId: null,
              isMonthlyRecord: false, // ++ FIX: This is not a real record
              hours: 0,
              rate: rateRecord?.base_rate ?? 0,
              flatrate: subProjectFlatRate,
              productivity: defaultProductivity,
              description: '',
              isBillable: true
            };
          }
          finalDataMap.set(resource._id, { ...rowData, uniqueId: `${project}-${subProject}-${resource._id}`, projectId: project, subprojectId: subProject, isEditable: true });
        });


        // Pass 2: Historical/Orphaned Records (Non-Editable)
        monthlyBillingRecords.forEach(billing => {
          if (finalDataMap.has(billing.resource_id)) return;

          const resourceInfo = allResourcesMap.get(billing.resource_id);
          const currentRate = ratesData.find(
            r => r.level.toLowerCase() === billing.productivity_level.toLowerCase()
          )?.base_rate || 0;
          const baseRecord = {
            uniqueId: `${project}-${subProject}-${billing.resource_id}`,
            billingId: billing._id,
            isMonthlyRecord: billing.month !== null, // ++ FIX: Track if this is a real record
            hours: billing.hours,
            rate:currentRate,
            flatrate: subProjectFlatRate,
            productivity: billing.productivity_level,
            description: billing.description || '',
            isBillable: billing.billable_status === 'Billable',
            projectId: project,
            subprojectId: subProject,
            isEditable: false
          };

          if (!resourceInfo) {
            finalDataMap.set(billing.resource_id, {
              ...baseRecord,
              name: billing.resource_name || `Deleted Resource (${billing.resource_id})`,
              avatar_url: 'https://placehold.co/40x40/f3f4f6/374151?text=DLT',
              role: 'N/A',
            });
          } else {
            finalDataMap.set(billing.resource_id, {
              ...resourceInfo,
              ...baseRecord
            });
          }
        });


        setResources(Array.from(finalDataMap.values()));
        setIsDataLoaded(true);
        showToast('Billing data loaded successfully!');
      } catch (error)
      {
        console.error("Error loading billing data:", error);
        showToast(error.message, 'error');
      } finally {
        setIsLoading(false);
      }
    } else {
      setResources([]);
      setProductivityRatesMap({});
      setIsDataLoaded(false);
    }
  }, [filters, projectsData, subprojects]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);


  // Handler for filter changes
  const handleFilterChange = (e) => {
    const { id, value } = e.target;

    const newFilters = { ...filters, [id]: value };
    if (id === 'project') {
      newFilters.subProject = '';
    }
    setFilters(newFilters);
  };
  useEffect(() => {
    if (filters.project) {
      const selectedProject = subprojects.find(sp => sp._id === filters.project);
      setSubprojectsData(selectedProject?.subprojects || []);
    } else {
      const allSubprojects = subprojects.flatMap(p => p.subprojects || []);
      setSubprojectsData(allSubprojects);
    }
  }, [filters.project, subprojects]);

  // Handler for changing resource hours, productivity, etc. inline
   const handleResourceChange = async (uniqueId, field, value) => {
    let targetResource = resources.find(r => r.uniqueId === uniqueId);
    if (!targetResource) return;

    const originalResourceState = { ...targetResource };
    const currentRates = productivityRatesMap[targetResource.subprojectId] || [];

    let parsedValue = value;
    if (field === 'hours') {
      parsedValue = Number(value);
      if (isNaN(parsedValue)) {
        parsedValue = 0;
      }
    }

    let newRes = { ...targetResource, [field]: parsedValue };

    if (field === 'productivity') {
      const rateRecord = currentRates.find(r => r.level.toLowerCase() === value.toLowerCase());
      newRes.rate = rateRecord ? rateRecord.base_rate : 0;
    }

    const updatedResources = resources.map(res =>
      res.uniqueId === uniqueId ? newRes : res
    );
    setResources(updatedResources);

    const totalAmount = Number(newRes.hours) * Number(newRes.flatrate);
    const costingAmount = Number(newRes.hours) * Number(newRes.rate);

    const payload = {
      project_id: newRes.projectId,
      subproject_id: newRes.subprojectId,
      resource_id: newRes._id,
      hours: Number(newRes.hours),
      productivity_level: newRes.productivity,
      rate: Number(newRes.rate),
      flatrate: Number(newRes.flatrate),
      costing: costingAmount,
      total_amount: totalAmount,
      description: newRes.description,
      billable_status: newRes.isBillable ? 'Billable' : 'Non-Billable',
      month: filters.month,
      year: filters.year,
    };

    try {
      let response, data;

      // ++ FIX: PUT only if it's an existing monthly record.
      // ++ POST if it's a new record (no billingId) OR based on a 'null' template.
      if (newRes.billingId && newRes.isMonthlyRecord) {
        response = await fetch(`${apiBaseUrl}/billing/${newRes.billingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`${apiBaseUrl}/billing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save billing record');

      // ++ FIX: If it was a POST, update state with new ID and set isMonthlyRecord to true
      if (!newRes.billingId || !newRes.isMonthlyRecord) {
        setResources(currentResources => currentResources.map(res =>
          res.uniqueId === uniqueId ? { ...res, billingId: data._id, isMonthlyRecord: true } : res
        ));
      }
      
      showToast('Billing record saved!');
      // Re-fetch to ensure complete sync, especially if it was a POST
      await fetchBillingData(); 
    } catch (error) {
      console.error('Error saving resource change:', error);
      showToast(error.message, 'error');
      setResources(currentResources =>
        currentResources.map(res =>
          res.uniqueId === uniqueId ? originalResourceState : res
        )
      );
    }
  };


  // Function to handle saving billing and generating an invoice
  const handleSaveBilling = () => {
    const billableRecords = resources.filter(r => r.billingId && r.hours > 0);
    if (billableRecords.length === 0) {
      showToast("No billable hours to invoice for this period, or records haven't been saved yet.", "error");
      return;
    }
    setIsConfirmModalOpen(true);
  };

const handleConfirmInvoice = async () => {
    setIsGeneratingInvoice(true);

    // 1. Get all resources currently loaded in the UI to process
    const resourcesToProcess = resources;

    if (resourcesToProcess.length === 0) {
      showToast("No records found to update or invoice.", "error");
      setIsConfirmModalOpen(false);
      setIsGeneratingInvoice(false);
      return;
    }

    // 2. Create an array of update (PUT) or create (POST) promises
    showToast("Syncing latest rates to all billing records...", "success");
    
    const syncPromises = resourcesToProcess.map(res => {
      const totalAmount = Number(res.hours) * Number(res.flatrate); // Revenue
      const costingAmount = Number(res.hours) * Number(res.rate);   // Cost

      const payload = {
        project_id: res.projectId,
        subproject_id: res.subprojectId,
        resource_id: res._id,
        hours: Number(res.hours),
        productivity_level: res.productivity,
        rate: Number(res.rate),
        flatrate: Number(res.flatrate),
        costing: costingAmount,
        total_amount: totalAmount,
        description: res.description || '',
        billable_status: res.isBillable ? 'Billable' : 'Non-Billable',
        month: filters.month,
        year: filters.year,
      };

      // ++ FIX: Use same logic as handleResourceChange
      // PUT if it's an existing monthly record
      if (res.billingId && res.isMonthlyRecord) {
        return fetch(`${apiBaseUrl}/billing/${res.billingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(response => response.json().then(data => ({ response, data, originalResource: res, method: 'PUT' })));
      } 
      // POST if it's a new record or based on a template
      else {
        return fetch(`${apiBaseUrl}/billing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(response => response.json().then(data => ({ response, data, originalResource: res, method: 'POST' })));
      }
    });

    try {
      // 3. Execute all syncs in parallel
      const results = await Promise.all(syncPromises);

      // 4. Check for failures and collect new/existing billing IDs
      const newBillingIds = new Map();
      let updatedResourcesForInvoice = [...resources];

      for (const result of results) {
        if (!result.response.ok) {
          const errorData = result.data;
          throw new Error(`Failed to sync record for ${result.originalResource.name}: ${errorData.message || 'Unknown error'}`);
        }
        
        // If this was a POST, store the new ID
        if (result.method === 'POST') {
           newBillingIds.set(result.originalResource.uniqueId, result.data._id);
        }
      }
      showToast("All records synced successfully!", "success");

      // 5. Update local state with any new billingIds BEFORE invoicing
      if (newBillingIds.size > 0) {
        updatedResourcesForInvoice = resources.map(res => {
          if (newBillingIds.has(res.uniqueId)) {
            return { ...res, billingId: newBillingIds.get(res.uniqueId), isMonthlyRecord: true };
          }
          return res;
        });
        setResources(updatedResourcesForInvoice); // Update main state
      }

      // 6. NOW, proceed with invoice generation
      // We invoice for records that have hours (billable or not, backend can filter)
      const billingRecordIds = updatedResourcesForInvoice
        .filter(r => r.hours > 0 && r.billingId) // Ensure it has hours AND a valid billingId
        .map(r => r.billingId);

      if (billingRecordIds.length === 0) {
        showToast("No records with hours to invoice after sync.", "info");
        setIsConfirmModalOpen(false);
        setIsGeneratingInvoice(false);
        return;
      }

      // 7. Create the invoice
      const invoiceResponse = await fetch(`${apiBaseUrl}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_records: billingRecordIds,
          month: filters.month,
          year: filters.year,
        }),
      });
      const newInvoice = await invoiceResponse.json();
      if (!invoiceResponse.ok) throw new Error(newInvoice.message || 'Failed to create invoice');

      setInvoiceInfo({
        id: newInvoice.invoice_number,
        message: `Invoice ${newInvoice.invoice_number} generated`,
      });
      showToast(`Invoice ${newInvoice.invoice_number} created successfully!`);
      
      // 8. Final re-fetch to get fresh data from DB
      await fetchBillingData();

    } catch (error) {
      console.error("Invoice creation or sync failed:", error);
      showToast(error.message, 'error');
    } finally {
      setIsConfirmModalOpen(false);
      setIsGeneratingInvoice(false);
    }
  };
  const handleEditClick = async (resource) => {
    if (!productivityRatesMap[resource.subprojectId]) {
      try {
        const res = await fetch(`${apiBaseUrl}/productivity?subproject_id=${resource.subprojectId}`);
        if (!res.ok) throw new Error('Failed to fetch productivity rates');
        const rates = await res.json();
        setProductivityRatesMap(prev => ({ ...prev, [resource.subprojectId]: rates }));
      } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
        return;
      }
    }
    setEditingResource({ ...resource });
    setIsModalOpen(true);
  };

  
  const handleModalFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    let newEditingResource = {
      ...editingResource,
      [name]: type === 'checkbox' ? checked : value
    };

    // Update Cost Rate if productivity changes
    if (name === 'productivity') {
      const rates = productivityRatesMap[editingResource.subprojectId] || [];
      const rateRecord = rates.find(r => r.level.toLowerCase() === value.toLowerCase());
      if (rateRecord) {
        newEditingResource.rate = rateRecord.base_rate;
      }
    }

    setEditingResource(newEditingResource);
  };

  const handleModalSave = async () => {
    if (!editingResource) return;

    const totalAmount = Number(editingResource.hours) * Number(editingResource.flatrate); // Revenue: Subproject Flatrate * Hours
    const costingAmount = Number(editingResource.hours) * Number(editingResource.rate); // Cost: Cost Rate * Hours

    const payload = {
      project_id: editingResource.projectId,
      subproject_id: editingResource.subprojectId,
      resource_id: editingResource._id,
      hours: Number(editingResource.hours),
      productivity_level: editingResource.productivity,
      rate: Number(editingResource.rate), // Internal Cost Rate
      flatrate: Number(editingResource.flatrate), // Subproject Flat Rate
      costing: costingAmount,
      total_amount: totalAmount,
      description: editingResource.description,
      billable_status: editingResource.isBillable ? 'Billable' : 'Non-Billable',
      month: filters.month,
      year: filters.year,
    };

    try {
      const response = await fetch(`${apiBaseUrl}/billing/${editingResource.billingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update billing record');

      setResources(currentResources => currentResources.map(res =>
        res.uniqueId === editingResource.uniqueId ? { ...res, ...editingResource } : res
      ));

      showToast('Billing record updated successfully!');
      setIsModalOpen(false);
      setEditingResource(null);

    } catch (error) {
      console.error('Error updating billing record:', error);
      showToast(error.message, 'error');
    }
  };

  // --- UI HELPER FUNCTIONS ---

  const sortedResources = useMemo(() => {
    let sortableItems = [...resources];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Custom calculations for sorting the new financial fields
        if (sortConfig.key === 'totalbill') {
          aValue = a.hours * a.flatrate;
          bValue = b.hours * b.flatrate;
        } else if (sortConfig.key === 'costing') {
          aValue = a.hours * a.rate;
          bValue = b.hours * b.rate;
        } else if (sortConfig.key === 'resource') {
          aValue = a.name; bValue = b.name;
        }

        // Handle numeric and string sorting
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [resources, sortConfig]);

  const filteredResources = useMemo(() => {
    return sortedResources
      .filter(res => showNonBillable || res.isBillable)
      .filter(res => res.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sortedResources, showNonBillable, searchTerm]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const totals = useMemo(() => {
    // Total Revenue (Only for Billable Status, using Subproject Flat Rate)
    const billableRevenue = resources
      .filter(r => r.isBillable)
      .reduce((sum, r) => sum + r.hours * r.flatrate, 0);

    // Total Internal Cost (for ALL resources, using Cost Rate)
    const totalCost = resources
      .reduce((sum, r) => sum + r.hours * r.rate, 0);

    // Grand Total is now Profit/Loss (Revenue - Cost)
    const grandProfitLoss = billableRevenue - totalCost;

    return {
      revenue: billableRevenue,
      cost: totalCost,
      grand: grandProfitLoss
    };
  }, [resources]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  const selectedProjectName = projectsData.find(p => p._id === filters.project)?.name;
  const selectedSubProjectName = subprojectsData.find(sp => sp._id === filters.subProject)?.name;

  // Map for sortable columns
  const columnMap = [
    { header: 'Project', key: 'projectName' },
    { header: 'Sub-Project', key: 'subProjectName' },
    { header: 'Resource', key: 'resource' },
    { header: 'Flat Rate ($)', key: 'flatrate' }, // Subproject Revenue Rate
    { header: 'Role', key: 'role' },
    { header: 'Productivity', key: 'productivity' },
    { header: 'Hours', key: 'hours' },
     { header: 'Cost Rate ($)', key: 'rate' }, // Internal Cost Rate
    { header: 'Costing ($)', key: 'costing' }, // Calculated Cost
    { header: 'Billable', key: 'isBillable' },
    { header: 'Total Bill ($)', key: 'totalbill' }, // Calculated Revenue
    { header: 'Actions', key: 'actions' },
  ];
  const sortableKeys = ['projectName', 'subProjectName', 'resource', 'flatrate', 'productivity', 'costing rate', 'costing', 'totalbill'];

  // ++ NEW: Skeleton Row Component for loading animation
const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td colSpan={12} className="py-3 px-4">
      <div className="h-4 bg-gray-200 rounded w-full"></div>
       <div className="h-4 bg-gray-200 rounded w-full"></div>
    </td>
  </tr>
);


  // ++ NEW: Empty Row Component for no data
  const EmptyRow = () => (
    <tr>
      <td colSpan={columnMap.length} className="text-center py-10 px-4">
        <div className="text-gray-500">
          <i className="fas fa-folder-open fa-3x mb-3"></i>
          <h3 className="text-lg font-semibold">No Data Found</h3>
          <p className="text-sm">No billing records match your current filters.</p>
        </div>
      </td>
    </tr>
  );


  return (
    <div className="bg-gray-50">
      {toast.show && (
        <div className={`fixed top-4 right-4 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-6 py-3 rounded-xl shadow-lg z-50 transform transition-transform duration-300`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>{toast.message}
        </div>
      )}
      <div>
        <PageHeader heading="Costing" subHeading="Analyze internal costs and billable revenue for projects" />
      </div>

      <div id="app-container" className="flex h-screen">
        <main id="main-content" className="flex-1 p-4 mb-50 flex flex-col w-full">
          <div id="billing-filters" className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
                <select id="project" value={filters.project} onChange={handleFilterChange} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent">
                  <option value="">All Projects</option>
                  {projectsData.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="subProject" className="block text-sm font-medium text-gray-700 mb-2">Select Sub-Project</label>
                <select id="subProject" value={filters.subProject} onChange={handleFilterChange} disabled={!filters.project} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-gray-100">
                  <option value="">Choose Sub-Project...</option>
                  {subprojectsData.map(sp => <option key={sp._id} value={sp._id}>{sp.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                <select id="month" value={filters.month} onChange={handleFilterChange} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent">
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
                <select id="year" value={filters.year} onChange={handleFilterChange} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent">
                  {/* Assuming years are 2024, 2025, 2026 for demonstration */}
                  <option>2026</option>
                  <option>2025</option>
                  <option>2024</option>
                </select>
              </div>
            </div>

            {/* ++ MODIFIED: Use new Loader component */}
            {isLoading && (
              <Loader message="Loading billing data..." />
            )}
            
            {isDataLoaded && !isLoading && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-700">
                  <i className="fas fa-check-circle"></i>
                  <span className="font-medium">{resources.length} records loaded for {new Date(filters.year, filters.month - 1, 1).toLocaleString('default', { month: 'long' })} {filters.year}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="text-sm text-gray-600 mb-2 md:mb-0">
                <span>{filteredResources.length} of {resources.length} records showing</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  <input type="text" placeholder="Search resources..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-48 focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
                </div>
                <button onClick={() => setShowNonBillable(!showNonBillable)} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-2">
                  <i className={`fas ${showNonBillable ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  <span>{showNonBillable ? 'Hide' : 'Show'} Non-Billable</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg flex-1 flex flex-col">
            <div className="overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '65vh' }}>
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
                  <tr>
                    {columnMap.map(({ header, key }) => {
                      const isSortable = sortableKeys.includes(key);
                      return (
                        <th key={key} className={`text-left py-4 px-4 font-semibold text-gray-700 ${isSortable ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                          onClick={() => isSortable && requestSort(key)}>
                          {header}
                          {isSortable && <i className="fas fa-sort ml-1"></i>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                {/* ++ MODIFIED: Replaced table body with conditional logic for Skeleton/Empty/Data */}
                <tbody>
                {/* isLoading ? (
                    <>
                      <SkeletonRow />
                    </>
                  ) :    */}
                  {filteredResources.length === 0 ? (
                    <SkeletonRow />
                  ) : (
                    filteredResources.map(res => (
                      <tr key={res.uniqueId} className={`border-b border-gray-100 transition-colors ${!res.isEditable ? 'bg-gray-100 opacity-70' : res.isBillable ? 'bg-green-50 hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}`}>
                        <td className="py-4 px-4">{res.projectName || selectedProjectName}</td>
                        <td className="py-4 px-4">{res.subProjectName || selectedSubProjectName}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <img src={res.avatar_url} alt={res.name} className="w-8 h-8 rounded-full object-cover" />
                            <span className="font-medium">{res.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-600 font-semibold">{formatCurrency(res.flatrate)}</td>
                        <td className="py-4 px-4 text-gray-600">{res.role}</td>
                        <td className="py-4 px-4">
                          <select value={res.productivity} onChange={(e) => handleResourceChange(res.uniqueId, 'productivity', e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed" disabled={!res.isEditable}>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Best">Best</option>
                          </select>
                        </td>
                        <td className="py-4 px-4">
                          <input type="number" value={res.hours} onChange={(e) => handleResourceChange(res.uniqueId, 'hours', e.target.value)} className="w-16 px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-center disabled:bg-gray-200 disabled:cursor-not-allowed" disabled={!res.isEditable} />
                        </td>
                        <td className="py-4 px-4 font-semibold text-red-600">{formatCurrency(res.rate)}</td>
                        <td className="py-4 px-4 font-bold text-red-700">
                        {formatCurrency(res.hours * res.rate)}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${res.isBillable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {res.isBillable ? '✅ Billable' : '🚫 Non-Billable'}
                          </span>
                        </td>
                        <td className={`py-4 px-4 font-bold ${res.isBillable ? 'text-blue-700' : 'text-gray-600'}`}>
                          {formatCurrency(res.hours * res.flatrate)}
                        </td>
                        <td className="py-4 px-4 text-left">
                          <button onClick={() => handleEditClick(res)} className="text-blue-600 hover:text-blue-800 mr-3 p-1 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Edit" disabled={!res.isEditable || !res.billingId}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="flex items-center space-x-4 md:space-x-8 mb-4 md:mb-0">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><div className="text-xs text-blue-600 font-medium">Total Billable Revenue</div></div>
                    <div className="text-xl font-bold text-blue-700">{formatCurrency(totals.revenue)}</div>
                  </div>
                  <div className="w-px h-12 bg-gray-200 hidden md:block"></div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div><div className="text-xs text-red-600 font-medium">Total Internal Cost</div></div>
                    <div className="text-xl font-bold text-red-700">{formatCurrency(totals.cost)}</div>
                  </div>
                  <div className="w-px h-12 bg-gray-200 hidden md:block"></div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1"><div className={`w-3 h-3 ${totals.grand >= 0 ? 'bg-green-500' : 'bg-orange-500'} rounded-full`}></div><div className={`text-xs ${totals.grand >= 0 ? 'text-green-600' : 'text-orange-600'} font-medium`}>Profit / Loss</div></div>
                    <div className="text-xl font-bold text-gray-700">{formatCurrency(totals.grand)}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={handleSaveBilling} className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 hover:shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2">
                    <i className="fas fa-file-invoice"></i>
                    <span>Generate Invoice</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-2xl transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 z-50`}>
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Invoice Summary</h3>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times"></i></button>
            </div>
          </div>
          {invoiceInfo && (
            <div className="p-6 space-y-4">
              {/* Invoice details would be rendered here */}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && editingResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Billing for {editingResource.name}</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="hours" className="block text-sm font-medium text-gray-700">Hours</label>
                <input type="number" name="hours" id="hours" value={editingResource.hours} onChange={handleModalFormChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="flatrate" className="block text-sm font-medium text-gray-700">Project Flat Rate ($)</label>
                  <input type="number" name="flatrate" id="flatrate" value={editingResource.flatrate} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" />
                </div>
                <div>
                  <label htmlFor="rate" className="block text-sm font-medium text-gray-700">Internal Cost Rate ($)</label>
                  <input type="number" name="rate" id="rate" value={editingResource.rate} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 cursor-not-allowed" />
                </div>
              </div>
              <div>
                <label htmlFor="productivity" className="block text-sm font-medium text-gray-700">Productivity</label>
                <select name="productivity" id="productivity" value={editingResource.productivity} onChange={handleModalFormChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Best</option>
                </select>
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea name="description" id="description" value={editingResource.description} onChange={handleModalFormChange} rows="3" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"></textarea>
              </div>
              <div className="flex items-center">
                <input type="checkbox" name="isBillable" id="isBillable" checked={editingResource.isBillable} onChange={handleModalFormChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                <label htmlFor="isBillable" className="ml-2 block text-sm text-gray-900">Is Billable?</label>
              </div>
            </div>
            <div className="mt-8 flex justify-end space-x-3">
              <button onClick={() => { setIsModalOpen(false); setEditingResource(null); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={handleModalSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ++ MODIFIED: Confirmation modal now shows a loader when isGeneratingInvoice is true */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Confirm Invoice Generation</h2>
            
            {isGeneratingInvoice ? (
              <div className="py-4">
                <Loader message="Generating... Please wait." />
              </div>
            ) : (
              <p className="text-gray-600 mb-6">
                Are you sure you want to generate an invoice for{' '}
                <span className="font-semibold text-blue-600">
                  {new Date(0, filters.month - 1).toLocaleString('default', { month: 'long' })} {filters.year}
                </span>? This action is irreversible.
              </p>
            )}

            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={isGeneratingInvoice}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInvoice}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-green-300 disabled:cursor-not-allowed"
                disabled={isGeneratingInvoice}
              >
                {isGeneratingInvoice ? 'Processing...' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Costing;