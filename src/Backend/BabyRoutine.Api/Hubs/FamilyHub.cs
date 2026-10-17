using Microsoft.AspNetCore.SignalR;

namespace BabyRoutine.Api.Hubs;

public class FamilyHub : Hub
{
    public async Task JoinFamilyGroup(string familyId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"family_{familyId}");
    }

    public async Task LeaveFamilyGroup(string familyId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"family_{familyId}");
    }
}
