using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Trivia.Api.Models;

public static class MediaTypes
{
    public const string None = "none";
    public const string Image = "image";
    public const string Gif = "gif";
    public const string YouTube = "youtube";
    public static readonly string[] All = [None, Image, Gif, YouTube];
}

public class Quiz
{
    [BsonId, BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public List<Question> Questions { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Question
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Text { get; set; } = "";
    public string MediaType { get; set; } = MediaTypes.None;
    public string? MediaUrl { get; set; }
    public List<string> Options { get; set; } = [];
    public int CorrectIndex { get; set; }
    public int TimeLimitSeconds { get; set; } = 20;
    public int Points { get; set; } = 1000;
}

public class GameResult
{
    [BsonId, BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    public string Code { get; set; } = "";
    public string? QuizId { get; set; }
    public string QuizTitle { get; set; } = "";
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;
    public List<PlayerResult> Players { get; set; } = [];
}

public class PlayerResult
{
    public string Name { get; set; } = "";
    public int Score { get; set; }
    public int Rank { get; set; }
}
