using OpenIddict.Abstractions;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace MedicalOffice.Api.Authentication
{
    public sealed class OpenIddictClientSeeder(
        IOpenIddictApplicationManager applicationManager,
        IConfiguration configuration)
    {
        private const string ClientId = "medicaloffice-angular";

        public async Task SeedAsync(
            CancellationToken cancellationToken = default)
        {
            var redirectUri = configuration[
                "OpenIddict:Clients:Angular:RedirectUri"];

            var postLogoutRedirectUri = configuration[
                "OpenIddict:Clients:Angular:PostLogoutRedirectUri"];

            if (!Uri.TryCreate(
                    redirectUri, UriKind.Absolute, out var callback) || 
                !Uri.TryCreate(
                    postLogoutRedirectUri, UriKind.Absolute, out var logout))
            {
                throw new InvalidOperationException(
                    "Angular client redirect URIs must be configured.");
            }

            var descriptor = new OpenIddictApplicationDescriptor
            {
                ClientId = ClientId,
                DisplayName = "Medical Office Angular",
                ClientType = ClientTypes.Public,
                ConsentType = ConsentTypes.Implicit,

                RedirectUris = { callback },
                PostLogoutRedirectUris = { logout },

                Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Token,

                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,

                    Permissions.ResponseTypes.Code,

                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Email
                },

                Requirements =
                {
                    Requirements.Features.ProofKeyForCodeExchange
                }
            };

            var application =
                await applicationManager.FindByClientIdAsync(
                    ClientId, cancellationToken);

            if (application is null)
            {
                await applicationManager.CreateAsync(
                    descriptor, cancellationToken);
            }
            else
            {
                await applicationManager.UpdateAsync(
                    application, descriptor, cancellationToken);
            }
        }
    }
}
