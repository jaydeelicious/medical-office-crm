using MedicalOffice.Api.Models.Account;
using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MedicalOffice.Api.Controllers
{
    [Route("account")]
    public class AccountController : Controller
    {
        private readonly SignInManager<ApplicationUser> _signInManager;

        public AccountController(
            SignInManager<ApplicationUser> signInManager)
        {
            _signInManager = signInManager;
        }

        [HttpGet("login")]
        [AllowAnonymous]
        public IActionResult Login(string? returnUrl = null)
        {
            //if (User.Identity?.IsAuthenticated == true)
            //{
            //    return RedirectToLocal(returnUrl);
            //}

            //return View(new LoginViewModel
            //{
            //    ReturnUrl = returnUrl
            //});

            return View(new LoginViewModel
            {
                ReturnUrl = returnUrl
            });
        }

        [HttpPost("login")]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(
            LoginViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var result = await _signInManager.PasswordSignInAsync(
                model.UserName,
                model.Password,
                isPersistent: false,
                lockoutOnFailure: true);

            if (result.Succeeded)
            {
                return RedirectToLocal(model.ReturnUrl);
            }

            if (result.IsLockedOut)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "Unable to sign in. Please try again later.");
            }
            else if (result.RequiresTwoFactor)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "Additional authentication is required.");
            }
            else
            {
                ModelState.AddModelError(
                    string.Empty,
                    "Invalid username or password.");
            }

            return View(model);
        }

        [HttpPost("logout")]
        [Authorize(Policy = "IdentityCookie")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();

            return RedirectToAction(nameof(Login));
        }

        private IActionResult RedirectToLocal(string? returnUrl)
        {
            if (!string.IsNullOrEmpty(returnUrl) &&
                Url.IsLocalUrl(returnUrl))
            {
                return LocalRedirect(returnUrl);
            }

            //return Redirect("/");
            return RedirectToAction(nameof(Login));
        }
    }
}
