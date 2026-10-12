using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace MedicalOffice.Api.Authentication;

public static class DevelopmentUserSeeder
{
    public static async Task SeedAsync(
        IServiceProvider services,
        IConfiguration configuration)
    {
        var userManager =
            services.GetRequiredService<UserManager<ApplicationUser>>();

        const string userName = "devadmin";

        if (await userManager.FindByNameAsync(userName) is not null)
        {
            return;
        }

        var password = configuration["DevelopmentTestUser:Password"];

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Development test user password is not configured.");
        }

        var user = new ApplicationUser
        {
            UserName = userName,
            Email = "devadmin@example.test",
            EmailConfirmed = true,
        };

        var result = await userManager.CreateAsync(user, password);

        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                string.Join("; ",
                    result.Errors.Select(error => error.Description)));
        }
    }
}