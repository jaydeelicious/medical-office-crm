export function getLocalToday(): string {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function timeToMinutes(time: string): number | null {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return null;
    }

    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function calculateEndTime(
    startTime: string,
    durationMinutes: number,
): string | null {
    const startMinutes = timeToMinutes(startTime);

    if (
        startMinutes === null ||
        !Number.isInteger(durationMinutes) ||
        durationMinutes <= 0
    ) {
        return null;
    }

    const endMinutes = startMinutes + durationMinutes;

    // The current API workflow assumes same-day appointments.
    if (endMinutes >= 24 * 60) {
        return null;
    }

    return minutesToTime(endMinutes);
}

export function calculateDuration(
    startTime: string,
    endTime: string,
): number | null {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    if (start === null || end === null || end <= start) {
        return null;
    }

    return end - start;
}