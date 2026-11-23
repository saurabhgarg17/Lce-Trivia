using MongoDB.Driver;
using Trivia.Api.Models;

namespace Trivia.Api.Services;

public static class SampleData
{
    private static Question Q(string text, string[] options, int correct, string media = MediaTypes.None, string? url = null, int time = 20) =>
        new() { Text = text, Options = [.. options], CorrectIndex = correct, MediaType = media, MediaUrl = url, TimeLimitSeconds = time };

    // Each sample is inserted only if no quiz with the same title exists yet.
    public static async Task SeedAsync(MongoContext db)
    {
        foreach (var quiz in Samples())
        {
            if (await db.Quizzes.CountDocumentsAsync(x => x.Title == quiz.Title) == 0)
                await db.Quizzes.InsertOneAsync(quiz);
        }
    }

    private static Quiz[] Samples() =>
    [
        new Quiz
        {
            Title = "Pizza! Pizza! Little Caesars Trivia",
            Description = "How well do you know Little Caesars?",
            Questions =
            [
                Q("In which year was Little Caesars founded?", ["1949", "1959", "1969", "1979"], 1),
                Q("Who founded Little Caesars with his wife Marian?", ["Mike Ilitch", "Tom Monaghan", "Dave Thomas", "Frank Carney"], 0),
                Q("In which U.S. state was the first Little Caesars opened?", ["Ohio", "Illinois", "Michigan", "New York"], 2),
                Q("What is the famous Little Caesars slogan?", ["Pizza! Pizza!", "Hot and Fresh!", "Slice of Life!", "Pie Time!"], 0, time: 15),
                Q("What is the name of Little Caesars' garlic-and-parmesan breadsticks?", ["Garlic Knots", "Crazy Bread", "Cheesy Sticks", "Pizza Fingers"], 1),
                Q("What does the Little Caesars mascot wear?", ["A suit of armor", "A top hat", "A toga", "A chef's apron"], 2, time: 15),
                Q("Which Detroit arena carries the Little Caesars name?", ["Little Caesars Arena", "Pizza Dome", "Caesars Palace", "Motor City Garden"], 0),
                Q("Which popular Little Caesars offer has pizzas ready the moment you walk in?", ["Fast-N-Fresh", "Hot-N-Ready", "Grab-N-Go", "Quick-N-Cheesy"], 1, time: 15),
            ]
        },
        new Quiz
        {
            Title = "Sample: General Knowledge",
            Description = "A quick starter trivia with image, GIF and YouTube questions.",
            Questions =
            [
                Q("Which planet is shown spinning here?", ["Mars", "Earth", "Venus", "Jupiter"], 1, MediaTypes.Gif,
                    "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif"),
                Q("In which city is this famous tower?", ["Rome", "London", "Paris", "Berlin"], 2, MediaTypes.Image,
                    "https://commons.wikimedia.org/wiki/Special:FilePath/Tour_Eiffel_Wikimedia_Commons.jpg?width=640"),
                Q("Who sang this 1987 hit?", ["Rick Astley", "Michael Jackson", "Prince", "George Michael"], 0, MediaTypes.YouTube,
                    "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 30),
                Q("How many continents are there?", ["5", "6", "7", "8"], 2, time: 15),
                Q("What is the largest ocean on Earth?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3),
                Q("Which language runs in a web browser?", ["JavaScript", "C#", "Go", "Rust"], 0, time: 15),
            ]
        },
    ];
}
