
using MedicalOffice.Api.Authentication;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace MedicalOffice.Tests.Integration.Authentication;

public class OpenIddictClientRegistrationTests
{
    private const string ClientId = "medicaloffice-angular";

    private const string RedirectUri =
        "http://localhost:4200/auth/callback";

    private const string PostLogoutRedirectUri =
        "http://localhost:4200/";

    [Fact]
    public async Task SeedAsync_RegistersAngularClient()
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await CreateSeeder(scope).SeedAsync();

        var application = await manager.FindByClientIdAsync(ClientId);

        Assert.NotNull(application);

        Assert.Equal(
            "Medical Office Angular",
            await manager.GetDisplayNameAsync(application));
    }

    [Fact]
    public async Task SeedAsync_RegistersPublicClientWithoutSecret()
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await CreateSeeder(scope).SeedAsync();

        var application = await GetAngularClientAsync(manager);

        Assert.Equal(
            ClientTypes.Public,
            await manager.GetClientTypeAsync(application));

        var descriptor = new OpenIddictApplicationDescriptor();

        await manager.PopulateAsync(descriptor, application);

        Assert.Null(descriptor.ClientSecret);
    }

    [Fact]
    public async Task SeedAsync_RegistersExpectedRedirectUris()
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await CreateSeeder(scope).SeedAsync();

        var application = await GetAngularClientAsync(manager);

        var redirectUris =
            await manager.GetRedirectUrisAsync(application);

        var logoutUris =
            await manager.GetPostLogoutRedirectUrisAsync(application);

        Assert.Equal(
            new[] { RedirectUri },
            redirectUris);

        Assert.Equal(
            new[] { PostLogoutRedirectUri },
            logoutUris);

        Assert.DoesNotContain(
            "https://evil.example/callback",
            redirectUris);
    }

    [Fact]
    public async Task SeedAsync_RegistersExpectedPermissions()
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await CreateSeeder(scope).SeedAsync();

        var application = await GetAngularClientAsync(manager);

        var permissions =
            await manager.GetPermissionsAsync(application);

        var expected = new[]
        {
            Permissions.Endpoints.Authorization,
            Permissions.Endpoints.Token,
            Permissions.GrantTypes.AuthorizationCode,
            Permissions.GrantTypes.RefreshToken,
            Permissions.ResponseTypes.Code,
            Permissions.Scopes.Profile,
            Permissions.Scopes.Email
        };

        Assert.Equal(
            expected.OrderBy(p => p),
            permissions.OrderBy(p => p));

        Assert.DoesNotContain(
            Permissions.GrantTypes.ClientCredentials,
            permissions);
    }

    [Fact]
    public async Task SeedAsync_RequiresPkce()
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await CreateSeeder(scope).SeedAsync();

        var application = await GetAngularClientAsync(manager);

        var requirements =
            await manager.GetRequirementsAsync(application);

        Assert.Contains(
            Requirements.Features.ProofKeyForCodeExchange,
            requirements);
    }

    [Fact]
    public async Task SeedAsync_WhenCalledTwice_DoesNotDuplicateClient()
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        var seeder = CreateSeeder(scope);

        await seeder.SeedAsync();

        var firstApplication =
            await GetAngularClientAsync(manager);

        var firstId =
            await manager.GetIdAsync(firstApplication);

        await seeder.SeedAsync();

        var secondApplication =
            await GetAngularClientAsync(manager);

        var secondId =
            await manager.GetIdAsync(secondApplication);

        Assert.Equal(firstId, secondId);
    }

    [Fact]
    public async Task SeedAsync_WhenConfigurationChanges_UpdatesClient()
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await CreateSeeder(scope).SeedAsync();

        const string newRedirect =
            "http://localhost:4300/auth/callback";

        const string newLogout =
            "http://localhost:4300/";

        await CreateSeeder(
            scope,
            newRedirect,
            newLogout).SeedAsync();

        var application = await GetAngularClientAsync(manager);

        var redirects =
            await manager.GetRedirectUrisAsync(application);

        var logoutRedirects =
            await manager.GetPostLogoutRedirectUrisAsync(application);

        Assert.Equal(new[] { newRedirect }, redirects);
        Assert.Equal(new[] { newLogout }, logoutRedirects);

        Assert.DoesNotContain(RedirectUri, redirects);
    }

    [Theory]
    [InlineData("", PostLogoutRedirectUri)]
    [InlineData("not-a-uri", PostLogoutRedirectUri)]
    [InlineData(RedirectUri, "invalid-uri")]
    public async Task SeedAsync_WithInvalidConfiguration_Throws(
        string redirectUri,
        string logoutUri)
    {
        using var factory = new CustomWebApplicationFactory();
        using var scope = await CreateInitializedScopeAsync(factory);

        var seeder = CreateSeeder(
            scope,
            redirectUri,
            logoutUri);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => seeder.SeedAsync());
    }

    private static OpenIddictClientSeeder CreateSeeder(
        IServiceScope scope,
        string redirectUri = RedirectUri,
        string logoutUri = PostLogoutRedirectUri)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["OpenIddict:Clients:Angular:RedirectUri"] =
                        redirectUri,

                    ["OpenIddict:Clients:Angular:PostLogoutRedirectUri"] =
                        logoutUri
                })
            .Build();

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        return new OpenIddictClientSeeder(
            manager, configuration);
    }

    private static async Task<object> GetAngularClientAsync(
        IOpenIddictApplicationManager manager)
    {
        var application =
            await manager.FindByClientIdAsync(ClientId);

        Assert.NotNull(application);

        return application;
    }

    private static async Task<IServiceScope>
        CreateInitializedScopeAsync(
            CustomWebApplicationFactory factory)
    {
        // Force initialization of the test host.
        using var client = factory.CreateClient();

        var scope = factory.Services.CreateScope();

        try
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await db.Database.EnsureCreatedAsync();

            return scope;
        }
        catch
        {
            scope.Dispose();
            throw;
        }
    }
}
