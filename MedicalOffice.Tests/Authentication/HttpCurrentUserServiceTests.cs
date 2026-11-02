
using System.Security.Claims;
using FluentAssertions;
using MedicalOffice.Api.Authentication;
using Microsoft.AspNetCore.Http;

namespace MedicalOffice.Tests.Authentication;

public class HttpCurrentUserServiceTests
{
    [Fact]
    public void AuthenticatedUser_WithNameIdentifier_ShouldReturnUserId()
    {
        var service = CreateService(
            new Claim(ClaimTypes.NameIdentifier, "user-123"));

        service.IsAuthenticated.Should().BeTrue();
        service.UserId.Should().Be("user-123");
    }

    [Fact]
    public void AuthenticatedUser_WithSubjectClaim_ShouldReturnUserId()
    {
        var service = CreateService(
            new Claim("sub", "oidc-user-456"));

        service.IsAuthenticated.Should().BeTrue();
        service.UserId.Should().Be("oidc-user-456");
    }

    [Fact]
    public void UnauthenticatedRequest_ShouldReturnNullUserId()
    {
        var context = new DefaultHttpContext();

        var accessor = new HttpContextAccessor
        {
            HttpContext = context
        };

        var service = new HttpCurrentUserService(accessor);

        service.IsAuthenticated.Should().BeFalse();
        service.UserId.Should().BeNull();
    }

    [Fact]
    public void NoHttpContext_ShouldReturnNullUserId()
    {
        var service = new HttpCurrentUserService(
            new HttpContextAccessor());

        service.IsAuthenticated.Should().BeFalse();
        service.UserId.Should().BeNull();
    }

    [Fact]
    public void AuthenticatedUser_WithoutIdentifier_ShouldReturnNullUserId()
    {
        var service = CreateService(
            new Claim(ClaimTypes.Name, "Test User"));

        service.IsAuthenticated.Should().BeTrue();
        service.UserId.Should().BeNull();
    }

    [Fact]
    public void AuthenticatedUser_WithEmptyIdentifier_ShouldReturnNullUserId()
    {
        var service = CreateService(
            new Claim(ClaimTypes.NameIdentifier, " "));

        service.IsAuthenticated.Should().BeTrue();
        service.UserId.Should().BeNull();
    }

    private static HttpCurrentUserService CreateService(
        params Claim[] claims)
    {
        var identity = new ClaimsIdentity(
            claims,
            authenticationType: "TestScheme");

        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity)
        };

        var accessor = new HttpContextAccessor
        {
            HttpContext = context
        };

        return new HttpCurrentUserService(accessor);
    }
}
