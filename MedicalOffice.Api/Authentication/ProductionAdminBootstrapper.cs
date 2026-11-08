
using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace MedicalOffice.Api.Authentication;

public static class ProductionAdminBootstrapper
{
    public static async Task SeedAsync(
        IServiceProvider services,
        IConfiguration configuration)
    {
        var userManager =
            services.GetRequiredService<UserManager<ApplicationUser>>();

        var roleManager =
            services.GetRequiredService<RoleManager<IdentityRole>>();

        var username = configuration["ProductionAdmin:Username"];
        var email = configuration["ProductionAdmin:Email"];
        var password = configuration["ProductionAdmin:Password"];

        if (string.IsNullOrWhiteSpace(username) ||
            string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Production administrator bootstrap configuration is incomplete.");
        }

        // Never modify or promote an existing account through bootstrap.
        if (await userManager.FindByNameAsync(username) is not null ||
            (!string.IsNullOrWhiteSpace(email) &&
             await userManager.FindByEmailAsync(email) is not null))
        {
            throw new InvalidOperationException(
                "Production administrator account already exists. " +
                "Disable bootstrap provisioning.");
        }

        const string roleName = "Admin";

        if (!await roleManager.RoleExistsAsync(roleName))
        {
            var roleResult = await roleManager.CreateAsync(
                new IdentityRole(roleName));

            EnsureSucceeded(roleResult, "Create administrator role");
        }

        var user = new ApplicationUser
        {
            UserName = username,
            Email = string.IsNullOrWhiteSpace(email) ? null : email,
            EmailConfirmed = !string.IsNullOrWhiteSpace(email)
        };

        var createResult = await userManager.CreateAsync(
            user, password);

        EnsureSucceeded(createResult, "Create administrator");

        var addRoleResult = await userManager.AddToRoleAsync(
            user, roleName);

        EnsureSucceeded(addRoleResult, "Assign administrator role");
    }

    private static void EnsureSucceeded(
        IdentityResult result,
        string operation)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"{operation} failed: " +
                string.Join("; ",
                    result.Errors.Select(error => error.Code)));
        }
    }
}
