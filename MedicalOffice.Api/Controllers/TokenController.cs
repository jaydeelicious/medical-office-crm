using System.Security.Claims;
using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace MedicalOffice.Api.Controllers
{
    public class TokenController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;

        public TokenController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager)
        {
            _userManager = userManager;
            _signInManager = signInManager;
        }

        [HttpPost("~/connect/token")]
        [IgnoreAntiforgeryToken]
        [Produces("application/json")]
        public async Task<IActionResult> Exchange()
        {
            var request = HttpContext.GetOpenIddictServerRequest()
                ?? throw new InvalidOperationException(
                    "The OpenID Connect request cannot be retrieved.");

            if (!request.IsAuthorizationCodeGrantType() &&
                !request.IsRefreshTokenGrantType())
            {
                return BadRequest();
            }

            // OpenIddict has already validated the grant and PKCE
            // requirements before passing this request to MVC
            var result = await HttpContext.AuthenticateAsync(
                OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);

            if (!result.Succeeded || result.Principal is null)
            {
                return InvalidGrant();
            }

            var subject = result.Principal.GetClaim(Claims.Subject);

            if (string.IsNullOrEmpty(subject))
            {
                return InvalidGrant();
            }

            // Revalidate the user against the current Identity database.
            var user = await _userManager.FindByIdAsync(subject);

            if (user is null ||
                await _userManager.IsLockedOutAsync(user) ||
                !await _signInManager.CanSignInAsync(user))
            {
                return InvalidGrant();
            }

            // Preserve grant-bound claims and scopes, but refresh
            // mutable user information from the database.
            var identity = new ClaimsIdentity(
                result.Principal.Claims,
                authenticationType:
                    TokenValidationParameters.DefaultAuthenticationType,
                nameType: Claims.Name,
                roleType: Claims.Role);

            identity.SetClaim(
                Claims.Subject,
                await _userManager.GetUserIdAsync(user));

            identity.SetClaim(
                Claims.Name,
                await _userManager.GetUserNameAsync(user));

            identity.SetClaim(
                Claims.Email,
                await _userManager.GetEmailAsync(user));

            // Apply explicit disclosure rules to the refreshed claims.
            identity.SetDestinations(claim => claim.Type switch
            {
                Claims.Name when identity.HasScope(Scopes.Profile)
                => [Destinations.AccessToken,
                    Destinations.IdentityToken],

                Claims.Email when identity.HasScope(Scopes.Email)
                    => [Destinations.AccessToken,
                    Destinations.IdentityToken],

                _ => []
            });

            // OpenIddict produces the appropriate tokens for the grant.
            return SignIn(
                new ClaimsPrincipal(identity),
                OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        private IActionResult InvalidGrant()
        {
            return Forbid(
                new AuthenticationProperties(
                    new Dictionary<string, string?>
                    {
                        [OpenIddictServerAspNetCoreConstants.Properties.Error] =
                            Errors.InvalidGrant,

                        [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                            "The authorization grant is no longer valid."
                    }),
                OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }
    }
}
