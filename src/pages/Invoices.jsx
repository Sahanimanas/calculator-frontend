import React, { useState, useMemo, useEffect } from 'react';

// NOTE: This component assumes Tailwind CSS is available.
// NOTE: For demonstration purposes, I am using 'alert' as a placeholder for a custom UI modal
// which is mandated by the guidelines. In a real-world scenario, you would replace this 
// with a custom component.

const apiBaseUrl = import.meta.env.VITE_BACKEND_URL;

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [projectsList, setProjectsList] = useState([]); // State for all projects
  const [subprojectsList, setSubprojectsList] = useState([]); // State for all subprojects
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    billingMonth: 'all',
    projectName: '', // Filter by selected Project ID
    subprojectName: '' // Filter by selected Subproject ID
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPdfLibReady, setIsPdfLibReady] = useState(false);

  // --- LOAD PDF LIBRARIES ---
  useEffect(() => {
    const loadPdfScripts = async () => {
      const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
      });

      try {
        // jspdf and jspdf-autotable are required for PDF generation
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
        setIsPdfLibReady(true);
      } catch (err) {
        console.error('Failed to load PDF libraries:', err);
      }
    };

    loadPdfScripts();
  }, []);

  // --- FETCH PROJECTS AND SUBPROJECTS FOR FILTERS ---
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/project/project-subproject`);
        if (!res.ok) throw new Error('Failed to fetch project structure');
        const projectStructure = await res.json();

        // Extract unique lists
        const projects = projectStructure.map(p => ({ _id: p._id, name: p.name }));
        const subprojects = projectStructure.flatMap(p =>
          (p.subprojects || []).map(sp => ({
            _id: sp._id,
            name: sp.name,
            projectId: p._id
          }))
        );

        setProjectsList(projects);
        setSubprojectsList(subprojects);

      } catch (err) {
        console.error('Error fetching project data for filters:', err);
      }
    };

    fetchProjects();
  }, []);


  // --- FETCH INVOICES ONLY ---
  useEffect(() => {
    const fetchInvoices = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/invoices`);
        if (!res.ok) throw new Error('Failed to fetch invoices');
        const data = await res.json();
        setInvoices(data);
        console.log(data)
      } catch (err) {
        console.error('Error fetching invoices:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  // --- DIRECT LOOKUPS (NO EXTERNAL DATA) ---
  const getLookups = (invoice) => {
    return invoice.billing_records.map(record => ({
      ...record,
      projectName: record.project_name || record.project_id?.name || 'N/A',
      subprojectName: record.subproject_name || record.subproject_id?.name || 'N/A',
      resourceName: record.resource_name || record.resource_id?.name || 'N/A'
    }));
  };

  // --- GENERATE UNIQUE MONTH/YEAR FOR DROPDOWN ---
  const uniqueBillingPeriods = useMemo(() => {
    const periods = new Set();
    invoices.forEach(invoice => {
      const firstRecord = invoice.billing_records?.[0];
      if (firstRecord && firstRecord.month && firstRecord.year) {
        const monthName = new Date(0, firstRecord.month - 1).toLocaleString('default', { month: 'long' });
        periods.add(`${monthName} ${firstRecord.year}`);
      }
    });

    // Convert set to array and sort by date (newest first)
    return ['all', ...Array.from(periods).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      // Use Date object for accurate month/year sorting
      const dateA = new Date(yearA, new Date(Date.parse(monthA + " 1, 2020")).getMonth());
      const dateB = new Date(yearB, new Date(Date.parse(monthB + " 1, 2020")).getMonth());
      return dateB - dateA; // Descending order (newest first)
    })];
  }, [invoices]);


  // --- FILTERED INVOICES ---
  const filteredInvoices = useMemo(() => {
    const searchLower = filters.search.toLowerCase();
    const monthFilter = filters.billingMonth;
    const projectIdFilter = filters.projectName;
    const subprojectIdFilter = filters.subprojectName;

    return invoices.filter(inv => {
      // 1. Invoice Number Search
      if (!inv.invoice_number.toLowerCase().includes(searchLower)) {
        return false;
      }

      // 2. Billing Month Filter
      if (monthFilter !== 'all') {
        const firstRecord = inv.billing_records?.[0];
        if (!firstRecord) return false;

        const monthName = new Date(0, firstRecord.month - 1).toLocaleString('default', { month: 'long' });
        const invoicePeriod = `${monthName} ${firstRecord.year}`;
        if (invoicePeriod !== monthFilter) {
          return false;
        }
      }

      // 3 & 4. Project/Subproject Filtering (Check if ANY record matches)
      const records = getLookups(inv);

      // Filter by Project ID
      if (projectIdFilter) {
        const projectMatch = records.some(r => (r.project_id?._id || r.project_id) === projectIdFilter);
        if (!projectMatch) return false;
      }

      // Filter by Subproject ID
      if (subprojectIdFilter) {
        const subprojectMatch = records.some(r => (r.subproject_id?._id || r.subproject_id) === subprojectIdFilter);
        if (!subprojectMatch) return false;
      }

      return true;
    });
  }, [invoices, filters]);

  // --- HELPERS ---
  const formatCurrency = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  const formatDate = (d) =>
    new Date(d).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // Retrieves the billing month/year string for the table display
  const getBillingMonthText = (invoice) => {
    const firstRecord = invoice.billing_records?.[0];
    if (firstRecord && firstRecord.month && firstRecord.year) {
      const monthName = new Date(0, firstRecord.month - 1).toLocaleString('default', { month: 'long' });
      return `${monthName} ${firstRecord.year}`;
    }
    return 'N/A';
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    let newFilters = { ...filters, [name]: value };

    // If the project filter changes, reset the subproject filter
    if (name === 'projectName') {
      newFilters.subprojectName = '';
    }

    setFilters(newFilters);
  };

  // --- HANDLE PDF DOWNLOAD ---
  const handleDownloadPdf = () => {
  if (!isPdfLibReady || !selectedInvoice) 
    return console.error("PDF not ready or no invoice selected.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text(`Invoice: ${selectedInvoice.invoice_number}`, 14, 22);

  const first = selectedInvoice.billing_records[0];
  if (first) {
    const period = `${new Date(0, first.month - 1).toLocaleString('default', { month: 'long' })} ${first.year}`;
    doc.setFontSize(12);
    doc.text(`For Period: ${period}`, 14, 30);
  }
  doc.text(`Date Generated: ${formatDate(selectedInvoice.createdAt)}`, 14, 36);

  const rows = getLookups(selectedInvoice);
  // ✅ UPDATED HEADERS (added Flat Rate)
  const head = [['Project', 'Sub-Project', 'Resource', 'Hours', 'Flat Rate', 'Rate', 'Costing', 'Total', 'Status']];

  const body = rows.map(r => {
  const isNonBillable = r.billable_status?.toLowerCase() === 'non-billable';
  const totalValue = isNonBillable ? 0 : r.total_amount;

  return [
    r.projectName,
    r.subprojectName,
    r.resourceName,
    r.hours,
    formatCurrency(r.flatrate),
    formatCurrency(r.rate),
    formatCurrency(r.costing),
    formatCurrency(totalValue), // ✅ updated
    r.billable_status
  ];
});


  doc.autoTable({ startY: 45, head, body });
  const finalY = doc.autoTable.previous.finalY;

  // --- Summary Totals ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  let currentY = finalY + 15;
  // doc.text(`Billing Total (Billable + Non-Billable): ${formatCurrency(selectedInvoice.total_billing_amount)}`, 14, currentY);

  currentY += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Costing Amount: ${formatCurrency(selectedInvoice.total_costing_amount)}`, 14, currentY);
  currentY += 8;
  doc.text(`Total Billing Amount: ${formatCurrency(selectedInvoice.total_billable_amount)}`, 14, currentY);

  doc.save(`Invoice-${selectedInvoice.invoice_number}.pdf`);
};
  // --- NEW: HANDLE CSV DOWNLOAD ---
 const handleDownloadCsv = (invoice) => {
  if (!invoice) return console.error("No invoice selected.");

  const records = getLookups(invoice);
  const firstRecord = invoice.billing_records[0] || {};
  const monthName = firstRecord.month
    ? new Date(0, firstRecord.month - 1).toLocaleString('default', { month: 'long' })
    : '';

  // ✅ Match PDF headers
  const headers = [
    "Invoice_Number",
    "Billing_Month",
    "Billing_Year",
    "Project",
    "Sub_Project",
    "Resource",
    "Hours",
    "Flat_Rate",
    "Rate",
    "Costing",
    "Total",
    "Status"
  ];

  // ✅ Generate data rows
const csvRows = records.map(r => {
  const isNonBillable = r.billable_status?.toLowerCase() === 'non-billable';
  const totalValue = isNonBillable ? 0 : r.total_amount;

  return [
    invoice.invoice_number,
    monthName,
    firstRecord.year || '',
    `"${r.projectName?.replace(/"/g, '""') || ''}"`,
    `"${r.subprojectName?.replace(/"/g, '""') || ''}"`,
    `"${r.resourceName?.replace(/"/g, '""') || ''}"`,
    r.hours || 0,
    r.flatrate || 0,
    r.rate || 0,
    r.costing || 0,
    totalValue || 0, // ✅ updated
    r.billable_status || ''
  ].join(',');
});


  // ✅ Add summary totals (same as in PDF)
  const summaryRows = [
    "",
    "SUMMARY TOTALS",
    "",
    `Total Costing Amount:,${invoice.total_costing_amount || 0}`,
    // `Total Non-BillableAmount:,${invoice.total_non_billable_amount || 0}`,
    `Total Billable Amount:,${invoice.total_billable_amount || 0}`
  ];

  // ✅ Combine CSV
  const csvContent = [
    headers.join(','),
    ...csvRows,
    '',
    ...summaryRows
  ].join('\n');

  // ✅ Download logic
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Invoice-${invoice.invoice_number}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


  // --- RENDER ---
  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Invoice Dashboard</h1>
          <p className="text-gray-600 mt-1">A summary of all generated invoices.</p>
        </header>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* 1. Search by Invoice # */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">Search by Invoice #</label>
              <input
                type="text"
                name="search"
                id="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="e.g., INV-2025-10-001"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {/* 2. Billing Month Filter */}
            <div>
              <label htmlFor="billingMonth" className="block text-sm font-medium text-gray-700">Billing Month</label>
              <select
                id="billingMonth"
                name="billingMonth"
                value={filters.billingMonth}
                onChange={handleFilterChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {uniqueBillingPeriods.map(period => (
                  <option key={period} value={period}>
                    {period === 'all' ? 'All Months' : period}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Project Name Filter */}
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">Project Name</label>
              <select
                id="projectName"
                name="projectName"
                value={filters.projectName}
                onChange={handleFilterChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Projects</option>
                {projectsList.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Subproject Name Filter */}
            <div>
              <label htmlFor="subprojectName" className="block text-sm font-medium text-gray-700">Subproject Name</label>
              <select
                id="subprojectName"
                name="subprojectName"
                value={filters.subprojectName}
                onChange={handleFilterChange}
                disabled={!filters.projectName}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
              >
                <option value="">All Subprojects</option>
                {subprojectsList
                  .filter(sp => sp.projectId === filters.projectName)
                  .map(sp => (
                    <option key={sp._id} value={sp._id}>{sp.name}</option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* UPDATED HEADER ARRAY: Added 'Billing Total' and 'Costing Total' */}
                  {['Invoice #', 'Billing Month', 'Billing Total', 'Costing Total', 'Billable Amount', 'Non-Billable Amount', 'Items', 'Created', 'Download'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan="9" className="text-center py-10">Loading invoices...</td></tr>
                ) : filteredInvoices.map(invoice => (
                  <tr key={invoice._id} onClick={() => setSelectedInvoice(invoice)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {getBillingMonthText(invoice)}
                    </td>
                    {/* Updated field to total_billing_amount */}
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(invoice.total_billing_amount)}</td>
                    {/* Added new field total_costing_amount */}
                    <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(invoice.total_costing_amount)}</td>

                    <td className="px-6 py-4 text-sm text-green-700">{formatCurrency(invoice.total_billable_amount)}</td>
                    <td className="px-6 py-4 text-sm text-red-700">{formatCurrency(invoice.total_non_billable_amount)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{invoice.billing_records.length}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(invoice.createdAt)}</td>

                    {/* DOWNLOAD CELL */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <button
                        onClick={(e) => {
                          // Stop propagation to prevent the row's onClick (opening the modal)
                          e.stopPropagation();
                          handleDownloadCsv(invoice);
                        }}
                        className="text-xs font-semibold text-green-600 hover:text-green-800 transition duration-150 p-2 rounded-lg bg-green-50 hover:bg-green-100 shadow-sm"
                        title={`Download ${invoice.invoice_number} as CSV`}
                      >
                        Download CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Invoice {selectedInvoice.invoice_number}</h2>
                {/* Displaying both new totals */}
                {/* <p className="text-sm text-gray-500 mt-1">
                  <span className="font-semibold text-gray-700">Billing Total:</span> {formatCurrency(selectedInvoice.total_billing_amount)}
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">Costing Total:</span> {formatCurrency(selectedInvoice.total_costing_amount)}
                </p> */}
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Billing Records ({selectedInvoice.billing_records.length})</h3>
              {console.log(selectedInvoice.billing_records)}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {/* UPDATED: Added 'Costing' to modal table headers */}
                      {['Project', 'Sub-Project', 'Resource', 'Hours','flat rate', 'costing Rate', 'Costing', 'Total', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getLookups(selectedInvoice).map(record => (
                      <tr key={record._id}>
                        <td className="px-4 py-3 text-sm text-gray-700">{record.projectName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{record.subprojectName}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{record.resourceName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.hours}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(record.flatrate)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(record.rate)}</td>
                        {/* UPDATED: Added Costing field to modal table body */}
                        <td className="px-4 py-3 text-sm text-red-600">{formatCurrency(record.costing)}</td>
                        {/* FIX: Use pre-calculated total_amount */}
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">
  {formatCurrency(
    record.billable_status?.toLowerCase() === 'non-billable'
      ? 0
      : record.total_amount
  )}
</td>

                        <td className="px-4 py-3 text-sm text-gray-600">{record.billable_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              {/* Download PDF button */}
              <button
                onClick={handleDownloadPdf}
                disabled={!isPdfLibReady}
                className={`px-4 py-2 rounded-lg text-white flex items-center space-x-2 ${isPdfLibReady ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                  }`}
              >
                <span>{isPdfLibReady ? 'Download PDF' : 'Loading Libs...'}</span>
              </button>
              {/* Download CSV button for the selected invoice in the modal */}
              <button
                onClick={() => handleDownloadCsv(selectedInvoice)}
                className="px-4 py-2 rounded-lg text-white flex items-center space-x-2 bg-green-600 hover:bg-green-700"
              >
                <span>Download CSV</span>
              </button>
              <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
