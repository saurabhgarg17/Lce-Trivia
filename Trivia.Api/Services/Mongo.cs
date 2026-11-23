using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Trivia.Api.Models;

namespace Trivia.Api.Services;

public class MongoSettings
{
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string Database { get; set; } = "khoot_trivia";
}

public class MongoContext
{
    public IMongoCollection<Quiz> Quizzes { get; }
    public IMongoCollection<GameResult> GameResults { get; }

    public MongoContext(IOptions<MongoSettings> options)
    {
        var s = options.Value;
        var db = new MongoClient(s.ConnectionString).GetDatabase(s.Database);
        Quizzes = db.GetCollection<Quiz>("quizzes");
        GameResults = db.GetCollection<GameResult>("gameResults");
    }
}

public static class QuizValidator
{
    public static string? Validate(Quiz q)
    {
        if (string.IsNullOrWhiteSpace(q.Title)) return "Title is required.";
        if (q.Title.Length > 100) return "Title is too long.";
        if (q.Questions.Count == 0) return "Add at least one question.";
        if (q.Questions.Count > 100) return "Too many questions (max 100).";

        for (var i = 0; i < q.Questions.Count; i++)
        {
            var n = i + 1;
            var x = q.Questions[i];
            if (string.IsNullOrWhiteSpace(x.Text)) return $"Question {n}: text is required.";
            x.Options = (x.Options ?? []).Select(o => (o ?? "").Trim()).ToList();
            if (x.Options.Count < 2 || x.Options.Count > 4) return $"Question {n}: needs 2-4 answer options.";
            if (x.Options.Any(o => o.Length == 0)) return $"Question {n}: answer options cannot be empty.";
            if (x.CorrectIndex < 0 || x.CorrectIndex >= x.Options.Count) return $"Question {n}: choose a correct answer.";
            x.TimeLimitSeconds = Math.Clamp(x.TimeLimitSeconds, 5, 120);
            x.Points = Math.Clamp(x.Points, 0, 2000);
            if (string.IsNullOrWhiteSpace(x.Id)) x.Id = Guid.NewGuid().ToString("N");

            if (!MediaTypes.All.Contains(x.MediaType)) return $"Question {n}: unknown media type.";
            if (x.MediaType == MediaTypes.None)
            {
                x.MediaUrl = null;
                continue;
            }
            if (string.IsNullOrWhiteSpace(x.MediaUrl)) return $"Question {n}: media URL is required.";
            if (x.MediaType == MediaTypes.YouTube)
            {
                var id = ParseYouTubeId(x.MediaUrl);
                if (id is null) return $"Question {n}: invalid YouTube URL.";
                x.MediaUrl = $"https://www.youtube.com/watch?v={id}";
            }
            else if (!(x.MediaUrl.StartsWith("/uploads/") ||
                       Uri.TryCreate(x.MediaUrl, UriKind.Absolute, out var u) &&
                       (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps)))
            {
                return $"Question {n}: invalid media URL.";
            }
        }
        return null;
    }

    public static string? ParseYouTubeId(string url)
    {
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var u)) return null;
        var host = u.Host.ToLowerInvariant();
        string? id = null;
        if (host == "youtu.be") id = u.AbsolutePath.Trim('/').Split('/')[0];
        else if (host.EndsWith("youtube.com") || host.EndsWith("youtube-nocookie.com"))
        {
            var query = System.Web.HttpUtility.ParseQueryString(u.Query);
            id = query["v"];
            if (string.IsNullOrEmpty(id))
            {
                var parts = u.AbsolutePath.Trim('/').Split('/');
                if (parts.Length == 2 && parts[0] is "embed" or "shorts" or "v") id = parts[1];
            }
        }
        return id is { Length: 11 } && id.All(c => char.IsLetterOrDigit(c) || c is '-' or '_') ? id : null;
    }
}
