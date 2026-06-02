using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NurseGo.API.Data;
using NurseGo.API.Models;

namespace NurseGo.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Nurse")]
public class DocumentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public DocumentsController(AppDbContext db, IWebHostEnvironment env)
    { _db = db; _env = env; }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // POST /api/documents/upload
    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string docType)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "ფაილი ცარიელია" });

        var allowed = new[] { ".pdf", ".jpg", ".jpeg", ".png" };
        var ext = Path.GetExtension(file.FileName).ToLower();
        if (!allowed.Contains(ext))
            return BadRequest(new { message = "მხოლოდ PDF, JPG, PNG ფაილებია დაშვებული" });

        var nurse = await _db.Nurses.FirstOrDefaultAsync(n => n.UserId == UserId);
        if (nurse == null) return NotFound();

        // ფაილის შენახვა
        var uploads = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "docs");
        Directory.CreateDirectory(uploads);
        var fileName = $"nurse-{nurse.Id}-{docType}-{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploads, fileName);

        await using var stream = System.IO.File.Create(filePath);
        await file.CopyToAsync(stream);

        var doc = new NurseDocument
        {
            NurseId  = nurse.Id,
            FileName = file.FileName,
            FilePath = $"/uploads/docs/{fileName}",
            DocType  = docType,
        };
        _db.NurseDocuments.Add(doc);
        await _db.SaveChangesAsync();

        return Ok(new { doc.Id, doc.FilePath, doc.DocType });
    }

    // GET /api/documents/my
    [HttpGet("my")]
    public async Task<IActionResult> GetMy()
    {
        var nurse = await _db.Nurses.FirstOrDefaultAsync(n => n.UserId == UserId);
        if (nurse == null) return NotFound();
        var docs = await _db.NurseDocuments.Where(d => d.NurseId == nurse.Id).ToListAsync();
        return Ok(docs);
    }
}
