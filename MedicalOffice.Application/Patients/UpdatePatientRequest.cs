using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Application.Patients
{
    public class UpdatePatientRequest
    {
        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string? Phone { get; set; } 

        public string? Email { get; set; }

        public DateOnly? DateOfBirth { get; set; }
    }
}
