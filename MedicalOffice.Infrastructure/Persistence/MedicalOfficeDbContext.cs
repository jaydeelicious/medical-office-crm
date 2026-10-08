using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MedicalOffice.Infrastructure.Persistence
{
    public class MedicalOfficeDbContext : IdentityDbContext<ApplicationUser>
    {
        public MedicalOfficeDbContext(
            DbContextOptions<MedicalOfficeDbContext> options)
            : base(options)
        {
        }

        public DbSet<Patient> Patients => Set<Patient>();

        public DbSet<Doctor> Doctors => Set<Doctor>();

        public DbSet<Appointment> Appointments => Set<Appointment>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfigurationsFromAssembly(
                typeof(MedicalOfficeDbContext).Assembly);
        }
    }
}
