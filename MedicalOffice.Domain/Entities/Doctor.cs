using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Domain.Entities
{
    public class Doctor
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string Specialty { get; set; } = string.Empty;
    }
}
