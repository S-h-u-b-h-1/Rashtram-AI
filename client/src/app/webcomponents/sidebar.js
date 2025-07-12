"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { PromptBoxDemo } from "./chat"; // ✅ Correct

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Menu } from "lucide-react"; // Using Lucide's hamburger icon

export default function SidebarLayout() {
  return (
    <SidebarProvider>
      {/* Sidebar component */}
      <AppSidebar />

      {/* Page Content Area */}
      <SidebarInset>
        {/* Header with SidebarTrigger */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <SidebarTrigger className="p-2 rounded hover:bg-gray-100">
            <span className="sr-only">Toggle sidebar</span>
          </SidebarTrigger>
        </div>

        {/* Main Page Content */}
        <main className="p-4">
          <PromptBoxDemo />
        </main> 
        
      </SidebarInset>
    </SidebarProvider>
  );
}
