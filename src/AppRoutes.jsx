import React from "react";
import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ProjectPage from "./pages/Project";
import Layout from "./Layout";
import Productivity from "./pages/Productivity";
// import Calculator from "./pages/Calculator";
import Costing from "./pages/Costing";
import ResourcesPage from "./pages/Resources";
import MasterDatabase from "./pages/MasterDatabase";
import Invoices from "./pages/Invoices";
import SettingsPage from "./pages/Settings";
import ProtectedRoute from "./ProtectedRoute";
// import Dashboard from "./pages/Dashboard";
import BillingDashboard from "./pages/Dashboard";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* <Route path="/" element={<Calculator />} /> */}
          <Route path="/projects" element={<ProjectPage />} />
          <Route path="/productivity" element={<Productivity />} />
          <Route path="/costing" element={<Costing />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/masterdatabase" element={<MasterDatabase />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<BillingDashboard />} />
          
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
