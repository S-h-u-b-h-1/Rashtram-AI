"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { PromptBoxDemo } from "./chat"; // ✅ Correct

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Menu } from "lucide-react";

export default function SidebarLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <SidebarTrigger className="p-2 rounded hover:bg-gray-100">
            <span className="sr-only">Toggle sidebar</span>
          </SidebarTrigger>
        </div>
        <main>
          <PromptBoxDemo />
        </main> 
        
      </SidebarInset>
    </SidebarProvider>
  );
}
