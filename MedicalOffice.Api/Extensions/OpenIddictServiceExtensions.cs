using OpenIddict.Abstractions;
using System.Security.Cryptography.X509Certificates;

namespace MedicalOffice.Api.Extensions
{
    public static class OpenIddictServiceExtensions
    {
        public static IServiceCollection AddOpenIddictServer(
            this IServiceCollection services,
            IWebHostEnvironment environment,
            IConfiguration configuration)
        {
            services.AddOpenIddict()
                .AddServer(options =>
                {
                    // OAuth 2.0 / OpenID Connect endpoints
                    options.SetAuthorizationEndpointUris("/connect/authorize");
                    options.SetTokenEndpointUris("/connect/token");

                    // Authorization Code + PKCE
                    options.AllowAuthorizationCodeFlow();
                    options.RequireProofKeyForCodeExchange();

                    // Allow clients to request refresh tokens
                    options.AllowRefreshTokenFlow();

                    // Supported scopes
                    options.RegisterScopes(
                        OpenIddictConstants.Scopes.OpenId,
                        OpenIddictConstants.Scopes.Profile,
                        OpenIddictConstants.Scopes.Email,
                        OpenIddictConstants.Scopes.OfflineAccess);

                    // Token lifetimes
                    options.SetAccessTokenLifetime(TimeSpan.FromMinutes(15));
                    options.SetAuthorizationCodeLifetime(TimeSpan.FromMinutes(5));
                    options.SetRefreshTokenLifetime(TimeSpan.FromDays(7));

                    // Signing and encryption credentials
                    if (environment.IsDevelopment())
                    {
                        options.AddDevelopmentEncryptionCertificate();
                        options.AddDevelopmentSigningCertificate();
                    }
                    else
                    {
                        var signingCertificate = LoadCertificate(
                            configuration,
                            "Signing");

                        var encryptionCertificate = LoadCertificate(
                            configuration,
                            "Encryption");

                        if (signingCertificate.Thumbprint == 
                            encryptionCertificate.Thumbprint)
                        {
                            throw new InvalidOperationException(
                                "Signing and encryption certificates must be different.");
                        }

                        options.AddSigningCertificate(signingCertificate);
                        options.AddEncryptionCertificate(encryptionCertificate);
                    }

                    // ASP.NET Core integration
                    options.UseAspNetCore()
                        .EnableAuthorizationEndpointPassthrough()
                        .EnableTokenEndpointPassthrough();
                })
                .AddValidation(options =>
                {
                    // Import credentials from the local OpenIddict server.
                    options.UseLocalServer();

                    // Integrate validation into ASP.NET Core
                    options.UseAspNetCore();
                });

            return services;
        }

        private static X509Certificate2 LoadCertificate(
            IConfiguration configuration,
            string certificateType)
        {
            var section = configuration.GetSection(
                $"OpenIddict:Certificates:{certificateType}");

            var path = section["Path"];
            var password = section["Password"];

            if (string.IsNullOrWhiteSpace(path) || 
                string.IsNullOrEmpty(password))
            {
                throw new InvalidOperationException(
                    $"OpenIddict {certificateType} certificate " +
                    "configuration is missing.");
            }

            if (!File.Exists(path))
            {
                throw new InvalidOperationException(
                    $"OpenIddict {certificateType} certificate " +
                    "file was not found.");
            }

            var certificate = X509CertificateLoader.LoadPkcs12FromFile(
                path,
                password,
                X509KeyStorageFlags.EphemeralKeySet);

            var now = DateTime.UtcNow;

            if (!certificate.HasPrivateKey ||
                now < certificate.NotBefore.ToUniversalTime() ||
                now >= certificate.NotAfter.ToUniversalTime())
            {
                certificate.Dispose();

                throw new InvalidOperationException(
                    $"OpenIddict {certificateType} certificate " +
                    "is invalid, expired, or missing its private key.");
            }

            return certificate;
        }
    }
}
