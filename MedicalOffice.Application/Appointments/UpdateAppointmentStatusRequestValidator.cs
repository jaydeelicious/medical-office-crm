using FluentValidation;
using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Application.Appointments
{
    public class UpdateAppointmentStatusRequestValidator : AbstractValidator<UpdateAppointmentStatusRequest>
    {
        public UpdateAppointmentStatusRequestValidator()
        {
            RuleFor(x => x.Status)
                .IsInEnum();
        }
    }
}
