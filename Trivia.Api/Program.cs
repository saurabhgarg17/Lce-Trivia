using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using MongoDB.Driver;
using Trivia.Api.Hubs;
using Trivia.Api.Models;
using Trivia.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<MongoSettings>(builder.Configuration.GetSection("Mongo"));
builder.Services.AddSingleton<MongoContext>();
builder.Services.AddSingleton<GameManager>();
builder.Services.AddSignalR();
builder.Services.AddOpenApi();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .SetIsOriginAllowed(_ => true)
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 10 * 1024 * 1024);

var app = builder.Build();

if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.UseCors();

try { await SampleData.SeedAsync(app.Services.GetRequiredService<MongoContext>()); }
catch (Exception ex) { app.Logger.LogWarning(ex, "Could not seed sample trivia (is MongoDB running?)"); }

var uploadsDir = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsDir);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads"
});

var api = app.MapGroup("/api");

// ---- Quizzes ----
api.MapGet("/quizzes", async (MongoContext db) =>
{
    var quizzes = await db.Quizzes.Find(_ => true).SortByDescending(q => q.UpdatedAt).ToListAsync();
    return quizzes.Select(q => new
    {
        q.Id,
        q.Title,
        q.Description,
        QuestionCount = q.Questions.Count,
        CoverUrl = q.Questions.FirstOrDefault(x => x.MediaType is MediaTypes.Image or MediaTypes.Gif)?.MediaUrl,
        q.UpdatedAt
    });
});

api.MapGet("/quizzes/{id}", async (string id, MongoContext db) =>
    await db.Quizzes.Find(q => q.Id == id).FirstOrDefaultAsync() is { } quiz ? Results.Ok(quiz) : Results.NotFound());

api.MapPost("/quizzes", async (Quiz quiz, MongoContext db) =>
{
    if (QuizValidator.Validate(quiz) is { } error) return Results.BadRequest(new { error });
    quiz.Id = null;
    quiz.CreatedAt = quiz.UpdatedAt = DateTime.UtcNow;
    await db.Quizzes.InsertOneAsync(quiz);
    return Results.Created($"/api/quizzes/{quiz.Id}", quiz);
});

api.MapPut("/quizzes/{id}", async (string id, Quiz quiz, MongoContext db) =>
{
    if (QuizValidator.Validate(quiz) is { } error) return Results.BadRequest(new { error });
    var existing = await db.Quizzes.Find(q => q.Id == id).FirstOrDefaultAsync();
    if (existing is null) return Results.NotFound();
    quiz.Id = id;
    quiz.CreatedAt = existing.CreatedAt;
    quiz.UpdatedAt = DateTime.UtcNow;
    await db.Quizzes.ReplaceOneAsync(q => q.Id == id, quiz);
    return Results.Ok(quiz);
});

api.MapDelete("/quizzes/{id}", async (string id, MongoContext db) =>
{
    var r = await db.Quizzes.DeleteOneAsync(q => q.Id == id);
    return r.DeletedCount > 0 ? Results.NoContent() : Results.NotFound();
});

// ---- Games ----
api.MapPost("/games", async (CreateGameRequest req, MongoContext db, GameManager games) =>
{
    var quiz = await db.Quizzes.Find(q => q.Id == req.QuizId).FirstOrDefaultAsync();
    if (quiz is null) return Results.NotFound(new { error = "Quiz not found." });
    var (code, hostToken) = games.CreateGame(quiz);
    return Results.Ok(new { code, hostToken });
});

api.MapGet("/games/{code}", (string code, GameManager games) =>
    games.Exists(code) ? Results.Ok(new { code }) : Results.NotFound(new { error = "Game not found or already started." }));

// ---- Media upload ----
var allowed = new Dictionary<string, string>
{
    [".png"] = MediaTypes.Image, [".jpg"] = MediaTypes.Image, [".jpeg"] = MediaTypes.Image,
    [".webp"] = MediaTypes.Image, [".gif"] = MediaTypes.Gif
};
api.MapPost("/media", async (IFormFile file) =>
{
    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (!allowed.TryGetValue(ext, out var type)) return Results.BadRequest(new { error = "Only png, jpg, webp or gif files are allowed." });
    if (file.Length is 0 or > 8 * 1024 * 1024) return Results.BadRequest(new { error = "File must be under 8 MB." });
    var name = $"{Guid.NewGuid():N}{ext}";
    await using (var fs = File.Create(Path.Combine(uploadsDir, name))) await file.CopyToAsync(fs);
    return Results.Ok(new { url = $"/uploads/{name}", mediaType = type });
}).DisableAntiforgery();

app.MapHub<GameHub>("/hubs/game");

app.Run();

record CreateGameRequest(string QuizId);
