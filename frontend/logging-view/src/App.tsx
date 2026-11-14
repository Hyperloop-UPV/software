// Root component. Wraps all pages in the shared AppLayout (sidebar + header).
// The active view mode (Normal / Simple) is encoded in the URL so each mode
// can have a completely independent UI. Normal is the default analysis view;
// Simple remains the plot studio for publication and PDF export.
import { Navigate, Route, Routes } from "react-router";
import AppLayout from "./layout/AppLayout";
import NormalPage from "./pages/NormalPage";
import SimplePage from "./pages/SimplePage";

const App = () => {
  return (
    <AppLayout>
      <Routes>
        <Route index element={<Navigate to="/normal" replace />} />
        <Route path="/normal" element={<NormalPage />} />
        <Route path="/simple" element={<SimplePage />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
