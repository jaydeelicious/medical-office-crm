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
            var result = await HttpContext.AuthenticateAsync(
                IdentityConstants.ApplicationScheme);

            if (!result.Succeeded || result.Principal is null)
            {
                // Silent authorization must not trigger interactive login.
                if (request.HasPromptValue(PromptValues.None))
                {
                    return Forbid(
                        OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
                }

                // Preserve the authorization request across login.
                var returnUrl =
                    Request.PathBase + Request.Path + Request.QueryString;

                return RedirectToAction(
                    "Login",
                    "Account",
                    new { returnUrl = returnUrl.ToString() });
            }

            // Retrieve the current user from Identity.
            var user = await _userManager.GetUserAsync(
                result.Principal);

            if (user is null ||
                !await _userManager.IsLockedOutAsync(user) &&
                !await _userManager.IsEmailConfirmedAsync(user) &&
                _userManager.Options.SignIn.RequireConfirmedEmail)
            {
                return Forbid(
                    OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            }

            if (await _userManager.IsLockedOutAsync(user) ||
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
