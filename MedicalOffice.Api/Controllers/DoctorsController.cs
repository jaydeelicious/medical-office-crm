using MedicalOffice.Application.Doctors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace MedicalOffice.Api.Controllers
{
    [ApiController]
    [Route("api/doctors")]
    [Authorize(Policy = "ApiBearer")]
    public class DoctorsController : ControllerBase
    {
        private readonly DoctorService _doctorService;

        public DoctorsController(DoctorService doctorService)
        {
            _doctorService = doctorService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<DoctorDto>>> GetAll(
            CancellationToken cancellationToken)
        {
            var doctors = await _doctorService.GetAllAsync(cancellationToken);

            return Ok(doctors);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<DoctorDto>> GetById(
            Guid id,
            CancellationToken cancellationToken)
        {
            var doctor = await _doctorService.GetByIdAsync(
                id,
                cancellationToken);

            if (doctor is null)
            {
                return NotFound();
            }

            return Ok(doctor);
        }

        [HttpPost]
        public async Task<ActionResult<DoctorDto>> Create(
            CreateDoctorRequest request,
            CancellationToken cancellationToken)
        {
            var doctor = await _doctorService.CreateAsync(
                request,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = doctor.Id },
                doctor);
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(
            Guid id,
            UpdateDoctorRequest request,
            CancellationToken cancellationToken)
        {
            var updated = await _doctorService.UpdateAsync(
                id,
                request,
                cancellationToken);

            return updated
                ? NoContent()
                : NotFound();
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(
            Guid id,
            CancellationToken cancellationToken)
        {
            var deleted = await _doctorService.DeleteAsync(
                id,
                cancellationToken);

            return deleted
                ? NoContent()
                : NotFound();
        }
    }
}
