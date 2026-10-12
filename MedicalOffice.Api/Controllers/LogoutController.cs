using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Server.AspNetCore;

namespace MedicalOffice.Api.Controllers;

public class LogoutController : Controller
{
    private readonly SignInManager<ApplicationUser> _signInManager;

    public LogoutController(
        SignInManager<ApplicationUser> signInManager)
    {
        _signInManager = signInManager;
    }

    [HttpGet("~/connect/logout")]
    public IActionResult Logout()
    {
        return View();
    }

    [HttpPost("~/connect/logout")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> LogoutPost()
    {
        await _signInManager.SignOutAsync();

        return SignOut(
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }
}