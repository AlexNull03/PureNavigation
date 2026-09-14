import { createHashRouter } from "react-router-dom";

import { AppLayout } from "@/layouts/AppLayout";
import { BrowsePage } from "@/pages/BrowsePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SoftwareDetailPage } from "@/pages/SoftwareDetailPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <BrowsePage /> },
      { path: "app/:name", element: <SoftwareDetailPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
