using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Trivia.Api.Hubs;
using Trivia.Api.Models;

namespace Trivia.Api.Services;

public static class Phases
{
    public const string Lobby = "lobby";
    public const string Question = "question";
    public const string Reveal = "reveal";
    public const string Leaderboard = "leaderboard";
    public const string Finished = "finished";
}

public class Player
{
    public string Id { get; init; } = Guid.NewGuid().ToString("N");
    public string Name { get; init; } = "";
    public int JoinOrder { get; init; }
    public string? Connection { get; set; }
    public int Score { get; set; }
    public int Streak { get; set; }
    public int PrevRank { get; set; }
    public int Choice { get; set; } = -1;
    public double AnswerMs { get; set; }
    public bool LastCorrect { get; set; }
    public int LastPoints { get; set; }
}

public class Game
{
    public required string Code { get; init; }
    public required string HostToken { get; init; }
    public required Quiz Quiz { get; init; }
    public string Phase { get; set; } = Phases.Lobby;
    public string? HostConnection { get; set; }
    public Dictionary<string, Player> Players { get; } = new();
    public int Index { get; set; } = -1;
    public DateTime QuestionStart { get; set; }
    public DateTime QuestionEnd { get; set; }
    public int[] OptionCounts { get; set; } = [];
    public CancellationTokenSource? Timer { get; set; }
    public DateTime LastActivity { get; set; } = DateTime.UtcNow;
    public int NextJoinOrder { get; set; }
    public object Lock { get; } = new();
}

public record PlayerInfo(string Id, string Name);
public record QuestionView(string Text, string MediaType, string? MediaUrl, List<string> Options, int TimeLimit, long StartsAt, long EndsAt);
public record LeaderboardEntry(string PlayerId, string Name, int Rank, int PrevRank, int Score, int PrevScore, int Streak);
public record MeView(string Id, string Name, int Score, int Rank, bool Answered, int Choice, bool? Correct, int Points, int Streak);

public record GameState(
    string Code,
    string Phase,
    string Title,
    long ServerNow,
    List<PlayerInfo> Players,
    int QuestionIndex,
    int TotalQuestions,
    QuestionView? Question,
    int AnsweredCount,
    int PlayerCount,
    int? CorrectIndex,
    int[]? OptionCounts,
    List<LeaderboardEntry>? Leaderboard,
    MeView? Me);

public record JoinResult(string? PlayerId, string? Error);

public class GameManager(IHubContext<GameHub> hub, MongoContext mongo, ILogger<GameManager> log)
{
    private readonly ConcurrentDictionary<string, Game> _games = new();

    private static long Ms(DateTime utc) => new DateTimeOffset(utc, TimeSpan.Zero).ToUnixTimeMilliseconds();

    public (string Code, string HostToken) CreateGame(Quiz quiz)
    {
        Prune();
        string code;
        do { code = Random.Shared.Next(100000, 1000000).ToString(); } while (_games.ContainsKey(code));
        var token = Guid.NewGuid().ToString("N");
        _games[code] = new Game { Code = code, HostToken = token, Quiz = quiz };
        return (code, token);
    }

    public bool Exists(string code) => _games.TryGetValue(code, out var g) && g.Phase == Phases.Lobby;

    private void Prune()
    {
        foreach (var (code, g) in _games)
        {
            if (DateTime.UtcNow - g.LastActivity > TimeSpan.FromHours(6) && _games.TryRemove(code, out _))
                g.Timer?.Cancel();
        }
    }

    public async Task<bool> HostConnect(string code, string token, string connection)
    {
        if (!_games.TryGetValue(code, out var g) || g.HostToken != token) return false;
        lock (g.Lock)
        {
            g.HostConnection = connection;
            g.LastActivity = DateTime.UtcNow;
        }
        await Push(g);
        return true;
    }

    public async Task<JoinResult> Join(string code, string name, string connection)
    {
        if (!_games.TryGetValue(code, out var g)) return new(null, "Game not found. Check the code.");
        name = (name ?? "").Trim();
        if (name.Length is < 1 or > 20) return new(null, "Pick a nickname (1-20 characters).");
        Player p;
        lock (g.Lock)
        {
            if (g.Phase != Phases.Lobby) return new(null, "This game has already started.");
            if (g.Players.Values.Any(x => x.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
                return new(null, "That nickname is taken.");
            if (g.Players.Count >= 200) return new(null, "Game is full.");
            p = new Player { Name = name, JoinOrder = g.NextJoinOrder++, Connection = connection };
            g.Players[p.Id] = p;
            g.LastActivity = DateTime.UtcNow;
        }
        await Push(g);
        return new(p.Id, null);
    }

    public async Task<bool> Rejoin(string code, string playerId, string connection)
    {
        if (!_games.TryGetValue(code, out var g)) return false;
        lock (g.Lock)
        {
            if (!g.Players.TryGetValue(playerId, out var p)) return false;
            p.Connection = connection;
        }
        await Push(g);
        return true;
    }

    public async Task SubmitAnswer(string code, string playerId, int choice)
    {
        if (!_games.TryGetValue(code, out var g)) return;
        var allAnswered = false;
        lock (g.Lock)
        {
            if (g.Phase != Phases.Question || !g.Players.TryGetValue(playerId, out var p)) return;
            var q = g.Quiz.Questions[g.Index];
            var now = DateTime.UtcNow;
            if (p.Choice != -1 || choice < 0 || choice >= q.Options.Count || now > g.QuestionEnd.AddMilliseconds(300)) return;
            p.Choice = choice;
            p.AnswerMs = Math.Min((now - g.QuestionStart).TotalMilliseconds, q.TimeLimitSeconds * 1000.0);
            g.LastActivity = now;
            allAnswered = g.Players.Values.All(x => x.Choice != -1);
            if (allAnswered) EndQuestionLocked(g);
        }
        await Push(g);
    }

    public async Task<bool> HostNext(string code, string token)
    {
        if (!_games.TryGetValue(code, out var g) || g.HostToken != token) return false;
        GameResult? finished = null;
        lock (g.Lock)
        {
            g.LastActivity = DateTime.UtcNow;
            switch (g.Phase)
            {
                case Phases.Lobby:
                    if (g.Players.Count == 0) return false;
                    StartQuestionLocked(g, 0);
                    break;
                case Phases.Question:
                    EndQuestionLocked(g);
                    break;
                case Phases.Reveal:
                    g.Phase = Phases.Leaderboard;
                    break;
                case Phases.Leaderboard:
                    if (g.Index + 1 < g.Quiz.Questions.Count) StartQuestionLocked(g, g.Index + 1);
                    else
                    {
                        g.Phase = Phases.Finished;
                        finished = BuildResult(g);
                    }
                    break;
                default:
                    return false;
            }
        }
        await Push(g);
        if (finished is not null) _ = SaveResult(finished);
        return true;
    }

    private async Task SaveResult(GameResult r)
    {
        try { await mongo.GameResults.InsertOneAsync(r); }
        catch (Exception ex) { log.LogWarning(ex, "Could not persist game result {Code}", r.Code); }
    }

    private static GameResult BuildResult(Game g) => new()
    {
        Code = g.Code,
        QuizId = g.Quiz.Id,
        QuizTitle = g.Quiz.Title,
        Players = Ranked(g).Select((p, i) => new PlayerResult { Name = p.Name, Score = p.Score, Rank = i + 1 }).ToList()
    };

    private void StartQuestionLocked(Game g, int index)
    {
        g.Timer?.Cancel();
        g.Index = index;
        g.Phase = Phases.Question;
        foreach (var p in g.Players.Values) { p.Choice = -1; p.LastCorrect = false; p.LastPoints = 0; }
        var q = g.Quiz.Questions[index];
        g.QuestionStart = DateTime.UtcNow.AddMilliseconds(500);
        g.QuestionEnd = g.QuestionStart.AddSeconds(q.TimeLimitSeconds);

        var cts = new CancellationTokenSource();
        g.Timer = cts;
        _ = Task.Run(async () =>
        {
            try { await Task.Delay(g.QuestionEnd - DateTime.UtcNow + TimeSpan.FromMilliseconds(350), cts.Token); }
            catch (OperationCanceledException) { return; }
            var ended = false;
            lock (g.Lock)
            {
                if (g.Phase == Phases.Question && g.Index == index) { EndQuestionLocked(g); ended = true; }
            }
            if (ended) await Push(g);
        });
    }

    private static List<Player> Ranked(Game g) =>
        g.Players.Values.OrderByDescending(p => p.Score).ThenBy(p => p.JoinOrder).ToList();

    private void EndQuestionLocked(Game g)
    {
        g.Timer?.Cancel();
        var q = g.Quiz.Questions[g.Index];
        var ranks = Ranked(g);
        for (var i = 0; i < ranks.Count; i++) ranks[i].PrevRank = i + 1;

        g.OptionCounts = new int[q.Options.Count];
        var limitMs = q.TimeLimitSeconds * 1000.0;
        foreach (var p in g.Players.Values)
        {
            if (p.Choice < 0) { p.Streak = 0; continue; }
            g.OptionCounts[p.Choice]++;
            if (p.Choice == q.CorrectIndex)
            {
                p.Streak++;
                var points = (int)Math.Round(q.Points * (1 - p.AnswerMs / limitMs / 2));
                points += Math.Min(p.Streak - 1, 5) * 50;
                p.LastCorrect = true;
                p.LastPoints = points;
                p.Score += points;
            }
            else p.Streak = 0;
        }
        g.Phase = Phases.Reveal;
    }

    private async Task Push(Game g)
    {
        List<(string Conn, GameState State)> sends = [];
        lock (g.Lock)
        {
            if (g.HostConnection is not null) sends.Add((g.HostConnection, BuildState(g, null)));
            foreach (var p in g.Players.Values.Where(p => p.Connection is not null))
                sends.Add((p.Connection!, BuildState(g, p)));
        }
        await Task.WhenAll(sends.Select(async s =>
        {
            try { await hub.Clients.Client(s.Conn).SendAsync("state", s.State); }
            catch (Exception ex) { log.LogDebug(ex, "Push failed"); }
        }));
    }

    private static GameState BuildState(Game g, Player? me)
    {
        var total = g.Quiz.Questions.Count;
        QuestionView? qv = null;
        if (g.Index >= 0 && g.Phase is Phases.Question or Phases.Reveal)
        {
            var q = g.Quiz.Questions[g.Index];
            qv = new QuestionView(q.Text, q.MediaType, q.MediaUrl, q.Options, q.TimeLimitSeconds, Ms(g.QuestionStart), Ms(g.QuestionEnd));
        }

        var ranked = Ranked(g);
        List<LeaderboardEntry>? board = null;
        if (g.Phase is Phases.Leaderboard or Phases.Finished)
        {
            board = ranked.Select((p, i) => new LeaderboardEntry(
                p.Id, p.Name, i + 1, g.Phase == Phases.Finished ? i + 1 : p.PrevRank,
                p.Score, g.Phase == Phases.Finished ? p.Score : p.Score - p.LastPoints, p.Streak)).ToList();
        }

        MeView? meView = null;
        if (me is not null)
        {
            var revealed = g.Phase is Phases.Reveal or Phases.Leaderboard or Phases.Finished;
            meView = new MeView(me.Id, me.Name, me.Score, ranked.IndexOf(me) + 1,
                me.Choice >= 0, me.Choice, revealed && g.Index >= 0 ? me.LastCorrect : null, me.LastPoints, me.Streak);
        }

        return new GameState(
            g.Code, g.Phase, g.Quiz.Title, Ms(DateTime.UtcNow),
            g.Phase == Phases.Lobby ? g.Players.Values.OrderBy(p => p.JoinOrder).Select(p => new PlayerInfo(p.Id, p.Name)).ToList() : [],
            g.Index, total, qv,
            g.Players.Values.Count(p => p.Choice >= 0), g.Players.Count,
            g.Phase is Phases.Reveal or Phases.Leaderboard && g.Index >= 0 ? g.Quiz.Questions[g.Index].CorrectIndex : null,
            g.Phase is Phases.Reveal ? g.OptionCounts : null,
            board, meView);
    }
}
