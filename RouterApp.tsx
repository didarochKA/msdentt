import React from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import Landing from "./App";
import DoctorsPage from "./DoctorsPage";
import DoctorProfilePage from "./DoctorProfilePage";

export default function RouterApp() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/doctors" element={<DoctorsPage />} />
        <Route path="/doctors/:id" element={<DoctorProfilePage />} />
      </Routes>
    </HashRouter>
  );
}

