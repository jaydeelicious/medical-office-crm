
import { AppointmentStatus } from './appointment.model';

export function getAppointmentStatusLabel(
  status: AppointmentStatus,
): string {
  switch (status) {
    case AppointmentStatus.Scheduled:
      return 'Scheduled';

    case AppointmentStatus.Completed:
      return 'Completed';

    case AppointmentStatus.Cancelled:
      return 'Cancelled';

    case AppointmentStatus.NoShow:
      return 'No show';

    default:
      return 'Unknown';
  }
}

export function getAppointmentStatusClass(
  status: AppointmentStatus,
): string {
  switch (status) {
    case AppointmentStatus.Scheduled:
      return 'status-scheduled';

    case AppointmentStatus.Completed:
      return 'status-completed';

    case AppointmentStatus.Cancelled:
      return 'status-cancelled';

    case AppointmentStatus.NoShow:
      return 'status-no-show';

    default:
      return '';
  }
}
