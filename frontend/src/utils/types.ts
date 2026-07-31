export interface Doctor {
    id: string;
    name: string;
    gender: "female" | "male";
    weekly_off: string;
    allowed_shifts: string[];
    max_nights_per_month: number;
    notes: string;
}

export interface Assignment {
    id: string;
    date: string;
    doctorId: string | null;
    doctorName: string | null;
    shift: "Morning" | "Day" | "OBGYN" | "Afternoon" | "Night";
    isActive: boolean;
    isManualOverride: boolean;
    source: "generated" | "manual";
}

export interface Leave { date: string; doctorId: string; doctorName: string; }