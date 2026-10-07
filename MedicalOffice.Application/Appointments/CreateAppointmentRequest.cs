using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Application.Appointments
{
    public class CreateAppointmentRequest
    {
        public Guid PatientId { get; set; }

        public Guid DoctorId { get; set; }

        public DateTime StartTime { get; set; }

        public DateTime EndTime { get; set; }

        public string? Notes { get; set; }
    }
}
