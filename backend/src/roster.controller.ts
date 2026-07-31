import { Request, Response } from "express";
import { pool } from "./config/db";

const shiftOrder = ["Morning", "Day", "OBGYN", "Afternoon", "Night"] as const;
type ShiftName = (typeof shiftOrder)[number];
type DoctorRow = {
    id: string;
    name: string;
    gender: "female" | "male";
    weekly_off: string;
    allowed_shifts: ShiftName[];
    max_nights_per_month: number;
    night_fixed_weekdays: string[];
    exempt_recovery: boolean;
    consecutive_nights_allowed: boolean;
};
type Assignment = { doctorId: string | null; shift: ShiftName; date: string };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const weekday = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
const addDays = (date: Date, amount: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount));
const normalizeMonth = (value: unknown) => {
    const month = String(value || "2026-06");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
    return `${month}-01`;
};
const isRohan = (doctor: DoctorRow) => doctor.name === "Dr. Rohan Khanna";
const isImran = (doctor: Pick<DoctorRow, "name">) => doctor.name === "Dr. Imran Siddiqui";
const weekStartFor = (date: Date) => addDays(date, -date.getUTCDay());
const assignmentsThisWeek = (doctorId: string, date: Date, assignments: Assignment[]) => assignments.filter((assignment) => assignment.doctorId === doctorId && new Date(`${assignment.date}T00:00:00Z`) >= weekStartFor(date));
const assignmentsForShiftThisWeek = (doctorId: string, shift: ShiftName, date: Date, assignments: Assignment[]) => assignmentsThisWeek(doctorId, date, assignments).filter((assignment) => assignment.shift === shift).length;

function canAssign(doctor: DoctorRow, shift: ShiftName, date: Date, assignments: Assignment[], leaveDates: Set<string>) {
    const key = dateKey(date);
    if (!doctor.allowed_shifts.includes(shift) || doctor.weekly_off.toLowerCase().includes(weekday(date)) || leaveDates.has(`${doctor.id}:${key}`)) return false;
    if (isRohan(doctor) && shift !== "Night" && shift !== "Morning" && shift !== "Afternoon") return false;
    if (isRohan(doctor) && shift === "Night" && !doctor.night_fixed_weekdays.includes(weekday(date))) return false;
    if (isRohan(doctor) && (shift === "Morning" || shift === "Afternoon") && doctor.night_fixed_weekdays.includes(weekday(date))) return false;
    if (isRohan(doctor) && (shift === "Morning" || shift === "Afternoon") && assignmentsForShiftThisWeek(doctor.id, shift, date, assignments) >= 1) return false;
    if (isImran(doctor) && shift !== "Day" && shift !== "Night") return false;
    if (assignments.some((assignment) => assignment.doctorId === doctor.id && assignment.date === key)) return false;
    const recent = assignments.filter((assignment) => assignment.doctorId === doctor.id).sort((a, b) => a.date.localeCompare(b.date));
    const weekStart = weekStartFor(date);
    if (recent.filter((assignment) => new Date(`${assignment.date}T00:00:00Z`) >= weekStart).length >= 6) return false;
    const previous = recent.at(-1);
    if (shift === "Night" && !doctor.consecutive_nights_allowed && previous?.shift === "Night") return false;
    if (!doctor.exempt_recovery && previous?.shift === "Night" && shift !== "Afternoon") return false;
    if (shift === "OBGYN" && doctor.gender !== "female") return false;
    if (shift === "Night" && recent.filter((assignment) => assignment.shift === "Night").length >= doctor.max_nights_per_month) return false;
    return true;
}

function chooseDoctor(doctors: DoctorRow[], shift: ShiftName, date: Date, assignments: Assignment[], leaveDates: Set<string>) {
    return doctors
        .filter((doctor) => canAssign(doctor, shift, date, assignments, leaveDates))
        .sort((a, b) => assignments.filter((item) => item.doctorId === a.id && item.shift === shift).length - assignments.filter((item) => item.doctorId === b.id && item.shift === shift).length)[0];
}

function chooseNightDoctor(doctors: DoctorRow[], date: Date, assignments: Assignment[], leaveDates: Set<string>) {
    const day = weekday(date);
    const fixedDoctor = doctors.find((doctor) => isRohan(doctor) && doctor.night_fixed_weekdays.includes(day));
    if (fixedDoctor) return canAssign(fixedDoctor, "Night", date, assignments, leaveDates) ? fixedDoctor : undefined;
    const imran = doctors.find((doctor) => isImran(doctor) && canAssign(doctor, "Night", date, assignments, leaveDates));
    if (imran) return imran;
    return doctors
        .filter((doctor) => !isRohan(doctor) && !isImran(doctor) && canAssign(doctor, "Night", date, assignments, leaveDates))
        .sort((a, b) => assignments.filter((item) => item.doctorId === a.id && item.shift === "Night").length - assignments.filter((item) => item.doctorId === b.id && item.shift === "Night").length)[0];
}

function chooseQuotaDoctor(doctors: DoctorRow[], shift: "Morning" | "Afternoon", date: Date, assignments: Assignment[], leaveDates: Set<string>) {
    const doctor = doctors.find((item) => isRohan(item) && assignmentsForShiftThisWeek(item.id, shift, date, assignments) < 1 && canAssign(item, shift, date, assignments, leaveDates));
    return doctor;
}

export class rosterController {
    async getDoctors(_req: Request, res: Response) {
        try {
            const result = await pool.query("SELECT * FROM doctors ORDER BY name");
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal Server Error" });
        }
    }

    async getRoster(req: Request, res: Response) {
        try {
            const monthStart = normalizeMonth(req.query.month);
            if (!monthStart) return res.status(400).json({ success: false, message: "month must use YYYY-MM format" });
            const result = await pool.query(`
                select a.id, to_char(a.assignment_date, 'YYYY-MM-DD') as date, a.doctor_id as "doctorId", d.name as "doctorName",
                       s.name as shift, a.is_active as "isActive", a.is_manual_override as "isManualOverride", a.source
                from roster_assignments a join monthly_rosters r on r.id = a.roster_id
                join shift_types s on s.id = a.shift_type_id left join doctors d on d.id = a.doctor_id
                where r.month_start = $1 order by a.assignment_date, array_position(array['Morning','Day','OBGYN','Afternoon','Night'], s.name)`, [monthStart]);
            const leaves = await pool.query(`select to_char(l.leave_date, 'YYYY-MM-DD') as date, l.doctor_id as "doctorId", d.name as "doctorName" from roster_leaves l join doctors d on d.id = l.doctor_id where l.leave_date >= $1::date and l.leave_date < ($1::date + interval '1 month') and l.approved = true order by l.leave_date`, [monthStart]);
            res.json({ success: true, data: { month: monthStart.slice(0, 7), assignments: result.rows, leaves: leaves.rows } });
        } catch (error) {
            res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal Server Error" });
        }
    }

    async generateRoster(req: Request, res: Response) {
        const client = await pool.connect();
        try {
            const monthStartValue = normalizeMonth(req.body.month);
            if (!monthStartValue) return res.status(400).json({ success: false, message: "month must use YYYY-MM format" });
            const month = monthStartValue.slice(0, 7);
            const monthStart = new Date(`${monthStartValue}T00:00:00Z`);
            await client.query("BEGIN");
            const roster = await client.query(`insert into monthly_rosters (month_start) values ($1) on conflict (month_start) do update set updated_at = now() returning id`, [monthStartValue]);
            const rosterId = roster.rows[0].id as string;
            const doctors = (await client.query("select * from doctors order by name")).rows as DoctorRow[];
            const leaveRows = (await client.query("select doctor_id, leave_date from roster_leaves where approved = true")).rows as { doctor_id: string; leave_date: Date }[];
            const leaveDates = new Set(leaveRows.map((leave) => `${leave.doctor_id}:${dateKey(new Date(leave.leave_date))}`));
            const existing = (await client.query(`select to_char(a.assignment_date, 'YYYY-MM-DD') as date, a.doctor_id as "doctorId", s.name as shift from roster_assignments a join shift_types s on s.id = a.shift_type_id where a.roster_id = $1 and a.is_manual_override = true`, [rosterId])).rows as Assignment[];
            const assignments = [...existing];
            const days = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
            const shiftIds = (await client.query("select id, name from shift_types")).rows as { id: string; name: ShiftName }[];
            for (let day = 1; day <= days; day += 1) {
                const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day));
                const available = doctors.filter((doctor) => !doctor.weekly_off.toLowerCase().includes(weekday(date)) && !leaveDates.has(`${doctor.id}:${dateKey(date)}`)).length;
                const activeShifts: ShiftName[] = available <= 3 ? ["Morning", "Afternoon", "Night"] : available <= 4 ? ["Morning", "Day", "Afternoon", "Night"] : [...shiftOrder];
                for (const shift of activeShifts) {
                    if (assignments.some((assignment) => assignment.date === dateKey(date) && assignment.shift === shift)) continue;
                    const mandatoryRohanNight = shift === "Night" && doctors.some((doctor) => isRohan(doctor) && doctor.night_fixed_weekdays.includes(weekday(date)));
                    let doctor = shift === "Night" ? chooseNightDoctor(doctors, date, assignments, leaveDates) : undefined;
                    if (!mandatoryRohanNight) {
                        doctor ??= shift === "Morning" || shift === "Afternoon" ? chooseQuotaDoctor(doctors, shift, date, assignments, leaveDates) : undefined;
                        doctor ??= chooseDoctor(doctors, shift, date, assignments, leaveDates);
                    }
                    assignments.push({ date: dateKey(date), shift, doctorId: doctor?.id ?? null });
                    const shiftId = shiftIds.find((item) => item.name === shift)?.id;
                    await client.query(`insert into roster_assignments (roster_id, assignment_date, shift_type_id, doctor_id, is_active, source) values ($1,$2,$3,$4,$5,'generated') on conflict (roster_id, assignment_date, shift_type_id) do update set doctor_id = excluded.doctor_id, is_active = excluded.is_active, source = 'generated', updated_at = now() where roster_assignments.is_manual_override = false`, [rosterId, dateKey(date), shiftId, doctor?.id ?? null, doctor ? true : false]);
                }
                for (const shift of shiftOrder.filter((item) => !activeShifts.includes(item))) {
                    const shiftId = shiftIds.find((item) => item.name === shift)?.id;
                    await client.query(`insert into roster_assignments (roster_id, assignment_date, shift_type_id, doctor_id, is_active, source) values ($1,$2,$3,null,false,'generated') on conflict (roster_id, assignment_date, shift_type_id) do update set is_active = false, doctor_id = null where roster_assignments.is_manual_override = false`, [rosterId, dateKey(date), shiftId]);
                }
            }
            await client.query("COMMIT");
            res.json({ success: true, message: "Roster generated", data: { month } });
        } catch (error) {
            await client.query("ROLLBACK");
            res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Roster generation failed" });
        } finally { client.release(); }
    }

    async updateAssignment(req: Request, res: Response) {
        try {
            const { doctorId, isActive = true, note } = req.body as { doctorId: string | null; isActive?: boolean; note?: string };
            const assignment = await pool.query(`
                select a.id, a.assignment_date::text as date, a.roster_id as "rosterId", a.doctor_id as "currentDoctorId",
                       s.name as shift
                from roster_assignments a join shift_types s on s.id = a.shift_type_id
                where a.id = $1`, [req.params.id]);
            if (!assignment.rowCount) return res.status(404).json({ success: false, message: "Assignment not found" });
            if (doctorId && isActive) {
                const current = assignment.rows[0] as { date: string; rosterId: string; shift: ShiftName };
                const doctorResult = await pool.query("select id, name, gender, weekly_off, allowed_shifts, max_nights_per_month from doctors where id = $1", [doctorId]);
                if (!doctorResult.rowCount) return res.status(400).json({ success: false, message: "Selected doctor was not found" });
                const doctor = doctorResult.rows[0] as Pick<DoctorRow, "id" | "name" | "gender" | "weekly_off" | "allowed_shifts" | "max_nights_per_month">;
                const date = new Date(`${current.date}T00:00:00Z`);
                if (!doctor.allowed_shifts.includes(current.shift)) return res.status(400).json({ success: false, message: `${doctor.name} is not allowed on the ${current.shift} shift` });
                if (current.shift === "OBGYN" && doctor.gender !== "female") return res.status(400).json({ success: false, message: "Only female doctors can work the OBGYN shift" });
                if (doctor.weekly_off.toLowerCase().includes(weekday(date))) return res.status(400).json({ success: false, message: `${doctor.name}'s weekly off is mandatory` });
                if (current.shift === "Night") {
                    const nightCount = await pool.query("select count(*)::int as count from roster_assignments a join shift_types s on s.id = a.shift_type_id where a.roster_id = $1 and a.doctor_id = $2 and s.name = 'Night' and a.is_active = true and a.id <> $3", [current.rosterId, doctorId, req.params.id]);
                    if (nightCount.rows[0].count >= (isImran(doctor) ? 2 : doctor.max_nights_per_month)) return res.status(400).json({ success: false, message: `${doctor.name} has reached the maximum Night shifts for this month` });
                }
                const leave = await pool.query("select 1 from roster_leaves where doctor_id = $1 and leave_date = $2::date and approved = true", [doctorId, current.date]);
                if (leave.rowCount) return res.status(400).json({ success: false, message: `${doctor.name} is on approved leave that day` });
                const sameDay = await pool.query(`select 1 from roster_assignments where roster_id = $1 and assignment_date = $2::date and doctor_id = $3 and is_active = true and id <> $4`, [current.rosterId, current.date, doctorId, req.params.id]);
                if (sameDay.rowCount) return res.status(400).json({ success: false, message: `${doctor.name} already has a shift that day` });
                const weekStart = addDays(date, -date.getUTCDay());
                const weeklyCount = await pool.query(`select count(*)::int as count from roster_assignments where roster_id = $1 and doctor_id = $2 and is_active = true and assignment_date >= $3::date and assignment_date < ($3::date + interval '7 days') and id <> $4`, [current.rosterId, doctorId, dateKey(weekStart), req.params.id]);
                if (weeklyCount.rows[0].count >= 6) return res.status(400).json({ success: false, message: `${doctor.name} already has the maximum six shifts this week` });
            }
            const result = await pool.query(`update roster_assignments set doctor_id = $1, is_active = $2, is_manual_override = true, source = 'manual', updated_at = now() where id = $3 returning *`, [doctorId || null, isActive, req.params.id]);
            res.json({ success: true, data: result.rows[0], note });
        } catch (error) { res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Update failed" }); }
    }
}