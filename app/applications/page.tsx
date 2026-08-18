"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import {
  getDemoApplications,
  getDemoUserId,
  saveDemoApplications,
} from "@/lib/demo-store";
import type { Application, ApplicationStatus } from "@/types";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    setApplications(getDemoApplications());
  }, []);

  const handleStatusChange = async (id: string, status: ApplicationStatus) => {
    const updated = applications.map((a) =>
      a.id === id ? { ...a, status } : a
    );
    setApplications(updated);
    saveDemoApplications(updated);

    const userId = getDemoUserId();
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});

    if (status === "applied") {
      await fetch("/api/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, eventType: "apply_to_job" }),
      });
    }
  };

  const handleNotesChange = (id: string, notes: string) => {
    const updated = applications.map((a) =>
      a.id === id ? { ...a, notes } : a
    );
    setApplications(updated);
    saveDemoApplications(updated);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 px-6 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold">Application Tracker</h1>
            <p className="text-sm text-muted mt-1">
              Drag cards between columns to update status
            </p>
          </div>

          {applications.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <p className="text-muted">
                No applications yet. Save or apply to roles from your dashboard.
              </p>
            </div>
          ) : (
            <KanbanBoard
              applications={applications}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
            />
          )}
        </main>
      </div>
    </div>
  );
}
