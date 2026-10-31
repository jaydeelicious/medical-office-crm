using MedicalOffice.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.Identity.Client.RP;

namespace MedicalOffice.Infrastructure.Persistence.Configurations
{
    public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
    {
        public void Configure(EntityTypeBuilder<AuditLog> builder)
        {
            builder.ToTable("AuditLogs");

            builder.HasKey(a => a.Id);

            builder.Property(a => a.OccurredAtUtc)
                .IsRequired();

            builder.Property(a => a.EntityType)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(a => a.EntityId)
                .IsRequired();

            builder.Property(a => a.Action)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(a => a.UserId)
                .HasMaxLength(450);

            builder.Property(a => a.ChangesJson);

            builder.Property(a => a.CorrelationId)
                .HasMaxLength(100);

            builder.HasIndex(a => new
            {
                a.EntityType,
                a.EntityId,
                a.OccurredAtUtc
            });

            builder.HasIndex(a => new
            {
                a.OccurredAtUtc,
                a.Id
            });
        }
    }
}