import { createHashRouter } from "react-router-dom";

import { AppLayout } from "@/layouts/AppLayout";
import { AdvisePage } from "@/pages/AdvisePage";
import { BrowsePage } from "@/pages/BrowsePage";
import { InspectPage } from "@/pages/InspectPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SoftwareDetailPage } from "@/pages/SoftwareDetailPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <BrowsePage /> },
      { path: "app/:name", element: <SoftwareDetailPage /> },
      { path: "advise", element: <AdvisePage /> },
      { path: "inspect", element: <InspectPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
