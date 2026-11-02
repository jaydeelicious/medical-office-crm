using System.Security.Claims;
using MedicalOffice.Application.Abstractions;

namespace MedicalOffice.Api.Authentication;

public sealed class HttpCurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpCurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public string? UserId
    {
        get
        {
            if (!IsAuthenticated)
            {
                return null;
            }

            var principal = _httpContextAccessor.HttpContext!.User;

            var userId =
                principal.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? principal.FindFirstValue("sub");

            return string.IsNullOrWhiteSpace(userId)
                ? null
                : userId;
        }
    }
}