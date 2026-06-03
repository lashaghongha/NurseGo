using Microsoft.EntityFrameworkCore;
using NurseGo.API.Models;

namespace NurseGo.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Nurse> Nurses => Set<Nurse>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<NurseDocument> NurseDocuments => Set<NurseDocument>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Service>().HasData(
            new Service { Id = 1, Name = "კუნთში ინექცია", Icon = "💉", Price = 20, Category = "ინექცია", DurationEstimate = "30 წთ" },
            new Service { Id = 2, Name = "ვენაში ინექცია", Icon = "🩸", Price = 25, Category = "ინექცია", DurationEstimate = "30 წთ" },
            new Service { Id = 3, Name = "გადასხმა (IV)", Icon = "🧴", Price = 40, Category = "გადასხმა", DurationEstimate = "2 სთ" },
            new Service { Id = 4, Name = "კათეტერის შეცვლა", Icon = "🔧", Price = 50, Category = "მოვლა", DurationEstimate = "45 წთ" },
            new Service { Id = 5, Name = "ჭრილობის დამუშავება", Icon = "🩹", Price = 35, Category = "მოვლა", DurationEstimate = "45 წთ" },
            new Service { Id = 6, Name = "ნაკერის მოხსნა", Icon = "✂️", Price = 30, Category = "მოვლა", DurationEstimate = "30 წთ" },
            new Service { Id = 7, Name = "წნევის გაზომვა", Icon = "📏", Price = 15, Category = "გაზომვა", DurationEstimate = "15 წთ" },
            new Service { Id = 8, Name = "შაქრის გაზომვა", Icon = "🍬", Price = 15, Category = "გაზომვა", DurationEstimate = "15 წთ" },
            new Service { Id = 9, Name = "მოხუცის მოვლა (1 სთ)", Icon = "👴", Price = 20, Category = "პატრონაჟი", DurationEstimate = "1 სთ" },
            new Service { Id = 10, Name = "მედიკამენტის ჩამოტანა", Icon = "💊", Price = 10, Category = "დამატებითი", DurationEstimate = "45 წთ" },
            new Service { Id = 11, Name = "ვიდეოკონსულტაცია", Icon = "🎥", Price = 25, Category = "დამატებითი", DurationEstimate = "20 წთ" },
            new Service { Id = 12, Name = "SOS გამოძახება", Icon = "🚨", Price = 60, Category = "სასწრაფო", DurationEstimate = "30 წთ" }
        );
    }
}
