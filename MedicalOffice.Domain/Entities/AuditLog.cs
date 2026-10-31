namespace MedicalOffice.Domain.Entities
{
    public class AuditLog
    {
        public Guid Id { get; set; }

        public DateTime OccurredAtUtc { get; set; }

        public string EntityType { get; set; } = string.Empty;

        public Guid EntityId { get; set; }

        public string Action { get; set; } = string.Empty;

        public string? UserId { get; set; }

        public string? ChangesJson { get; set; }

        public string? CorrelationId { get; set; }
    }
}