using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Application.Appointments
{
    public class RescheduleAppointmentRequest
    {
        public DateTime StartTime { get; set; }

        public DateTime EndTime { get; set; }

        public string RowVersion { get; set; } = string.Empty;
    }
}
