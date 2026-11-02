namespace MedicalOffice.Application.Abstractions;

public interface ICurrentUserService
{ 
    string? UserId { get; }

    bool IsAuthenticated { get; }
}