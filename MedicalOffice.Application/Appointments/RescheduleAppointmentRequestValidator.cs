using FluentValidation;
using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Application.Appointments
{
    public class RescheduleAppointmentRequestValidator : AbstractValidator<RescheduleAppointmentRequest>
    {
        public RescheduleAppointmentRequestValidator()
        {
            RuleFor(x => x.StartTime)
                .LessThan(x => x.EndTime)
                .WithMessage("Start time must be earlier than end time");
        }
    }
}
