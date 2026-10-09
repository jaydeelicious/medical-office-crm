using MedicalOffice.Application.Appointments;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace MedicalOffice.Api.Controllers
{
    [ApiController]
    [Route("api/appointments")]
    [Authorize(Policy = "ApiBearer")]
    public class AppointmentsController : ControllerBase
    {
        private readonly AppointmentService _appointmentService;

        public AppointmentsController(AppointmentService appointmentService)
        {
            _appointmentService = appointmentService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<AppointmentDto>>> GetAll(
            [FromQuery] Guid? doctorId,
            [FromQuery] DateOnly? date,
            CancellationToken cancellationToken)
        {
            var appointments =
                await _appointmentService.GetAllAsync(
                    doctorId,
                    date,
                    cancellationToken);

            return Ok(appointments);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<AppointmentDto>> GetById(
            Guid id,
            CancellationToken cancellationToken)
        {
            var appointment =
                await _appointmentService.GetByIdAsync(
                    id,
                    cancellationToken);

            if (appointment is null)
            {
                return NotFound();
            }

            return Ok(appointment);
        }

        [HttpPost]
        public async Task<ActionResult<AppointmentDto>> Create(
            CreateAppointmentRequest request,
            CancellationToken cancellationToken)
        {
            var appointment =
                await _appointmentService.CreateAsync(
                    request,
                    cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = appointment.Id },
                appointment);
        }

        [HttpPut("{id:guid}/reschedule")]
        public async Task<IActionResult> Reschedule(
            Guid id,
            RescheduleAppointmentRequest request,
            CancellationToken cancellationToken)
        {
            var updated =
                await _appointmentService.RescheduleAsync(
                    id,
                    request,
                    cancellationToken);

            if (!updated)
            {
                return NotFound();
            }

            return NoContent();
        }

        [HttpPatch("{id:guid}/status")]
        public async Task<IActionResult> UpdateStatus(
            Guid id,
            UpdateAppointmentStatusRequest request,
            CancellationToken cancellationToken)
        {
            var updated =
                await _appointmentService.UpdateStatusAsync(
                    id,
                    request,
                    cancellationToken);

            if (!updated)
            {
                return NotFound();
            }

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(
            Guid id,
            CancellationToken cancellationToken)
        {
            var deleted =
                await _appointmentService.DeleteAsync(
                    id,
                    cancellationToken);

            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
    }
}
