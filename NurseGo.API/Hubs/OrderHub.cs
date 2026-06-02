using Microsoft.AspNetCore.SignalR;

namespace NurseGo.API.Hubs;

public class OrderHub : Hub
{
    // კლიენტი უერთდება თავის Order room-ს
    public async Task JoinOrder(string orderId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");

    // ექთანი უერთდება თავის nurse room-ს
    public async Task JoinNurse(string nurseId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"nurse-{nurseId}");

    public override Task OnConnectedAsync() => base.OnConnectedAsync();
}
