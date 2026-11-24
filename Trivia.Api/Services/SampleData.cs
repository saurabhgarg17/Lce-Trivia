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
        new Quiz
        {
            Title = "Sample: Artificial Intelligence",
            Description = "A quick introduction to AI, machine learning, and generative AI.",
            Questions =
            [
                Q("What does AI stand for?", ["Automated Internet", "Artificial Intelligence", "Advanced Integration", "Algorithmic Input"], 1, time: 15),
                Q("Which best describes machine learning?", ["Computers learn patterns from data", "Computers repair their own hardware", "People manually write every possible answer", "A computer connects to more websites"], 0),
                Q("What is training data used for?", ["To teach a model patterns from examples", "To measure a computer's screen size", "To encrypt a model's source code", "To connect a model to the internet"], 0),
                Q("What does LLM stand for?", ["Large Language Model", "Linked Learning Machine", "Logical Language Method", "Long-term Memory"], 0, time: 15),
                Q("Which task is an example of computer vision?", ["Identifying objects in a photo", "Translating spoken words into text", "Writing a music playlist", "Sorting files by name"], 0),
                Q("What can generative AI do?", ["Create new text, images, or other content", "Guarantee that every answer is correct", "Replace all computer programs", "Work only when a person types code"], 0),
                Q("What is an AI hallucination?", ["An inaccurate or fabricated output presented as fact", "A model shutting down after a timer", "A computer displaying a blurry image", "A method for backing up training data"], 0),
                Q("What is a sensible way to use AI-generated information?", ["Verify important claims with reliable sources", "Assume it is always up to date", "Share private information to improve every answer", "Use it without checking the results"], 0),
            ]
        },
    ];
}
