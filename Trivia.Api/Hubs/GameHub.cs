using Microsoft.AspNetCore.SignalR;
using Trivia.Api.Services;

namespace Trivia.Api.Hubs;

// Clients receive a single "state" event (GameState) whenever the game changes.
public class GameHub(GameManager games) : Hub
{
    public Task<bool> HostConnect(string code, string hostToken) =>
        games.HostConnect(code, hostToken, Context.ConnectionId);

    public Task<bool> HostNext(string code, string hostToken) =>
        games.HostNext(code, hostToken);

    public Task<JoinResult> Join(string code, string name) =>
        games.Join(code, name, Context.ConnectionId);

    public Task<bool> Rejoin(string code, string playerId) =>
        games.Rejoin(code, playerId, Context.ConnectionId);

    public Task SubmitAnswer(string code, string playerId, int choice) =>
        games.SubmitAnswer(code, playerId, choice);
}
