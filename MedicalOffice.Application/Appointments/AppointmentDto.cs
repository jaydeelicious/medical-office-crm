using MedicalOffice.Domain.Enums;

namespace MedicalOffice.Application.Appointments
{
    public class AppointmentDto
    {
        public Guid Id { get; set; }
        
        public Guid PatientId { get; set; } 

        public Guid DoctorId { get; set; }

        public DateTime StartTime { get; set; }
        
        public DateTime EndTime { get; set; }

        public AppointmentStatus Status { get; set; }

        public string? Notes { get; set; }
    }
}
