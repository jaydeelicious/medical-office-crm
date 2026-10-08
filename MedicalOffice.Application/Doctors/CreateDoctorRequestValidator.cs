using FluentValidation;

namespace MedicalOffice.Application.Doctors
{
    public class CreateDoctorRequestValidator : AbstractValidator<CreateDoctorRequest>
    {
        public CreateDoctorRequestValidator()
        {
            RuleFor(x => x.FirstName)
                .NotEmpty()
                .MaximumLength(100);

            RuleFor(x => x.LastName)
                .NotEmpty()
                .MaximumLength(100);

            RuleFor(x => x.Phone)
                .MaximumLength(30);

            RuleFor(x => x.Email)
                .EmailAddress()
                .MaximumLength(200)
                .When(x => !string.IsNullOrWhiteSpace(x.Email));

            RuleFor(x => x.Specialty)
                .NotEmpty()
                .MaximumLength(150);
        }
    }
}
