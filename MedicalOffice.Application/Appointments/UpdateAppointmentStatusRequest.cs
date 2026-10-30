using MedicalOffice.Domain.Enums;

namespace MedicalOffice.Application.Appointments
{
    public class UpdateAppointmentStatusRequest
    {
        public AppointmentStatus Status { get; set; }

        public string RowVersion { get; set; } = string.Empty;
    }
}
