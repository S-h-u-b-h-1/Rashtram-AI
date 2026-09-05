"use client";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ResearchReport } from "@/components/workspace/ResearchReport";
export default function ReportPage() { const params = useParams(); return <ProtectedRoute><WorkspaceShell activeKey="research" title="Research report"><ResearchReport key={String(params.id)} id={String(params.id)} /></WorkspaceShell></ProtectedRoute>; }
