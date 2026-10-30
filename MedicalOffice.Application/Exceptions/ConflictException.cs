using System;
using System.Collections.Generic;
using System.Text;

namespace MedicalOffice.Application.Exceptions
{
    public class ConflictException : Exception
    {
        public string Code { get; }
        public ConflictException(
            string message,
            string code = ConflictCodes.AppointmentOverlap)
            : base(message)
        {
            Code = code;
        }
    }
}
