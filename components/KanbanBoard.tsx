"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/types";

const COLUMNS: { id: ApplicationStatus; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "oa", label: "OA" },
  { id: "interview", label: "Interview" },
  { id: "rejected", label: "Rejected" },
  { id: "offer", label: "Offer" },
];

interface KanbanBoardProps {
  applications: Application[];
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}

function DroppableColumn({
  id,
  children,
}: {
  id: ApplicationStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn("flex-1 space-y-2 p-2 min-h-[200px]", isOver && "bg-blue/5")}
    >
      {children}
    </div>
  );
}

function KanbanCard({
  app,
  onNotesChange,
}: {
  app: Application;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border border-border bg-card2 p-3 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <p className="font-medium text-sm text-text">
        {app.job?.title || "Role"}
      </p>
      <p className="text-xs text-muted mt-0.5">
        {app.job?.company || "Company"}
      </p>
      {app.deadline && (
        <p className="mt-1.5 font-mono text-[10px] text-amber">
          Due {new Date(app.deadline).toLocaleDateString()}
        </p>
      )}
      <textarea
        className="mt-2 w-full resize-none rounded border border-border bg-bg px-2 py-1 text-xs text-muted placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue"
        placeholder="Add notes..."
        rows={2}
        defaultValue={app.notes || ""}
        onBlur={(e) => onNotesChange(app.id, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function KanbanBoard({
  applications,
  onStatusChange,
  onNotesChange,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const activeApp = applications.find((a) => a.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const appId = String(active.id);
    const newStatus = String(over.id) as ApplicationStatus;
    const colIds = COLUMNS.map((c) => c.id);

    if (colIds.includes(newStatus)) {
      onStatusChange(appId, newStatus);
    } else {
      const overApp = applications.find((a) => a.id === over.id);
      if (overApp) onStatusChange(appId, overApp.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colApps = applications.filter((a) => a.status === col.id);
          return (
            <div
              key={col.id}
              className="flex w-56 flex-shrink-0 flex-col rounded-xl border border-border bg-bg2"
            >
              <div className="border-b border-border px-3 py-2.5">
                <p className="text-sm font-medium text-text">{col.label}</p>
                <p className="font-mono text-[10px] text-muted">
                  {colApps.length}
                </p>
              </div>
              <SortableContext
                id={col.id}
                items={colApps.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn id={col.id}>
                  {colApps.map((app) => (
                    <KanbanCard
                      key={app.id}
                      app={app}
                      onNotesChange={onNotesChange}
                    />
                  ))}
                </DroppableColumn>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeApp && (
          <div className="rounded-lg border border-blue/40 bg-card p-3 shadow-xl w-52">
            <p className="font-medium text-sm">{activeApp.job?.title}</p>
            <p className="text-xs text-muted">{activeApp.job?.company}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
