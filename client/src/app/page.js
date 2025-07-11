"use client";

import Navbar from "@/components/Navbar";
import Sidebar from "./webcomponents/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Home() {
  return (
    <>
  <SidebarProvider>
        <Sidebar />
  </SidebarProvider>
    </>
  );
}
