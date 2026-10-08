using FluentValidation;
using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Application.Appointments
{
    public class CreateAppointmentRequestValidator : AbstractValidator<CreateAppointmentRequest>
    {
        public CreateAppointmentRequestValidator()
        {
            RuleFor(x => x.PatientId)
                .NotEmpty();

            RuleFor(x => x.DoctorId)
                .NotEmpty();

            RuleFor(x => x.StartTime)
                .LessThan(x => x.EndTime)
                .WithMessage("Start time must be earlier than end time");

            RuleFor(x => x.Notes)
                .MaximumLength(1000);
        }
    }
}
