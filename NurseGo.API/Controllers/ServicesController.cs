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

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.Services.Where(s => s.IsActive).ToListAsync());

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
}
