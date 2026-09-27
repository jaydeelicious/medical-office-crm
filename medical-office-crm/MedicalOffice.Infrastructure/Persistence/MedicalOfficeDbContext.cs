using MedicalOffice.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedicalOffice.Infrastructure.Persistence
{
    public class MedicalOfficeDbContext : DbContext
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
            modelBuilder.ApplyConfigurationsFromAssembly(
                typeof(MedicalOfficeDbContext).Assembly);

            base.OnModelCreating(modelBuilder);
        }
    }
}
