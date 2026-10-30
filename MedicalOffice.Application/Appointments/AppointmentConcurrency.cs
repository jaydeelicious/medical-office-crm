using MedicalOffice.Application.Exceptions;

namespace MedicalOffice.Application.Appointments;

public static class AppointmentConcurrency
{
    public static byte[] DecodeRowVersion(string? rowVersion)
    {
        if (string.IsNullOrWhiteSpace(rowVersion))
        {
            throw new ArgumentException("An appointment row version is required.");
        }

        byte[] bytes;

        try
        {
            bytes = Convert.FromBase64String(rowVersion);
        }
        catch (FormatException)
        {
            throw new ArgumentException("The appointment row version is invalid.");
        }

        if (bytes.Length != 8)
        {
            throw new ArgumentException("The appointment row version must contain 8 bytes.");
        }

        return bytes;
    }

    public static void EnsureMatches(
        byte[] currentVersion,
        byte[] expectedVersion)
    {
        if (!currentVersion.AsSpan().SequenceEqual(expectedVersion))
        {
            throw new ConflictException(
                "The appointment has been modified by another user. " +
                "Refresh the appointment and try again.");
        }
    }

    public static bool IsValidRowVersion(string? rowVersion)
    {
        if (string.IsNullOrWhiteSpace(rowVersion))
            return false;

        try
        {
            return Convert.FromBase64String(rowVersion).Length == 8;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}