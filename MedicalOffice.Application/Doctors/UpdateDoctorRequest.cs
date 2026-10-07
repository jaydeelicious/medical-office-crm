namespace MedicalOffice.Application.Doctors
{
    public class UpdateDoctorRequest
    {
        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string? Phone { get; set; } 

        public string? Email { get; set; }

        public string Specialty { get; set; } = string.Empty;
    }
}