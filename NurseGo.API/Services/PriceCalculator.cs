namespace NurseGo.API.Services;

public static class PriceCalculator
{
    private static readonly Dictionary<string, decimal> DistrictSurcharges = new()
    {
        { "ვაკე", 0 }, { "საბურთალო", 0 }, { "გლდანი", 10 },
        { "დიდუბე", 5 }, { "ნაძალადევი", 5 }, { "ისანი", 5 },
        { "სამგორი", 10 }, { "კრწანისი", 5 }, { "დიღომი", 10 }, { "ვარკეთილი", 15 },
    };

    public static decimal GetDistrictSurcharge(string district)
        => DistrictSurcharges.TryGetValue(district, out var s) ? s : 0;

    public static decimal GetNightSurcharge(decimal basePrice, bool isNight)
        => isNight ? Math.Round(basePrice * 0.2m) : 0;

    public static decimal GetPlatformCommission(decimal total)
        => Math.Round(total * 0.2m);
}
