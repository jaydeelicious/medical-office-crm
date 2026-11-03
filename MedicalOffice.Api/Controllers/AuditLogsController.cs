using MedicalOffice.Application.AuditLogs;
using MedicalOffice.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedicalOffice.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Policy = "AuditRead")]
public sealed class AuditLogsController : ControllerBase
{
    private readonly AuditLogService _auditLogService;

    public AuditLogsController(AuditLogService auditLogService)
    {
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> GetPaged(
        [FromQuery] AuditLogQuery query,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _auditLogService.GetPagedAsync(
                query,
                cancellationToken);

            return Ok(result);
        }
        catch (ArgumentException)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid audit history query",
                Detail = "One or more audit query parameters are invalid."
            });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AuditLogDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid audit log ID"
            });
        }

        var auditLog = await _auditLogService.GetByIdAsync(
            id,
            cancellationToken);

        return auditLog is null
            ? NotFound()
            : Ok(auditLog);
    }
}
