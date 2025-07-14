"use client";
import Sidebar from "../webcomponents/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Chat() {
  return (
    <>
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>
    </>
  );
}
