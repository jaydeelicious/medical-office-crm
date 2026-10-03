using System;

namespace MedicalOffice.Domain.Entities
{
    public class Patient
    {
        public Guid Id { get; set; }

        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string? Phone { get; set; }

        public string? Email { get; set; }

        public DateOnly? DateOfBirth { get; set; }
    }
}
