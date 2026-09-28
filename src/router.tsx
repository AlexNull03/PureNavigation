import { createHashRouter } from "react-router-dom";

import { AppLayout } from "@/layouts/AppLayout";
import { AdvisePage } from "@/pages/AdvisePage";
import { CategoryPage } from "@/pages/CategoryPage";
import { HomePage } from "@/pages/HomePage";
import { InspectPage } from "@/pages/InspectPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SoftwareDetailPage } from "@/pages/SoftwareDetailPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "category/:id", element: <CategoryPage /> },
      { path: "app/:name", element: <SoftwareDetailPage /> },
      { path: "advise", element: <AdvisePage /> },
      { path: "inspect", element: <InspectPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
