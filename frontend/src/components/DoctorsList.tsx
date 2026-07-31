import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  generateRoster,
  getDoctors,
  getRoster,
  updateAssignment,
} from "../api";
import type { Assignment, Doctor, Leave } from "../utils/types";

const shiftNames = ["Morning", "Day", "OBGYN", "Afternoon", "Night"] as const;
const shiftClass: Record<string, string> = {
  Morning: "morning",
  Day: "day",
  OBGYN: "obgyn",
  Afternoon: "afternoon",
  Night: "night",
};
const monthDays = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  return Array.from(
    { length: new Date(Date.UTC(year, value, 0)).getUTCDate() },
    (_, index) => new Date(Date.UTC(year, value - 1, index + 1)),
  );
};
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const weekday = (date: Date) =>
  date
    .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
    .toLowerCase();
const errorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    if (message) return message;
  }
  return error instanceof Error ? error.message : fallback;
};

const DoctorsList = () => {
  const [month, setMonth] = useState("2026-06");
  const [weekIndex, setWeekIndex] = useState(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const [doctorRows, roster] = await Promise.all([
        getDoctors(),
        getRoster(month),
      ]);
      setDoctors(doctorRows);
      setAssignments(roster.assignments);
      setLeaves(roster.leaves);
    } catch (err) {
      toast.error(errorMessage(err, "Could not connect to the roster API"));
    }
  };
  useEffect(() => {
    void load();
  }, [month]);
  const weeks = useMemo(() => {
    const allDays = monthDays(month);
    return Array.from({ length: Math.ceil(allDays.length / 7) }, (_, index) =>
      allDays.slice(index * 7, index * 7 + 7),
    );
  }, [month]);
  const days = weeks[weekIndex] || weeks[0] || [];
  const visibleDates = new Set(days.map(dateKey));
  const visibleLeaves = leaves.filter((item) =>
    visibleDates.has(item.date.slice(0, 10)),
  );
  const generate = async () => {
    setBusy(true);
    try {
      const roster = await generateRoster(month);
      setAssignments(roster.assignments);
      setLeaves(roster.leaves);
    } catch (err) {
      toast.error(errorMessage(err, "Generation failed"));
    } finally {
      setBusy(false);
    }
  };
  const save = async (
    assignment: Assignment,
    doctorId: string | null,
    isActive = true,
  ) => {
    setBusy(true);
    try {
      await updateAssignment(assignment.id, doctorId, isActive);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Update failed"));
    } finally {
      setBusy(false);
    }
  };
  const assignmentFor = (date: string, shift: string) =>
    assignments.find(
      (item) => item.date.slice(0, 10) === date && item.shift === shift,
    );
  const leaveFor = (date: string) =>
    visibleLeaves.filter((leave) => leave.date.slice(0, 10) === date);
  const weeklyOffFor = (date: Date) =>
    doctors
      .filter((doctor) =>
        doctor.weekly_off.toLowerCase().includes(weekday(date)),
      )
      .map((doctor) => doctor.name.replace("Dr. ", ""));
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  const weekLabel = days.length
    ? `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} - ${days.at(-1)?.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : "";
  return (
    <main className="app-shell container-fluid px-3 px-md-4">
      <header className="topbar d-flex align-items-center justify-content-between py-3">
        <div className="brand-mark d-flex align-items-center gap-2">
          <ShieldCheck size={22} />
          <span>
            PARAM<span> HEALTHCARE</span>
          </span>
        </div>
        <div className="status d-none d-md-block">
          <span className="status-dot" /> Operations / Duty roster
        </div>
      </header>
      <section className="hero row align-items-end g-4 pb-3">
        <div className="col-lg-8">
          <h1>
            Duty roster <em>control room</em>
          </h1>
          <p className="lede">
            A living weekly plan for coverage, recovery, and the people behind
            every shift.
          </p>
        </div>
        <div className="hero-accent col-lg-auto d-none d-lg-flex align-items-center gap-3">
          <CalendarDays size={42} />
          <strong>
            {new Date(`${month}-01T00:00:00Z`)
              .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
              .toUpperCase()}
            <br />
            <small>{month.slice(0, 4)}</small>
          </strong>
        </div>
      </section>
      <section className="toolbar d-flex flex-wrap align-items-end gap-3">
        <label className="d-grid gap-1">
          Roster month
          <input className="form-control"
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setWeekIndex(0);
            }}
          />
        </label>
        <label className="d-grid gap-1">
          Roster week
          <select className="form-select"
            value={weekIndex}
            onChange={(event) => setWeekIndex(Number(event.target.value))}
          >
            {weeks.map((week, index) => (
              <option value={index} key={index}>
                Week {index + 1}:{" "}
                {week[0].toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}{" "}
                -{" "}
                {week
                  .at(-1)
                  ?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary btn btn-success d-inline-flex align-items-center gap-2"
          onClick={() => void generate()}
          disabled={busy}
        >
          <RefreshCw size={16} /> {busy ? "Working..." : "Generate roster"}
        </button>
        <button
          className="secondary btn btn-outline-success d-inline-flex align-items-center gap-2"
          onClick={() => void load()}
          disabled={busy}
        >
          <RotateCcw size={16} /> Refresh
        </button>
      </section>
      <section className="roster-panel card shadow-sm overflow-hidden">
        <div className="panel-heading d-flex flex-column flex-lg-row align-items-start align-items-lg-end justify-content-between gap-3">
          <div>
            <p className="eyebrow">Weekly view / {monthLabel}</p>
            <h2>{weekLabel}</h2>
          </div>
          <div className="legend d-flex flex-wrap gap-3">
            <span>
              <i className="legend-swatch filled" /> Assigned
            </span>
            <span>
              <i className="legend-swatch leave" /> Leave
            </span>
            <span>
              <i className="legend-swatch manual" /> Override
            </span>
          </div>
        </div>
        <div className="calendar-wrap">
          <div className="calendar-grid calendar-header bg-light">
            <div className="date-label">DATE</div>
            {shiftNames.map((shift) => (
              <div key={shift}>{shift}</div>
            ))}
          </div>
          {days.map((date) => {
            const key = dateKey(date);
            const dayLeaves = leaveFor(key);
            const weeklyOffDoctors = weeklyOffFor(date);
            return (
              <div className="calendar-grid day-row" key={key}>
                <div className="date-cell">
                  <strong>
                    {date.getUTCDate().toString().padStart(2, "0")}
                  </strong>
                  <span>
                    {date.toLocaleDateString("en-US", {
                      weekday: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                  {weeklyOffDoctors.map((name) => (
                    <small className="off-note" key={name}>
                      Weekly off: {name}
                    </small>
                  ))}
                  {dayLeaves.map((leave) => (
                    <small className="leave-note" key={leave.doctorId}>
                      {leave.doctorName.replace("Dr. ", "")} leave
                    </small>
                  ))}
                </div>
                {shiftNames.map((shift) => {
                  const assignment = assignmentFor(key, shift);
                  return (
                    <div
                      className={`slot ${shiftClass[shift]} ${assignment?.isActive ? "filled" : "inactive"}`}
                      key={shift}
                    >
                      {assignment ? (
                        <>
                          <select
                            className="form-select form-select-sm"
                            aria-label={`${key} ${shift} doctor`}
                            value={assignment.doctorId || ""}
                            onChange={(event) =>
                              void save(assignment, event.target.value || null)
                            }
                            disabled={busy || !assignment.isActive}
                          >
                            <option value="">Unassigned</option>
                            {doctors.map((doctor) => (
                              <option value={doctor.id} key={doctor.id}>
                                {doctor.name}
                              </option>
                            ))}
                          </select>
                          {assignment.isManualOverride && (
                            <span
                              className="override-dot"
                              title="Manual override"
                            />
                          )}
                          {assignment.isActive && (
                            <button
                              className="clear-button btn btn-link btn-sm text-danger text-decoration-none"
                              title="Clear assignment"
                              onClick={() => void save(assignment, null)}
                              disabled={busy}
                            >
                              x
                            </button>
                          )}
                        </>
                      ) : (
                        <span>Not generated</span>
                      )}
                      {assignment && (
                        <button
                          className="inactive-button btn btn-link btn-sm text-secondary text-decoration-none px-0"
                          onClick={() =>
                            void save(
                              assignment,
                              assignment.doctorId,
                              !assignment.isActive,
                            )
                          }
                          disabled={busy}
                        >
                          {assignment.isActive ? "Make inactive" : "Activate"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default DoctorsList;
