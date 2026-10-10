using System.Security.Claims;
using System.Globalization;
using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace MedicalOffice.Api.Controllers
{
    public class AuthorizationController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;

        public AuthorizationController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager)
        {
            _userManager = userManager;
            _signInManager = signInManager;
        }

        [HttpGet("~/connect/authorize")]
        public async Task<IActionResult> Authorize(
            CancellationToken cancellationToken)
        {
            var request = HttpContext.GetOpenIddictServerRequest()
                ?? throw new InvalidOperationException(
                    "The OpenID Connect request cannot be retrieved.");

            // Authenticate using the Identity browser cookie.
            const string freshLoginKey = "FreshLoginRequested";

            var result = await HttpContext.AuthenticateAsync(
                IdentityConstants.ApplicationScheme);

            var authenticated =
                result.Succeeded && result.Principal is not null;

            var issuedUtc = result.Properties?.IssuedUtc;

            // TempData survives the login redirect and is integrity-protected.
            var reauthenticationCompleted =
                TempData.Peek(freshLoginKey) is true;

            var requiresFreshLogin =
                request.HasPromptValue(PromptValues.Login) ||
                request.MaxAge is 0;

            var sessionTooOld =
                request.MaxAge is > 0 &&
                (issuedUtc is null ||
                 DateTimeOffset.UtcNow - issuedUtc.Value >
                 TimeSpan.FromSeconds(request.MaxAge.Value));

            var mustReauthenticate =
                (requiresFreshLogin || sessionTooOld) &&
                !reauthenticationCompleted;

            if (!authenticated || mustReauthenticate)
            {
                if (request.HasPromptValue(PromptValues.None))
                {
                    return Forbid(
                        new AuthenticationProperties(
                            new Dictionary<string, string?>
                            {
                                [OpenIddictServerAspNetCoreConstants
                                    .Properties.Error] = Errors.LoginRequired,

                                [OpenIddictServerAspNetCoreConstants
                                    .Properties.ErrorDescription] =
                                    "User authentication is required."
                            }),
                        OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
                }

                // An existing cookie must not satisfy a fresh-login request.
                if (authenticated && mustReauthenticate)
                {
                    await HttpContext.SignOutAsync(
                        IdentityConstants.ApplicationScheme);

                    TempData[freshLoginKey] = true;
                }

                // Preserve the original OAuth/OIDC request.
                var returnUrl =
                    Request.PathBase + Request.Path + Request.QueryString;

                return RedirectToAction(
                    "Login",
                    "Account",
                    new { returnUrl = returnUrl.ToString() });
            }

            if (result.Principal is null)
            {
                throw new InvalidOperationException(
                    "The authenticated user principal is missing.");
            }

            // Consume the one-time marker after successful reauthentication.
            if (reauthenticationCompleted)
            {
                TempData.Remove(freshLoginKey);
            }

            // Retrieve the current user from Identity.
            var user = await _userManager.GetUserAsync(
                result.Principal);

            if (user is null ||
                await _userManager.IsLockedOutAsync(user) ||
                !await _signInManager.CanSignInAsync(user))
            {
                return Forbid(
                    OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            }

            // Construct the identity used to issue OAuth/OIDC tokens.
            var identity = new ClaimsIdentity(
                authenticationType:
                    TokenValidationParameters.DefaultAuthenticationType,
                nameType: Claims.Name,
                roleType: Claims.Role);

            if (issuedUtc is not null)
            {
                identity.AddClaim(new Claim(
                    Claims.AuthenticationTime,
                    issuedUtc.Value.ToUnixTimeSeconds()
                        .ToString(CultureInfo.InvariantCulture),
                    ClaimValueTypes.Integer64));
            }

            identity.SetClaim(
                Claims.Subject,
                await _userManager.GetUserIdAsync(user));

            identity.SetClaim(
                Claims.Name,
                await _userManager.GetUserNameAsync(user));

            identity.SetClaim(
                Claims.Email,
                await _userManager.GetEmailAsync(user));

            // Retain only the scopes validated by OpenIddict.
            identity.SetScopes(request.GetScopes());

            // Explicitly select the tokens that may expose each claim.
            identity.SetDestinations(claim => claim.Type switch
            {
                Claims.AuthenticationTime
                    => [Destinations.IdentityToken],

                Claims.Name when identity.HasScope(Scopes.Profile)
                    => [Destinations.AccessToken,
                        Destinations.IdentityToken],

                Claims.Email when identity.HasScope(Scopes.Email)
                    => [Destinations.AccessToken,
                        Destinations.IdentityToken],

                _ => []
            });

            var principal = new ClaimsPrincipal(identity);

            // OpenIddict processes this principal and generates the code
            return SignIn(
                principal,
                OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }
    }
}
