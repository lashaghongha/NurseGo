using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Models;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ServicesController(AppDbContext db) => _db = db;

    // GET /api/services — public (active only)
    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.Services.Where(s => s.IsActive).OrderBy(s => s.Category).ThenBy(s => s.Id).ToListAsync());

    // GET /api/services/all — admin (includes inactive)
    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllForAdmin()
        => Ok(await _db.Services.OrderBy(s => s.Category).ThenBy(s => s.Id).ToListAsync());

    // POST /api/services — create
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(ServiceUpsertRequest req)
    {
        var service = new Service
        {
            Name             = req.Name.Trim(),
            Icon             = req.Icon.Trim(),
            Price            = req.Price,
            Category         = req.Category.Trim(),
            DurationEstimate = req.DurationEstimate.Trim(),
            IsActive         = true,
        };
        _db.Services.Add(service);
        await _db.SaveChangesAsync();
        return Ok(service);
    }

    // PUT /api/services/{id} — full update
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, ServiceUpsertRequest req)
    {
        var service = await _db.Services.FindAsync(id);
        if (service == null) return NotFound();
        service.Name             = req.Name.Trim();
        service.Icon             = req.Icon.Trim();
        service.Price            = req.Price;
        service.Category         = req.Category.Trim();
        service.DurationEstimate = req.DurationEstimate.Trim();
        service.IsActive         = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(service);
    }

    // PUT /api/services/{id}/price — price-only shortcut (kept for backwards compat)
    [HttpPut("{id}/price")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdatePrice(int id, UpdateServicePriceRequest req)
    {
        var service = await _db.Services.FindAsync(id);
        if (service == null) return NotFound();
        service.Price = req.Price;
        await _db.SaveChangesAsync();
        return Ok(new { service.Id, service.Price });
    }

    // DELETE /api/services/{id} — soft delete (sets IsActive=false)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var service = await _db.Services.FindAsync(id);
        if (service == null) return NotFound();
        service.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "მომსახურება გამოირთო" });
    }

    // PUT /api/services/{id}/restore — restore soft-deleted service
    [HttpPut("{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Restore(int id)
    {
        var service = await _db.Services.FindAsync(id);
        if (service == null) return NotFound();
        service.IsActive = true;
        await _db.SaveChangesAsync();
        return Ok(service);
    }
}
